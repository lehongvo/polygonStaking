// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract PolygonDeFiAggregatorProxy is TransparentUpgradeableProxy {
    constructor(
        address logic,
        address admin,
        bytes memory data
    ) payable TransparentUpgradeableProxy(logic, admin, data) {}
}
