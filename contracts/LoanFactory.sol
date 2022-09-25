// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
//change to different clones
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./LiquidLoans.sol";
//import onwnable upgreadable
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";



contract LoanFactory is OwnableUpgradeable{

    address immutable liquidLoansImplementation;

    using Clones for address;
   
    event contractCreation(address cloneAddress, address manager);

    constructor() public {
        liquidLoansImplementation = address (new LiquidLoans());
        
    }

    function createLoanContract(bytes32 salt, address lpA, address swapA, address llAddress) public {
        address clone = Clones.cloneDeterministic(liquidLoansImplementation, salt);
        //address 
        LiquidLoans(clone).initialize(lpA, swapA, llAddress);
    //    LiquidLoans(clone).transferOwnership(msg.sender);
        emit contractCreation(clone, msg.sender);
    }
}