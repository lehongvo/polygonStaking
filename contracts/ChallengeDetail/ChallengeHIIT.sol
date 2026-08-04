// SPDX-License-Identifier: MIT
// File: Challenge/IChallengeFee.sol

pragma solidity ^0.8.16;

// ==== custom errors (auto) ====
error RelayExpired();
error RelayBadNonce();
error RelayBadSignature();
error TransferHelperFailed();
error OnlyStakeholdersCanCallThisFunction();
error InvalidHiitResultsLength();
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
error InsufficientMaticForNativeStaking();
error PrincipalMaticTransferFailed();
error RewardsMaticTransferFailed();
error SystemFeeMaticTransferFailed();

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
     * @dev Generates random rewards for a challenge based on the given daily result data.
     * @param _challengeAddress The address of the challenge for which rewards are being generated.
     * @param _dailyResult An array of daily result data (0=not achieved, 1=achieved for HIIT).
     * @return A boolean indicating whether the rewards were generated successfully.
     */
    function randomRewards(
        address _challengeAddress,
        uint256[] memory _dailyResult
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
     * @param _goal For HIIT challenges, pass `highIntensityIntervals` here (the external interface uses this slot for the primary numeric config).
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
     * @param _stepIndex Unused for HIIT — pass empty array [].
     * @param _data A tuple of two uint64 values.
     * @param _signature The signature to be validated.
     * @notice Verifies the authenticity of a provided signature for daily HIIT results.
     */
    function checkValidSignature(
        uint256[] memory _day,
        uint256[] memory _stepIndex,
        uint64[2] memory _data,
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
// File: Challenge/ChallengeHIIT.sol

pragma solidity ^0.8.16;

/**
 * @title ChallengeHIIT
 * @dev HIIT (High-Intensity Interval Training) challenge contract.
 *      Uses heart-rate-based evaluation: achieved per day is derived from highIntensityIntervals and totalHighIntensityTime.
 *      Reuses existing signature interface; backend signs HIIT result as 0/1 per day.
 */
contract ChallengeHIIT is IERC721Receiver {
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

    /** @dev historyData HIIT achieved status per day (0=not achieved, 1=achieved).
     */
    uint256[] historyData;

    /** @dev historyDate date in challenge.
     */
    uint256[] historyDate;

    /** @dev historyIntervals raw high-intensity interval count per day submission.
     */
    uint256[] historyIntervals;

    /** @dev historyTime raw total high-intensity seconds per day submission.
     */
    uint256[] historyTime;

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

    /** @dev dayRequired number of days which challenger need to achieve HIIT.
     */
    uint256 public dayRequired;

    /** @dev currentStatus number of days HIIT achieved.
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

    /** @dev hiitAchievedOn HIIT achieved status on a day (0 or 1).
     */
    mapping(uint256 => uint256) private hiitAchievedOn;

    /** @dev CHALLENGE-2698: tracks whether a canonical day has already counted toward
     *  currentStatus, independent of history-array bookkeeping/caller-supplied _timeRange --
     *  guarantees a day can only ever increment progress once, however many times it (or an
     *  overlapping signed batch covering it) is resubmitted. */
    mapping(uint256 => bool) private processedDay;

    ChallengeState private stateInstance;

    uint256[] private awardReceiversPercent;

    mapping(address => uint256[]) private awardTokenReceivers;

    uint256[] private listBalanceAllToken;

    uint256[] private amountTokenToReceiverList;

    uint256 public totalBalanceBaseToken;

    address public createByToken;

    uint8 private amountSuccessFee;

    uint8 private amountFailFee;

    /** @dev HIIT config: number of high-intensity intervals per day. */
    uint256 public highIntensityIntervals;

    /** @dev HIIT config: total high-intensity time in seconds per day. */
    uint256 public totalHighIntensityTime;

    // Reentrancy guard status: 1 = NOT_ENTERED, 2 = ENTERED.
    uint256 private _reentrancyStatus = 1;

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
     * @param _primaryRequired [duration, startTime, endTime, highIntensityIntervals, totalHighIntensityTime, dayRequired].
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
        if (!(_allowGiveUp.length == 3)) revert InvalidAllowGiveUp();
        if (!(_primaryRequired.length >= 6)) revert InvalidHiitData();
        if (_allowGiveUp[1]) {
            if (!(msg.value == _totalAmount)) revert InvalidAward();
        }

        uint256 i;

        if (!(_index > 0)) revert InvalidValue();
        _totalAmount = _totalAmount - _gasData[2];

        uint256[] memory awardReceiversApprovalsTamp = new uint256[](_awardReceiversPercent.length);

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
            awardReceiversApprovalsTamp[j] = (_awardReceiversPercent[j] * _totalAmount) / 100;
        }

        if (!(_awardReceivers.length == awardReceiversApprovalsTamp.length)) revert InvalidLists();
        for (i = 0; i < _index; i++) {
            if (!(awardReceiversApprovalsTamp[i] > 0)) revert InvalidValue0();
            approvalSuccessOf[_awardReceivers[i]] = awardReceiversApprovalsTamp[i];
            sumAwardSuccess = sumAwardSuccess + awardReceiversApprovalsTamp[i];
        }

        for (i = _index; i < _awardReceivers.length; i++) {
            if (!(awardReceiversApprovalsTamp[i] > 0)) revert InvalidValue1();
            approvalFailOf[_awardReceivers[i]] = awardReceiversApprovalsTamp[i];
            sumAwardFail = sumAwardFail + awardReceiversApprovalsTamp[i];
        }

        sponsor = _stakeHolders[0];
        challenger = _stakeHolders[1];
        feeAddress = _stakeHolders[2];
        erc721Address = _erc721Address;
        erc20ListAddress = IExerciseSupplementNFT(_erc721Address[0]).getErc20ListAddress();
        returnedNFTWallet = IExerciseSupplementNFT(_erc721Address[0]).returnedNFTWallet();
        duration = _primaryRequired[0];
        startTime = _primaryRequired[1];
        endTime = _primaryRequired[2];
        highIntensityIntervals = _primaryRequired[3];
        totalHighIntensityTime = _primaryRequired[4];
        dayRequired = _primaryRequired[5];
        stateInstance = ChallengeState.PROCESSING;
        awardReceivers = _awardReceivers;
        awardReceiversApprovals = awardReceiversApprovalsTamp;
        awardReceiversPercent = _awardReceiversPercent;
        index = _index;
        gasFee = _gasData[2];
        createByToken = _createByToken;

        (amountSuccessFee, amountFailFee) = IChallengeFee(
            IExerciseSupplementNFT(_erc721Address[0]).feeSettingAddress()
        ).getAmountFee();

        totalReward = _totalAmount;
        allowGiveUp = _allowGiveUp;

        if (_allowGiveUp[0] && _allAwardToSponsorWhenGiveUp) choiceAwardToSponsor = true;

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
            tranferCoinNative(payable(msg.sender), msg.value);
        }
    }

    /**
     * @dev Send daily HIIT results to update contract activities.
     * @param _day An array of uint256 values representing days.
     * @param _intervals Number of high-intensity intervals per day (one value per day).
     * @param _totalSeconds Total high-intensity time in seconds per day (one value per day).
     *        A day is achieved when _intervals[i] >= highIntensityIntervals AND _totalSeconds[i] >= totalHighIntensityTime.
     * @param _data A tuple of two uint64 values.
     * @param _signature The signature to be validated.
     * @param _listGachaAddress An array of addresses representing Gacha contract addresses.
     * @param _listNFTAddress An array of addresses representing NFT contract addresses.
     * @param _listIndexNFT An array of arrays representing NFT indices.
     * @param _listSenderAddress An array of arrays representing sender addresses.
     * @param _statusTypeNft An array of boolean values representing NFT status types.
     * @param _timeRange A tuple of two uint64 values representing the time range.
     * @dev This function can only be called by authorized challengers within a specific time frame.
     */
    function sendDailyResult(
        uint256[] memory _day,
        uint256[] memory _intervals,
        uint256[] memory _totalSeconds,
        uint64[2] memory _data,
        bytes calldata _signature,
        address[] memory _listGachaAddress,
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft,
        uint64[2] memory _timeRange
    ) public nonReentrant available onTimeSendResult onlyChallenger {
        _executeDailyResult(_day, _intervals, _totalSeconds, _data, _signature, _listGachaAddress, _listNFTAddress, _listIndexNFT, _listSenderAddress, _statusTypeNft, _timeRange);
    }

    mapping(address => uint256) public relayNonce;

    /**
     * @notice Meta-tx relayer: challenger ký off-chain, relayer submit. ⚠️ FUND-AUTH — audit trước deploy.
     */
    function sendDailyResultViaRelayer(
        uint256[] memory _day,
        uint256[] memory _intervals,
        uint256[] memory _totalSeconds,
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
        // Các tham số NFT/Gacha điều khiển việc CHUYỂN TÀI SẢN nên PHẢI nằm trong chữ ký.
        // Nếu không, relayer có thể tái dùng chữ ký hợp lệ của challenger nhưng đổi
        // địa chỉ NFT / người nhận / target Gacha. Hash riêng rồi nhét vào payload.
        bytes32 assetHash = keccak256(
            abi.encode(_signature, _listGachaAddress, _listNFTAddress, _listIndexNFT, _listSenderAddress, _statusTypeNft)
        );
        bytes32 payload = keccak256(
            abi.encode(address(this), block.chainid, _nonce, _deadline, _day, _intervals, _totalSeconds, _data, _timeRange, assetHash)
        );
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payload));
        if (!(_recoverRelaySigner(ethHash, _challengerSig) == challenger)) revert RelayBadSignature();
        relayNonce[challenger]++;
        _executeDailyResult(_day, _intervals, _totalSeconds, _data, _signature, _listGachaAddress, _listNFTAddress, _listIndexNFT, _listSenderAddress, _statusTypeNft, _timeRange);
    }

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
        uint256[] memory _intervals,
        uint256[] memory _totalSeconds,
        uint64[2] memory _data,
        bytes calldata _signature,
        address[] memory _listGachaAddress,
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft,
        uint64[2] memory _timeRange
    ) private {
        uint256[] memory emptyArr = new uint256[](0);
        IExerciseSupplementNFT(erc721Address[0]).checkValidSignature(
            _day,
            emptyArr,
            _data,
            _signature
        );

        uint dayLength = _day.length;
        if (!(dayLength > 0)) revert InvalidHiitResultsLength();
        if (!(_intervals.length == dayLength && _totalSeconds.length == dayLength)) revert InvalidHiitResultsLength();
        // CHALLENGE-2698: reject a batch with duplicate/unsorted days outright -- a strictly
        // increasing _day array means the "last day" special-casing below (indices computed
        // from dayLength-1) can never be confused by an out-of-order or repeated entry.
        for (uint256 k = 1; k < dayLength; k++) {
            if (!(_day[k] > _day[k - 1])) revert UnsortedOrDuplicateDays();
        }

        uint256[] memory achieved = new uint256[](dayLength);
        for (uint256 i = 0; i < dayLength; i++) {
            if (
                _intervals[i] >= highIntensityIntervals &&
                _totalSeconds[i] >= totalHighIntensityTime
            ) {
                achieved[i] = 1;
            }
        }

        bool isSendSameDay;
        bool isSendFailWithSameDay;
        uint256 lastIndex = totalReward;
        uint256[] storage tempHistoryDate = historyDate;
        uint256[] storage tempHistoryData = historyData;

        for (uint256 i = 0; i < dayLength; i++) {
            bool dayAlreadyAchieved = false;
            bool dayFoundInHistory = false;
            bool thisDayIsSameDay = false;

            uint256 histLen = tempHistoryDate.length;
            for (uint256 j = 0; j < histLen; j++) {
                if (
                    !thisDayIsSameDay &&
                    tempHistoryDate[j] >= _timeRange[0] &&
                    tempHistoryDate[j] <= _timeRange[1] &&
                    tempHistoryDate[j] == _day[dayLength - 1]
                ) {
                    if (tempHistoryData[j] == 1) require(false, "Day already achieved");
                    isSendSameDay = true;
                    thisDayIsSameDay = true;
                    tempHistoryData[j] = achieved[dayLength - 1];
                    tempHistoryDate[j] = _day[dayLength - 1];
                    hiitAchievedOn[_day[dayLength - 1]] = achieved[dayLength - 1];
                    historyIntervals[j] = _intervals[dayLength - 1];
                    historyTime[j] = _totalSeconds[dayLength - 1];
                } else {
                    if (tempHistoryDate[j] == _day[i]) {
                        dayFoundInHistory = true;
                        if (tempHistoryData[j] == 1) {
                            dayAlreadyAchieved = true;
                        }
                        lastIndex = i;
                        tempHistoryData[j] = achieved[i];
                        hiitAchievedOn[_day[i]] = achieved[i];
                        historyIntervals[j] = _intervals[i];
                        historyTime[j] = _totalSeconds[i];
                    }
                }
            }

            if (!thisDayIsSameDay && !dayFoundInHistory) {
                tempHistoryDate.push(_day[i]);
                tempHistoryData.push(achieved[i]);
                hiitAchievedOn[_day[i]] = achieved[i];
                historyIntervals.push(_intervals[i]);
                historyTime.push(_totalSeconds[i]);
            }

            uint256 achievedValue = thisDayIsSameDay ? achieved[dayLength - 1] : achieved[i];
            // CHALLENGE-2698: processedDay is an independent, guaranteed-correct backstop on
            // top of the existing dayAlreadyAchieved history scan above -- it guards against
            // counting the same canonical day twice regardless of _timeRange or how the
            // history-array bookkeeping branches, however many times the day is resubmitted.
            uint256 dayForProgress = thisDayIsSameDay ? _day[dayLength - 1] : _day[i];
            if (
                achievedValue == 1 &&
                !dayAlreadyAchieved &&
                currentStatus < dayRequired &&
                !processedDay[dayForProgress]
            ) {
                if (!thisDayIsSameDay || i == dayLength - 1) {
                    currentStatus = currentStatus + 1;
                    processedDay[dayForProgress] = true;
                }
            }
        }

        if (tempHistoryData.length > 1) {
            isSendFailWithSameDay = true;
            for (uint256 i = 0; i < tempHistoryData.length - 1; i++) {
                if (tempHistoryData[i] == 0) {
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
            achieved[dayLength - 1] == 0 &&
            _day[dayLength - 1] > _timeRange[0] &&
            _day[dayLength - 1] < _timeRange[1]
        ) {
            isSendFailWithSameDay = true;
        }

        if (
            sequence - currentStatus > duration - dayRequired &&
            !isSendFailWithSameDay &&
            lastIndex == totalReward
        ) {
            stateInstance = ChallengeState.FAILED;
            transferToListReceiverFail(
                _listNFTAddress,
                _listIndexNFT,
                _listSenderAddress,
                _statusTypeNft
            );
        } else {
            if (currentStatus >= dayRequired) {
                stateInstance = ChallengeState.SUCCESS;
                transferToListReceiverSuccess(_listNFTAddress, _listIndexNFT, _statusTypeNft);
            }
        }

        for (uint256 i = 0; i < _listGachaAddress.length; i++) {
            IGacha(_listGachaAddress[i]).randomRewards(address(this), achieved);
        }

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

            for (uint256 i = 0; i < erc20ListAddress.length; i++) {
                uint256 amountTokenToReceiver;
                uint256 totalTokenRewardSubtractFee =
                    (listBalanceAllToken[i] * remainningAmountFee) / 100;

                if (getBalanceTokenOfContract(erc20ListAddress[i], address(this)) > 0) {
                    amountTokenToReceiver =
                        (totalTokenRewardSubtractFee * currentStatus) / dayRequired;

                    uint256 amountNativeToSponsor =
                        totalTokenRewardSubtractFee - amountTokenToReceiver;

                    TransferHelper.safeTransfer(
                        erc20ListAddress[i],
                        sponsor,
                        amountNativeToSponsor
                    );

                    amountTokenToReceiverList.push(amountTokenToReceiver);
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
                    if (getBalanceTokenOfContract(erc20ListAddress[j], address(this)) > 0) {
                        uint256 amountTokenTmp =
                            (awardTokenReceivers[erc20ListAddress[j]][i] *
                                amountTokenToReceiverList[j]) /
                                ((listBalanceAllToken[j] * remainningAmountFee) / 100);

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
        transferToListReceiverFail(
            _listNFTAddress,
            _listIndexNFT,
            _listSenderAddress,
            _statusTypeNft
        );

        stateInstance = ChallengeState.CLOSED;
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
                highIntensityIntervals,
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

        tranferCoinNative(feeAddress, serverFailureFee);
        emit FundTransfer(feeAddress, serverFailureFee);

        // CHALLENGE-2696: same fee-complement scaling as transferToListReceiverSuccess, using
        // amountFailFee -- see the comment there for why this is safe and giveUp()-neutral.
        for (uint256 i = index; i < awardReceivers.length; i++) {
            tranferCoinNative(
                awardReceivers[i],
                (approvalFailOf[awardReceivers[i]] * (100 - amountFailFee)) / 100
            );

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

        transferNFTForSenderWhenFailed(
            _listNFTAddress,
            _listIndexNFT,
            _listSenderAddress,
            _statusTypeNft
        );

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
        for (uint256 i = 0; i < _listNFTAddress.length; i++) {
            if (_statusTypeNft[i]) {
                for (uint256 j = 0; j < _listIndexNFT[i].length; j++) {
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
                    bytes memory extraData = abi.encode(
                        address(this),
                        _receiveAddress,
                        _listIndexNFT[i][j],
                        balanceTokenERC1155
                    );
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
                for (uint256 j = 0; j < lengthListIndexNFT; j++) {
                    uint256 tokenId = _listIndexNFT[i][j];
                    address[] memory depositors = erc1155Depositors[_listNFTAddress[i]][tokenId];
                    if (depositors.length > 0) {
                        for (uint256 d = 0; d < depositors.length; d++) {
                            address depositor = depositors[d];
                            uint256 amount = erc1155DepositorBalance[_listNFTAddress[i]][tokenId][depositor];
                            if (amount == 0) continue; // already returned

                            erc1155DepositorBalance[_listNFTAddress[i]][tokenId][depositor] = 0; // CEI

                            bytes memory extraData = abi.encode(address(this), depositor, tokenId, amount);
                            TransferHelper.safeTransferNFT1155(
                                _listNFTAddress[i],
                                address(this),
                                depositor,
                                tokenId,
                                amount,
                                extraData
                            );
                        }
                    } else {
                        uint256 heldBalance = IERC1155(_listNFTAddress[i]).balanceOf(address(this), tokenId);
                        if (heldBalance > 0) {
                            bytes memory extraData = abi.encode(address(this), challenger, tokenId, heldBalance);
                            TransferHelper.safeTransferNFT1155(
                                _listNFTAddress[i],
                                address(this),
                                challenger,
                                tokenId,
                                heldBalance,
                                extraData
                            );
                        }
                    }
                }
            }
        }
    }

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

        uint256 coinNativeBalance = address(this).balance;

        if (coinNativeBalance > 0) {
            serverSuccessFee = (coinNativeBalance * amountSuccessFee) / 100;
            serverFailureFee = (coinNativeBalance * amountFailFee) / 100;

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
            // native balance, tranferCoinNative() in settlement reverts
            // (InsufficientContractBalance) and permanently bricks the payout (root cause
            // of the ~1700 JPYC stuck on Kaia). Zero the native accruals so those
            // transfers become no-ops; the ERC20 distribution below pays receivers.
            serverSuccessFee = 0;
            serverFailureFee = 0;
            for (uint256 i = 0; i < awardReceivers.length; i++) {
                approvalSuccessOf[awardReceivers[i]] = 0;
                approvalFailOf[awardReceivers[i]] = 0;
            }
        }

        totalBalanceBaseToken = getContractBalance();

        for (uint256 i = 0; i < erc20ListAddress.length; i++) {
            listBalanceAllToken.push(IERC20(erc20ListAddress[i]).balanceOf(address(this)));

            if (getBalanceTokenOfContract(erc20ListAddress[i], address(this)) > 0) {
                for (uint256 j = 0; j < awardReceiversPercent.length; j++) {
                    uint256 awardAmount =
                        (awardReceiversPercent[j] *
                            IERC20(erc20ListAddress[i]).balanceOf(address(this))) / 100;
                    awardTokenReceivers[erc20ListAddress[i]].push(awardAmount);
                }

                // CHALLENGE-2696: use the fee percent matching the ACTUAL outcome being settled
                // (was always amountFailFee, overcharging/undercharging success settlements).
                uint8 tokenFeePercent = _isSuccessOutcome ? amountSuccessFee : amountFailFee;
                uint256 realAmountFee = (listBalanceAllToken[i] * tokenFeePercent) / 100;
                if (realAmountFee > 0) {
                    TransferHelper.safeTransfer(erc20ListAddress[i], feeAddress, realAmountFee);
                }
            }
        }
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getChallengeHistory()
        external
        view
        returns (uint256[] memory date, uint256[] memory data)
    {
        return (historyDate, historyData);
    }

    /**
     * @dev Returns raw HIIT submission history per day.
     * @return date Array of submission timestamps.
     * @return data Array of achieved status per day (0=not achieved, 1=achieved).
     * @return intervals Array of raw high-intensity interval counts per day.
     * @return time Array of raw total high-intensity seconds per day.
     */
    function getHIITHistory()
        external
        view
        returns (
            uint256[] memory date,
            uint256[] memory data,
            uint256[] memory intervals,
            uint256[] memory time
        )
    {
        return (historyDate, historyData, historyIntervals, historyTime);
    }

    function getState() external view returns (ChallengeState) {
        return stateInstance;
    }

    function tranferCoinNative(address payable from, uint256 value) private {
        if (!(getContractBalance() >= value)) revert InsufficientContractBalance();
        TransferHelper.saveTransferEth(from, value);
    }

    function getBalanceTokenOfContract(
        address _erc20Address,
        address _fromAddress
    ) private view returns (uint256) {
        return IERC20(_erc20Address).balanceOf(_fromAddress);
    }

    function allContractERC20() external view returns (address[] memory) {
        return erc20ListAddress;
    }

    /** @dev Returns HIIT challenge progress info.
     *  @return challengeCleared Number of days HIIT was achieved.
     *  @return challengeDayRequired Total days required to complete the challenge.
     *  @return daysRemained Days still needed to achieve HIIT.
     */
    function getChallengeInfo()
        external
        view
        returns (uint256 challengeCleared, uint256 challengeDayRequired, uint256 daysRemained)
    {
        return (currentStatus, dayRequired, dayRequired - currentStatus);
    }

    /** @dev Returns the HIIT configuration for this challenge. */
    function getHIITConfig()
        external
        view
        returns (uint256 _highIntensityIntervals, uint256 _totalHighIntensityTime)
    {
        return (highIntensityIntervals, totalHighIntensityTime);
    }

    /** @dev Returns the HIIT achievement status for a specific day. */
    function getHIITAchievedOn(uint256 _day) external view returns (uint256) {
        return hiitAchievedOn[_day];
    }

    function getAwardReceiversPercent() public view returns (uint256[] memory) {
        return (awardReceiversPercent);
    }

    function getBalanceToken() public view returns (uint256[] memory) {
        return listBalanceAllToken;
    }

    function getAwardReceiversAtIndex(
        uint256 _index,
        bool _isAddressSuccess
    ) public view returns (address) {
        if (!_isAddressSuccess) {
            return awardReceivers[_index + index];
        }
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
        if (erc1155DepositorBalance[msg.sender][tokenId][from] == 0) {
            erc1155Depositors[msg.sender][tokenId].push(from);
        }
        erc1155DepositorBalance[msg.sender][tokenId][from] += amount;
        return this.onERC1155Received.selector;
    }
}
