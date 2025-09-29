// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// Interfaces for Polygon DeFi Staking Protocols
interface ILiquidStaking {
    function deposit(uint256 _amount) external returns (uint256);
    function withdraw(uint256 _shares) external returns (uint256);
    function getRewards() external view returns (uint256);
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

// Interface for Aave-style protocols
interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

// Interface for Compound-style protocols
interface ICompoundPool {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function exchangeRateStored() external view returns (uint256);
}

// Interface for WMATIC
interface IWMATIC {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
    function balanceOf(address owner) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title PolygonDeFiAggregator
 * @dev DeFi staking aggregator contract for Polygon PoS
 * Enhanced with time-locking features and multi-token support
 */
contract PolygonDeFiAggregator is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    struct TimeLockedStake {
        uint256 amount;
        uint256 shares;
        uint256 startTime;
        uint256 endTime;
        address stakingToken; // Token being staked
        string protocol; // Protocol name
        bool isActive;
        bool isScheduled; // true if start time is in future
    }

    struct UserPosition {
        uint256 totalDeposited;
        uint256 lastActionTime;
        mapping(address => mapping(string => uint256)) tokenProtocolBalances;
        mapping(address => mapping(string => uint256)) tokenProtocolShares;
        TimeLockedStake[] timeLockedStakes;
    }

    struct ProtocolInfo {
        address contractAddress;
        bool isActive;
        uint256 totalDeposited;
        uint256 currentAPY; // in basis points (10000 = 100%)
        string protocolType; // "liquid", "lending", "compound"
        string protocolName;
    }

    struct SupportedToken {
        address tokenAddress;
        string symbol;
        uint8 decimals;
        bool isActive;
    }

    // Constants
    address public WMATIC_ADDRESS;

    // State variables
    mapping(address => SupportedToken) public supportedTokens;
    address[] public supportedTokensList;

    // Protocol management
    mapping(string => ProtocolInfo) public protocols;
    mapping(address => UserPosition) public userPositions;
    string[] public supportedProtocols;

    // Performance tracking
    mapping(address => mapping(string => uint256)) public tokenProtocolTVL;
    mapping(string => uint256) public protocolLastUpdate;
    mapping(address => mapping(string => uint256)) public tokenProtocolTotalShares;

    // Fee system
    uint256 public percentFeeForSystem = 20;

    // Aave Rewards Controller (configurable by owner)
    address public AAVE_REWARDS_CONTROLLER;
    // Aave Reward token (e.g., WMATIC on Polygon) - used for v3 getUserUnclaimedRewards
    address public AAVE_REWARD_TOKEN;

    // Events
    event TokenAdded(address indexed token, string symbol, uint8 decimals);

    event TimeLockedStakeCreated(
        address indexed user,
        uint256 indexed stakeId,
        address indexed token,
        string protocol,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );

    event WithdrawTimeLockedStake(
        address indexed user,
        uint256 indexed stakeId,
        uint256 amount,
        uint256 rewards,
        uint256 timestamp
    );

    event ProtocolAdded(string protocolName, address contractAddress, string protocolType);
    event APYUpdated(string protocolName, uint256 oldAPY, uint256 newAPY);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _wmaticAddress) initializer public {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        WMATIC_ADDRESS = _wmaticAddress;
    }

    // Accept native MATIC
    receive() external payable {}
    fallback() external payable {}

    /**
     * @dev Add supported token
     */
    function addSupportedToken(
        address _tokenAddress,
        string memory _symbol,
        uint8 _decimals
    ) external onlyOwner {
        _addSupportedToken(_tokenAddress, _symbol, _decimals);
    }

    function _addSupportedToken(
        address _tokenAddress,
        string memory _symbol,
        uint8 _decimals
    ) internal {
        require(_tokenAddress != address(0), "Invalid token address");
        require(!supportedTokens[_tokenAddress].isActive, "Token already supported");

        supportedTokens[_tokenAddress] = SupportedToken({
            tokenAddress: _tokenAddress,
            symbol: _symbol,
            decimals: _decimals,
            isActive: true
        });

        supportedTokensList.push(_tokenAddress);
        emit TokenAdded(_tokenAddress, _symbol, _decimals);
    }

    /**
     * @dev Add DeFi protocol
     */
    function addProtocol(
        string memory _name,
        address _contractAddress,
        string memory _protocolType,
        uint256 _initialAPY
    ) external onlyOwner {
        require(_contractAddress != address(0), "Invalid contract address");
        require(!protocols[_name].isActive, "Protocol already exists");
        require(
            keccak256(bytes(_protocolType)) == keccak256(bytes("liquid")) ||
                keccak256(bytes(_protocolType)) == keccak256(bytes("lending")) ||
                keccak256(bytes(_protocolType)) == keccak256(bytes("compound")),
            "Invalid protocol type"
        );

        protocols[_name] = ProtocolInfo({
            contractAddress: _contractAddress,
            isActive: true,
            totalDeposited: 0,
            currentAPY: _initialAPY,
            protocolType: _protocolType,
            protocolName: _name
        });

        supportedProtocols.push(_name);
        protocolLastUpdate[_name] = block.timestamp;

        emit ProtocolAdded(_name, _contractAddress, _protocolType);
    }

