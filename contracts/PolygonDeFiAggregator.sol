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

/**
 * @title PolygonDeFiAggregator
 * @dev Contract trung gian để tương tác với các DeFi staking protocols trên Polygon PoS
 */
contract PolygonDeFiAggregator is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct UserPosition {
        uint256 totalDeposited;
        uint256 totalClaimed;
        uint256 lastActionTime;
        mapping(string => uint256) protocolBalances;
        mapping(string => uint256) protocolShares;
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

    // State variables
    IERC20 public immutable POL_TOKEN;

    // Protocol management
    mapping(string => ProtocolInfo) public protocols;
    mapping(address => UserPosition) public userPositions;
    string[] public supportedProtocols;

    // Performance tracking
    mapping(string => uint256) public protocolTVL;
    mapping(string => uint256) public protocolLastUpdate;

    // Events
    event Staked(address indexed user, string protocol, uint256 amount, uint256 timestamp);
    event WithdrawnImmediately(
        address indexed user,
        string protocol,
        uint256 amount,
        uint256 timestamp
    );
    event RewardsClaimed(address indexed user, string protocol, uint256 rewards, uint256 timestamp);
    event ProtocolAdded(string protocolName, address contractAddress, string protocolType);
    event APYUpdated(string protocolName, uint256 oldAPY, uint256 newAPY);

    constructor(address _polToken) Ownable(msg.sender) {
        POL_TOKEN = IERC20(_polToken);
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

    /**
     * @dev Stake POL through specified DeFi protocol
     */
    function stake(uint256 _amount, string memory _protocol) external nonReentrant whenNotPaused {
        require(_amount > 0, "Cannot stake 0");
        ProtocolInfo storage protocol = protocols[_protocol];
        require(protocol.isActive, "Protocol not supported");

        POL_TOKEN.safeTransferFrom(msg.sender, address(this), _amount);

        UserPosition storage position = userPositions[msg.sender];
        position.totalDeposited += _amount;
        position.protocolBalances[_protocol] += _amount;
        position.lastActionTime = block.timestamp;

        // Approve protocol contract
        POL_TOKEN.approve(protocol.contractAddress, _amount);

        // Stake based on protocol type
        uint256 sharesReceived = _stakeToProtocol(_protocol, _amount);
        position.protocolShares[_protocol] += sharesReceived;

        protocol.totalDeposited += _amount;
        protocolTVL[_protocol] += _amount;

        emit Staked(msg.sender, _protocol, _amount, block.timestamp);
    }

    /**
     * @dev Internal function to stake to specific protocol
     */
    function _stakeToProtocol(
        string memory _protocol,
        uint256 _amount
    ) internal returns (uint256 shares) {
        ProtocolInfo storage protocol = protocols[_protocol];

        if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("liquid"))) {
            shares = ILiquidStaking(protocol.contractAddress).deposit(_amount);
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lending"))) {
            IAavePool(protocol.contractAddress).supply(
                address(POL_TOKEN),
                _amount,
                address(this),
                0
            );
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
    function withdrawImmediately(uint256 _amount, string memory _protocol) external nonReentrant {
        require(_amount > 0, "Cannot withdraw 0");
        ProtocolInfo storage protocol = protocols[_protocol];
        require(protocol.isActive, "Protocol not supported");

        UserPosition storage position = userPositions[msg.sender];
        require(position.protocolBalances[_protocol] >= _amount, "Insufficient balance");

        // Calculate shares to withdraw
        uint256 totalShares = position.protocolShares[_protocol];
        uint256 totalBalance = position.protocolBalances[_protocol];
        uint256 sharesToWithdraw = (totalShares * _amount) / totalBalance;

        // Withdraw from protocol
        uint256 actualWithdrawn = _withdrawFromProtocol(_protocol, sharesToWithdraw);

        // Apply early withdrawal penalty if less than 7 days
        uint256 finalAmount = actualWithdrawn;
        if (block.timestamp < position.lastActionTime + 7 days) {
            uint256 penalty = (actualWithdrawn * 200) / 10000; // 2% penalty
            finalAmount = actualWithdrawn - penalty;
            // Keep penalty in contract as protocol boost
        }

        // Update user position
        position.protocolBalances[_protocol] -= _amount;
        position.protocolShares[_protocol] -= sharesToWithdraw;
        position.totalDeposited -= _amount;

        // Update protocol stats
        protocol.totalDeposited -= _amount;
        protocolTVL[_protocol] -= _amount;

        POL_TOKEN.safeTransfer(msg.sender, finalAmount);

        emit WithdrawnImmediately(msg.sender, _protocol, finalAmount, block.timestamp);
    }

    /**
     * @dev Internal function to withdraw from specific protocol
     */
    function _withdrawFromProtocol(
        string memory _protocol,
        uint256 _shares
    ) internal returns (uint256 amount) {
        ProtocolInfo storage protocol = protocols[_protocol];

        if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("liquid"))) {
            amount = ILiquidStaking(protocol.contractAddress).withdraw(_shares);
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lending"))) {
            amount = IAavePool(protocol.contractAddress).withdraw(
                address(POL_TOKEN),
                _shares,
                address(this)
            );
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("lp"))) {
            ILPStaking(protocol.contractAddress).unstake(_shares);
            amount = _shares; // 1:1 for simplicity
        } else if (keccak256(bytes(protocol.protocolType)) == keccak256(bytes("compound"))) {
            amount = ICompoundPool(protocol.contractAddress).redeem(_shares);
        }

        return amount;
    }

    /**
     * @dev Claim rewards from all protocols
     */
    function claim() external nonReentrant {
        uint256 totalRewards = 0;

        for (uint256 i = 0; i < supportedProtocols.length; i++) {
            string memory protocolName = supportedProtocols[i];
            ProtocolInfo storage protocol = protocols[protocolName];

            if (userPositions[msg.sender].protocolBalances[protocolName] > 0) {
                uint256 rewards = _claimFromProtocol(protocolName);
                if (rewards > 0) {
                    totalRewards += rewards;
                    emit RewardsClaimed(msg.sender, protocolName, rewards, block.timestamp);
                }
            }
        }

        if (totalRewards > 0) {
            userPositions[msg.sender].totalClaimed += totalRewards;

            // Transfer rewards (could be POL or other reward tokens)
            POL_TOKEN.safeTransfer(msg.sender, totalRewards);
        }
    }

    /**
     * @dev Internal function to claim from specific protocol
     */
    function _claimFromProtocol(string memory _protocol) internal returns (uint256 rewards) {
        ProtocolInfo storage protocol = protocols[_protocol];

        try ILiquidStaking(protocol.contractAddress).claimRewards() {
            // Try liquid staking claim
            rewards = ILiquidStaking(protocol.contractAddress).getRewards();
        } catch {
            try ILPStaking(protocol.contractAddress).claim() {
                // Try LP staking claim
                rewards = ILPStaking(protocol.contractAddress).earned(address(this));
            } catch {
                // If all fail, return 0
                rewards = 0;
            }
        }
        return rewards;
    }

    /**
     * @dev Get user's total position across all protocols
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
        for (uint256 i = 0; i < supportedProtocols.length; i++) {
            string memory protocolName = supportedProtocols[i];
            uint256 balance = position.protocolBalances[protocolName];

            if (balance > 0) {
                estimatedValue += balance;
                // Add estimated accrued interest based on APY and time
                uint256 timeElapsed = block.timestamp - protocolLastUpdate[protocolName];
                uint256 interest = (balance * protocols[protocolName].currentAPY * timeElapsed) /
                    (365 days * 10000);
                totalRewards += interest;
            }
        }
    }

    /**
     * @dev Get user's position in specific protocol
     */
    function getUserProtocolPosition(
        address _user,
        string memory _protocol
    ) external view returns (uint256 balance, uint256 shares, uint256 estimatedRewards) {
        UserPosition storage position = userPositions[_user];
        balance = position.protocolBalances[_protocol];
        shares = position.protocolShares[_protocol];

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
        returns (
            string[] memory names,
            uint256[] memory apys,
            uint256[] memory tvls,
            bool[] memory activeStatus
        )
    {
        uint256 length = supportedProtocols.length;
        names = new string[](length);
        apys = new uint256[](length);
        tvls = new uint256[](length);
        activeStatus = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            string memory name = supportedProtocols[i];
            names[i] = name;
            apys[i] = protocols[name].currentAPY;
            tvls[i] = protocolTVL[name];
            activeStatus[i] = protocols[name].isActive;
        }
    }

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

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = POL_TOKEN.balanceOf(address(this));
        if (balance > 0) {
            POL_TOKEN.safeTransfer(owner(), balance);
        }
    }
}
