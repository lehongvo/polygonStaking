// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IMintable721 {
    function mint(address to, uint256 id) external;
    function nextTokenIdToMint() external view returns (uint256);
}

interface IMintable1155 {
    function mint(address to, uint256 id, uint256 amount) external;
}

/**
 * @title MockGachaSupplement
 * @notice Plays the role of `erc721Address(0)` returned by Challenge — i.e. the
 *         registry that Gacha calls for `getDestinationAddress`, `safeMintNFT721Heper`
 *         and `safeMintNFT1155Heper`. All settable so tests can craft scenarios.
 */
contract MockGachaSupplement {
    address public destinationAddress;

    function setDestinationAddress(address addr) external {
        destinationAddress = addr;
    }

    function getDestinationAddress(
        address /*_challengeContract*/,
        address /*_gachaAddress*/
    ) external view returns (address) {
        return destinationAddress;
    }

    /**
     * @dev Mint helper: forward to mintable ERC721. Uses on-chain auto-id from token.
     */
    function safeMintNFT721Heper(address tokenAddr, address to) external {
        uint256 id = IMintable721(tokenAddr).nextTokenIdToMint();
        IMintable721(tokenAddr).mint(to, id);
    }

    /**
     * @dev Mint helper for ERC1155.
     */
    function safeMintNFT1155Heper(
        address tokenAddr,
        address to,
        uint256 id,
        uint256 amount
    ) external {
        IMintable1155(tokenAddr).mint(to, id, amount);
    }
}
