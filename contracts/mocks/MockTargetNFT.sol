// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockTargetNFT
 * @notice Minimal NFT mock exposing the surface that
 *         ExerciseSupplementNFT.safeMintNFT calls on its target NFT contracts:
 *           - safeMint(address)            (selector 0x40d097c3)
 *           - nextTokenIdToMint() view
 *           - balanceOf(address) view      (used for SoulBound eligibility check)
 *           - ownerOf(uint256) view
 *         Anyone can call safeMint — no role guard, fine for unit tests.
 */
contract MockTargetNFT {
    uint256 public nextTokenIdToMint;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public ownerOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed id);

    function safeMint(address to) external {
        uint256 id = nextTokenIdToMint;
        ownerOf[id] = to;
        balanceOf[to] += 1;
        nextTokenIdToMint = id + 1;
        emit Transfer(address(0), to, id);
    }

    /**
     * @dev Helper to seed balance without minting (useful for SoulBound
     *      eligibility tests where we want the user to "own" required NFT
     *      without going through full mint flow).
     */
    function setBalance(address account, uint256 amount) external {
        balanceOf[account] = amount;
    }
}
