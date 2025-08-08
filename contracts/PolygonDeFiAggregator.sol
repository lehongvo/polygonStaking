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
    function claimRewards() external;
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

// Interface cho QuickSwap/SushiSwap LP staking
interface ILPStaking {
    function stake(uint256 _amount) external;
    function unstake(uint256 _amount) external;
    function claim() external;
    function earned(address account) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

// Interface cho Compound-style protocols
interface ICompoundPool {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function exchangeRateStored() external view returns (uint256);
}

// Interface cho WMATIC (Wrapped MATIC)
interface IWMATIC {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title PolygonDeFiAggregator
 * @dev Contract trung gian để tương tác với các DeFi staking protocols trên Polygon PoS
 * Enhanced với time-locking features và multi-token support
 */
contract PolygonDeFiAggregator is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    address public constant WMATIC_ADDRESS = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;

    struct TimeLockedStake {
        uint256 amount;
        uint256 shares;
        uint256 startTime;
        uint256 endTime;
        uint256 lastClaimTime;
        address stakingToken; // Token được stake (TTJP, POL, etc.)
        string protocol; // Protocol name (ankr, aave, etc.)
        bool isActive;
        bool isScheduled; // true if start time is in future
    }

    struct UserPosition {
        uint256 totalDeposited;
        uint256 totalClaimed;
        uint256 lastActionTime;
        mapping(address => mapping(string => uint256)) tokenProtocolBalances; // token => protocol => balance
        mapping(address => mapping(string => uint256)) tokenProtocolShares; // token => protocol => shares
        TimeLockedStake[] timeLockedStakes; // Array of time-locked stakes
    }

    struct ProtocolInfo {
        address contractAddress;
        address rewardToken;
        bool isActive;
        uint256 totalDeposited;
        uint256 currentAPY; // in basis points (10000 = 100%)
        string protocolType; // "liquid", "lending", "lp", "compound"
        string protocolName;
    }

    struct SupportedToken {
        address tokenAddress;
        string symbol;
        uint8 decimals;
        bool isActive;
    }

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

