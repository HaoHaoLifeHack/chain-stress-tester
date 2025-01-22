// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    uint8 private _decimals = 6; // USDC uses 6 decimal places

    constructor(address initialOwner) 
        ERC20("Mock USDC", "mUSDC") 
        Ownable(initialOwner)
    {
        // Initial mint 1,000,000,000 USDC (1000000 * 10^6)
        _mint(msg.sender, 1000000000 * 10**decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // Simulate faucet functionality, anyone can get test tokens
    function faucet(address to) public {
        require(to != address(0), "Invalid address");
        // Mint 100 USDC
        _mint(to, 100 * 10**decimals());
    }
}