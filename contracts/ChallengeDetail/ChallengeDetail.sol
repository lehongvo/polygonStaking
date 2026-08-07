// SPDX-License-Identifier: MIT
// File: Challenge/IChallengeFee.sol

pragma solidity ^0.8.16;

// ==== custom errors (auto) ====
error RelayExpired();
error RelayBadNonce();
error RelayBadSignature();
error TransferHelperFailed();
error OnlyStakeholdersCanCallThisFunction();
error AddressInsufficientBalance();
error AddressUnableToSendValueRecipientMayHaveReverted();
error ReentrancyguardReentrantCall();
error ChallengeHasNotStartedYet();
error ChallengeWasFinished();
error ChallengeHasNotFinishedYet();
error CanNotGiveUp();
error ThisChallengeWasGiveUp();
error OnlyChallengerCanCallThisFunction();
error CantCall();
error SumOfPercentsExceeds100();
error InvalidStepExceedsGoalOrNotGreater();
error TheChallengeHasNotYetBeenFinished();
error OnlyReturnedNftWalletAddress();
error InsufficientContractBalance();
error InvalidDayLength();
error UnsortedOrDuplicateDays();
error InvalidStepIndexLength();
error InvalidAllowGiveUp();
error InvalidHiitData();
error InvalidAward();
error InvalidValue();
error InvalidLists();
error InvalidValue0();
error InvalidValue1();
error InvalidHiitResultsLength();
error InsufficientMaticForNativeStaking();
error PrincipalMaticTransferFailed();
error RewardsMaticTransferFailed();
error SystemFeeMaticTransferFailed();
error NoPendingNativeClaim();
error ZeroErc1155Deposit();
error NoPendingErc1155Claim();
error Erc1155ClaimTransferFailed();
error ExceedsMaxDailyBatch();
error TooManyGachaCalls();
error TooManyNftContracts();
error TooManyNftIds();

/**
 * @dev Interface for the ChallengeFee contract.
 */
interface IChallengeFee {
    /**
     * @dev Retrieves the current amount fee settings.
     * @return successFee The current amount of success fee.
     * @return failFee The current amount of fail fee.
     */
    function getAmountFee() external view returns (uint8 successFee, uint8 failFee);
}

// File: Challenge/IGacha.sol

pragma solidity ^0.8.16;

interface IGacha {
    /**
     * @dev This function generates random rewards for a challenge, based on the given _dataStep array.
     * @param _challengeAddress The address of the challenge for which rewards are being generated.
     * @param _dataStep An array of step data used to calculate the rewards.
     * @return A boolean indicating whether the rewards were generated successfully.
     */
    function randomRewards(
        address _challengeAddress,
        uint256[] memory _dataStep
    ) external returns (bool);
}
// File: Challenge/IERC165.sol

// OpenZeppelin Contracts v4.4.1 (utils/introspection/IERC165.sol)

pragma solidity ^0.8.16;

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
// File: Challenge/IERC1155.sol

// OpenZeppelin Contracts (last updated v4.7.0) (token/ERC1155/IERC1155.sol)

pragma solidity ^0.8.0;

/**
 * @dev Required interface of an ERC1155 compliant contract, as defined in the
 * https://eips.ethereum.org/EIPS/eip-1155[EIP].
 *
 * _Available since v3.1._
 */
interface IERC1155 is IERC165 {
    function balanceOf(address account, uint256 id) external view returns (uint256);

    function nextTokenIdToMint() external view returns (uint256);
}

// File: Challenge/TransferHelper.sol

pragma solidity ^0.8.7;

/**
    helper methods for interacting with ERC20 tokens that do not consistently return true/false
    with the addition of a transfer function to send eth or an erc20 token
*/
library TransferHelper {
    function safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x095ea7b3, to, value)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    function saveTransferEth(address payable recipient, uint256 amount) internal {
        if (!(address(this).balance >= amount)) revert AddressInsufficientBalance();
        (bool success, ) = recipient.call{ value: amount }("");
        if (!(success)) revert AddressUnableToSendValueRecipientMayHaveReverted();
    }

    function safeMintNFT1155(
        address token,
        address account,
        uint256 id,
        uint256 amount,
        bytes memory dataValue
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x280f4e28, account, id, amount, dataValue)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    function safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, value)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    function safeApproveForAllNFT1155(address token, address operator, bool approved) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa22cb465, operator, approved)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    function safeTransferNFT1155(
        address token,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory dataValue
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xf242432a, from, to, id, amount, dataValue)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    function safeMintNFT(address token, address to) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x40d097c3, to));
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    function safeApproveForAll(address token, address to, bool value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa22cb465, to, value)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, value)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
    }

    // sends ETH or an erc20 token
    function safeTransferBaseToken(
        address token,
        address payable to,
        uint256 value,
        bool isERC20
    ) internal {
        if (!isERC20) {
            to.transfer(value);
        } else {
            (bool success, bytes memory data) = token.call(
                abi.encodeWithSelector(0xa9059cbb, to, value)
            );
            if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TransferHelperFailed();
        }
    }
}

// File: Challenge/IExerciseSupplementNFT.sol

// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC721/IERC721.sol)

pragma solidity ^0.8.0;

/**
 * @dev Required interface of an ERC721 compliant contract.
 */
interface IExerciseSupplementNFT {
    /**
     * @dev Emitted when `tokenId` token is transferred from `from` to `to`.
     */
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables `approved` to manage the `tokenId` token.
     */
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets.
     */
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    /**
     * @dev Returns the number of tokens in ``owner``'s account.
     */
    function balanceOf(address owner) external view returns (uint256 balance);

    /**
     * @dev Returns the owner of the `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external;

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must have been allowed to move this token by either {approve} or {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) external;

    /**
     * @dev Transfers `tokenId` token from `from` to `to`.
     *
     * WARNING: Note that the caller is responsible to confirm that the recipient is capable of receiving ERC721
     * or else they may be permanently lost. Usage of {safeTransferFrom} prevents loss, though the caller must
     * understand this adds an external call which potentially creates a reentrancy vulnerability.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 tokenId) external;

    /**
     * @dev Gives permission to `to` to transfer `tokenId` token to another account.
     * The approval is cleared when the token is transferred.
     *
     * Only a single account can be approved at a time, so approving the zero address clears previous approvals.
     *
     * Requirements:
     *
     * - The caller must own the token or be an approved operator.
     * - `tokenId` must exist.
     *
     * Emits an {Approval} event.
     */
    function approve(address to, uint256 tokenId) external;

    /**
     * @dev Approve or remove `operator` as an operator for the caller.
     * Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.
     *
     * Requirements:
     *
     * - The `operator` cannot be the caller.
     *
     * Emits an {ApprovalForAll} event.
     */
    function setApprovalForAll(address operator, bool approved) external;

    /**
     * @dev Returns the account approved for `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function getApproved(uint256 tokenId) external view returns (address operator);

    /**
     * @dev Returns if the `operator` is allowed to manage all of the assets of `owner`.
     *
     * See {setApprovalForAll}
     */
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    /**
     * @dev Returns the ERC-20 token symbol.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns an array of addresses of registered ERC-20 token contracts.
     */
    function getErc20ListAddress() external view returns (address[] memory);

    /**
     * @dev Returns an array of addresses of registered NFT contracts.
     */
    function getNftListAddress() external view returns (address[] memory);

    /**
     * @dev Returns the address of the contract for setting fees.
     */
    function feeSettingAddress() external view returns (address);

    /**
     * @dev Mint an NFT with specified parameters.
     * @param _goal The target goal amount.
     * @param _duration The duration of the challenge.
     * @param _dayRequired The number of days required for the challenge.
     * @param _createByToken The address of the creator of the token.
     * @param _totalReward The total reward amount.
     * @param _awardReceiversPercent The percentage of the reward to award to receivers.
     * @param _awardReceivers The address of the reward receivers.
     * @param _challenger The address of the challenger.
     * @return The address and token ID of the new NFT.
     */
    function safeMintNFT(
        uint256 _goal,
        uint256 _duration,
        uint256 _dayRequired,
        address _createByToken,
        uint256 _totalReward,
        uint256 _awardReceiversPercent,
        address _awardReceivers,
        address _challenger
    ) external returns (address, uint256);