    // ===== TIME-LOCKED STAKING FUNCTIONS =====

    /**
     * @dev Create time-locked stake
     * @param _token Token address to stake
     * @param _amount Amount to stake
     * @param _protocol Protocol to stake in
     * @param _lockDuration Lock duration in seconds
     */
    function createTimeLockedStake(
        address _token,
        uint256 _amount,
        string memory _protocol,
        uint256 _lockDuration
    ) external payable nonReentrant whenNotPaused returns (uint256 stakeId) {
        require(_lockDuration >= 1 days, "Minimum lock duration is 1 day");
        require(_lockDuration <= 365 days, "Maximum lock duration is 365 days");

        ProtocolInfo storage protocol = protocols[_protocol];
        require(protocol.isActive, "Protocol not supported");

        uint256 actualAmount;

        // Handle native MATIC staking
        if (_token == WMATIC_ADDRESS && msg.value > 0) {
            require(msg.value > 0, "Cannot stake 0 MATIC");
            require(
                keccak256(bytes(_protocol)) == keccak256(bytes("aave_lending")),
                "Native MATIC only supported for Aave"
            );

            actualAmount = msg.value;

            // Wrap native MATIC to WMATIC
            IWMATIC wmatic = IWMATIC(WMATIC_ADDRESS);
            wmatic.deposit{ value: actualAmount }();
        } else {
            // Handle ERC20 token staking
            require(_amount > 0, "Cannot stake 0");
            require(msg.value == 0, "Don't send MATIC for ERC20 staking");
            require(supportedTokens[_token].isActive, "Token not supported");

            actualAmount = _amount;

            // Transfer tokens from user
            IERC20(_token).safeTransferFrom(msg.sender, address(this), actualAmount);
        }

        // Calculate end time
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + _lockDuration;

        // Approve protocol contract
        IERC20(_token).approve(protocol.contractAddress, actualAmount);

        // Stake to protocol and get shares
        uint256 sharesReceived = _stakeToProtocol(_token, _protocol, actualAmount);

        // Create time-locked stake
        UserPosition storage position = userPositions[msg.sender];
        position.timeLockedStakes.push(
            TimeLockedStake({
                amount: actualAmount,
                shares: sharesReceived,
                startTime: startTime,
                endTime: endTime,
                stakingToken: _token,
                protocol: _protocol,
                isActive: true,
                isScheduled: false
            })
        );

        stakeId = position.timeLockedStakes.length - 1;

        // Update position tracking
        position.totalDeposited += actualAmount;
        position.tokenProtocolBalances[_token][_protocol] += actualAmount;
        position.tokenProtocolShares[_token][_protocol] += sharesReceived;
        position.lastActionTime = block.timestamp;

        // Update protocol stats
        protocol.totalDeposited += actualAmount;
        tokenProtocolTVL[_token][_protocol] += actualAmount;

        emit TimeLockedStakeCreated(
            msg.sender,
            stakeId,
            _token,
            _protocol,
            actualAmount,
            startTime,
            endTime
        );

        return stakeId;
    }

    /**
     * @dev Withdraw time-locked stake
     * @param _stakeId ID of the stake to withdraw
     */
    function withdrawTimeLockedStake(uint256 _stakeId, address systemFeeAddress) external nonReentrant {
        UserPosition storage position = userPositions[msg.sender];
        require(_stakeId < position.timeLockedStakes.length, "Invalid stake ID");

        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];

        ProtocolInfo storage protocol = protocols[stake.protocol];

        // Withdraw from protocol
        uint256 actualWithdrawn = _withdrawFromProtocol(
            stake.stakingToken,
            stake.protocol,
            stake.shares
        );

        // Calculate rewards and ensure we don't lose principal
        uint256 rewards = actualWithdrawn > stake.amount ? actualWithdrawn - stake.amount : 0;
        
        // Safety check: ensure we don't lose principal due to precision loss
        require(actualWithdrawn >= stake.amount, "Withdrawal amount less than principal - precision loss detected");
        
        // Calculate system fee from rewards only (not from principal)
        uint256 systemFeeAmount = 0;
        uint256 remaining = rewards;
        if (rewards > 0 && percentFeeForSystem > 0) {
            systemFeeAmount = (rewards * percentFeeForSystem) / 100; // Direct percentage calculation
            remaining = rewards - systemFeeAmount; // User gets rewards minus fee
        }

