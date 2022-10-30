// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/ISwap.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "./LLUsd.sol";
import "./OwnerPausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./console.sol";
contract LiquidLoans is OwnerPausableUpgradeable {
    using SafeMath for uint256;
    
  //  event loanContract();
    event getloan(uint interest, uint amount, address recipient, uint lpLocked);
    event repayloan(uint amount, address payee, uint lpReleased);

//those are placeholders for the real values
    address public treasury = 0xd744C8812362B9cEFe7D0D0198537F81841A9244;
    address public lpAddress;
    address public swapAddress;

    LLUsd llUsd;
    
    address public usdA;

    uint public allowed;

    struct loanUtils {
        uint256 owedBalance;
        uint256 lpLocked;
    }

    mapping (address => loanUtils) public accounting;

    function initialize(address _lpAddress, address _swapAddress, address llAddress, address [] calldata tokens) initializer public {  
        __Ownable_init();
        require (tokens.length <= 4 
        && tokens.length > 0, "tokens length must be between 1 and 4"
        );
        swapAddress = _swapAddress;

       
       

        for (uint i; i < tokens.length; i++) {

            if (ISwap(swapAddress).getTokenIndex(tokens[i]) == i)
            {
                allowed++;
            }
            
        }

        require (tokens.length == allowed, "tokens must be in the swap");
        
        lpAddress = _lpAddress;
        usdA = llAddress;       
    }
    
/*@dev: mintAndLock is different for different implementations, in this implementation we assume that the pool
contains two USD pegged assets, using this contract in a pool with more than two assets or one where the assets
are not USD pegged might introduce serious issues and vulnerabilities*/
    
    function mintAndLock (uint256 amount) external {
        require (amount > 0, "amount must be greater than 0");
        
        //extracts fee updates amount
        uint256 interest = amount.div(1000);

        uint256 [] memory tokenArray = ISwap(swapAddress).calculateRemoveLiquidity(amount);

        if(allowed == 2){
            require(tokenArray.length == allowed, "array must have 2 tokens");
            
        uint256 balanceA = tokenArray[0];
        uint256 balanceB = tokenArray[1];
     
        uint256 usdPaid = balanceA.add(balanceB).div(5).mul(4);
        
        IERC20Upgradeable(lpAddress).approve(address(this), amount);
        IERC20Upgradeable(lpAddress).transferFrom(msg.sender, address(this), amount);
        IERC20Upgradeable(lpAddress).transferFrom(msg.sender, treasury, interest);
        
        accounting[msg.sender].owedBalance = usdPaid;
        accounting[msg.sender].lpLocked = amount;
        IERC20(usdA).transfer(msg.sender, usdPaid);
        
       
        emit getloan(interest, usdPaid, msg.sender, amount);

        }

        else if (allowed == 3){
            require(tokenArray.length == allowed, "array must have 3 tokens");

        uint256 balanceA = tokenArray[0];
        uint256 balanceB = tokenArray[1];
        uint256 balanceC = tokenArray[2];
     
        uint256 usdPaid = balanceA.add(balanceB).add(balanceC).div(5).mul(4);
        
        IERC20Upgradeable(lpAddress).approve(address(this), amount);
        IERC20Upgradeable(lpAddress).transferFrom(msg.sender, address(this), amount);
        IERC20Upgradeable(lpAddress).transferFrom(msg.sender, treasury, interest);
        
        accounting[msg.sender].owedBalance = usdPaid;
        accounting[msg.sender].lpLocked = amount;
        IERC20(usdA).transfer(msg.sender, usdPaid);
        
       
        emit getloan(interest, usdPaid, msg.sender, amount);

        }

        else if (allowed == 4){
            require(tokenArray.length == allowed, "array must have 3 tokens");

        uint256 balanceA = tokenArray[0];
        uint256 balanceB = tokenArray[1];
        uint256 balanceC = tokenArray[2];
        uint256 balanceD = tokenArray[3];
     
        uint256 usdPaid = balanceA.add(balanceB).add(balanceC).add(balanceD).div(5).mul(4);
        
        IERC20Upgradeable(lpAddress).approve(address(this), amount);
        IERC20Upgradeable(lpAddress).transferFrom(msg.sender, address(this), amount);
        IERC20Upgradeable(lpAddress).transferFrom(msg.sender, treasury, interest);
        
        accounting[msg.sender].owedBalance = usdPaid;
        accounting[msg.sender].lpLocked = amount;
        IERC20(usdA).transfer(msg.sender, usdPaid);
        
       
        emit getloan(interest, usdPaid, msg.sender, amount);

        }

        else {
            revert();
        }
    }

    function burnAndUnlock (address token, uint256 amount) external {
        require (amount != 0, "amount must be greater than 0");
        require (token != address(0), "token address must be valid");
        require  (accounting[msg.sender].lpLocked >= amount, "amount must be less than or equal to owed balance");
        
        // uint256 analogy = accounting[msg.sender].lpLocked.div(accounting[msg.sender].owedBalance);

        if (token == usdA) {
            uint256 usdToBurn = amount.div(5).mul(4);
            accounting[msg.sender].owedBalance -= usdToBurn;
            ERC20Burnable(usdA).burnFrom(msg.sender, usdToBurn);
            accounting[msg.sender].lpLocked -= amount;
            IERC20Upgradeable(lpAddress).transfer(msg.sender, amount);
        }
            
        
        else {
            revert();
        }

        emit repayloan(amount, msg.sender, amount);

        }

}

     




   


   


 