    /**
     * @dev Returns true if the given address is an NFT contract.
     * @param nftAddress The address to check.
     * @return True if the given address is an NFT contract, false otherwise.
     */
    function typeNfts(address nftAddress) external view returns (bool);

    /**
     * @dev Returns the next token ID to be minted.
     * @return The next token ID to be minted.
     */
    function nextTokenIdToMint() external view returns (uint256);

    /**
     * @dev Returns the address of the receiver of a specified NFT's history.
     * @param tokenId The ID of the NFT.
     * @param to The address of the receiver.
     * @return The address of the receiver of the specified NFT's history.
     */
    function getHistoryNFT(uint256 tokenId, address to) external view returns (address);

    /**
     * This function returns the address of the NFT wallet that was previously set by the contract owner.
     * @return The address of the NFT wallet.
     */
    function returnedNFTWallet() external view returns (address);

    /**
     * @dev Check the validity of a provided signature.
     * @param _day An array of uint256 values representing days.
     * @param _stepIndex An array of uint256 values representing step indices.
     * @param _data A tuple of two uint64 values.
     * @param _signature The signature to be validated.
     * @notice This function is used to verify the authenticity of a provided signature
     *         based on certain criteria, including the provided data and time window.
     *         It is an external function to allow external contracts to perform signature verification.
     */
    function checkValidSignature(
        uint256[] memory _day,
        uint256[] memory _stepIndex,
        uint64[2] memory _data,
        bytes32 _extraDataHash,
        bytes memory _signature
    ) external;
}

// File: Challenge/IERC721Receiver.sol

// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC721/IERC721Receiver.sol)

pragma solidity ^0.8.0;

/**
 * @title ERC721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC721 asset contracts.
 */
interface IERC721Receiver {
    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

// File: Challenge/IERC20.sol

pragma solidity ^0.8.16;

interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the ERC-20 token symbol.
     */
    function symbol() external view returns (string memory);
}
// File: Challenge/ChallengeDetail.sol

pragma solidity ^0.8.16;

