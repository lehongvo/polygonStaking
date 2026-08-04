// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IERC20MinimalAave {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IMockAToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/**
 * @title MockAavePoolWithAToken
 * @notice Aave Pool mock for testing CHALLENGE-2697 (PolygonDeFiAggregator Aave custody/share
 *         fix), unlike MockAavePoolForTest (CHALLENGE-2695, no aToken tracking). supply() pulls
 *         the asset from the caller and mints the configured aToken to `onBehalfOf`; withdraw()
 *         burns aToken from the caller and transfers exactly `amount` of the underlying to `to`
 *         -- both match real Aave v3 semantics closely enough to exercise proportional-share
 *         custody. Registered directly as a protocol's contractAddress via addProtocol (that
 *         field is owner-configurable, unlike the hardcoded aToken lookup).
 */
contract MockAavePoolWithAToken {
    mapping(address => address) public aTokenOf;

    function setAToken(address underlying, address aToken) external {
        aTokenOf[underlying] = aToken;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        IERC20MinimalAave(asset).transferFrom(msg.sender, address(this), amount);
        IMockAToken(aTokenOf[asset]).mint(onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        IMockAToken(aTokenOf[asset]).burn(msg.sender, amount);
        IERC20MinimalAave(asset).transfer(to, amount);
        return amount;
    }
}
