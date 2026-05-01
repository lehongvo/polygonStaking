// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockERC721
 * @notice Minimal ERC721 mock for testing. Anyone can mint. Tracks ownerOf.
 *         Implements bare minimum for safeTransferFrom interaction.
 */
contract MockERC721 {
    string public name;
    string public symbol;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Transfer(address indexed from, address indexed to, uint256 indexed id);
    event Approval(address indexed owner, address indexed approved, uint256 indexed id);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 id) external {
        require(ownerOf[id] == address(0), "already minted");
        ownerOf[id] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, id);
    }

    function approve(address to, uint256 id) external {
        require(ownerOf[id] == msg.sender, "not owner");
        getApproved[id] = to;
        emit Approval(msg.sender, to, id);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    function transferFrom(address from, address to, uint256 id) public {
        require(ownerOf[id] == from, "not owner");
        require(
            msg.sender == from ||
                getApproved[id] == msg.sender ||
                isApprovedForAll[from][msg.sender],
            "not authorized"
        );
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        ownerOf[id] = to;
        delete getApproved[id];
        emit Transfer(from, to, id);
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        transferFrom(from, to, id);
        // Skip onERC721Received call for simplicity (challenge contract uses
        // raw call selector directly, not safeTransferFrom).
    }

    function safeTransferFrom(address from, address to, uint256 id, bytes calldata) external {
        transferFrom(from, to, id);
    }
}
