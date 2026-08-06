// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockGachaERC1155NoName
 * @notice Standards-shaped ERC1155 without a name() function — used to prove Gacha
 *         settlement does not depend on optional metadata (CHALLENGE-2830).
 */
contract MockGachaERC1155NoName {
    uint256 public nextTokenIdToMint;
    mapping(address => mapping(uint256 => uint256)) public balanceOf;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );

    function mint(address to, uint256 id, uint256 amount) external {
        balanceOf[to][id] += amount;
        if (id >= nextTokenIdToMint) {
            nextTokenIdToMint = id + 1;
        }
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata
    ) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(balanceOf[from][id] >= amount, "insufficient");
        balanceOf[from][id] -= amount;
        balanceOf[to][id] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }
}
