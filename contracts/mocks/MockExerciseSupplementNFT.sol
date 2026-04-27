// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockExerciseSupplementNFT
 * @notice Minimal mock for unit-testing Challenge contracts. Implements both
 *         IExerciseSupplementNFT-shaped methods and IChallengeFee.getAmountFee
 *         in a single contract so it can serve as both registry and fee source.
 *
 *         Extended (D3) to support:
 *           - setErc20List(): inject ERC20 token list for ERC20 payout testing
 *           - setSafeMintReturn(): control safeMintNFT return values
 */
contract MockExerciseSupplementNFT {
    address[] private _erc20List;
    address public returnedNFTWallet;
    uint8 public successFee;
    uint8 public failFee;
    bool public revertSignature;

    address public mintReturnAddress;
    uint256 public mintReturnTokenId;

    constructor(address _returnedNFTWallet, uint8 _successFee, uint8 _failFee) {
        returnedNFTWallet = _returnedNFTWallet;
        successFee = _successFee;
        failFee = _failFee;
    }

    function getErc20ListAddress() external view returns (address[] memory) {
        return _erc20List;
    }

    function setErc20List(address[] calldata list) external {
        delete _erc20List;
        for (uint256 i = 0; i < list.length; i++) {
            _erc20List.push(list[i]);
        }
    }

    function feeSettingAddress() external view returns (address) {
        return address(this);
    }

    function getAmountFee() external view returns (uint8, uint8) {
        return (successFee, failFee);
    }

    function setRevertSignature(bool v) external {
        revertSignature = v;
    }

    function checkValidSignature(
        uint256[] memory,
        uint256[] memory,
        uint64[2] memory,
        bytes memory
    ) external view {
        require(!revertSignature, "MOCK: bad signature");
    }

    function setSafeMintReturn(address _addr, uint256 _id) external {
        mintReturnAddress = _addr;
        mintReturnTokenId = _id;
    }

    function safeMintNFT(
        uint256,
        uint256,
        uint256,
        address,
        uint256,
        uint256,
        address,
        address
    ) external view returns (address, uint256) {
        return (mintReturnAddress, mintReturnTokenId);
    }

    function typeNfts(address) external pure returns (bool) {
        return false;
    }

    function nextTokenIdToMint() external pure returns (uint256) {
        return 0;
    }

    function getHistoryNFT(uint256, address) external pure returns (address) {
        return address(0);
    }
}
