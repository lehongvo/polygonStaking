// SPDX-License-Identifier: MIT
// File: Challenge/IChallengeFee.sol

pragma solidity ^0.8.16;

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
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: APPROVE_FAILED"
        );
    }

    function saveTransferEth(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Address: unable to send value, recipient may have reverted");
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
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: MINT_NFT1155_FAILED"
        );
    }

    function safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: TRANSFER_FAILED"
        );
    }

    function safeApproveForAllNFT1155(address token, address operator, bool approved) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa22cb465, operator, approved)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: APPROVE_NFT1155_FAILED"
        );
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
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: TRANSFER_NFT1155_FAILED"
        );
    }

    function safeMintNFT(address token, address to) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x40d097c3, to));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: MINT_NFT_FAILED"
        );
    }

    function safeApproveForAll(address token, address to, bool value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa22cb465, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: APPROVE_FAILED"
        );
    }

    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TransferHelper: TRANSFER_FROM_FAILED"
        );
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
            require(
                success && (data.length == 0 || abi.decode(data, (bool))),
                "TransferHelper: TRANSFER_FAILED"
            );
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
     * @param _goal For HIIT challenges, 0 (there is no per-day step or interval goal).
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
 * @title ChallengeHIITV4
 * @dev Contract version 4 of the HIIT-only challenge (Timer V1).
 *      The phone judges each day and the backend checks the workout record before signing, so the
 *      contract only records days sent as achieved. A day is counted at most once. Days are keyed by
 *      the first second of the calendar day in the challenge's creation time zone. Results are
 *      accepted until the outcome is finalized (success, give-up or close); there is no
 *      endTime + 2 days limit. Only the challenger can give up.
 */
