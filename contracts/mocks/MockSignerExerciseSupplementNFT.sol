// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockSignerExerciseSupplementNFT
 * @notice Test registry for the V3 challenge contracts. Same shape as MockExerciseSupplementNFT,
 *         but `checkValidSignature` verifies the backend signature exactly like the production
 *         ExerciseSupplementNFT: only challenge contracts granted the challenge role may call it,
 *         keccak256(abi.encodePacked(msg.sender, _day, _stepIndex, _data, chainId)) must be signed
 *         as an Ethereum signed message by `securityAddress` (low-s only, as OZ ECDSA), each
 *         signature is usable once, and `_data[1]` is an expiry at most 10 minutes ahead.
 */
contract MockSignerExerciseSupplementNFT {
    address[] private _erc20List;
    address public returnedNFTWallet;
    uint8 public successFee;
    uint8 public failFee;
    address public securityAddress;
    mapping(bytes => bool) public verifyHash;
    mapping(address => bool) public allowedChallenge;

    constructor(
        address _returnedNFTWallet,
        uint8 _successFee,
        uint8 _failFee,
        address _securityAddress
    ) {
        returnedNFTWallet = _returnedNFTWallet;
        successFee = _successFee;
        failFee = _failFee;
        securityAddress = _securityAddress;
    }

    /** @dev Stands in for grantRole(ALLOWED_CONTRACTS_CHALLENGE, challenge), done by the cron in production. */
    function grantChallengeRole(address challenge) external {
        allowedChallenge[challenge] = true;
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

    function checkValidSignature(
        uint256[] memory _day,
        uint256[] memory _stepIndex,
        uint64[2] memory _data,
        bytes memory _signature
    ) external {
        require(allowedChallenge[msg.sender], "AccessControl: missing challenge role");
        require(securityAddress != address(0), "SecurityNotSet");
        require(!verifyHash[_signature], "HashUsed");
        require(
            block.timestamp <= _data[1] && _data[1] - block.timestamp <= 10 minutes,
            "Signature is inaccessible"
        );
        bytes32 hash = keccak256(
            abi.encodePacked(msg.sender, _day, _stepIndex, _data, block.chainid)
        );
        bytes32 messageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        require(_signature.length == 65, "InvalidSignature");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "InvalidSignature"
        );
        require(ecrecover(messageHash, v, r, s) == securityAddress, "InvalidSignature");
        verifyHash[_signature] = true;
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
    ) external pure returns (address, uint256) {
        return (address(0), 0);
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
