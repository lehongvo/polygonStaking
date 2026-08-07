// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IERC1155ReceiverHook {
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);
}

/**
 * @title MockERC1155
 * @notice Minimal ERC1155 mock for testing. safeTransferFrom invokes onERC1155Received on
 *         contract recipients so Challenge custody hooks can be exercised in tests.
 */
contract MockERC1155 {
    mapping(uint256 => mapping(address => uint256)) public balanceOf;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );

    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );

    function mint(address to, uint256 id, uint256 amount) external {
        balanceOf[id][to] += amount;
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
        bytes calldata data
    ) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(balanceOf[id][from] >= amount, "insufficient");
        balanceOf[id][from] -= amount;
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
        if (to.code.length > 0) {
            IERC1155ReceiverHook(to).onERC1155Received(msg.sender, from, id, amount, data);
        }
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata
    ) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(ids.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            require(balanceOf[ids[i]][from] >= amounts[i], "insufficient");
            balanceOf[ids[i]][from] -= amounts[i];
            balanceOf[ids[i]][to] += amounts[i];
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
    }
}
