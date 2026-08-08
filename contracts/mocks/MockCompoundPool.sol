// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title MockCompoundPool
 * @notice Minimal Compound V2-style cToken mock for CHALLENGE-2697 (PolygonDeFiAggregator
 *         Compound mint()/redeem() return-code fix). Real Compound cTokens return an ERROR CODE
 *         from both mint() and redeem() (0 = success), never the cToken/underlying amount moved
 *         -- this mock mints/burns 1:1 with the underlying and lets a test force a nonzero error
 *         code on demand, so both halves of the fix (amounts derived from balance deltas, and
 *         nonzero codes correctly treated as failures) are exercisable.
 *         Registered directly as a protocol's contractAddress via addProtocol -- for a
 *         "compound" protocol type, PolygonDeFiAggregator treats contractAddress as the cToken
 *         itself (it calls mint/redeem/balanceOf directly on it), matching real Compound usage.
 */
contract MockCompoundPool {
    address public underlying;
    mapping(address => uint256) public balanceOf;
    uint256 public mintErrorCode;
    uint256 public redeemErrorCode;

    constructor(address _underlying) {
        underlying = _underlying;
    }

    function setMintErrorCode(uint256 code) external {
        mintErrorCode = code;
    }

    function setRedeemErrorCode(uint256 code) external {
        redeemErrorCode = code;
    }

    function mint(uint256 mintAmount) external returns (uint256) {
        if (mintErrorCode != 0) {
            return mintErrorCode;
        }
        IERC20Minimal(underlying).transferFrom(msg.sender, address(this), mintAmount);
        balanceOf[msg.sender] += mintAmount;
        return 0;
    }

    function redeem(uint256 redeemTokens) external returns (uint256) {
        if (redeemErrorCode != 0) {
            return redeemErrorCode;
        }
        balanceOf[msg.sender] -= redeemTokens;
        IERC20Minimal(underlying).transfer(msg.sender, redeemTokens);
        return 0;
    }
}