    // Events
    event TokenAdded(address indexed token, string symbol, uint8 decimals);
    event Staked(
        address indexed user,
        address indexed token,
        string protocol,
        uint256 amount,
        uint256 timestamp
    );
    event TimeLockedStakeCreated(
        address indexed user,
        uint256 indexed stakeId,
        address indexed token,
        string protocol,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );
    event ScheduledStakeExecuted(address indexed user, uint256 indexed stakeId, uint256 timestamp);
    event WithdrawnImmediately(
        address indexed user,
        address indexed token,
        string protocol,
        uint256 amount,
        uint256 timestamp
    );
    event WithdrawnMature(
        address indexed user,
        uint256 indexed stakeId,
        uint256 amount,
        uint256 rewards,
        uint256 timestamp
    );
    event RewardsClaimed(
        address indexed user,
        address indexed token,
        string protocol,
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
        address _rewardToken,
        string memory _protocolType,
        uint256 _initialAPY
    ) external onlyOwner {
        require(_contractAddress != address(0), "Invalid contract address");
        require(!protocols[_name].isActive, "Protocol already exists");
        require(
            keccak256(bytes(_protocolType)) == keccak256(bytes("liquid")) ||
                keccak256(bytes(_protocolType)) == keccak256(bytes("lending")) ||
                keccak256(bytes(_protocolType)) == keccak256(bytes("lp")) ||
                keccak256(bytes(_protocolType)) == keccak256(bytes("compound")),
            "Invalid protocol type"
        );

        protocols[_name] = ProtocolInfo({
            contractAddress: _contractAddress,
            rewardToken: _rewardToken,
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
     * @dev Create time-locked stake with custom start and end time
     * @param _token Token address to stake (TTJP, POL, etc.)
     * @param _amount Amount to stake
     * @param _protocol Protocol to stake in
     * @param _startTime When to start staking (can be future)
     * @param _lockDuration How long to lock (in seconds)
     */
    function createTimeLockedStake(
        address _token,
        uint256 _amount,
        string memory _protocol,
        uint256 _startTime,
        uint256 _lockDuration
    ) external nonReentrant whenNotPaused {
        require(_amount > 0, "Cannot stake 0");
        require(_lockDuration >= 1 days, "Minimum lock duration is 1 day");
        require(_lockDuration <= 365 days, "Maximum lock duration is 365 days");
        require(_startTime >= block.timestamp, "Start time cannot be in the past");

        // Check if token is supported
        require(supportedTokens[_token].isActive, "Token not supported");

        ProtocolInfo storage protocol = protocols[_protocol];
        require(protocol.isActive, "Protocol not supported");

        // Transfer tokens from user
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 endTime = _startTime + _lockDuration;
        bool isScheduled = _startTime > block.timestamp;

        // Create time-locked stake
        UserPosition storage position = userPositions[msg.sender];
        position.timeLockedStakes.push(
            TimeLockedStake({
                amount: _amount,
                shares: 0, // Will be set when actually staked
                startTime: _startTime,
                endTime: endTime,
                lastClaimTime: _startTime,
                stakingToken: _token,
                protocol: _protocol,
                isActive: true,
                isScheduled: isScheduled
            })
        );

        uint256 stakeId = position.timeLockedStakes.length - 1;

        // If start time is now, execute immediately
        if (!isScheduled) {
            _executeStake(msg.sender, stakeId);
        }

        emit TimeLockedStakeCreated(
            msg.sender,
            stakeId,
            _token,
            _protocol,
            _amount,
            _startTime,
            endTime
        );
    }

    /**
     * @dev Execute scheduled stake when start time arrives
     */
    function executeScheduledStake(uint256 _stakeId) external nonReentrant {
        UserPosition storage position = userPositions[msg.sender];
        require(_stakeId < position.timeLockedStakes.length, "Invalid stake ID");

        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];
        require(stake.isActive, "Stake not active");
        require(stake.isScheduled, "Stake already executed");
        require(block.timestamp >= stake.startTime, "Start time not reached");

        _executeStake(msg.sender, _stakeId);

        emit ScheduledStakeExecuted(msg.sender, _stakeId, block.timestamp);
    }

    /**
     * @dev Internal function to execute staking
     */
    function _executeStake(address _user, uint256 _stakeId) internal {
        UserPosition storage position = userPositions[_user];
        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];

        ProtocolInfo storage protocol = protocols[stake.protocol];

        // Approve protocol contract
        IERC20(stake.stakingToken).approve(protocol.contractAddress, stake.amount);

        // Stake to protocol and get shares
        uint256 sharesReceived = _stakeToProtocol(stake.stakingToken, stake.protocol, stake.amount);
        stake.shares = sharesReceived;
        stake.isScheduled = false;

        // Update position tracking
        position.totalDeposited += stake.amount;
        position.tokenProtocolBalances[stake.stakingToken][stake.protocol] += stake.amount;
        position.tokenProtocolShares[stake.stakingToken][stake.protocol] += sharesReceived;
        position.lastActionTime = block.timestamp;

        // Update protocol stats
        protocol.totalDeposited += stake.amount;
        tokenProtocolTVL[stake.stakingToken][stake.protocol] += stake.amount;
    }

    /**
     * @dev Withdraw time-locked stake when matured (full amount + rewards)
     */
    function withdrawTimeLockedStake(uint256 _stakeId) external nonReentrant {
        UserPosition storage position = userPositions[msg.sender];
        require(_stakeId < position.timeLockedStakes.length, "Invalid stake ID");

        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];
        require(stake.isActive, "Stake not active");
        require(!stake.isScheduled, "Stake not yet executed");
        require(block.timestamp >= stake.endTime, "Stake not yet matured");

        ProtocolInfo storage protocol = protocols[stake.protocol];

        // Withdraw from protocol
        uint256 actualWithdrawn = _withdrawFromProtocol(
            stake.stakingToken,
            stake.protocol,
            stake.shares
        );

        // Calculate rewards
        uint256 rewards = actualWithdrawn > stake.amount ? actualWithdrawn - stake.amount : 0;

        // Update state
        stake.isActive = false;
        position.tokenProtocolBalances[stake.stakingToken][stake.protocol] -= stake.amount;
        position.tokenProtocolShares[stake.stakingToken][stake.protocol] -= stake.shares;
        position.totalDeposited -= stake.amount;
        position.totalClaimed += rewards;

        // Update protocol stats
        protocol.totalDeposited -= stake.amount;
        tokenProtocolTVL[stake.stakingToken][stake.protocol] -= stake.amount;

        // Transfer tokens
        IERC20(stake.stakingToken).safeTransfer(msg.sender, actualWithdrawn);

        emit WithdrawnMature(msg.sender, _stakeId, stake.amount, rewards, block.timestamp);
    }

