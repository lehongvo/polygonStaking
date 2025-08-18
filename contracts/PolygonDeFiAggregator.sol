// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Interface cho Polygon DeFi Staking Protocols
interface ILiquidStaking {
    function deposit(uint256 _amount) external returns (uint256);
    function withdraw(uint256 _shares) external returns (uint256);
    function getRewards() external view returns (uint256);
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

// Interface cho Aave-style protocols
interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

// Interface cho Compound-style protocols
interface ICompoundPool {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function exchangeRateStored() external view returns (uint256);
}

// Interface cho WMATIC
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
 * @dev Contract trung gian để tương tác với các DeFi staking protocols trên Polygon PoS
 * Enhanced với time-locking features và multi-token support
 */
contract PolygonDeFiAggregator is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct TimeLockedStake {
        uint256 amount;
        uint256 shares;
        uint256 startTime;
        uint256 endTime;
        address stakingToken; // Token được stake (TTJP, POL, etc.)
        string protocol; // Protocol name (ankr, aave, etc.)
        bool isActive;
        bool isScheduled; // true if start time is in future
    }

    struct UserPosition {
        uint256 totalDeposited;
        uint256 lastActionTime;
        mapping(address => mapping(string => uint256)) tokenProtocolBalances; // token => protocol => balance
        mapping(address => mapping(string => uint256)) tokenProtocolShares; // token => protocol => shares
        TimeLockedStake[] timeLockedStakes; // Array of time-locked stakes
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
    address public constant WMATIC_ADDRESS = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;

    // State variables
    mapping(address => SupportedToken) public supportedTokens;
    address[] public supportedTokensList;

    // Protocol management
    mapping(string => ProtocolInfo) public protocols;
    mapping(address => UserPosition) public userPositions;
    string[] public supportedProtocols;

    // Performance tracking
    mapping(address => mapping(string => uint256)) public tokenProtocolTVL; // token => protocol => TVL
    mapping(string => uint256) public protocolLastUpdate;
    // Aggregate shares for interest-bearing protocols (e.g., Aave aTokens)
    mapping(address => mapping(string => uint256)) public tokenProtocolTotalShares; // token => protocol => total minted shares

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

    constructor() Ownable(msg.sender) {}

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
     * @dev Create time-locked stake (immediate execution)
     * @param _token Token address to stake (TTJP, POL, etc.)
     * @param _amount Amount to stake
     * @param _protocol Protocol to stake in
     * @param _lockDuration How long to lock (in seconds)
     */
    function createTimeLockedStake(
        address _token,
        uint256 _amount,
        string memory _protocol,
        uint256 _lockDuration
    ) external payable nonReentrant whenNotPaused {
        require(_lockDuration >= 1 days, "Minimum lock duration is 1 day");
        require(_lockDuration <= 365 days, "Maximum lock duration is 365 days");

        ProtocolInfo storage protocol = protocols[_protocol];
        require(protocol.isActive, "Protocol not supported");

        uint256 actualAmount;

        // Handle native MATIC staking (wrap to WMATIC)
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
            // Handle regular ERC20 token staking
            require(_amount > 0, "Cannot stake 0");
            require(msg.value == 0, "Don't send MATIC for ERC20 staking");
            require(supportedTokens[_token].isActive, "Token not supported");

            actualAmount = _amount;

            // Transfer tokens from user
            IERC20(_token).safeTransferFrom(msg.sender, address(this), actualAmount);
        }