        // Update state
        stake.isActive = false;
        position.tokenProtocolBalances[stake.stakingToken][stake.protocol] -= stake.amount;
        position.tokenProtocolShares[stake.stakingToken][stake.protocol] -= stake.shares;
        position.totalDeposited -= stake.amount;

        // Update protocol stats
        protocol.totalDeposited -= stake.amount;
        tokenProtocolTVL[stake.stakingToken][stake.protocol] -= stake.amount;

        // Handle withdrawal - transfer principal and rewards separately for visibility
        if (stake.stakingToken == WMATIC_ADDRESS) {
            IWMATIC wmatic = IWMATIC(WMATIC_ADDRESS);
            
            // Transfer principal amount
            wmatic.withdraw(stake.amount);
            (bool success1, ) = msg.sender.call{value: stake.amount}("");
            require(success1, "Principal MATIC transfer failed");
            
            // Transfer rewards if any
            if (rewards > 0) {
                wmatic.withdraw(remaining);
                (bool success2, ) = msg.sender.call{value: remaining}("");
                require(success2, "Rewards MATIC transfer failed");
            }
            
            // Transfer system fee to specified address if any
            if (systemFeeAmount > 0) {
                wmatic.withdraw(systemFeeAmount);
                (bool success3, ) = systemFeeAddress.call{value: systemFeeAmount}("");
                require(success3, "System fee MATIC transfer failed");
            }
        } else {
            // Transfer principal
            IERC20(stake.stakingToken).safeTransfer(msg.sender, stake.amount);
            
            // Transfer rewards if any
            if (rewards > 0) {
                IERC20(stake.stakingToken).safeTransfer(msg.sender, remaining);
            }
            
            // Transfer system fee to specified address if any
            if (systemFeeAmount > 0) {
                IERC20(stake.stakingToken).safeTransfer(systemFeeAddress, systemFeeAmount);
            }
        }

