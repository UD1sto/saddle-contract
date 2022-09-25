// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract LLUsd is ERC20Burnable, Ownable {
    using SafeMath for uint256;

    constructor() public ERC20("Liquid Loans USD", "LLUSD") {
        _mint(msg.sender, 100000 * 10 ** 18);
    }

    
}