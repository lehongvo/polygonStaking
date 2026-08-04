// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IERC1155ReceiverMock {
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);
}

/**
 * @title MockGachaERC1155
 * @notice ERC1155 mock with name() (Gacha calls IChallenge(token).name() on
 *         reward tokens regardless of standard) and nextTokenIdToMint() used
 *         by checkBalanceNft for ERC1155 require-balance NFTs.
 *         CHALLENGE-2733: safeTransferFrom now calls onERC1155Received when `to` is a contract,
 *         matching real (standards-compliant) ERC1155 behavior -- needed to test that Gacha's
 *         nonReentrant guard actually blocks a reentrant randomRewards() call made from within
 *         that hook. The prior version never invoked the hook at all, so this path was
 *         previously untestable.
 */
contract MockGachaERC1155 {
    string public name;
    uint256 public nextTokenIdToMint;
    // Standard ERC1155 layout: balanceOf(address account, uint256 id).
    mapping(address => mapping(uint256 => uint256)) public balanceOf;
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

    constructor(string memory _name) {
        name = _name;
    }

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
        bytes calldata data
    ) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(balanceOf[from][id] >= amount, "insufficient");
        balanceOf[from][id] -= amount;
        balanceOf[to][id] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
        if (to.code.length > 0) {
            IERC1155ReceiverMock(to).onERC1155Received(msg.sender, from, id, amount, data);
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
            require(balanceOf[from][ids[i]] >= amounts[i], "insufficient");
            balanceOf[from][ids[i]] -= amounts[i];
            balanceOf[to][ids[i]] += amounts[i];
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
    }
}
