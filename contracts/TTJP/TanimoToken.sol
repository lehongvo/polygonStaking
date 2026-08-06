// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

// ==== custom errors (auto) ====
error InvalidNetworkFee();
error YouDoNotHaveRight();
error Erc20ChallengeWasFinished();
error InvalidOwnerAddress(); // CHALLENGE-2804
error NoPendingOwner(); // CHALLENGE-2804

import "./ERC20Upgradeable.sol";
import "./Initializable.sol";
import "./UUPSUpgradeable.sol";
import "./IChallenge.sol";

contract TanimoToken is Initializable, ERC20Upgradeable, UUPSUpgradeable {
    // CHALLENGE-2702: this is the IMPLEMENTATION contract deployed behind a proxy. Without
    // disabling initializers here, anyone could call initialize() directly on the
    // implementation address itself (not through the proxy) and take owner/admin roles on
    // that implementation instance. Matches the existing correct pattern in
    // PolygonDeFiAggregator.sol.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // Contract size
    uint256 private sizeContract;

    /**
     * @dev Value send to contract should be equal with `amount`.
     */
    modifier validateFee(uint256 _amount) {
        if (!(msg.value == _amount)) revert InvalidNetworkFee();
        _;
    }

    /**
     * @dev Action only called from owner.
     */
    modifier onlyOwner() {
        if (!(msg.sender == _owner)) revert YouDoNotHaveRight();
        _;
    }

    /**
     * @dev Owner of token.
     */
    address payable public _owner;

    // CHALLENGE-2804: appended AFTER all existing storage (TanimoToken is already deployed as a
    // live UUPS proxy on Kaia mainnet -- see deployInfo/tanimo-token-kaia.json -- so no existing
    // slot may be reordered/retyped; new state must only ever be added at the end).
    /**
     * @dev Address proposed to take over ownership via transferOwnership(); becomes owner only
     * after calling acceptOwnership() from that same address. address(0) means no pending
     * proposal.
     */
    address payable public _pendingOwner;

    event OwnershipTransferProposed(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferAccepted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferCancelled(address indexed currentOwner, address indexed cancelledPendingOwner);

    /**
    * @dev Initializes the Tanimo Token contract.
    * @param _ownerOfToken The address of the contract owner.
    */
    function initialize(address payable _ownerOfToken,uint256 _sizeCodeContract) initializer public {
        // CHALLENGE-2804: a zero-address owner would permanently brick mintToken/setSizeContract/
        // _authorizeUpgrade (onlyOwner) with no way to ever satisfy msg.sender == address(0).
        if (!(_ownerOfToken != address(0))) revert InvalidOwnerAddress();
        __ERC20_init("Tanimo Token", "TTJP"); // Initialize the ERC20 token with the name "Tanimo Token" and the symbol "TTJP".
        __UUPSUpgradeable_init(); // Initialize the UUPSUpgradeable contract.
        _owner = _ownerOfToken; // Set the contract owner to the provided address.
        sizeContract = _sizeCodeContract;
    }

    /**
     * @dev Step 1 of 2: current owner proposes a new owner. Ownership does NOT change yet --
     * the proposed address must call acceptOwnership() itself. This protects against
     * transferring control to an address that is unreachable, a typo, or cannot sign
     * transactions (unlike a single-step transfer, a mistaken proposal can simply be
     * cancelled or re-proposed and never takes effect on its own).
     * @param newOwner The proposed new owner. Pass address(0) to cancel any pending proposal
     * (equivalent to calling cancelOwnershipTransfer()).
     */
    function transferOwnership(address payable newOwner) external onlyOwner {
        _pendingOwner = newOwner;
        emit OwnershipTransferProposed(_owner, newOwner);
    }

    /**
     * @dev Step 2 of 2: the proposed owner accepts, completing the rotation. Only the exact
     * address proposed via transferOwnership() may call this.
     */
    function acceptOwnership() external {
        if (!(msg.sender == _pendingOwner) || _pendingOwner == address(0)) revert YouDoNotHaveRight();
        address payable previousOwner = _owner;
        _owner = _pendingOwner;
        _pendingOwner = payable(address(0));
        emit OwnershipTransferAccepted(previousOwner, _owner);
    }

    /**
     * @dev Lets the current owner withdraw a pending proposal before it is accepted (e.g. sent
     * to the wrong address). No-op-safe: reverts if there is nothing pending, so it can't be
     * used to silently emit a spurious cancellation event.
     */
    function cancelOwnershipTransfer() external onlyOwner {
        if (_pendingOwner == address(0)) revert NoPendingOwner();
        address payable cancelled = _pendingOwner;
        _pendingOwner = payable(address(0));
        emit OwnershipTransferCancelled(_owner, cancelled);
    }

    /**
     * @dev Mint token to an address.
     * @param _receiver : receivers address
     * @param _amountToken : amount token to mint
     */
    function mintToken(address _receiver, uint _amountToken) onlyOwner public {
        _mint(_receiver, _amountToken);
    }

    /**
     * @dev Burn token — H4 fix: was `onlyOwner` burning ANY `_from` (arbitrary confiscation of any
     * holder's balance without consent). That signature was never invoked (only present in ABIs).
     * Now a caller may burn ONLY their own tokens (`_from` must equal `msg.sender`); the owner can
     * no longer confiscate. Signature kept for ABI compatibility. Storage layout unchanged.
     * @param _from : holder whose tokens are burned — must be the caller
     * @param _amountToken : amount token to burn
     */
    function burnToken(address _from, uint _amountToken) public {
        if (_from != msg.sender) revert YouDoNotHaveRight();
        _burn(_from, _amountToken);
    }
    
    /**
    * @dev Sets the size of the code contract.
    * @param _sizeCodeContract The new size of the code contract.
    * Requirements:
    * - `_sizeCodeContract` must be greater than zero.
    * Emits a {SizeContractChanged} event.
    */
    function setSizeContract(uint256 _sizeCodeContract) external onlyOwner {
        require(_sizeCodeContract > 0, "Size contract must be greater than zero"); // Ensure that the provided size is greater than zero.
        sizeContract = _sizeCodeContract; // Update the size of the code contract.
    }

    /**
    * @dev Hook that is called before any token transfer. Calls the superclass implementation.
    * @param from The address tokens are transferred from.
    * @param to The address tokens are transferred to.
    * @param amount The amount of tokens being transferred.
    */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable)
    {
        super._beforeTokenTransfer(from, to, amount); // Call the superclass implementation of this function.
        uint256 size;
        assembly { size := extcodesize(to) }
        if(size == sizeContract) {
            if (!(!IChallenge(payable(to)).isFinished())) revert Erc20ChallengeWasFinished();
        }
    }

    /**
    @dev Internal function to authorize the upgrade of the contract implementation.
    @param newImplementation Address of the new implementation contract.
    */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}