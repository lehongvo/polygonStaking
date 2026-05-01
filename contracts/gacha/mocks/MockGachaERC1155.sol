// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockGachaERC1155
 * @notice ERC1155 mock with name() (Gacha calls IChallenge(token).name() on
 *         reward tokens regardless of standard) and nextTokenIdToMint() used
 *         by checkBalanceNft for ERC1155 require-balance NFTs.
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
        bytes calldata
    ) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(balanceOf[from][id] >= amount, "insufficient");
        balanceOf[from][id] -= amount;
        balanceOf[to][id] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }
}
