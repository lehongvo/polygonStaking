// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IClaimable {
    function claim(address _token) external;
}

/**
 * @title MockClaimReceiver
 * @notice Test receiver for the V4 claim of failed transfers: it rejects native coin until `setAccept(true)`,
 *         then claims what a challenge recorded for it.
 */
contract MockClaimReceiver {
    bool public accept;

    function setAccept(bool _accept) external {
        accept = _accept;
    }

    function claimFrom(address _challenge, address _token) external {
        IClaimable(_challenge).claim(_token);
    }

    receive() external payable {
        require(accept, "rejected");
    }
}