        // Emit event with actual amounts
        emit WithdrawTimeLockedStake(msg.sender, _stakeId, stake.amount, rewards, block.timestamp);
    }

    /**
     * @dev Internal function to stake to protocol
     */
    function _stakeToProtocol(
        address _token,
        string memory _protocol,
        uint256 _amount
    ) internal returns (uint256 shares) {
        ProtocolInfo storage protocol = protocols[_protocol];

        if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("liquid"))) {
            shares = ILiquidStaking(protocol.contractAddress).deposit(_amount);
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lending"))) {
            // For Aave lending
            address aTokenAddress;
            if (_token == WMATIC_ADDRESS) {
                aTokenAddress = 0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97;
            } else {
                revert("Unsupported token for Aave lending");
            }

            uint256 balanceBefore = IERC20(aTokenAddress).balanceOf(address(this));
            IAavePool(protocol.contractAddress).supply(_token, _amount, address(this), 0);
            uint256 balanceAfter = IERC20(aTokenAddress).balanceOf(address(this));
            shares = balanceAfter - balanceBefore;
            tokenProtocolTotalShares[_token][_protocol] += shares;
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("compound"))) {
            shares = ICompoundPool(protocol.contractAddress).mint(_amount);
        }

        return shares;
    }

    /**
     * @dev Internal function to withdraw from protocol
     */
    function _withdrawFromProtocol(
        address _token,
        string memory _protocol,
        uint256 _shares
    ) internal returns (uint256 amount) {
        ProtocolInfo storage protocol = protocols[_protocol];

        if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("liquid"))) {
            amount = ILiquidStaking(protocol.contractAddress).withdraw(_shares);
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lending"))) {
            // Withdraw from Aave - use type(uint256).max to withdraw all available
            // This prevents precision loss issues with small amounts
            amount = IAavePool(protocol.contractAddress).withdraw(
                _token,
                type(uint256).max, // Withdraw all available (Aave handles the calculation)
                address(this)
            );
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("compound"))) {
            amount = ICompoundPool(protocol.contractAddress).redeem(_shares);
        }

        return amount;
    }

    // ===== VIEW FUNCTIONS =====

    /**
     * @dev Get user's time-locked stakes
     */
    function getUserTimeLockedStakes(
        address _user
    ) external view returns (TimeLockedStake[] memory) {
        return userPositions[_user].timeLockedStakes;
    }

    /**
     * @dev Check if time-locked stake is matured
     */
    function isTimeLockedStakeMatured(
        address _user,
        uint256 _stakeId
    ) external view returns (bool) {
        UserPosition storage position = userPositions[_user];
        if (_stakeId >= position.timeLockedStakes.length) return false;

        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];
        return stake.isActive && !stake.isScheduled && block.timestamp >= stake.endTime;
    }

    /**
     * @dev Get user's total position
     */
    function getUserTotalPosition(
        address _user
    ) external view returns (uint256 totalDeposited, uint256 estimatedValue, uint256 totalRewards) {
        UserPosition storage position = userPositions[_user];
        totalDeposited = position.totalDeposited;

        // Calculate estimated value and rewards
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            address token = supportedTokensList[i];
            for (uint256 j = 0; j < supportedProtocols.length; j++) {
                string memory protocolName = supportedProtocols[j];
                uint256 balance = position.tokenProtocolBalances[token][protocolName];

                if (balance > 0) {
                    estimatedValue += balance;
                    // Add estimated interest
                    uint256 timeElapsed = block.timestamp - protocolLastUpdate[protocolName];
                    uint256 interest = (balance *
                        protocols[protocolName].currentAPY *
                        timeElapsed) / (365 days * 10000);
                    totalRewards += interest;
                }
            }
        }
    }

    /**
     * @dev Get user's position for token and protocol
     */
    function getUserTokenProtocolPosition(
        address _user,
        address _token,
        string memory _protocol
    ) external view returns (uint256 balance, uint256 shares, uint256 estimatedRewards) {
        UserPosition storage position = userPositions[_user];
        balance = position.tokenProtocolBalances[_token][_protocol];
        shares = position.tokenProtocolShares[_token][_protocol];

        if (balance > 0) {
            uint256 timeElapsed = block.timestamp - protocolLastUpdate[_protocol];
            estimatedRewards =
                (balance * protocols[_protocol].currentAPY * timeElapsed) / (365 days * 10000);
        }
    }

    /**
     * @dev Get all protocols
     */
    function getAllProtocols()
        external
        view
        returns (string[] memory names, uint256[] memory apys, bool[] memory activeStatus)
    {
        uint256 length = supportedProtocols.length;
        names = new string[](length);
        apys = new uint256[](length);
        activeStatus = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            string memory name = supportedProtocols[i];
            names[i] = name;
            apys[i] = protocols[name].currentAPY;
            activeStatus[i] = protocols[name].isActive;
        }
    }

    /**
     * @dev Get all supported tokens
     */
    function getAllSupportedTokens()
        external
        view
        returns (
            address[] memory addresses,
            string[] memory symbols,
            uint8[] memory decimals,
            bool[] memory activeStatus
        )
    {
        uint256 length = supportedTokensList.length;
        addresses = new address[](length);
        symbols = new string[](length);
        decimals = new uint8[](length);
        activeStatus = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            address tokenAddr = supportedTokensList[i];
            SupportedToken storage token = supportedTokens[tokenAddr];
            addresses[i] = tokenAddr;
            symbols[i] = token.symbol;
            decimals[i] = token.decimals;
            activeStatus[i] = token.isActive;
        }
    }

    /**
     * @dev Get system fee information
     */
    function getSystemFeeInfo() external view returns (uint256 feePercent, uint256 feeInBasisPoints) {
        return (percentFeeForSystem, percentFeeForSystem);
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @dev Update protocol APY
     */
    function updateProtocolAPY(string memory _protocol, uint256 _newAPY) external onlyOwner {
        require(protocols[_protocol].isActive, "Protocol not found");
        uint256 oldAPY = protocols[_protocol].currentAPY;
        protocols[_protocol].currentAPY = _newAPY;
        protocolLastUpdate[_protocol] = block.timestamp;

        emit APYUpdated(_protocol, oldAPY, _newAPY);
    }

    /**
     * @dev Set token status
     */
    function setTokenStatus(address _token, bool _isActive) external onlyOwner {
        require(supportedTokens[_token].tokenAddress != address(0), "Token not found");
        supportedTokens[_token].isActive = _isActive;
    }

    /**
     * @dev Emergency functions
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setProtocolStatus(string memory _protocol, bool _isActive) external onlyOwner {
        protocols[_protocol].isActive = _isActive;
    }

    /**
     * @dev Set system fee percentage
     * @param _percentFee New fee percentage (0-100 basis points)
     */
    function setPercentFeeForSystem(uint256 _percentFee) external onlyOwner {
        require(_percentFee >= 0 && _percentFee <= 100, "Fee must be between 0 and 100 basis points");
        
        uint256 oldFee = percentFeeForSystem;
        percentFeeForSystem = _percentFee;
        
        emit FeeUpdated(oldFee, _percentFee);
    }

    function emergencyWithdraw(address _token) external onlyOwner {
        IERC20 token = IERC20(_token);
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.safeTransfer(owner(), balance);
        }
    }

    /**
     * @dev Authorize upgrade (only owner)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Storage gap for future upgrades
    uint256[50] private __gap;
}