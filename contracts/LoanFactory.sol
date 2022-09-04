// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
//change to different clones
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./LiquidLoans.sol";
//import onwnable upgreadable
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";



contract LoanFactory is OwnableUpgradeable{

    address immutable liquidLoansImplementation;
   
    event contractCreation(address cloneAddress, address manager);

    constructor() public {
        liquidLoansImplementation = address (new LiquidLoans());
        
    }

    function createLoanContract(address price1A, address price2A, address lpA, address swapA, address llAddress, string calldata lpTokenName, string calldata lpTokenSymbol) public onlyOwner{
        address clone = Clones.clone(liquidLoansImplementation);
        //address 
        LiquidLoans(clone).initialize(price1A, price2A, lpA, swapA, llAddress, lpTokenName, lpTokenSymbol);
        LiquidLoans(clone).transferOwnership(msg.sender);
        emit contractCreation(clone, msg.sender);
    }

    

}