        // Calculate end time (start immediately)
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
                isScheduled: false // Always executed immediately
            })
        );

        uint256 stakeId = position.timeLockedStakes.length - 1;

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
    }

    /**
     * @dev Withdraw time-locked stake (always 100% return)
     * @param _stakeId ID of the stake to withdraw
     *
     * Logic:
     * - User ALWAYS gets 100% of actualWithdrawn (principal + rewards)
     * - No penalty whether withdrawn early or at maturity
     * - Flexible withdrawal anytime after stake execution
     */
    function withdrawTimeLockedStake(uint256 _stakeId) external nonReentrant {
        UserPosition storage position = userPositions[msg.sender];
        require(_stakeId < position.timeLockedStakes.length, "Invalid stake ID");

        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];
        require(stake.isActive, "Stake not active");
        require(!stake.isScheduled, "Stake not yet executed");

        ProtocolInfo storage protocol = protocols[stake.protocol];

        // Withdraw from protocol (gets principal + rewards)
        uint256 actualWithdrawn = _withdrawFromProtocol(
            stake.stakingToken,
            stake.protocol,
            stake.shares
        );

        // Calculate rewards
        uint256 rewards = actualWithdrawn > stake.amount ? actualWithdrawn - stake.amount : 0;

        // User always gets 100% of actualWithdrawn (principal + rewards)
        uint256 finalAmount = actualWithdrawn;

        // Update state
        stake.isActive = false;
        position.tokenProtocolBalances[stake.stakingToken][stake.protocol] -= stake.amount;
        position.tokenProtocolShares[stake.stakingToken][stake.protocol] -= stake.shares;
        position.totalDeposited -= stake.amount;

        // Update protocol stats
        protocol.totalDeposited -= stake.amount;
        tokenProtocolTVL[stake.stakingToken][stake.protocol] -= stake.amount;

        // Handle withdrawal based on token type
        if (stake.stakingToken == WMATIC_ADDRESS) {
            // Unwrap WMATIC to native MATIC and send to user
            IWMATIC wmatic = IWMATIC(WMATIC_ADDRESS);
            wmatic.withdraw(finalAmount);
            (bool success, ) = msg.sender.call{value: finalAmount}("");
            require(success, "MATIC transfer failed");
        } else {
            IERC20(stake.stakingToken).safeTransfer(msg.sender, finalAmount);
        }

        // Emit withdrawal event
        emit WithdrawTimeLockedStake(msg.sender, _stakeId, stake.amount, rewards, block.timestamp);
    }

    /**
     * @dev Internal function to stake to specific protocol
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
            // For Aave lending, compute shares from actual aToken balance received
            address aTokenAddress;
            if (_token == WMATIC_ADDRESS) {
                aTokenAddress = 0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97; // aPolWM
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
     * @dev Internal function to withdraw from specific protocol
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
            // For Aave lending, withdraw proportional underlying to include rewards
            address aTokenAddress;
            if (_token == WMATIC_ADDRESS) {
                aTokenAddress = 0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97; // aPolWM
            } else {
                revert("Unsupported token for Aave lending");
            }

            uint256 currentATokenBalance = IERC20(aTokenAddress).balanceOf(address(this));
            uint256 totalShares = tokenProtocolTotalShares[_token][_protocol];
            require(totalShares > 0, "No shares to withdraw");

            uint256 underlyingToWithdraw = (currentATokenBalance * _shares) / totalShares;
            amount = IAavePool(protocol.contractAddress).withdraw(_token, underlyingToWithdraw, address(this));
            tokenProtocolTotalShares[_token][_protocol] -= _shares;
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("compound"))) {
            amount = ICompoundPool(protocol.contractAddress).redeem(_shares);
        }

        return amount;
    }

    // ===== TIME-LOCKED VIEW FUNCTIONS =====

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

    // ===== ORIGINAL VIEW FUNCTIONS =====

    /**
     * @dev Get user's total position across all tokens and protocols
     */
    function getUserTotalPosition(
        address _user
    ) external view returns (uint256 totalDeposited, uint256 estimatedValue, uint256 totalRewards) {
        UserPosition storage position = userPositions[_user];
        totalDeposited = position.totalDeposited;

        // Calculate estimated current value and pending rewards
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            address token = supportedTokensList[i];
            for (uint256 j = 0; j < supportedProtocols.length; j++) {
                string memory protocolName = supportedProtocols[j];
                uint256 balance = position.tokenProtocolBalances[token][protocolName];

                if (balance > 0) {
                    estimatedValue += balance;
                    // Add estimated accrued interest based on APY and time
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
     * @dev Get user's position in specific token and protocol
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
     * @dev Get all protocols with stats
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

    // ===== ADMIN FUNCTIONS =====

    /**
     * @dev Update protocol APY (only owner)
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

    function emergencyWithdraw(address _token) external onlyOwner {
        IERC20 token = IERC20(_token);
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.safeTransfer(owner(), balance);
        }
    }
}
