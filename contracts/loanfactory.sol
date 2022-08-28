// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
//change to different clones
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./liquidLoans.sol";
//import onwnable upgreadable
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";



contract loanfactory is OwnableUpgradeable{

    address immutable liquidLoansImplementation;
   
    event contractCreation(address cloneAddress, address manager);

    constructor() public {
        liquidLoansImplementation = address (new liquidLoans());
        
    }

    function createLoanContract(address price1A, address price2A, address lpA, address swapA, address llAddress, string calldata lpTokenName, string calldata lpTokenSymbol) public onlyOwner{
        address clone = Clones.clone(liquidLoansImplementation);
        //address 
        liquidLoans(clone).initialize(price1A, price2A, lpA, swapA, llAddress, lpTokenName, lpTokenSymbol);
        liquidLoans(clone).transferOwnership(msg.sender);
        emit contractCreation(clone, msg.sender);
    }

    

}