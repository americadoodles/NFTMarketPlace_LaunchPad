// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint256 private initalSupply = 10**6 * 1e18;
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, initalSupply);
    }

    function mint(uint256 _amount) external {
        _mint(msg.sender, _amount);   
    }
}