contract ChallengeHIITV4 is IERC721Receiver {
    /** @dev HIIT results: achieved exercise days, with `achieved` always 1. */
    struct HiitInput {
        uint256[] day;
        uint256[] achieved;
        uint64[] timeRange;
    }

    /**
     * @dev Required value of `_data[0]` in a V4 result signature ("ESPV4SR!"), so a signature made
     *      for an older contract version can never be accepted by this contract.
     */
    uint64 public constant SIGNATURE_DOMAIN_V4 = 0x4553505634535221;

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

    /** @dev historyData achieved flag per recorded day, always 1 (only achieved days are recorded).
     */
    uint256[] historyData;

    /** @dev HIIT menu: seconds of move and rest per set, total sets, first sets not judged, target %. */
    uint256 private hiitMoveSeconds;
    uint256 private hiitRestSeconds;
    uint256 private hiitTotalSets;
    uint256 private hiitUnscoredSets;
    uint256 private hiitTargetPercent;

    /** @dev historyDate achieved days, in first-submission order.
     */
    uint256[] historyDate;

    /** @dev historyDateIndex O(1) lookup: day index (see _dayIndex) → (index in historyDate) + 1; 0 means not present.
     */
    mapping(uint256 => uint256) private historyDateIndex;

    /**
     * @dev dayAnchor the first recorded exercise day key; it anchors the challenge calendar.
     *      Results are keyed by the day index from this anchor (see _dayIndex), so one calendar
     *      day can never be counted twice under two keys.
     */
    uint256 public dayAnchor;

    /** @dev Keeps the day index positive for days recorded before the anchor day. */
    uint256 private constant DAY_INDEX_OFFSET = 36500 days;

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

    /** @dev allowGiveUp challenge allow give up or not.
     */
    bool[] public allowGiveUp;

    /** @dev isFinished challenge finish or not.
     */
    bool public isFinished;

    /** @dev isSuccess challenge success or not.
     */
    bool public isSuccess;

    /** @dev selectGiveUpStatus challenge need be give up one time.
     */
    bool selectGiveUpStatus;

    ChallengeState private stateInstance;

    uint256[] private awardReceiversPercent;

    mapping(address => uint256[]) private awardTokenReceivers;

    uint256[] private listBalanceAllToken;

    uint256 public totalBalanceBaseToken;

    /**
     * @dev Unpaid amounts of failed transfers, by token (address(0) = native coin) and intended recipient.
     *      Only that recipient can claim them; they never go to the sponsor.
     */
    mapping(address => mapping(address => uint256)) public claimable;

    /** @dev Total claimable per token (address(0) = native coin), kept out of the remainder returned to the sponsor. */
    mapping(address => uint256) public totalClaimable;

    address public createByToken;

    uint8 private amountSuccessFee;

    uint8 private amountFailFee;

    // Reentrancy guard status: 1 = NOT_ENTERED, 2 = ENTERED.
    uint256 private _reentrancyStatus = 1;

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    modifier nonReentrant() {
        require(_reentrancyStatus != 2, "ReentrancyGuard: reentrant call");
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
     * @dev Emitted when a native-token transfer to a receiver fails during settlement.
     * Settlement continues rather than reverting — funds remain in contract for recovery.
     */
    event NativeTransferFailed(address indexed receiver, uint256 amount);

    /**
     * @dev Emitted when a transfer fails during settlement; the amount stays claimable by its recipient.
     * @param token The token (address(0) = native coin).
     */
    event TransferClaimable(address indexed token, address indexed receiver, uint256 amount);

    /** @dev Emitted when a recipient claims an amount left by a failed transfer. */
    event Claimed(address indexed token, address indexed receiver, uint256 amount);

    /**
     * @dev Emitted when a gacha call fails. The gacha is a bonus: its failure must not block the
     * result submission or settlement, but it is recorded so it can be reconciled off chain.
     * @param gacha The gacha contract whose randomRewards call failed.
     */
    event GachaRewardFailed(address indexed gacha);

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
        require(block.timestamp >= startTime, "Challenge has not started yet");
        require(block.timestamp <= endTime, "Challenge was finished");
        _;
    }

    /**
     * @dev Action should be called in required time.
     */
    modifier onTimeSendResult() {
        // No upper time limit: results are accepted until the outcome is finalized (see `available`).
        require(block.timestamp >= startTime, "Challenge has not started yet");
        _;
    }

    /**
     * @dev Action should be called after challenge finish.
     */
    modifier afterFinish() {
        require(block.timestamp > endTime + 2 days, "Challenge has not finished yet");
        _;
    }

    /**
     * @dev Action should be called when challenge is running.
     */
    modifier available() {
        require(!isFinished, "Challenge was finished");
        _;
    }

    /**
     * @dev Action should be called when challenge was allowed give up.
     */
    modifier canGiveUp() {
        require(allowGiveUp[0], "Can not give up");
        _;
    }

    /**
     * @dev User only call give up one time.
     */
    modifier notSelectGiveUp() {
        require(!selectGiveUpStatus, "This challenge was give up");
        _;
    }

    /**
     * @dev Action only called from challenger.
     */
    modifier onlyChallenger() {
        require(msg.sender == challenger, "Only challenger can call this function");
        _;
    }

    /**
     * @dev verify challenge success or not before close.
     */
    modifier availableForClose() {
        require(!isSuccess && !isFinished, "Cant call");
        _;
    }

    /**
     * @dev Constructor function for creating a new challenge.
     * @param _stakeHolders Array of addresses of the stakeholders participating in the challenge.
     * @param _createByToken The address of the token used to create this challenge.
     * @param _erc721Address Array of addresses of the ERC721 tokens used in the challenge.
     * @param _primaryRequired [duration (days), startTime, endTime, dayRequired (achieved days; 0 counts as reached),
     *        move seconds, rest seconds, total sets, first sets not judged, target percent].
     * @param _awardReceivers Array of addresses of the receivers who will receive awards if the challenge succeeds.
     * @param _index The index of the current award receiver.
     * @param _allowGiveUp Array of boolean values indicating whether each stakeholder can give up the challenge or not.
     * @param _gasData Array of gas data values for executing the smart contract functions in the challenge.
     *      The ninth argument (all awards to the sponsor on give-up) is ignored and kept for the deploy arguments:
     *      on give-up the deposit minus the failure fee always goes back to the sponsor (no payout by achievement).
     * @param _awardReceiversPercent Percent of each receiver. With the fees read from the fee contract, the success
     *        percents plus the success fee and the failure percents plus the failure fee must each make 100.
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
        bool /* _allAwardToSponsorWhenGiveUp */,
        uint256[] memory _awardReceiversPercent,
        uint256 _totalAmount
    ) payable {
        require(_allowGiveUp.length == 3, "Invalid allow give up");
        // [duration, startTime, endTime, dayRequired, M, R, T, N, target percent]
        require(_primaryRequired.length == 9, "Invalid HIIT data");
        // Only what must always hold: the Custom limits stay in the backend settings.
        require(
            _primaryRequired[4] > 0 &&
                _primaryRequired[5] > 0 &&
                _primaryRequired[7] > 0 &&
                _primaryRequired[7] < _primaryRequired[6] &&
                _primaryRequired[8] > 0 &&
                _primaryRequired[8] <= 100,
            "Invalid HIIT menu"
        );

        if (_allowGiveUp[1]) {
            require(msg.value == _totalAmount, "Invalid award");
        }

        uint256 i;
        uint256 successPercent;
        uint256 failPercent;

        require(_index > 0, "Invalid value");
        // Required HIIT days: at least 1 and at most the number of calendar days of the period.
        require(
            _primaryRequired[3] >= 1 &&
                _primaryRequired[3] <= (_primaryRequired[2] - _primaryRequired[1]) / 1 days + 1,
            "Invalid required days"
        );

        _totalAmount = _totalAmount - _gasData[2];

        uint256[] memory awardReceiversApprovalsTamp = new uint256[](_awardReceiversPercent.length);

        for (uint256 j = 0; j < _awardReceiversPercent.length; j++) {
            awardReceiversApprovalsTamp[j] = (_awardReceiversPercent[j] * _totalAmount) / 100;
        }

        require(_awardReceivers.length == awardReceiversApprovalsTamp.length, "Invalid lists");

        for (i = 0; i < _index; i++) {
            require(awardReceiversApprovalsTamp[i] > 0, "Invalid value0");
            sumAwardSuccess = sumAwardSuccess + awardReceiversApprovalsTamp[i];
            successPercent += _awardReceiversPercent[i];
        }

        for (i = _index; i < _awardReceivers.length; i++) {
            require(awardReceiversApprovalsTamp[i] > 0, "Invalid value1");
            sumAwardFail = sumAwardFail + awardReceiversApprovalsTamp[i];
            failPercent += _awardReceiversPercent[i];
        }

        require(_stakeHolders[2] != address(0), "Invalid fee address");
        sponsor = _stakeHolders[0];
        challenger = _stakeHolders[1];
        feeAddress = _stakeHolders[2];
        erc721Address = _erc721Address;
        erc20ListAddress = IExerciseSupplementNFT(_erc721Address[0]).getErc20ListAddress();
        returnedNFTWallet = IExerciseSupplementNFT(_erc721Address[0]).returnedNFTWallet();
        duration = _primaryRequired[0];
        startTime = _primaryRequired[1];
        endTime = _primaryRequired[2];
        dayRequired = _primaryRequired[3];
        hiitMoveSeconds = _primaryRequired[4];
        hiitRestSeconds = _primaryRequired[5];
        hiitTotalSets = _primaryRequired[6];
        hiitUnscoredSets = _primaryRequired[7];
        hiitTargetPercent = _primaryRequired[8];
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
        // Each outcome pays exactly the deposit: nothing but a rounding remainder can stay in the contract.
        require(
            successPercent + amountSuccessFee == 100 && failPercent + amountFailFee == 100,
            "Invalid award percent"
        );

        totalReward = _totalAmount;
        allowGiveUp = _allowGiveUp;

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
     * @dev Send achieved HIIT days.
     *      Each entry carries its exercise day key and its range [start, end] (see `_checkDays`).
     *      A day already recorded is skipped: no revert, no second count, no gacha roll.
     *      The backend signs the payload hash; it is passed to the NFT signature check as its only
     *      step-index element, so every submitted value is signed, and `_data[0]` must be
     *      SIGNATURE_DOMAIN_V4.
     * @param _hiit Achieved days, with `achieved` always 1.
     * @param _data [SIGNATURE_DOMAIN_V4, signature expiry]; the expiry is checked by the NFT contract.
     * @param _signature Backend signature over the payload hash.
     * @param _listGachaAddress Gacha contracts called with one achieved flag per newly recorded day.
     * @param _listNFTAddress An array of addresses representing NFT contract addresses.
     * @param _listIndexNFT An array of arrays representing NFT indices.
     * @param _statusTypeNft An array of boolean values representing NFT status types.
     */
    function sendDailyResult(
        HiitInput calldata _hiit,
        uint64[2] memory _data,
        bytes calldata _signature,
        address[] memory _listGachaAddress,
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        bool[] memory _statusTypeNft
    ) public nonReentrant available onTimeSendResult onlyChallenger {
        require(_data[0] == SIGNATURE_DOMAIN_V4, "Invalid signature domain");
        uint256[] memory payloadHash = new uint256[](1);
        payloadHash[0] = _hiitPayloadHash(_hiit);
        IExerciseSupplementNFT(erc721Address[0]).checkValidSignature(
            new uint256[](0),
            payloadHash,
            _data,
            _signature
        );
        require(_hiit.day.length > 0, "Invalid HIIT results length");
        require(_hiit.achieved.length == _hiit.day.length, "Invalid HIIT results length");
        // The first recorded day anchors the challenge calendar (see _dayIndex).
        if (dayAnchor == 0) dayAnchor = _hiit.day[0];
        _checkDays(_hiit.day, _hiit.timeRange);

        // One achieved flag per newly recorded day: a resend must not roll the gacha again.
        uint256[] memory newFlags = _recordHiit(_hiit);

        // Success when the required number of achieved days is reached. There is no early failure
        // here: late results can still add a past day, so a failed outcome is only finalized by
        // closeChallenge (after endTime + 2 days) or giveUp.
        if (currentStatus >= dayRequired) {
            stateInstance = ChallengeState.SUCCESS;
            transferToListReceiverSuccess(_listNFTAddress, _listIndexNFT, _statusTypeNft);
        }

        // try/catch so a faulty/paused gacha cannot revert and block settlement
        // (settlement above is already final; gacha is a bonus side-effect).
        if (newFlags.length > 0) {
            for (uint256 i = 0; i < _listGachaAddress.length; i++) {
                try
                    IGacha(_listGachaAddress[i]).randomRewards(address(this), newFlags)
                {} catch {
                    emit GachaRewardFailed(_listGachaAddress[i]);
                }
            }
        }

        emit SendDailyResult(currentStatus);
    }

    /**
     * @dev Payload hash signed by the backend:
     *      keccak256(abi.encode(_hiit.day, _hiit.achieved, _hiit.timeRange)).
     */
    function _hiitPayloadHash(HiitInput calldata _hiit) private pure returns (uint256) {
        return uint256(keccak256(abi.encode(_hiit.day, _hiit.achieved, _hiit.timeRange)));
    }

    /**
     * @dev Record the submitted days. A day already recorded is skipped.
     * @return newFlags One achieved flag (1) per newly recorded day.
     */
    function _recordHiit(HiitInput calldata _hiit) private returns (uint256[] memory newFlags) {
        newFlags = new uint256[](_hiit.day.length);
        uint256 newCount;
        for (uint256 i = 0; i < _hiit.day.length; i++) {
            require(_hiit.achieved[i] == 1, "Invalid achieved");
            uint256 day = _hiit.day[i];
            uint256 dayIndex = _dayIndex(day);
            if (historyDateIndex[dayIndex] != 0) continue;
            historyDate.push(day);
            historyData.push(1);
            historyDateIndex[dayIndex] = historyDate.length;
            if (currentStatus < dayRequired) currentStatus = currentStatus + 1;
            newFlags[newCount] = 1;
            newCount = newCount + 1;
        }
        assembly {
            mstore(newFlags, newCount)
        }
    }

    /**
     * @dev Validate the exercise day keys against their ranges.
     *      `_timeRange` holds one [start, end] pair per day: [start0, end0, start1, end1, ...].
     *      The range start is the later of the day key and the challenge start, so day 1 runs from
     *      the challenge start to the end of that calendar day. The range end sits 23 to 25 hours
     *      after the day key (daylight saving time). The day must have started, must be one of the
     *      period's calendar days (its key less than one day before the start, its range ending between
     *      the start time and the end time), and its key must sit on the challenge calendar (_dayIndex).
     *      Known limit: on a 25-hour day, a start in its last hour would refuse that day's key.
     */
    function _checkDays(uint256[] calldata _days, uint64[] calldata _timeRange) private view {
        require(_timeRange.length == _days.length * 2, "Invalid time range length");
        for (uint256 i = 0; i < _days.length; i++) {
            uint256 day = _days[i];
            uint256 rangeStart = _timeRange[2 * i];
            uint256 rangeEnd = _timeRange[2 * i + 1];
            require(
                rangeStart == (day > startTime ? day : startTime) &&
                    rangeEnd >= day + 23 hours - 1 &&
                    rangeEnd <= day + 25 hours - 1,
                "Invalid time range"
            );
            require(rangeStart <= block.timestamp, "Day has not started");
            require(
                day + 1 days > startTime && rangeEnd >= startTime && rangeEnd <= endTime,
                "Day outside challenge period"
            );
            // The key, never the range start: day 1 can start many hours after its key.
            _dayIndex(day);
        }
    }

    /**
     * @dev Index of an exercise day on the calendar anchored at `dayAnchor`. A day key must be a
     *      whole number of days from the anchor, within one hour for daylight saving time, so a
     *      calendar day has exactly one index even if its key were built in another time zone.
     */
    function _dayIndex(uint256 _day) private view returns (uint256 calendarIndex) {
        bool onCalendar;
        (calendarIndex, onCalendar) = _calendarIndex(_day);
        require(onCalendar, "Day not on the challenge calendar");
    }

    /** @dev Day index of `_day` and whether it is within one hour of the anchored day grid. */
    function _calendarIndex(
        uint256 _day
    ) private view returns (uint256 calendarIndex, bool onCalendar) {
        calendarIndex = (_day + DAY_INDEX_OFFSET + 12 hours - dayAnchor) / 1 days;
        uint256 aligned = dayAnchor + calendarIndex * 1 days - DAY_INDEX_OFFSET;
        uint256 drift = _day > aligned ? _day - aligned : aligned - _day;
        onCalendar = drift <= 1 hours;
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
    ) external nonReentrant canGiveUp notSelectGiveUp onTime available onlyChallenger {
        // EFFECTS — write state before any external interaction (CEI)
        isFinished = true;
        selectGiveUpStatus = true;
        stateInstance = ChallengeState.GAVE_UP;

        updateRewardSuccessAndfail(false);

        // The deposit minus the failure fee goes back to the sponsor: no payout by achievement.
        uint256 remainningAmountFee = uint256(100) - amountFailFee;
        uint256 amount = (address(this).balance * remainningAmountFee) / 100;
        tranferCoinNative(sponsor, amount);
        for (uint256 i = 0; i < erc20ListAddress.length; i++) {
            _payToken(erc20ListAddress[i], sponsor, (listBalanceAllToken[i] * remainningAmountFee) / 100);
        }
        emit FundTransfer(sponsor, amount);

        transferNFTForSenderWhenFailed(
            _listNFTAddress,
            _listIndexNFT,
            _listSenderAddress,
            _statusTypeNft
        );

        if (tranferCoinNative(feeAddress, serverFailureFee)) emit FundTransfer(feeAddress, serverFailureFee);
        _returnRemainderToSponsor();

        emit GiveUp(msg.sender);
    }

    /**
     * @dev Closes the challenge and performs necessary actions for handling the failure scenario.
     * @param _listNFTAddress The list of NFT contract addresses.
     * @param _listIndexNFT The list of NFT indices for each address.
     * @param _listSenderAddress The list of sender addresses for each NFT.
     * @param _statusTypeNft The status of each NFT (true for ERC721, false for ERC1155).
     *      Only the sponsor closes, from endTime + 2 days, with no upper limit; results are accepted until then.
     */
    function closeChallenge(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft
    ) external nonReentrant afterFinish availableForClose {
        require(msg.sender == sponsor, "Only sponsor can close");
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
        require(isFinished, "The challenge has not yet been finished");
        require(returnedNFTWallet == msg.sender, "Only returned nft wallet address");

        for (uint256 i = 0; i < _listTokenErc20.length; i++) {
            address tokenErc20 = _listTokenErc20[i];
            uint256 balanceErc20 = IERC20(tokenErc20).balanceOf(address(this));
            // Amounts claimable by the recipients of failed transfers stay in the contract.
            if (balanceErc20 > totalClaimable[tokenErc20]) {
                TransferHelper.safeTransfer(tokenErc20, returnedNFTWallet, balanceErc20 - totalClaimable[tokenErc20]);
            }
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

        updateRewardSuccessAndfail(true);

        if (tranferCoinNative(feeAddress, serverSuccessFee)) emit FundTransfer(feeAddress, serverSuccessFee);

        for (uint256 i = 0; i < index; i++) {
            tranferCoinNative(awardReceivers[i], awardReceiversApprovals[i]);
            for (uint256 j = 0; j < erc20ListAddress.length; j++) {
                // awardTokenReceivers holds amounts only for the tokens that had a balance at settlement.
                if (getBalanceTokenOfContract(erc20ListAddress[j], address(this)) > 0) {
                    _payToken(erc20ListAddress[j], awardReceivers[i], awardTokenReceivers[erc20ListAddress[j]][i]);
                }
            }
        }
        _returnRemainderToSponsor();

        if (allowGiveUp[2]) {
            address currentAddressNftUse;
            (currentAddressNftUse, indexNft) = IExerciseSupplementNFT(erc721Address[0]).safeMintNFT(
                0, // HIIT V4 has no per-day step or interval goal
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

        if (tranferCoinNative(feeAddress, serverFailureFee)) emit FundTransfer(feeAddress, serverFailureFee);

        for (uint256 i = index; i < awardReceivers.length; i++) {
            tranferCoinNative(awardReceivers[i], awardReceiversApprovals[i]);
            for (uint256 j = 0; j < erc20ListAddress.length; j++) {
                // awardTokenReceivers holds amounts only for the tokens that had a balance at settlement.
                if (getBalanceTokenOfContract(erc20ListAddress[j], address(this)) > 0) {
                    _payToken(erc20ListAddress[j], awardReceivers[i], awardTokenReceivers[erc20ListAddress[j]][i]);
                }
            }
        }
        _returnRemainderToSponsor();

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
     * @param _listNFTAddress An array of NFT contract addresses.
     * @param _listIndexNFT An array of arrays containing indices of NFTs to transfer.
     * @param _listSenderAddress An array of arrays containing sender addresses for each NFT.
     * @param _statusTypeNft An array indicating the status type of each NFT.
     */
    function transferNFTForSenderWhenFailed(
        address[] memory _listNFTAddress,
        uint256[][] memory _listIndexNFT,
        address[][] memory _listSenderAddress,
        bool[] memory _statusTypeNft
    ) private {
        for (uint256 i = 0; i < _listNFTAddress.length; i++) {
            if (_statusTypeNft[i]) {
                for (uint256 j = 0; j < _listIndexNFT[i].length; j++) {
                    TransferHelper.safeTransferFrom(
                        _listNFTAddress[i],
                        address(this),
                        _listSenderAddress[i][j],
                        _listIndexNFT[i][j]
                    );
                }
            } else {
                uint256 lengthListIndexNFT = _listIndexNFT[i].length / 2;
                for (uint256 j = 0; j < lengthListIndexNFT; j++) {
                    uint256 balanceTokenERC1155 = _listIndexNFT[i][j + lengthListIndexNFT];
                    bytes memory extraData = abi.encode(
                        address(this),
                        _listSenderAddress[i][j],
                        _listIndexNFT[i][j],
                        balanceTokenERC1155
                    );
                    TransferHelper.safeTransferNFT1155(
                        _listNFTAddress[i],
                        address(this),
                        _listSenderAddress[i][j],
                        _listIndexNFT[i][j],
                        balanceTokenERC1155,
                        extraData
                    );
                }
            }
        }
    }

    /** @param _success true on success (success fee), false on give-up or Close (failure fee), for coin and tokens. */
    function updateRewardSuccessAndfail(bool _success) private {
        // Reset constructor-populated accumulators so the += below sums correctly.
        // listBalanceAllToken / awardTokenReceivers are guaranteed empty here
        // (single-call lifecycle enforced by nonReentrant + isFinished CEI).
        sumAwardSuccess = 0;
        sumAwardFail = 0;

        uint256 coinNativeBalance = address(this).balance;

        if (coinNativeBalance > 0) {
            serverSuccessFee = (coinNativeBalance * amountSuccessFee) / 100;
            serverFailureFee = (coinNativeBalance * amountFailFee) / 100;

            // Coin is split by list position, like tokens: positions < index are paid on success, the others on
            // Close, so an address listed in both lists or twice gets the share of each of its positions.
            for (uint256 i = 0; i < index; i++) {
                awardReceiversApprovals[i] = (awardReceiversPercent[i] * coinNativeBalance) / 100;
                sumAwardSuccess += awardReceiversApprovals[i];
            }

            for (uint256 i = index; i < awardReceivers.length; i++) {
                awardReceiversApprovals[i] = (awardReceiversPercent[i] * coinNativeBalance) / 100;
                sumAwardFail += awardReceiversApprovals[i];
            }
        } else {
            // No native balance (e.g. JPYC/ERC20-only challenge): zero the native
            // payouts so tranferCoinNative becomes a no-op and settlement proceeds to
            // the ERC20 distribution below instead of reverting on insufficient native
            // balance (constructor-seeded approvals are denominated in the total amount,
            // not in native coin).
            serverSuccessFee = 0;
            serverFailureFee = 0;
            for (uint256 i = 0; i < awardReceivers.length; i++) {
                awardReceiversApprovals[i] = 0;
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

                _payToken(
                    erc20ListAddress[i],
                    feeAddress,
                    (listBalanceAllToken[i] * (_success ? amountSuccessFee : amountFailFee)) / 100
                );
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

    function getState() external view returns (ChallengeState) {
        return stateInstance;
    }

    function tranferCoinNative(address payable from, uint256 value) private returns (bool success) {
        if (value > 0 && getContractBalance() >= value) {
            (success, ) = from.call{ value: value }("");
            if (!success) {
                emit NativeTransferFailed(from, value);
                _recordClaim(address(0), from, value);
            }
        }
    }

    /** @dev Transfer tokens; a failed transfer is recorded for its recipient instead of reverting the settlement. */
    function _payToken(address _token, address _to, uint256 _amount) private {
        if (_amount == 0) return;
        (bool ok, bytes memory data) = _token.call(abi.encodeWithSelector(IERC20.transfer.selector, _to, _amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) _recordClaim(_token, _to, _amount);
    }

    function _recordClaim(address _token, address _to, uint256 _amount) private {
        claimable[_token][_to] += _amount;
        totalClaimable[_token] += _amount;
        emit TransferClaimable(_token, _to, _amount);
    }

    /** @dev After a settlement only a rounding remainder is left besides the claimable amounts: it goes to the sponsor. */
    function _returnRemainderToSponsor() private {
        uint256 coin = getContractBalance();
        if (coin > totalClaimable[address(0)]) tranferCoinNative(sponsor, coin - totalClaimable[address(0)]);
        for (uint256 i = 0; i < erc20ListAddress.length; i++) {
            address token = erc20ListAddress[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > totalClaimable[token]) _payToken(token, sponsor, balance - totalClaimable[token]);
        }
    }

    /**
     * @dev Pay the caller the amount a failed transfer left for it.
     * @param _token The token (address(0) = native coin).
     */
    function claim(address _token) external nonReentrant {
        uint256 amount = claimable[_token][msg.sender];
        require(amount > 0, "Nothing to claim");
        claimable[_token][msg.sender] = 0;
        totalClaimable[_token] -= amount;
        if (_token == address(0)) {
            (bool ok, ) = payable(msg.sender).call{ value: amount }("");
            require(ok, "Claim failed");
        } else {
            TransferHelper.safeTransfer(_token, msg.sender, amount);
        }
        emit Claimed(_token, msg.sender, amount);
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

    /** @dev Contract version identifier; deployed challenges before version 3 do not have it. */
    function contractVersion() external pure returns (uint256) {
        return 4;
    }

    /** @dev HIIT menu of the challenge. */
    function getHiitMenu()
        external
        view
        returns (
            uint256 moveSeconds,
            uint256 restSeconds,
            uint256 totalSets,
            uint256 unscoredSets,
            uint256 targetPercent
        )
    {
        return (hiitMoveSeconds, hiitRestSeconds, hiitTotalSets, hiitUnscoredSets, hiitTargetPercent);
    }

    /** @dev Achieved exercise days, in first-submission order. */
    function getHistoryV4() external view returns (uint256[] memory hiitDays) {
        return historyDate;
    }

    /** @dev Returns the HIIT achievement status for a specific day. */
    function getHIITAchievedOn(uint256 _day) external view returns (uint256) {
        if (dayAnchor == 0) return 0;
        (uint256 calendarIndex, bool onCalendar) = _calendarIndex(_day);
        uint256 idx = onCalendar ? historyDateIndex[calendarIndex] : 0;
        return idx == 0 ? 0 : historyData[idx - 1];
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

    /**
     * @dev onERC721Received.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) external virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @dev onERC1155Received.
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