    /**
     * @dev Withdraw time-locked stake early (with penalty)
     */
    function withdrawTimeLockedStakeEarly(uint256 _stakeId) external nonReentrant {
        UserPosition storage position = userPositions[msg.sender];
        require(_stakeId < position.timeLockedStakes.length, "Invalid stake ID");

        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];
        require(stake.isActive, "Stake not active");
        require(!stake.isScheduled, "Stake not yet executed");
        require(
            block.timestamp < stake.endTime,
            "Stake already matured, use withdrawTimeLockedStake"
        );

        ProtocolInfo storage protocol = protocols[stake.protocol];

        // Withdraw from protocol
        uint256 actualWithdrawn = _withdrawFromProtocol(
            stake.stakingToken,
            stake.protocol,
            stake.shares
        );

        // Apply early withdrawal penalty (5%)
        uint256 penalty = (actualWithdrawn * 500) / 10000;
        uint256 finalAmount = actualWithdrawn - penalty;

        // Update state
        stake.isActive = false;
        position.tokenProtocolBalances[stake.stakingToken][stake.protocol] -= stake.amount;
        position.tokenProtocolShares[stake.stakingToken][stake.protocol] -= stake.shares;
        position.totalDeposited -= stake.amount;

        // Update protocol stats
        protocol.totalDeposited -= stake.amount;
        tokenProtocolTVL[stake.stakingToken][stake.protocol] -= stake.amount;

        // Transfer tokens (minus penalty)
        IERC20(stake.stakingToken).safeTransfer(msg.sender, finalAmount);

        emit WithdrawnImmediately(
            msg.sender,
            stake.stakingToken,
            stake.protocol,
            finalAmount,
            block.timestamp
        );
    }

    // ===== ORIGINAL FUNCTIONS (for backward compatibility) =====

