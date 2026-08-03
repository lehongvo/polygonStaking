// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title MockWMATIC
 * @notice Minimal WMATIC-like mock for testing CHALLENGE-2695 (Aave staking withdraw order).
 *         Standard ERC20 transfer/approve semantics plus deposit()/withdraw() wrap/unwrap,
 *         matching the real WMATIC contract's interface closely enough for
 *         ChallengeDetailV2's IWMATIC calls. Deployed via hardhat_setCode at the real,
 *         hardcoded WMATIC_WPOC_ADDRESS so the contract-under-test's calls to that address
 *         resolve here instead of a real (nonexistent on a local network) WMATIC contract.
 */
contract MockWMATIC {
    string public name = "Wrapped Matic (mock)";
    string public symbol = "WMATIC";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
        emit Transfer(address(0), msg.sender, msg.value);
    }

    // Test-only convenience: credit `to` with `amount` WMATIC balance backed by native MATIC
    // sent alongside, so a test can simulate Aave yield sitting in the mock pool without an
    // impersonated deposit() call. Mirrors MockERC20.mint's "anyone can mint" test pattern.
    function mint(address to) external payable {
        balanceOf[to] += msg.value;
        emit Transfer(address(0), to, msg.value);
    }

    function withdraw(uint256 wad) external {
        require(balanceOf[msg.sender] >= wad, "insufficient");
        balanceOf[msg.sender] -= wad;
        (bool ok, ) = msg.sender.call{ value: wad }("");
        require(ok, "native transfer failed");
        emit Transfer(msg.sender, address(0), wad);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // Lets a test fund this contract's own native balance (so withdraw() can pay out)
    // without going through deposit()'s msg.sender-credited accounting.
    receive() external payable {}
}
