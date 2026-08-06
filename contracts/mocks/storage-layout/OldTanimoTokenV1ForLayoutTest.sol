// SPDX-License-Identifier: MIT

// CHALLENGE-2804 storage-layout regression test fixture.
// Verbatim copy of contracts/TTJP/TanimoToken.sol as it existed at git HEAD (commit da4ac56,
// CHALLENGE-2702) -- i.e. before the CHALLENGE-2804 pendingOwner storage slot was appended --
// with only the outer contract name and import paths (relative to this file's new location)
// changed so it can compile alongside the real TanimoToken. This mirrors the storage layout
// that is ACTUALLY live on Kaia mainnet today (see deployInfo/tanimo-token-kaia.json --
// deployed 2026-05-26, after CHALLENGE-2702 but before CHALLENGE-2804). Used only by
// test/security/tanimo-token-ownership.test.ts via upgrades.validateUpgrade() to prove the
// current contracts/TTJP/TanimoToken.sol is upgrade-safe from this exact on-chain baseline.
// Never deploy this contract for any other purpose.

pragma solidity ^0.8.16;

// ==== custom errors (auto) ====
error OldInvalidNetworkFee();
error OldYouDoNotHaveRight();
error OldErc20ChallengeWasFinished();

import "../../TTJP/ERC20Upgradeable.sol";
import "../../TTJP/Initializable.sol";
import "../../TTJP/UUPSUpgradeable.sol";
import "../../TTJP/IChallenge.sol";

contract OldTanimoTokenV1ForLayoutTest is Initializable, ERC20Upgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // Contract size
    uint256 private sizeContract;

    modifier validateFee(uint256 _amount) {
        if (!(msg.value == _amount)) revert OldInvalidNetworkFee();
        _;
    }

    modifier onlyOwner() {
        if (!(msg.sender == _owner)) revert OldYouDoNotHaveRight();
        _;
    }

    address payable public _owner;

    function initialize(address payable _ownerOfToken, uint256 _sizeCodeContract) initializer public {
        __ERC20_init("Tanimo Token", "TTJP");
        __UUPSUpgradeable_init();
        _owner = _ownerOfToken;
        sizeContract = _sizeCodeContract;
    }

    function mintToken(address _receiver, uint _amountToken) onlyOwner public {
        _mint(_receiver, _amountToken);
    }

    function burnToken(address _from, uint _amountToken) public {
        if (_from != msg.sender) revert OldYouDoNotHaveRight();
        _burn(_from, _amountToken);
    }

    function setSizeContract(uint256 _sizeCodeContract) external onlyOwner {
        require(_sizeCodeContract > 0, "Size contract must be greater than zero");
        sizeContract = _sizeCodeContract;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable)
    {
        super._beforeTokenTransfer(from, to, amount);
        uint256 size;
        assembly { size := extcodesize(to) }
        if (size == sizeContract) {
            if (!(!IChallenge(payable(to)).isFinished())) revert OldErc20ChallengeWasFinished();
        }
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}