    /**
    /**
     * @dev Stake tokens through specified DeFi protocol (immediate, no time lock)
     * Enhanced to support native MATIC staking when _token is WMATIC
     * @param _token Token address to stake (use WMATIC_ADDRESS for native MATIC)
     * @param _amount Amount to stake (ignored if sending native MATIC)
     * @param _protocol Protocol to stake in
     */
    function stake(
        address _token,
        uint256 _amount,
        string memory _protocol
    ) external payable nonReentrant whenNotPaused {
        ProtocolInfo storage protocol = protocols[_protocol];
        require(protocol.isActive, "Protocol not supported");

        uint256 actualAmount;

        // Handle native MATIC staking (when _token is WMATIC and msg.value > 0)
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

        // Update user position
        UserPosition storage position = userPositions[msg.sender];
        position.totalDeposited += actualAmount;
        position.tokenProtocolBalances[_token][_protocol] += actualAmount;
        position.lastActionTime = block.timestamp;

        // Approve protocol contract
        IERC20(_token).approve(protocol.contractAddress, actualAmount);

        // Stake based on protocol type
        uint256 sharesReceived = _stakeToProtocol(_token, _protocol, actualAmount);
        position.tokenProtocolShares[_token][_protocol] += sharesReceived;

        // Update protocol stats
        protocol.totalDeposited += actualAmount;
        tokenProtocolTVL[_token][_protocol] += actualAmount;

        emit Staked(msg.sender, _token, _protocol, actualAmount, block.timestamp);
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
            IAavePool(protocol.contractAddress).supply(_token, _amount, address(this), 0);
            shares = _amount; // 1:1 for simplicity
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lp"))) {
            ILPStaking(protocol.contractAddress).stake(_amount);
            shares = _amount; // 1:1 for simplicity
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("compound"))) {
            shares = ICompoundPool(protocol.contractAddress).mint(_amount);
        }

        return shares;
    }

    /**
     * @dev Withdraw immediately from protocol
     */
    function withdrawImmediately(
        address _token,
        uint256 _amount,
        string memory _protocol
    ) external nonReentrant {
        require(_amount > 0, "Cannot withdraw 0");
        require(supportedTokens[_token].isActive, "Token not supported");

        ProtocolInfo storage protocol = protocols[_protocol];
        require(protocol.isActive, "Protocol not supported");

        UserPosition storage position = userPositions[msg.sender];
        require(
            position.tokenProtocolBalances[_token][_protocol] >= _amount,
            "Insufficient balance"
        );

        // Calculate shares to withdraw
        uint256 totalShares = position.tokenProtocolShares[_token][_protocol];
        uint256 totalBalance = position.tokenProtocolBalances[_token][_protocol];
        require(totalBalance > 0, "No balance to withdraw");
        uint256 sharesToWithdraw = (totalShares * _amount) / totalBalance;

        // Withdraw from protocol
        uint256 actualWithdrawn = _withdrawFromProtocol(_token, _protocol, sharesToWithdraw);

        // Apply early withdrawal penalty if less than 7 days
        uint256 finalAmount = actualWithdrawn;
        if (block.timestamp < position.lastActionTime + 7 days) {
            uint256 penalty = (actualWithdrawn * 200) / 10000; // 2% penalty
            finalAmount = actualWithdrawn - penalty;
            // Keep penalty in contract as protocol boost
        }

        // Update user position
        position.tokenProtocolBalances[_token][_protocol] -= _amount;
        position.tokenProtocolShares[_token][_protocol] -= sharesToWithdraw;
        position.totalDeposited -= _amount;

        // Update protocol stats
        protocol.totalDeposited -= _amount;
        tokenProtocolTVL[_token][_protocol] -= _amount;

        IERC20(_token).safeTransfer(msg.sender, finalAmount);

        emit WithdrawnImmediately(msg.sender, _token, _protocol, finalAmount, block.timestamp);
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
            amount = IAavePool(protocol.contractAddress).withdraw(_token, _shares, address(this));
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lp"))) {
            ILPStaking(protocol.contractAddress).unstake(_shares);
            amount = _shares; // 1:1 for simplicity
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("compound"))) {
            amount = ICompoundPool(protocol.contractAddress).redeem(_shares);
        }

        return amount;
    }

    /**
     * @dev Claim rewards from all protocols for a specific token
     */
    function claim(address _token) external nonReentrant {
        require(supportedTokens[_token].isActive, "Token not supported");

        uint256 totalRewards = 0;

        for (uint256 i = 0; i < supportedProtocols.length; i++) {
            string memory protocolName = supportedProtocols[i];
            ProtocolInfo storage protocol = protocols[protocolName];

            if (userPositions[msg.sender].tokenProtocolBalances[_token][protocolName] > 0) {
                uint256 rewards = _claimFromProtocol(_token, protocolName);
                if (rewards > 0) {
                    totalRewards += rewards;
                    emit RewardsClaimed(msg.sender, _token, protocolName, rewards, block.timestamp);
                }
            }
        }

        if (totalRewards > 0) {
            userPositions[msg.sender].totalClaimed += totalRewards;

            // Transfer rewards (could be same token or reward token)
            IERC20(_token).safeTransfer(msg.sender, totalRewards);
        }
    }

    /**
     * @dev Internal function to claim from specific protocol
     */
    function _claimFromProtocol(
        address _token,
        string memory _protocol
    ) internal returns (uint256 rewards) {
        ProtocolInfo storage protocol = protocols[_protocol];

        // Get rewards before claiming to track the amount
        uint256 balanceBefore = IERC20(_token).balanceOf(address(this));

        if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("liquid"))) {
            try ILiquidStaking(protocol.contractAddress).claimRewards() {
                rewards = IERC20(_token).balanceOf(address(this)) - balanceBefore;
            } catch {
                rewards = 0;
            }
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lp"))) {
            try ILPStaking(protocol.contractAddress).claim() {
                rewards = IERC20(_token).balanceOf(address(this)) - balanceBefore;
            } catch {
                rewards = 0;
            }
        } else {
            // For lending and compound protocols, rewards might be auto-compounded
            rewards = 0;
        }

        return rewards;
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

    /**
     * @dev Get pending scheduled stakes that can be executed
     */
    function getPendingScheduledStakes(address _user) external view returns (uint256[] memory) {
        UserPosition storage position = userPositions[_user];
        uint256[] memory temp = new uint256[](position.timeLockedStakes.length);
        uint256 count = 0;

        for (uint256 i = 0; i < position.timeLockedStakes.length; i++) {
            TimeLockedStake storage stake = position.timeLockedStakes[i];
            if (stake.isActive && stake.isScheduled && block.timestamp >= stake.startTime) {
                temp[count] = i;
                count++;
            }
        }

        // Create properly sized array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }

        return result;
    }

    // ===== ORIGINAL VIEW FUNCTIONS =====

    /**
     * @dev Get user's total position across all tokens and protocols
     */
    function getUserTotalPosition(
        address _user
    )
        external
        view
        returns (
            uint256 totalDeposited,
            uint256 totalClaimed,
            uint256 estimatedValue,
            uint256 totalRewards
        )
    {
        UserPosition storage position = userPositions[_user];
        totalDeposited = position.totalDeposited;
        totalClaimed = position.totalClaimed;

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