contract ChallengeDetail is IERC721Receiver {
    /** @param ChallengeState currentState of challenge:
         1 : in processs
         2 : success
         3 : failed
         4 : gave up
         5 : closed
    */
    enum ChallengeState {
        PROCESSING,
        SUCCESS,
        FAILED,
        GAVE_UP,
        CLOSED
    }

    uint256 private constant MAX_DAILY_BATCH_DAYS = 31;
    uint256 private constant MAX_GACHA_CALLS_PER_TX = 10;
    uint256 private constant MAX_NFT_CONTRACTS_PER_TX = 10;
    uint256 private constant MAX_NFT_IDS_PER_CONTRACT = 20;

    /** @dev returnedNFTWallet received NFT when Success
     */
    address private returnedNFTWallet;

    /** @dev erc20ListAddress list address of erc-20 contract.
     */
    address[] private erc20ListAddress;

    /** @dev erc721Address address of erc-721 contract.
     */
    address[] public erc721Address;

    /** @dev sponsor sponsor of challenge.
     */
    address payable public sponsor;

    /** @dev challenger challenger of challenge.
     */
    address payable public challenger;

    /** @dev feeAddress feeAddress of challenge.
     */
    address payable private feeAddress;

    /** @dev awardReceivers list of receivers when challenge success and fail, start by success list.
     */
    address payable[] private awardReceivers;

    /** @dev awardReceiversApprovals list of award for receivers when challenge success and fail, start by success list.
     */
    uint256[] private awardReceiversApprovals;

    /** @dev historyData number of steps each day in challenge.
     */
    uint256[] historyData;

    /** @dev historyDate date in challenge.
     */
    uint256[] historyDate;

    /** @dev index index to split array receivers.
     */
    uint256 private index;

    uint256 public indexNft;

    /** @dev totalReward total reward receiver can receive in challenge.
     */
    uint256 public totalReward;

    /** @dev gasFee coin for challenger transaction fee. Transfer for challenger when create challenge.
     */
    uint256 private gasFee;

    /** @dev serverSuccessFee coin for sever when challenge success.
     */
    uint256 private serverSuccessFee;

    /** @dev serverFailureFee coin for sever when challenge fail.
     */
    uint256 private serverFailureFee;

    /** @dev duration duration of challenge from start to end time.
     */
    uint256 public duration;

    /** @dev startTime startTime of challenge.
     */
    uint256 public startTime;

    /** @dev endTime endTime of challenge.
     */
    uint256 public endTime;

    /** @dev dayRequired number of day which challenger need to finish challenge.
     */
    uint256 public dayRequired;

    /** @dev goal number of steps which challenger need to finish in day.
     */
    uint256 public goal;

    /** @dev currentStatus currentStatus of challenge.
     */
    uint256 public currentStatus;

    /** @dev sumAwardSuccess sumAwardSuccess of challenge.
     */
    uint256 sumAwardSuccess;

    /** @dev sumAwardFail sumAwardFail of challenge.
     */
    uint256 sumAwardFail;

    /** @dev sequence submit daily result count number of challenger.
     */
    uint256 sequence;

    /** @dev allowGiveUp challenge allow give up or not.
     */
    bool[] public allowGiveUp;

    /** @dev isFinished challenge finish or not.
     */
    bool public isFinished;

    /** @dev isSuccess challenge success or not.
     */
    bool public isSuccess;

    /** @dev choiceAwardToSponsor all award will go to sponsor wallet when challenger give up or not.
     */
    bool private choiceAwardToSponsor;

    /** @dev selectGiveUpStatus challenge need be give up one time.
     */
    bool selectGiveUpStatus;

    /** @dev approvalSuccessOf get amount of coin an `address` can receive when ckhallenge success.
     */
    mapping(address => uint256) private approvalSuccessOf;

    /** @dev approvalFailOf get amount of coin an `address` can receive when challenge fail.
     */
    mapping(address => uint256) private approvalFailOf;

    /** @dev stepOn get step on a day.
     */
    mapping(uint256 => uint256) private stepOn;

    /** @dev CHALLENGE-2698: tracks whether a canonical day has already counted toward
     *  currentStatus, independent of history-array bookkeeping/caller-supplied _timeRange --
     *  guarantees a day can only ever increment progress once, however many times it (or an
     *  overlapping signed batch covering it) is resubmitted. */
    mapping(uint256 => bool) private processedDay;

    // Instance of the ChallengeState contract
    ChallengeState private stateInstance;

    // Array of percentages for award receivers
    uint256[] private awardReceiversPercent;

    // Mapping of award receivers to the index of their awarded tokens
    mapping(address => uint256[]) private awardTokenReceivers;

    // Array of balances of all tokens
    uint256[] private listBalanceAllToken;

    // Array of amounts of tokens to be received by each token receiver
    uint256[] private amountTokenToReceiverList;

    // Total balance of the base token
    uint256 public totalBalanceBaseToken;

    // Address of the creator of the token
    address public createByToken;

    // Represents the amount of success fee in percentage.
    uint8 private amountSuccessFee;

    // Represents the amount of fail fee in percentage.
    uint8 private amountFailFee;

    // Reentrancy guard status: 1 = NOT_ENTERED, 2 = ENTERED.
    uint256 private _reentrancyStatus = 1;

    // CHALLENGE-2825: pull-claim ledger for native payouts whose recipient rejected a push
    // transfer during settlement -- appended after existing storage (live UUPS proxies).
    mapping(address => uint256) private _pendingNativeClaims;

    // CHALLENGE-2791: pull-claim ledger for ERC1155 fail-path returns.
    mapping(address => mapping(address => mapping(uint256 => uint256))) private _pendingErc1155Claims;
    mapping(address => mapping(uint256 => mapping(address => bool))) private _erc1155DepositorRegistered;

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    modifier nonReentrant() {
        if (!(_reentrancyStatus != 2)) revert ReentrancyguardReentrantCall();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    /**
     * @dev Emitted when the daily result is sent.
     * @param currentStatus The current status of the daily result.
     */
    event SendDailyResult(uint256 indexed currentStatus);

    /**
     * @dev Event emitted when a transfer of tokens is executed.
     * @param to Address of the receiver of the tokens.
     * @param valueSend Amount of tokens transferred.
     */
    event FundTransfer(address indexed to, uint256 indexed valueSend);

    /**
     * @dev Emitted when a participant gives up on the challenge.
     * @param from The address of the participant who gave up.
     */
    event GiveUp(address indexed from);

    /**
     * @dev Emitted when a challenge is closed, indicating whether the challenge was successful or not.
     * @param challengeStatus A boolean flag indicating whether the challenge was successful or not.
     */
    event CloseChallenge(bool indexed challengeStatus);

    /**
     * @dev CHALLENGE-2825: emitted when a native payout push fails and the amount is credited
     * for later pull-claim instead of reverting the whole settlement transaction.
     */
    event NativePayoutCredited(address indexed recipient, uint256 amount);

    /**
     * @dev CHALLENGE-2825: emitted when a credited native payout is successfully claimed.
     */
    event NativePayoutClaimed(address indexed recipient, uint256 amount);

    /**
     * @dev CHALLENGE-2791: emitted when an ERC1155 fail-path return is credited for pull-claim
     * instead of being pushed during terminal settlement.
     */
    event Erc1155ReturnCredited(
        address indexed token,
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount
    );

    /**
     * @dev CHALLENGE-2791: emitted when a credited ERC1155 return is successfully claimed.
     */
    event Erc1155ReturnClaimed(
        address indexed token,
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount
    );

    /**
     * @dev Action should be called in challenge time.
     */
    modifier onTime() {
        if (!(block.timestamp >= startTime)) revert ChallengeHasNotStartedYet();
        if (!(block.timestamp <= endTime)) revert ChallengeWasFinished();
        _;
    }

    /**
     * @dev Action should be called in required time.
     */
    modifier onTimeSendResult() {
        if (!(block.timestamp <= endTime + 2 days)) revert ChallengeWasFinished();
        if (!(block.timestamp >= startTime)) revert ChallengeHasNotStartedYet();
        _;
    }

    /**
     * @dev Action should be called after challenge finish.
     */
    modifier afterFinish() {
        if (!(block.timestamp > endTime + 2 days)) revert ChallengeHasNotFinishedYet();
        _;
    }

    /**
     * @dev Action should be called when challenge is running.
     */
    modifier available() {
        if (!(!isFinished)) revert ChallengeWasFinished();
        _;
    }

    /**
     * @dev Action should be called when challenge was allowed give up.
     */
    modifier canGiveUp() {
        if (!(allowGiveUp[0])) revert CanNotGiveUp();
        _;
    }

    /**
     * @dev User only call give up one time.
     */
    modifier notSelectGiveUp() {
        if (!(!selectGiveUpStatus)) revert ThisChallengeWasGiveUp();
        _;
    }

    /**
     * @dev Action only called from stakeholders.
     */
    modifier onlyStakeHolders() {
        if (!(msg.sender == challenger || msg.sender == sponsor)) revert OnlyStakeholdersCanCallThisFunction();
        _;
    }

    /**
     * @dev Action only called from challenger.
     */
    modifier onlyChallenger() {
        if (!(msg.sender == challenger)) revert OnlyChallengerCanCallThisFunction();
        _;
    }

    /**
     * @dev verify challenge success or not before close.
     */
    modifier availableForClose() {
        if (!(!isSuccess && !isFinished)) revert CantCall();
        _;
    }

    /**
     * @dev Constructor function for creating a new challenge.
     * @param _stakeHolders Array of addresses of the stakeholders participating in the challenge.
     * @param _createByToken The address of the token used to create this challenge.
     * @param _erc721Address Array of addresses of the ERC721 tokens used in the challenge.
     * @param _primaryRequired Array of values representing the primary requirements for each ERC721 token in the challenge.
     * @param _awardReceivers Array of addresses of the receivers who will receive awards if the challenge succeeds.
     * @param _index The index of the current award receiver.
     * @param _allowGiveUp Array of boolean values indicating whether each stakeholder can give up the challenge or not.
     * @param _gasData Array of gas data values for executing the smart contract functions in the challenge.
     * @param _allAwardToSponsorWhenGiveUp A boolean value indicating whether all awards should be given to the sponsor when the challenge is given up.
     * @param _awardReceiversPercent Array of percentage values representing the percentage of awards that each award receiver will receive.
     * @param _totalAmount The total amount of tokens locked in the challenge.
     */
    constructor(
        address payable[] memory _stakeHolders,
        address _createByToken,
        address[] memory _erc721Address,
        uint256[] memory _primaryRequired,
        address payable[] memory _awardReceivers,
        uint256 _index,
        bool[] memory _allowGiveUp,
        uint256[] memory _gasData,
        bool _allAwardToSponsorWhenGiveUp,
        uint256[] memory _awardReceiversPercent,
        uint256 _totalAmount
    ) payable {
        require(_allowGiveUp.length == 3, "Invalid allow give up"); // Checking if _allowGiveUp array length is 3.
        // CHALLENGE-2817: [duration, startTime, endTime, goal, dayRequired] indexed up to [4] below.
        require(_primaryRequired.length >= 5, "Invalid primary required length");
        // CHALLENGE-2811: sponsor/challenger/feeAddress are relied on as payout/authorization
        // targets throughout settlement; a zero address here could burn native value or brick
        // access control.
        require(_stakeHolders.length >= 3, "Invalid stakeholders length");
        require(
            _stakeHolders[0] != address(0) &&
                _stakeHolders[1] != address(0) &&
                _stakeHolders[2] != address(0),
            "Invalid stakeholder address"
        );

        if (_allowGiveUp[1]) {
            require(msg.value == _totalAmount, "Invalid award"); // Checking if msg.value is equal to _totalAmount when _allowGiveUp[1] is true.
        }

        uint256 i;

        require(_index > 0, "Invalid value"); // Checking if _index is greater than 0.

        _totalAmount = _totalAmount - _gasData[2]; // Subtracting _gasData[2] from _totalAmount.

        uint256[] memory awardReceiversApprovalsTamp = new uint256[](_awardReceiversPercent.length); // Creating a new array with length equal to _awardReceiversPercent length.

        {
            // CHALLENGE-2663: _awardReceiversPercent holds 2 MUTUALLY EXCLUSIVE groups split
            // by _index -- [0,_index) pays out on SUCCESS, [_index,length) pays out on FAILURE --
            // only one group is ever paid, so each group must be validated <=100 SEPARATELY.
            // Summing the whole array (old bug) rejected a valid prod config (e.g. index=1,
            // [100,100]), blocking redeploy.
            uint256 successSumPercent;
            uint256 failSumPercent;
            uint256 splitAt = _index < _awardReceiversPercent.length ? _index : _awardReceiversPercent.length;
            for (uint256 k = 0; k < splitAt; k++) {
                successSumPercent += _awardReceiversPercent[k];
            }
            for (uint256 k = splitAt; k < _awardReceiversPercent.length; k++) {
                failSumPercent += _awardReceiversPercent[k];
            }
            if (!(successSumPercent <= 100)) revert SumOfPercentsExceeds100();
            if (!(failSumPercent <= 100)) revert SumOfPercentsExceeds100();
        }
        for (uint256 j = 0; j < _awardReceiversPercent.length; j++) {
            awardReceiversApprovalsTamp[j] = (_awardReceiversPercent[j] * _totalAmount) / 100; // Calculating the award amount for each receiver.
        }

        require(_awardReceivers.length == awardReceiversApprovalsTamp.length, "Invalid lists"); // Checking if _awardReceivers length is equal to awardReceiversApprovalsTamp length.

        for (i = 0; i < _index; i++) {
            // CHALLENGE-2811: approvalSuccessOf is an address-keyed mapping, but the payout loop
            // (transferToListReceiverSuccess) re-reads it once per array index -- a duplicate
            // address in this group would overwrite the mapping entry yet still get paid once per
            // occurrence, double-spending the (possibly wrong) overwritten amount. Mapping value
            // is guaranteed 0 until first written (fresh contract storage, amounts required >0
            // below), so re-visiting the same address is detected here without extra storage.
            require(_awardReceivers[i] != address(0), "Invalid receiver address");
            require(approvalSuccessOf[_awardReceivers[i]] == 0, "Duplicate receiver address");
            require(awardReceiversApprovalsTamp[i] > 0, "Invalid value0"); // Checking if the award amount for each receiver is greater than 0.
            approvalSuccessOf[_awardReceivers[i]] = awardReceiversApprovalsTamp[i]; // Setting the award amount for successful participants.
            sumAwardSuccess = sumAwardSuccess + awardReceiversApprovalsTamp[i]; // Summing up the award amounts for successful participants.
        }

        for (i = _index; i < _awardReceivers.length; i++) {
            // CHALLENGE-2811: same duplicate/zero-address protection as the success loop above,
            // applied to the failure-side mapping (approvalFailOf).
            require(_awardReceivers[i] != address(0), "Invalid receiver address");
            require(approvalFailOf[_awardReceivers[i]] == 0, "Duplicate receiver address");
            require(awardReceiversApprovalsTamp[i] > 0, "Invalid value1"); // Checking if the award amount for each receiver is greater than 0.
            approvalFailOf[_awardReceivers[i]] = awardReceiversApprovalsTamp[i]; // Setting the award amount for failed participants.
            sumAwardFail = sumAwardFail + awardReceiversApprovalsTamp[i]; // Summing up the award amounts for failed participants.
        }

        sponsor = _stakeHolders[0]; // Setting the sponsor address.
        challenger = _stakeHolders[1]; // Setting the challenger address.
        feeAddress = _stakeHolders[2]; // Setting the fee address.
        erc721Address = _erc721Address; // Setting the ERC721 contract address.
        erc20ListAddress = IExerciseSupplementNFT(_erc721Address[0]).getErc20ListAddress(); // Getting the ERC20 list address from the ERC721 contract.
        returnedNFTWallet = IExerciseSupplementNFT(_erc721Address[0]).returnedNFTWallet(); // Get the address of the returned NFT wallet from the ExerciseSupplementNFT contract
        duration = _primaryRequired[0]; // Setting the duration of the challenge.
        startTime = _primaryRequired[1]; // Setting the start time of the challenge.
        endTime = _primaryRequired[2]; // Setting the end time of the challenge.
        goal = _primaryRequired[3]; // Setting the goal of the challenge.
        dayRequired = _primaryRequired[4]; // Setting the required number of days for the challenge.
        // CHALLENGE-2817: settlement (duration - dayRequired for failure detection, division by
        // dayRequired for partial give-up payout) assumes 0 < dayRequired <= duration; enforce it
        // here so a malformed/direct deployment cannot underflow or divide by zero later.
        require(duration > 0, "Invalid duration");
        require(dayRequired > 0 && dayRequired <= duration, "Invalid dayRequired");
        require(endTime > startTime, "Invalid time range");
        stateInstance = ChallengeState.PROCESSING; // Setting the challenge state to PROCESSING.
        awardReceivers = _awardReceivers; // Setting the list of award receivers.
        awardReceiversApprovals = awardReceiversApprovalsTamp; // Setting the awardReceiversApprovals
        awardReceiversPercent = _awardReceiversPercent; // Assigning the award percentage to the contract variable
        index = _index; // Assigning the index value to the contract variable
        gasFee = _gasData[2]; // Assigning the gas fee to the contract variable
        createByToken = _createByToken; // Assigning the create by token value to the contract variable

        // get amoutn base fee
        (amountSuccessFee, amountFailFee) = IChallengeFee(
            IExerciseSupplementNFT(_erc721Address[0]).feeSettingAddress()
        ).getAmountFee();

        totalReward = _totalAmount; // Assigning the total reward to the contract variable
        allowGiveUp = _allowGiveUp; // Assigning the allow give up value to the contract variable

        // Checking if give up is allowed and all awards should be given to the sponsor, then set the choiceAwardToSponsor variable to true
        if (_allowGiveUp[0] && _allAwardToSponsorWhenGiveUp) choiceAwardToSponsor = true;

        // Transferring the gas fee from the challenger to the contract and emitting an event
        tranferCoinNative(challenger, gasFee);
        emit FundTransfer(challenger, gasFee);
    }

    /**
     * @dev This function allows the contract to receive native currency of the network.
     * It checks if the sale is finished, and if it is, it transfers the native coins to the sender.
     * @notice This function is triggered automatically when native coins are sent to the contract address.
     */
    receive() external payable {
        // Skip refund branch while a nonReentrant call is in progress to avoid
        // mid-flow re-deposit loops after CEI sets isFinished early.
        if (isFinished && _reentrancyStatus != 2) {
            // Check if the sale is finished
            tranferCoinNative(payable(msg.sender), msg.value); // Transfer the native coins to the sender
        }
    }

    /**
     * @dev Send daily results to update contract activities.
     * @param _day An array of uint256 values representing days.
     * @param _stepIndex An array of uint256 values representing step indices.
     * @param _data A tuple of two uint64 values.
     * @param _signature The signature to be validated.
     * @param _listGachaAddress An array of addresses representing Gacha contract addresses.
     * @param _listNFTAddress An array of addresses representing NFT contract addresses.
     * @param _listIndexNFT An array of arrays representing NFT indices.
     * @param _listSenderAddress An array of arrays representing sender addresses.
     * @param _statusTypeNft An array of boolean values representing NFT status types.
     * @param _timeRange A tuple of two uint64 values representing the time range.
     * @notice This function is used to send daily results for updating contract activities.
     *         It requires specific roles (onlyChallenger) and enforces timing constraints (onTimeSendResult).
     *         It processes various input data related to Gacha and NFT contracts to update activities.
     *         The provided signature is validated to ensure the authenticity of the data.
     * @dev This function can only be called by authorized challengers within a specific time frame.
     */
    function sendDailyResult(
        uint256[] memory _day,
        uint256[] memory _stepIndex,
        uint64[2] memory _data,
        bytes calldata _signature,
        address[] memory _listGachaAddress,
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft,
        uint64[2] memory _timeRange
    ) public nonReentrant available onTimeSendResult onlyChallenger {
        _executeDailyResult(_day, _stepIndex, _data, _signature, _listGachaAddress, _listNFTAddress, _listIndexNFT, _listSenderAddress, _statusTypeNft, _timeRange);
    }

    // Per-challenger nonce cho meta-tx relayer (chống replay).
    mapping(address => uint256) public relayNonce;

    /**
     * @notice Meta-tx: challenger UỶ QUYỀN settlement bằng CHỮ KÝ (raw key KHÔNG rời client), relayer submit tx.
     *      ⚠️ FUND-AUTHORIZATION — BẮT BUỘC security audit trước khi deploy. Unit test KHÔNG thay thế audit.
     */
    function sendDailyResultViaRelayer(
        uint256[] memory _day,
        uint256[] memory _stepIndex,
        uint64[2] memory _data,
        bytes calldata _signature,
        address[] memory _listGachaAddress,
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft,
        uint64[2] memory _timeRange,
        uint256 _nonce,
        uint256 _deadline,
        bytes calldata _challengerSig
    ) public nonReentrant available onTimeSendResult {
        if (!(block.timestamp <= _deadline)) revert RelayExpired();
        if (!(_nonce == relayNonce[challenger])) revert RelayBadNonce();
        // Hash gắn address(this)+chainid → chống replay xuyên contract/chain.
        // Các tham số NFT/Gacha điều khiển việc CHUYỂN TÀI SẢN nên PHẢI nằm trong chữ ký.
        // Nếu không, relayer có thể tái dùng chữ ký hợp lệ của challenger nhưng đổi
        // địa chỉ NFT / người nhận / target Gacha. Hash riêng rồi nhét vào payload.
        bytes32 assetHash = keccak256(
            abi.encode(_signature, _listGachaAddress, _listNFTAddress, _listIndexNFT, _listSenderAddress, _statusTypeNft)
        );
        bytes32 payload = keccak256(
            abi.encode(address(this), block.chainid, _nonce, _deadline, _day, _stepIndex, _data, _timeRange, assetHash)
        );
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payload));
        if (!(_recoverRelaySigner(ethHash, _challengerSig) == challenger)) revert RelayBadSignature();
        relayNonce[challenger]++; // effects TRƯỚC external call (CEI)
        _executeDailyResult(_day, _stepIndex, _data, _signature, _listGachaAddress, _listNFTAddress, _listIndexNFT, _listSenderAddress, _statusTypeNft, _timeRange);
    }

    // ecrecover + chống malleability (EIP-2). ⚠️ Điểm rủi ro cao nhất — audit kỹ.
    function _recoverRelaySigner(bytes32 hash, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert RelayBadSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert RelayBadSignature();
        if (v != 27 && v != 28) revert RelayBadSignature();
        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) revert RelayBadSignature();
        return signer;
    }

    function _executeDailyResult(
        uint256[] memory _day,
        uint256[] memory _stepIndex,
        uint64[2] memory _data,
        bytes calldata _signature,
        address[] memory _listGachaAddress,
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft,
        uint64[2] memory _timeRange
    ) private {
        // CHALLENGE-2673: no specialized achievement metrics for this variant -- fixed sentinel
        // hash, matching what the backend signs for ChallengeDetail/ChallengeDetailV2.
        IExerciseSupplementNFT(erc721Address[0]).checkValidSignature(
            _day,
            _stepIndex,
            _data,
            keccak256(abi.encode()),
            _signature
        );

        uint dayLength = _day.length;
        if (dayLength > MAX_DAILY_BATCH_DAYS) revert ExceedsMaxDailyBatch();
        if (_listGachaAddress.length > MAX_GACHA_CALLS_PER_TX) revert TooManyGachaCalls();
        if (_listNFTAddress.length > MAX_NFT_CONTRACTS_PER_TX) revert TooManyNftContracts();
        for (uint256 boundCheck = 0; boundCheck < _listNFTAddress.length; boundCheck++) {
            if (_listIndexNFT[boundCheck].length > MAX_NFT_IDS_PER_CONTRACT) revert TooManyNftIds();
        }
        // CHALLENGE-2698: reject a batch with duplicate/unsorted days outright -- a strictly
        // increasing _day array means the "last day" special-casing below (indices computed
        // from dayLength-1) can never be confused by an out-of-order or repeated entry.
        for (uint256 k = 1; k < dayLength; k++) {
            if (!(_day[k] > _day[k - 1])) revert UnsortedOrDuplicateDays();
        }
        bool isSendSameDay;
        bool isSendFailWithSameDay;
        uint256 lastIndex = totalReward;
        uint256[] storage tempHistoryDate = historyDate;
        uint256[] storage tempHistoryData = historyData;

        for (uint256 i = 0; i < dayLength; i++) {
            uint256 histLen = tempHistoryDate.length;
            for (uint256 j = 0; j < histLen; j++) {
                if (tempHistoryDate[j] >= _timeRange[0] && tempHistoryDate[j] <= _timeRange[1]) {
                    if (!(tempHistoryData[j] < goal)) revert InvalidStepExceedsGoalOrNotGreater();
                    isSendSameDay = true;
                    tempHistoryData[j] = _stepIndex[dayLength - 1];
                    tempHistoryDate[j] = _day[dayLength - 1];
                } else {
                    if (tempHistoryDate[j] == _day[i]) {
                        lastIndex = i;
                        tempHistoryData[j] = _stepIndex[i];
                    }
                }
            }

            if (!isSendSameDay) {
                if (lastIndex != i) {
                    tempHistoryDate.push(_day[i]);
                    tempHistoryData.push(_stepIndex[i]);
                }
                stepOn[_day[i]] = _stepIndex[i];
            }

            // CHALLENGE-2698: processedDay guards against counting the same canonical day
            // twice, independent of the isSendSameDay/history bookkeeping above and of
            // whatever _timeRange the caller supplies -- a resubmission (same or different
            // signature) of an already-processed day can never increment currentStatus again.
            if (_stepIndex[i] >= goal && currentStatus < dayRequired && !processedDay[_day[i]]) {
                currentStatus = currentStatus + 1;
                processedDay[_day[i]] = true;
            }
        }

        if (tempHistoryData.length > 1) {
            isSendFailWithSameDay = true;
            for (uint256 i = 0; i < tempHistoryData.length - 1; i++) {
                if (tempHistoryData[i] < goal) {
                    isSendFailWithSameDay = false;
                    lastIndex = totalReward;
                    break;
                }
            }
        }

        if (isSendSameDay && isSendFailWithSameDay) {
            sequence = sequence + dayLength - 1;
        } else {
            sequence = sequence + dayLength;
        }

        if (
            _stepIndex[dayLength - 1] < goal &&
            _day[dayLength - 1] > _timeRange[0] &&
            _day[dayLength - 1] < _timeRange[1]
        ) {
            isSendFailWithSameDay = true;
        }

        // Check if the challenge has failed due to too many missed days
        if (
            sequence - currentStatus > duration - dayRequired &&
            !isSendFailWithSameDay &&
            lastIndex == totalReward
        ) {
            stateInstance = ChallengeState.FAILED;
            // Transfer funds to the receiver addresses for the failed challenge
            transferToListReceiverFail(
                _listNFTAddress,
                _listIndexNFT,
                _listSenderAddress,
                _statusTypeNft
            );
        } else {
            // Check if the challenge has been completed successfully
            if (currentStatus >= dayRequired) {
                stateInstance = ChallengeState.SUCCESS;
                // Transfer funds to the receiver addresses for the successful challenge
                transferToListReceiverSuccess(_listNFTAddress, _listIndexNFT, _statusTypeNft);
            }
        }

        // Loop through each gacha instance and invoke random rewards
        for (uint256 i = 0; i < _listGachaAddress.length; i++) {
            IGacha(_listGachaAddress[i]).randomRewards(address(this), _stepIndex);
        }

        // Emit an event for the current status of the challenge
        emit SendDailyResult(currentStatus);
    }

    /**
     * @dev Give up function to handle NFT transfers when a user decides to give up.
     * @param _listNFTAddress An array of NFT contract addresses.
     * @param _listIndexNFT An array of arrays containing indices of NFTs to transfer.
     * @param _listSenderAddress An array of arrays containing sender addresses for each NFT.
     * @param _statusTypeNft An array indicating the status type of each NFT.
     */
    function giveUp(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft
    ) external nonReentrant canGiveUp notSelectGiveUp onTime available onlyStakeHolders {
        // EFFECTS — write state before any external interaction (CEI)
        isFinished = true;
        selectGiveUpStatus = true;
        stateInstance = ChallengeState.GAVE_UP;

        updateRewardSuccessAndfail(false); // give-up is fail-like: uses amountFailFee, same as before

        uint256 remainningAmountFee = uint256(100) - amountFailFee;

        uint256 amount = (address(this).balance * remainningAmountFee) / 100;

        if (choiceAwardToSponsor) {
            tranferCoinNative(sponsor, amount);
            for (uint256 i = 0; i < erc20ListAddress.length; i++) {
                uint256 realBalanceToken = getBalanceTokenOfContract(
                    erc20ListAddress[i],
                    address(this)
                );
                if (remainningAmountFee > 0 && realBalanceToken > 0) {
                    TransferHelper.safeTransfer(
                        erc20ListAddress[i],
                        sponsor,
                        (listBalanceAllToken[i] * remainningAmountFee) / 100
                    );
                }
            }

            emit FundTransfer(sponsor, amount);
        } else {
            uint256 amountToReceiverList = (amount * currentStatus) / dayRequired;

            tranferCoinNative(sponsor, amount - amountToReceiverList);

            // CHALLENGE-2795: index by the original ERC20 list position — never push a
            // compressed array and later read it with the full-list index.
            uint256[] memory amountTokenToReceiverByIndex = new uint256[](erc20ListAddress.length);
            for (uint256 i = 0; i < erc20ListAddress.length; i++) {
                uint256 totalTokenRewardSubtractFee =
                    (listBalanceAllToken[i] * remainningAmountFee) / 100;

                if (getBalanceTokenOfContract(erc20ListAddress[i], address(this)) > 0) {
                    uint256 amountTokenToReceiver =
                        (totalTokenRewardSubtractFee * currentStatus) / dayRequired;

                    uint256 amountNativeToSponsor =
                        totalTokenRewardSubtractFee - amountTokenToReceiver;

                    TransferHelper.safeTransfer(
                        erc20ListAddress[i],
                        sponsor,
                        amountNativeToSponsor
                    );

                    amountTokenToReceiverByIndex[i] = amountTokenToReceiver;
                }
            }

            for (uint256 i = 0; i < index; i++) {
                if (amount > 0) {
                    tranferCoinNative(
                        awardReceivers[i],
                        (approvalSuccessOf[awardReceivers[i]] * amountToReceiverList) / amount
                    );
                }

                for (uint256 j = 0; j < erc20ListAddress.length; j++) {
                    uint256 tokenDenom = (listBalanceAllToken[j] * remainningAmountFee) / 100;
                    uint256 receiverShare = amountTokenToReceiverByIndex[j];
                    if (tokenDenom == 0 || receiverShare == 0) {
                        continue;
                    }
                    if (getBalanceTokenOfContract(erc20ListAddress[j], address(this)) > 0) {
                        uint256 amountTokenTmp =
                            (awardTokenReceivers[erc20ListAddress[j]][i] * receiverShare) /
                            tokenDenom;

                        TransferHelper.safeTransfer(
                            erc20ListAddress[j],
                            awardReceivers[i],
                            amountTokenTmp
                        );
                    }
                }
            }
        }

        transferNFTForSenderWhenFailed(
            _listNFTAddress,
            _listIndexNFT,
            _listSenderAddress,
            _statusTypeNft
        );

        tranferCoinNative(feeAddress, serverFailureFee);
        emit FundTransfer(feeAddress, serverFailureFee);

        emit GiveUp(msg.sender);
    }

    /**
     * @dev Closes the challenge and performs necessary actions for handling the failure scenario.
     * @param _listNFTAddress The list of NFT contract addresses.
     * @param _listIndexNFT The list of NFT indices for each address.
     * @param _listSenderAddress The list of sender addresses for each NFT.
     * @param _statusTypeNft The status of each NFT (true for ERC721, false for ERC1155).
     */
    function closeChallenge(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft
    ) external nonReentrant onlyStakeHolders afterFinish availableForClose {
        // Transfer NFTs and handle failure scenario for receivers
        transferToListReceiverFail(
            _listNFTAddress,
            _listIndexNFT,
            _listSenderAddress,
            _statusTypeNft
        );

        // Update challenge state to CLOSED
        stateInstance = ChallengeState.CLOSED;

        // Emit event to indicate the challenge is closed
        emit CloseChallenge(false);
    }

    /**
     * @dev Withdraw tokens on completion function to handle the withdrawal of tokens and NFTs on completion of a task.
     * @param _listTokenErc20 An array of ERC20 token contract addresses.
     * @param _listNFTAddress An array of NFT contract addresses.
     * @param _listIndexNFT An array of arrays containing indices of NFTs to transfer.
     * @param _statusTypeNft An array indicating the status type of each NFT.
     */
    function withdrawTokensOnCompletion(
        address[] memory _listTokenErc20,
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        bool[] memory _statusTypeNft
    ) external nonReentrant {
        if (!(isFinished)) revert TheChallengeHasNotYetBeenFinished();
        if (!(returnedNFTWallet == msg.sender)) revert OnlyReturnedNftWalletAddress();
        // Transfer ERC20 tokens
        for (uint256 i = 0; i < _listTokenErc20.length; i++) {
            address tokenErc20 = _listTokenErc20[i];
            uint256 balanceErc20 = IERC20(tokenErc20).balanceOf(address(this));

            TransferHelper.safeTransfer(tokenErc20, returnedNFTWallet, balanceErc20);
        }

        transferNFTForSenderWhenFinish(
            _listNFTAddress,
            _listIndexNFT,
            _statusTypeNft,
            returnedNFTWallet
        );
    }

    /**
     * @dev Transfer NFTs to a list of receivers successfully.
     * @param _listNFTAddress An array of NFT contract addresses.
     * @param _listIndexNFT An array of arrays containing indices of NFTs to transfer.
     * @param _statusTypeNft An array indicating the status type of each NFT.
     */
    function transferToListReceiverSuccess(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        bool[] memory _statusTypeNft
    ) private {
        // EFFECTS — write success/finished flags before any external interaction (CEI)
        isSuccess = true;
        isFinished = true;

        updateRewardSuccessAndfail(true); // CHALLENGE-2696: success outcome -> amountSuccessFee (was always amountFailFee)

        tranferCoinNative(feeAddress, serverSuccessFee);
        emit FundTransfer(feeAddress, serverSuccessFee);

        // CHALLENGE-2696: approvalSuccessOf/awardTokenReceivers are GROSS-based (percent[i] *
        // balance / 100) -- unchanged, so giveUp()'s use of approvalSuccessOf as a weighting
        // source is unaffected. The fee (serverSuccessFee, paid above) is ALSO gross-based, so
        // paying both in full would double-count the same balance whenever the success group's
        // percentages sum close to 100. Scale what's actually PAID here by the fee's complement
        // (100-amountSuccessFee)/100 -- fee + sum(scaled shares) <= gross is then guaranteed for
        // any percent-sum <= 100, without changing what's stored or touching giveUp()'s math.
        for (uint256 i = 0; i < index; i++) {
            tranferCoinNative(
                awardReceivers[i],
                (approvalSuccessOf[awardReceivers[i]] * (100 - amountSuccessFee)) / 100
            );

            for (uint256 j = 0; j < erc20ListAddress.length; j++) {
                if (getBalanceTokenOfContract(erc20ListAddress[j], address(this)) > 0) {
                    TransferHelper.safeTransfer(
                        erc20ListAddress[j],
                        awardReceivers[i],
                        (awardTokenReceivers[erc20ListAddress[j]][i] * (100 - amountSuccessFee)) / 100
                    );
                }
            }
        }

        if (allowGiveUp[2]) {
            address currentAddressNftUse;
            (currentAddressNftUse, indexNft) = IExerciseSupplementNFT(erc721Address[0]).safeMintNFT(
                goal,
                duration,
                dayRequired,
                createByToken,
                totalReward,
                awardReceiversPercent[0],
                address(awardReceivers[0]),
                address(challenger)
            );
            erc721Address.push(currentAddressNftUse);
        }

        transferNFTForSenderWhenFinish(_listNFTAddress, _listIndexNFT, _statusTypeNft, challenger);
    }

    /**
     * @dev Transfers NFTs and handles the failure scenario for the list of receivers.
     * @param _listNFTAddress The list of NFT contract addresses.
     * @param _listIndexNFT The list of NFT indices for each address.
     * @param _listSenderAddress The list of sender addresses for each NFT.
     * @param _statusTypeNft The status of each NFT (true for ERC721, false for ERC1155).
     */
    function transferToListReceiverFail(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft
    ) private {
        // EFFECTS — write finished flag before any external interaction (CEI)
        isFinished = true;

        updateRewardSuccessAndfail(false);

        // Transfer server failure fee to fee address
        tranferCoinNative(feeAddress, serverFailureFee);
        emit FundTransfer(feeAddress, serverFailureFee);

        // Transfer rewards and tokens to all receivers.
        // CHALLENGE-2696: same fee-complement scaling as transferToListReceiverSuccess, using
        // amountFailFee -- see the comment there for why this is safe and giveUp()-neutral.
        for (uint256 i = index; i < awardReceivers.length; i++) {
            // Transfer ETH rewards to receiver
            tranferCoinNative(
                awardReceivers[i],
                (approvalFailOf[awardReceivers[i]] * (100 - amountFailFee)) / 100
            );

            // Transfer ERC20 token rewards to receiver
            for (uint256 j = 0; j < erc20ListAddress.length; j++) {
                if (getBalanceTokenOfContract(erc20ListAddress[j], address(this)) > 0) {
                    TransferHelper.safeTransfer(
                        erc20ListAddress[j],
                        awardReceivers[i],
                        (awardTokenReceivers[erc20ListAddress[j]][i] * (100 - amountFailFee)) / 100
                    );
                }
            }
        }

        // Transfer NFTs to their original owners
        transferNFTForSenderWhenFailed(
            _listNFTAddress,
            _listIndexNFT,
            _listSenderAddress,
            _statusTypeNft
        );

        // Emit event (challenge already marked finished at start of function)
        emit CloseChallenge(false);
    }

    /**
     * @dev Transfer NFTs back to the sender when the task is finished.
     * @param _listNFTAddress An array of NFT contract addresses.
     * @param _listIndexNFT An array of arrays containing indices of NFTs to transfer.
     * @param _statusTypeNft An array indicating the status type of each NFT.
     * @param _receiveAddress The address to receive the transferred NFTs.
     */
    function transferNFTForSenderWhenFinish(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        bool[] memory _statusTypeNft,
        address _receiveAddress
    ) private {
        // Iterate through the list of ERC721 contracts
        for (uint256 i = 0; i < _listNFTAddress.length; i++) {
            if (_statusTypeNft[i]) {
                for (uint256 j = 0; j < _listIndexNFT[i].length; j++) {
                    // Transfer the NFT to the sender
                    TransferHelper.safeTransferFrom(
                        _listNFTAddress[i],
                        address(this),
                        _receiveAddress,
                        _listIndexNFT[i][j]
                    );
                }
            } else {
                for (uint256 j = 0; j < _listIndexNFT[i].length; j++) {
                    uint256 balanceTokenERC1155 = IERC1155(_listNFTAddress[i]).balanceOf(
                        address(this),
                        _listIndexNFT[i][j]
                    );
                    // Encode data transfer token
                    bytes memory extraData = abi.encode(
                        address(this),
                        _receiveAddress,
                        _listIndexNFT[i][j],
                        balanceTokenERC1155
                    );

                    // Transfer the NFT to the sender
                    TransferHelper.safeTransferNFT1155(
                        _listNFTAddress[i],
                        address(this),
                        _receiveAddress,
                        _listIndexNFT[i][j],
                        balanceTokenERC1155,
                        extraData
                    );
                }
            }
        }
    }

    /**
     * @dev Transfer NFTs back to the sender when the task fails.
     * CHALLENGE-2694: recipient (and, for ERC1155, amount) now come ONLY from the authoritative
     * erc721Depositor/erc1155DepositorBalance records populated in onERC721Received/
     * onERC1155Received -- _listSenderAddress is accepted for ABI/signature-format compatibility
     * (the relayer signing scheme already binds it, see CHALLENGE-2653) but its VALUES are no
     * longer used to pick who receives anything. An entry with no recorded depositor (never
     * deposited, or already returned) falls back to the challenge's own AUTHORITATIVE
     * `challenger` address if this contract still holds the token (e.g. deposited via plain
     * transferFrom, which never triggers onERC721Received) -- never an arbitrary caller-supplied
     * address.
     * @param _listNFTAddress An array of NFT contract addresses.
     * @param _listIndexNFT An array of arrays containing indices of NFTs to transfer.
     * @param _listSenderAddress Unused for recipient selection -- kept for ABI/signature-format compatibility.
     * @param _statusTypeNft An array indicating the status type of each NFT.
     */
    function transferNFTForSenderWhenFailed(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft
    ) private {
        _listSenderAddress; // silence unused-param warning -- kept for ABI/signature compatibility only
        // Iterate through the list of ERC721 contracts
        for (uint256 i = 0; i < _listNFTAddress.length; i++) {
            if (_statusTypeNft[i]) {
                for (uint256 j = 0; j < _listIndexNFT[i].length; j++) {
                    uint256 tokenId = _listIndexNFT[i][j];
                    address depositor = erc721Depositor[_listNFTAddress[i]][tokenId];
                    if (depositor != address(0)) {
                        delete erc721Depositor[_listNFTAddress[i]][tokenId]; // effects before external call (CEI)
                        TransferHelper.safeTransferFrom(_listNFTAddress[i], address(this), depositor, tokenId);
                        continue;
                    }
                    if (IExerciseSupplementNFT(_listNFTAddress[i]).ownerOf(tokenId) == address(this)) {
                        TransferHelper.safeTransferFrom(_listNFTAddress[i], address(this), challenger, tokenId);
                    }
                }
            } else {
                uint256 lengthListIndexNFT = _listIndexNFT[i].length / 2;
                address nft = _listNFTAddress[i];
                for (uint256 j = 0; j < lengthListIndexNFT; j++) {
                    _creditErc1155ReturnsForSettlement(nft, _listIndexNFT[i][j]);
                }
            }
        }
    }

    /**
     * @dev CHALLENGE-2791: credit ERC1155 fail-path returns for pull-claim instead of pushing
     * in an unbounded loop during terminal settlement. One reverting receiver cannot block others.
     */
    function _creditErc1155ReturnsForSettlement(address nft, uint256 tokenId) private {
        address[] memory depositors = erc1155Depositors[nft][tokenId];
        if (depositors.length > 0) {
            for (uint256 d = 0; d < depositors.length; d++) {
                address depositor = depositors[d];
                uint256 amount = erc1155DepositorBalance[nft][tokenId][depositor];
                if (amount == 0) continue;
                erc1155DepositorBalance[nft][tokenId][depositor] = 0;
                _erc1155DepositorRegistered[nft][tokenId][depositor] = false;
                _pendingErc1155Claims[depositor][nft][tokenId] += amount;
                emit Erc1155ReturnCredited(nft, tokenId, depositor, amount);
            }
            delete erc1155Depositors[nft][tokenId];
        } else {
            uint256 heldBalance = IERC1155(nft).balanceOf(address(this), tokenId);
            if (heldBalance > 0) {
                _pendingErc1155Claims[challenger][nft][tokenId] += heldBalance;
                emit Erc1155ReturnCredited(nft, tokenId, challenger, heldBalance);
            }
        }
    }

    // Update reward for successful and failed challenges
    // CHALLENGE-2696: `_isSuccessOutcome` selects which fee percent (amountSuccessFee vs
    // amountFailFee) applies to the ERC20 fee below -- previously it was ALWAYS amountFailFee,
    // so a successful ERC20-funded settlement was charged the failure fee. The native side is
    // unaffected (it already computes both serverSuccessFee/serverFailureFee and both
    // approvalSuccessOf/approvalFailOf candidates unconditionally; giveUp() depends on
    // approvalSuccessOf as a weighting source regardless of outcome). Insufficient-balance
    // reverts (never a silent skip) plus the constructor's percent+fee<=100 invariant guarantee
    // neither fee nor receiver shares can ever exceed the available gross balance.
    function updateRewardSuccessAndfail(bool _isSuccessOutcome) private {
        // Reset constructor-populated accumulators so the += below sums correctly.
        // listBalanceAllToken / awardTokenReceivers are guaranteed empty here
        // (single-call lifecycle enforced by nonReentrant + isFinished CEI).
        sumAwardSuccess = 0;
        sumAwardFail = 0;

        // Update balance Matic and token
        uint256 coinNativeBalance = address(this).balance;

        if (coinNativeBalance > 0) {
            serverSuccessFee = (coinNativeBalance * amountSuccessFee) / (100);
            serverFailureFee = (coinNativeBalance * amountFailFee) / (100);

            for (uint256 i = 0; i < index; i++) {
                approvalSuccessOf[awardReceivers[i]] =
                    (awardReceiversPercent[i] * coinNativeBalance) / 100;
                sumAwardSuccess += (awardReceiversPercent[i] * coinNativeBalance) / 100;
            }

            for (uint256 i = index; i < awardReceivers.length; i++) {
                approvalFailOf[awardReceivers[i]] =
                    (awardReceiversPercent[i] * coinNativeBalance) / 100;
                sumAwardFail += (awardReceiversPercent[i] * coinNativeBalance) / 100;
            }
        } else {
            // Token-funded challenge (native balance == 0): the constructor pre-seeded
            // approvalSuccessOf/approvalFailOf with NATIVE-denominated amounts. With no
            // native balance, tranferCoinNative() in settlement would revert
            // (InsufficientContractBalance) and permanently brick the payout (this is the
            // root cause of the ~1700 JPYC stuck on Kaia). Zero the native accruals so the
            // native transfers become no-ops; the ERC20 distribution below pays receivers.
            serverSuccessFee = 0;
            serverFailureFee = 0;
            for (uint256 i = 0; i < index; i++) {
                approvalSuccessOf[awardReceivers[i]] = 0;
            }
            for (uint256 i = index; i < awardReceivers.length; i++) {
                approvalFailOf[awardReceivers[i]] = 0;
            }
        }
        // Get total balance of base token in contract
        totalBalanceBaseToken = getContractBalance();

        // Loop through all ERC20 tokens in list
        for (uint256 i = 0; i < erc20ListAddress.length; i++) {
            // Get balance of current ERC20 token
            listBalanceAllToken.push(IERC20(erc20ListAddress[i]).balanceOf(address(this)));

            // Check if contract holds any balance of current ERC20 token
            if (getBalanceTokenOfContract(erc20ListAddress[i], address(this)) > 0) {
                // Loop through all award receivers percentage
                for (uint256 j = 0; j < awardReceiversPercent.length; j++) {
                    // Calculate the amount of ERC20 token to award to current receiver
                    uint256 awardAmount =
                        (awardReceiversPercent[j] *
                            IERC20(erc20ListAddress[i]).balanceOf(address(this))) / 100;
                    // Add the award amount to receiver's balance for current ERC20 token
                    awardTokenReceivers[erc20ListAddress[i]].push(awardAmount);
                }

                // Transfer fee of current ERC20 token to fee address as fee
                // CHALLENGE-2696: use the fee percent matching the ACTUAL outcome being settled
                // (was always amountFailFee, overcharging/undercharging success settlements).
                uint8 tokenFeePercent = _isSuccessOutcome ? amountSuccessFee : amountFailFee;
                uint256 realAmountFee = (listBalanceAllToken[i] * tokenFeePercent) / (100);
                if (realAmountFee > 0) {
                    TransferHelper.safeTransfer(erc20ListAddress[i], feeAddress, realAmountFee);
                }
            }
        }
    }

    // Returns the owner of the specified ERC721 token.
    function getOwnerOfNft(address _erc721Address, uint256 _index) private view returns (address) {
        return IExerciseSupplementNFT(_erc721Address).ownerOf(_index);
    }

    // Returns the balance of the contract in the native currency (ether).
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Returns the history of the challenge as an array of dates and corresponding data values.
    function getChallengeHistory()
        external
        view
        returns (uint256[] memory date, uint256[] memory data)
    {
        return (historyDate, historyData);
    }

    // Returns the current state of the challenge as an enumerated value.
    function getState() external view returns (ChallengeState) {
        return stateInstance;
    }

    // Check if the contract has enough balance to transfer
    function tranferCoinNative(address payable from, uint256 value) private {
        if (!(getContractBalance() >= value)) revert InsufficientContractBalance();
        // CHALLENGE-2825: a rejecting recipient must not revert the whole settlement -- credit
        // for later pull-claim instead of using TransferHelper.saveTransferEth (which reverts).
        (bool success, ) = from.call{value: value}("");
        if (!success) {
            _pendingNativeClaims[from] += value;
            emit NativePayoutCredited(from, value);
            return;
        }
    }

    /**
     * @dev CHALLENGE-2825: view the caller's credited native balance awaiting pull-claim.
     */
    function pendingNativeClaim(address account) external view returns (uint256) {
        return _pendingNativeClaims[account];
    }

    /**
     * @dev CHALLENGE-2825: pull-claim a previously credited native payout. Checks-effects-interactions:
     * zero the claim before the external call; restore on failure so the balance stays retryable.
     */
    function claimPendingNative() external nonReentrant {
        uint256 amount = _pendingNativeClaims[msg.sender];
        if (amount == 0) revert NoPendingNativeClaim();
        _pendingNativeClaims[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            _pendingNativeClaims[msg.sender] = amount;
            revert AddressUnableToSendValueRecipientMayHaveReverted();
        }
        emit NativePayoutClaimed(msg.sender, amount);
    }

    /**
     * @dev CHALLENGE-2791: view the caller's credited ERC1155 balance awaiting pull-claim.
     */
    function pendingErc1155Claim(
        address account,
        address token,
        uint256 tokenId
    ) external view returns (uint256) {
        return _pendingErc1155Claims[account][token][tokenId];
    }

    /**
     * @dev CHALLENGE-2791: pull-claim a previously credited ERC1155 fail-path return.
     * Checks-effects-interactions: zero the claim before the external transfer; restore on failure.
     */
    function claimPendingErc1155(address token, uint256 tokenId) external nonReentrant {
        uint256 amount = _pendingErc1155Claims[msg.sender][token][tokenId];
        if (amount == 0) revert NoPendingErc1155Claim();
        _pendingErc1155Claims[msg.sender][token][tokenId] = 0;
        bytes memory extraData = abi.encode(address(this), msg.sender, tokenId, amount);
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xf242432a, address(this), msg.sender, tokenId, amount, extraData)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) {
            _pendingErc1155Claims[msg.sender][token][tokenId] = amount;
            revert Erc1155ClaimTransferFailed();
        }
        emit Erc1155ReturnClaimed(token, tokenId, msg.sender, amount);
    }

    // Private function to get balance of a specific ERC20 token in the contract
    function getBalanceTokenOfContract(
        address _erc20Address,
        address _fromAddress
    ) private view returns (uint256) {
        return IERC20(_erc20Address).balanceOf(_fromAddress);
    }

    // Private function to compare two strings
    function compareStrings(string memory a, string memory b) private pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    // Public function to return all ERC20 token contract addresses
    function allContractERC20() external view returns (address[] memory) {
        return erc20ListAddress;
    }

    // Return information about the current challenge
    function getChallengeInfo()
        external
        view
        returns (uint256 challengeCleared, uint256 challengeDayRequired, uint256 daysRemained)
    {
        return (
            currentStatus, // The current status of the challenge
            dayRequired, // The number of days required to complete the challenge
            dayRequired - (currentStatus) // The number of days remaining in the challenge
        );
    }

    // Return the array of award receiver percentages
    function getAwardReceiversPercent() public view returns (uint256[] memory) {
        return (awardReceiversPercent);
    }

    // Return the array of token balances for each token in the contract
    function getBalanceToken() public view returns (uint256[] memory) {
        return listBalanceAllToken;
    }

    /**
     * This function returns the address of an award receiver at the specified index.
     * If _isAddressSuccess is false, it returns the address of the award receiver who did not approve the transaction.
     * If _isAddressSuccess is true, it returns the address of the award receiver who approved the transaction.
     */
    function getAwardReceiversAtIndex(
        uint256 _index,
        bool _isAddressSuccess
    ) public view returns (address) {
        // If _isAddressSuccess is false, return the address of the award receiver who did not approve the transaction.
        if (!_isAddressSuccess) {
            return awardReceivers[_index + index];
        }
        // If _isAddressSuccess is true, return the address of the award receiver who approved the transaction.
        return awardReceivers[_index];
    }

    // CHALLENGE-2694: authoritative on-chain custody records for deposited NFTs. Previously
    // onERC721Received/onERC1155Received discarded `from` entirely -- transferNFTForSenderWhenFailed
    // then trusted a CALLER-SUPPLIED _listSenderAddress for who gets the NFT back, with no check
    // against who actually deposited it. Recording custody here lets the failure-path return use
    // an authoritative record instead of caller input.
    mapping(address => mapping(uint256 => address)) private erc721Depositor; // nft => tokenId => depositor
    mapping(address => mapping(uint256 => mapping(address => uint256))) private erc1155DepositorBalance; // nft => tokenId => depositor => amount
    mapping(address => mapping(uint256 => address[])) private erc1155Depositors; // nft => tokenId => depositor list (enumeration)

    /**
     * @dev onERC721Received. Records `from` as the authoritative depositor for (msg.sender, tokenId) --
     * msg.sender here is the NFT contract calling this hook, per the ERC721 standard.
     */
    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes memory
    ) external virtual override returns (bytes4) {
        erc721Depositor[msg.sender][tokenId] = from;
        return this.onERC721Received.selector;
    }

    /**
     * @dev onERC1155Received. Accumulates `from`'s balance for (msg.sender, tokenId); ERC1155 allows
     * more than one depositor to hold the same tokenId, so balances are tracked per-depositor.
     */
    function onERC1155Received(
        address,
        address from,
        uint256 tokenId,
        uint256 amount,
        bytes memory
    ) public returns (bytes4) {
        if (amount == 0) revert ZeroErc1155Deposit();
        if (!_erc1155DepositorRegistered[msg.sender][tokenId][from]) {
            _erc1155DepositorRegistered[msg.sender][tokenId][from] = true;
            erc1155Depositors[msg.sender][tokenId].push(from);
        }
        erc1155DepositorBalance[msg.sender][tokenId][from] += amount;
        return this.onERC1155Received.selector;
    }
}
