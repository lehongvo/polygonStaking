// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ==== custom errors (auto) ====
error InvalidProtocolType();
error NativeMaticOnlySupportedForAave();
error FeeMustBeBetween0And100BasisPoints();
error InvalidTokenAddress();
error TokenAlreadySupported();
error InvalidContractAddress();
error ProtocolAlreadyExists();
error MinimumLockDurationIs1Day();
error MaximumLockDurationIs365Days();
error ProtocolNotSupported();
error CannotStake0Matic();
error CannotStake0();
error DonTSendMaticForErc20Staking();
error TokenNotSupported();
error InvalidStakeId();
error PrincipalMaticTransferFailed();
error RewardsMaticTransferFailed();
error SystemFeeMaticTransferFailed();
error ProtocolNotFound();
error TokenNotFound();
error AtokenAddressNotFoundForThisToken();
error StakeNotActive();
error StakeNotMatured();
error InvalidFeeRecipient();

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
contract PolygonDeFiAggregator is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
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

    // CHALLENGE-2697: governed system-fee recipient. Was previously a caller-supplied parameter
    // on withdrawTimeLockedStake, letting the withdrawer redirect the fee anywhere.
    address public systemFeeAddress;

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
    event SystemFeeAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _wmaticAddress) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        WMATIC_ADDRESS = _wmaticAddress;
        // CHALLENGE-2697: default the governed fee recipient to the owner so it's never
        // address(0); the owner can repoint it later via setSystemFeeAddress.
        systemFeeAddress = initialOwner;
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
        if (!(_tokenAddress != address(0))) revert InvalidTokenAddress();
        if (!(!supportedTokens[_tokenAddress].isActive)) revert TokenAlreadySupported();
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
        if (!(_contractAddress != address(0))) revert InvalidContractAddress();
        if (!(!protocols[_name].isActive)) revert ProtocolAlreadyExists();
        if (!(keccak256(bytes(_protocolType)) == keccak256(bytes("liquid")) || keccak256(bytes(_protocolType)) == keccak256(bytes("lending")) || keccak256(bytes(_protocolType)) == keccak256(bytes("compound")))) revert InvalidProtocolType();

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
        if (!(_lockDuration >= 1 days)) revert MinimumLockDurationIs1Day();
        if (!(_lockDuration <= 365 days)) revert MaximumLockDurationIs365Days();
        ProtocolInfo storage protocol = protocols[_protocol];
        if (!(protocol.isActive)) revert ProtocolNotSupported();
        uint256 actualAmount;

        // Handle native MATIC staking
        if (_token == WMATIC_ADDRESS && msg.value > 0) {
            if (!(msg.value > 0)) revert CannotStake0Matic();
            if (!(keccak256(bytes(_protocol)) == keccak256(bytes("aave_lending")))) revert NativeMaticOnlySupportedForAave();

            actualAmount = msg.value;

            // Wrap native MATIC to WMATIC
            IWMATIC wmatic = IWMATIC(WMATIC_ADDRESS);
            wmatic.deposit{ value: actualAmount }();
        } else {
            // Handle ERC20 token staking
            if (!(_amount > 0)) revert CannotStake0();
            if (!(msg.value == 0)) revert DonTSendMaticForErc20Staking();
            if (!(supportedTokens[_token].isActive)) revert TokenNotSupported();
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
     * @dev Withdraw time-locked stake.
     * CHALLENGE-2697: the fee recipient is now the governed `systemFeeAddress` (set only by the
     * owner) instead of a caller-supplied parameter -- the withdrawer could previously redirect
     * the system fee anywhere. Also now requires the stake to still be active and matured, and
     * applies ALL state effects (isActive=false, balance/shares/TVL updates) BEFORE the protocol
     * withdrawal and token transfers (CEI) -- the isActive check + early flip to false is what
     * rejects a second withdrawal of the same stake.
     * @param _stakeId ID of the stake to withdraw
     */
    function withdrawTimeLockedStake(uint256 _stakeId) external nonReentrant {
        UserPosition storage position = userPositions[msg.sender];
        if (!(_stakeId < position.timeLockedStakes.length)) revert InvalidStakeId();
        TimeLockedStake storage stake = position.timeLockedStakes[_stakeId];

        if (!(stake.isActive)) revert StakeNotActive();
        if (!(block.timestamp >= stake.endTime)) revert StakeNotMatured();

        ProtocolInfo storage protocol = protocols[stake.protocol];

        // Snapshot what the external calls below need, then apply every state effect BEFORE
        // any external interaction (protocol withdrawal + token transfers) -- CEI.
        address stakingToken = stake.stakingToken;
        string memory protocolName = stake.protocol;
        uint256 stakeAmount = stake.amount;
        uint256 stakeShares = stake.shares;

        stake.isActive = false;
        position.tokenProtocolBalances[stakingToken][protocolName] -= stakeAmount;
        position.tokenProtocolShares[stakingToken][protocolName] -= stakeShares;
        position.totalDeposited -= stakeAmount;
        protocol.totalDeposited -= stakeAmount;
        tokenProtocolTVL[stakingToken][protocolName] -= stakeAmount;

        // Withdraw from protocol (external interaction, after all effects above)
        uint256 actualWithdrawn = _withdrawFromProtocol(stakingToken, protocolName, stakeShares);

        // Calculate rewards and ensure we don't lose principal
        uint256 rewards = actualWithdrawn > stakeAmount ? actualWithdrawn - stakeAmount : 0;

        // Calculate system fee from rewards only (not from principal)
        uint256 systemFeeAmount = 0;
        uint256 remaining = rewards;
        if (rewards > 0 && percentFeeForSystem > 0) {
            systemFeeAmount = (rewards * percentFeeForSystem) / 100; // Direct percentage calculation
            remaining = rewards - systemFeeAmount; // User gets rewards minus fee
        }

        address feeRecipient = systemFeeAddress;

        // Handle withdrawal - transfer principal and rewards separately for visibility
        if (stakingToken == WMATIC_ADDRESS) {
            IWMATIC wmatic = IWMATIC(WMATIC_ADDRESS);

            // Transfer principal amount
            wmatic.withdraw(stakeAmount);
            (bool success1, ) = msg.sender.call{ value: stakeAmount }("");
            if (!(success1)) revert PrincipalMaticTransferFailed();
            // Transfer rewards if any
            if (rewards > 0) {
                wmatic.withdraw(remaining);
                (bool success2, ) = msg.sender.call{ value: remaining }("");
                if (!(success2)) revert RewardsMaticTransferFailed();
            }

            // Transfer system fee to the governed recipient if any
            if (systemFeeAmount > 0) {
                wmatic.withdraw(systemFeeAmount);
                (bool success3, ) = feeRecipient.call{ value: systemFeeAmount }("");
                if (!(success3)) revert SystemFeeMaticTransferFailed();
            }
        } else {
            // Transfer principal
            IERC20(stakingToken).safeTransfer(
                msg.sender,
                actualWithdrawn <= stakeAmount ? actualWithdrawn : stakeAmount
            );

            // Transfer rewards if any
            if (rewards > 0) {
                IERC20(stakingToken).safeTransfer(msg.sender, remaining);
            }

            // Transfer system fee to the governed recipient if any
            if (systemFeeAmount > 0) {
                IERC20(stakingToken).safeTransfer(feeRecipient, systemFeeAmount);
            }
        }

        // Emit event with actual amounts
        emit WithdrawTimeLockedStake(msg.sender, _stakeId, stakeAmount, rewards, block.timestamp);
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
            // CHALLENGE-2697: custody the aTokens on THIS contract (onBehalfOf = address(this)),
            // not msg.sender -- Aave mints aTokens to onBehalfOf, so the old code let the USER
            // hold them directly and this contract never actually owned what withdraw() later
            // tried to pull back. Shares are computed proportionally against this contract's
            // aToken balance (ERC4626-style: shares = received * totalShares / balanceBefore),
            // so pooled deposits for the same token+protocol correctly share accrued yield and
            // each stake can only ever claim its own proportional slice on withdrawal.
            address aToken = _getATokenAddress(_token);
            uint256 balanceBefore = IERC20(aToken).balanceOf(address(this));
            IAavePool(protocol.contractAddress).supply(_token, _amount, address(this), 0);
            uint256 received = IERC20(aToken).balanceOf(address(this)) - balanceBefore;

            uint256 totalSharesBefore = tokenProtocolTotalShares[_token][_protocol];
            shares = (totalSharesBefore == 0 || balanceBefore == 0)
                ? received
                : (received * totalSharesBefore) / balanceBefore;
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
            // CHALLENGE-2697: withdraw exactly THIS stake's proportional claim of the pooled
            // aToken balance (principal + its share of accrued yield) -- never
            // type(uint256).max, which would drain every other user's position in the same
            // token+protocol pool along with this one. `to` is address(this) (not msg.sender),
            // matching the liquid/compound branches above: the underlying lands on this
            // contract, which then forwards it to the user in withdrawTimeLockedStake (same
            // WMATIC-unwrap / safeTransfer path as the other two protocol types).
            address aToken = _getATokenAddress(_token);
            uint256 totalSharesBefore = tokenProtocolTotalShares[_token][_protocol];
            uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
            uint256 amountToWithdraw = totalSharesBefore == 0
                ? 0
                : (_shares * aTokenBalance) / totalSharesBefore;
            tokenProtocolTotalShares[_token][_protocol] = totalSharesBefore - _shares;
            if (amountToWithdraw > 0) {
                amount = IAavePool(protocol.contractAddress).withdraw(
                    _token,
                    amountToWithdraw,
                    address(this)
                );
            }
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
                    uint256 interest =
                        (balance * protocols[protocolName].currentAPY * timeElapsed) /
                            (365 days * 10000);
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
    function getSystemFeeInfo()
        external
        view
        returns (uint256 feePercent, uint256 feeInBasisPoints)
    {
        return (percentFeeForSystem, percentFeeForSystem);
    }

    /**
     * @dev Get aToken address for a given token
     */
    function getATokenAddress(address _token) external view returns (address) {
        return _getATokenAddress(_token);
    }

    /**
     * @dev Internal function to get aToken address from Aave protocol
     */
    function _getATokenAddress(address _token) internal view returns (address) {
        // Aave v3 Polygon aToken addresses
        if (_token == WMATIC_ADDRESS) {
            return 0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97; // aPolWMATIC
        }
        // USDT
        if (_token == 0xc2132D05D31c914a87C6611C10748AEb04B58e8F) {
            return 0x6ab707Aca953eDAeFBc4fD23bA73294241490620; // aPolUSDT
        }
        // USDC
        if (_token == 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174) {
            return 0x625E7708F30cA75bFD92583e0c60ccdE3c2839A6; // aPolUSDC
        }
        // DAI
        if (_token == 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063) {
            return 0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE; // aPolDAI
        }
        // WETH
        if (_token == 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619) {
            return 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8; // aPolWETH
        }
        // WBTC
        if (_token == 0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6) {
            return 0x5c2ed810328349100A66B82b78a1791B101C9D61; // aPolWBTC
        }
        // AAVE
        if (_token == 0xD6DF932A45C0f255f85145f286eA0b292B21C90B) {
            return 0xf329e36C7bF6E5E86ce2150875a84Ce77f477375; // aPolAAVE
        }

        revert AtokenAddressNotFoundForThisToken();
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @dev Update protocol APY
     */
    function updateProtocolAPY(string memory _protocol, uint256 _newAPY) external onlyOwner {
        if (!(protocols[_protocol].isActive)) revert ProtocolNotFound();
        uint256 oldAPY = protocols[_protocol].currentAPY;
        protocols[_protocol].currentAPY = _newAPY;
        protocolLastUpdate[_protocol] = block.timestamp;

        emit APYUpdated(_protocol, oldAPY, _newAPY);
    }

    /**
     * @dev Set token status
     */
    function setTokenStatus(address _token, bool _isActive) external onlyOwner {
        if (!(supportedTokens[_token].tokenAddress != address(0))) revert TokenNotFound();
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
        if (!(_percentFee >= 0 && _percentFee <= 100)) revert FeeMustBeBetween0And100BasisPoints();

        uint256 oldFee = percentFeeForSystem;
        percentFeeForSystem = _percentFee;

        emit FeeUpdated(oldFee, _percentFee);
    }

    /**
     * @dev CHALLENGE-2697: set the governed system-fee recipient. withdrawTimeLockedStake no
     * longer accepts this as a per-call parameter.
     * @param _systemFeeAddress New fee recipient (must not be address(0))
     */
    function setSystemFeeAddress(address _systemFeeAddress) external onlyOwner {
        if (!(_systemFeeAddress != address(0))) revert InvalidFeeRecipient();

        address oldAddress = systemFeeAddress;
        systemFeeAddress = _systemFeeAddress;

        emit SystemFeeAddressUpdated(oldAddress, _systemFeeAddress);
    }

    function emergencyWithdraw(address _token) external onlyOwner {
        IERC20 token = IERC20(_token);
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.safeTransfer(owner(), balance);
            emit EmergencyWithdraw(_token, owner(), balance);
        }
    }

    /**
     * @dev Authorize upgrade (only owner)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Storage gap for future upgrades
    uint256[50] private __gap;
}
