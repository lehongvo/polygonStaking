// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockRejectingERC1155Receiver
 * @notice Configurable IERC1155Receiver used by CHALLENGE-2791 tests. While `rejectReceive`
 *         is true, onERC1155Received reverts so claimPendingErc1155 must credit back instead
 *         of losing funds or blocking other recipients' claims.
 */
contract MockRejectingERC1155Receiver {
    bool public rejectReceive = true;

    function setReject(bool _reject) external {
        rejectReceive = _reject;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external view returns (bytes4) {
        if (rejectReceive) revert("MockRejectingERC1155Receiver: rejecting");
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external view returns (bytes4) {
        if (rejectReceive) revert("MockRejectingERC1155Receiver: rejecting");
        return this.onERC1155BatchReceived.selector;
    }
}
