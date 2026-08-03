// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

// Minimal local interface matching the standard IERC721Receiver ABI -- avoids depending on
// the production contracts' flattened/renamed copy just for this mock.
interface IERC721ReceiverMock {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

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
        _checkOnERC721Received(from, to, id, "");
    }

    function safeTransferFrom(address from, address to, uint256 id, bytes calldata data) external {
        transferFrom(from, to, id);
        _checkOnERC721Received(from, to, id, data);
    }

    // CHALLENGE-2694: real ERC721 safeTransferFrom calls onERC721Received on a contract
    // recipient -- this was previously skipped, so tests couldn't exercise the
    // depositor-tracking fix. size(to) > 0 means `to` has contract code deployed.
    function _checkOnERC721Received(address from, address to, uint256 id, bytes memory data) private {
        uint256 size;
        assembly { size := extcodesize(to) }
        if (size > 0) {
            bytes4 retval = IERC721ReceiverMock(to).onERC721Received(msg.sender, from, id, data);
            require(retval == IERC721ReceiverMock.onERC721Received.selector, "receiver rejected");
        }
    }
}
