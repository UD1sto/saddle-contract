// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/ISwap.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./LLUsd.sol";
import "./OwnerPausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
contract LiquidLoans is OwnerPausableUpgradeable {
    using SafeMathUpgradeable for uint256;

    AggregatorV3Interface internal priceFeed1;
    AggregatorV3Interface internal priceFeed2;
    
    event loanContract();
    event getloan(uint interest, uint amount, address recipient, uint lpLocked, uint _price1, uint _price2);
    event repayloan(uint amount, address payee, uint lpReleased);

//those are placeholders for the real values
    address public treasury;

    address public lpAddress;
    address public swapAddress;

    LLUsd llUsd;
    
    address public usdA;
  

    struct loanUtils {
        uint256 owedBalance;
        uint256 lpLocked;
    }


    mapping (address => loanUtils) accounting;

    function initialize(address price1A, address price2A, address _lpAddress, address _swapAddress, address llAddress) initializer public {
        priceFeed1 = AggregatorV3Interface(price1A);
        priceFeed2 = AggregatorV3Interface(price2A);
        treasury = 0xd744C8812362B9cEFe7D0D0198537F81841A9244;
        lpAddress = _lpAddress;
        swapAddress = _swapAddress;

        

        llUsd = LLUsd(Clones.clone(llAddress));
        
        require(llUsd.initialize("test", "TST"),"could not init llToken clone");
        usdA = address(llUsd);
        
    }

/*@dev: mintAndLock is different for different implementations, in this implementation we assume that the pool
contains two USD pegged assets, using this contract in a pool with more than two assets or one where the assets
are not USD pegged might introduce serious issues and vulnerabilities*/
       
    function mintAndLock (uint256 amount, address pool) public {
        require (amount > 0, "amount must be greater than 0");

        uint256 [] memory tokenArray = ISwap(swapAddress).calculateRemoveLiquidity(amount);
        uint256 balanceA = tokenArray[1];
        uint256 balanceB = tokenArray[2];

        int256 usdPriceA = getLatestPrice1();
        int256 usdPriceB = getLatestPrice2();

        uint256 a = uint(usdPriceA);
        uint256 b = uint(usdPriceB);

        uint256 usdPrice = a.mul(balanceA).add(b).mul(balanceB).div(5).mul(4);
        uint256 usdInterest = usdPrice.div(1000);
        uint256 usdPaid = usdPrice.sub(usdInterest);
        
        IERC20Upgradeable(lpAddress).approve(address(this), amount);
        IERC20Upgradeable(lpAddress).transferFrom(msg.sender, address(this), amount);
        
//mint on spot, need to protect the erc20 contract
        accounting[msg.sender].owedBalance = usdPaid;
        accounting[msg.sender].lpLocked = amount;
        llUsd.mint(treasury, usdInterest);
        llUsd.mint(msg.sender, usdPaid);
       

        emit getloan(usdInterest, usdPaid, msg.sender, amount, a, b);

    }

    function burnAndUnlock (address token, uint256 amount) public {
       
        

        uint256 analogy = accounting[msg.sender].lpLocked.div(accounting[msg.sender].owedBalance);

        if (token == usdA) {
            uint256 LpToRelease = amount.mul(analogy);
            accounting[msg.sender].owedBalance = accounting[msg.sender].owedBalance.sub(amount);
            accounting[msg.sender].lpLocked = accounting[msg.sender].lpLocked.sub(LpToRelease);
            llUsd.burn(amount);

            emit repayloan(amount, msg.sender, LpToRelease);
        } else if (token == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) { 
            int256 usdPrice = getLatestPrice1();
            uint256 uPrice = uint(usdPrice);
            uint256 converted = amount.mul(uPrice);
            uint256 LpToRelease = converted.mul(analogy);
            
            accounting[msg.sender].owedBalance = accounting[msg.sender].owedBalance.sub(converted);
            accounting[msg.sender].lpLocked = accounting[msg.sender].lpLocked.sub(LpToRelease);

            IERC20(token).transfer(address(this), converted);
            IERC20(lpAddress).transfer(msg.sender, LpToRelease);

            emit repayloan(converted, msg.sender, LpToRelease);
        }

        else if (token == 0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa) {
            int256 usdPrice = getLatestPrice2();
            uint256 uPrice = uint(usdPrice);
            uint256 converted = amount.mul(uPrice);
            uint256 LpToRelease = converted.mul(analogy);
            
            accounting[msg.sender].owedBalance = accounting[msg.sender].owedBalance.sub(converted);
            accounting[msg.sender].lpLocked = accounting[msg.sender].lpLocked.sub(LpToRelease);

            IERC20(token).transfer(address(this), converted);
            IERC20(lpAddress).transfer(msg.sender, LpToRelease);
            
            emit repayloan(converted, msg.sender, LpToRelease);
        }

        else {
            revert();
        }

        }

    function getLatestPrice1() public view returns (int) {     
        (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
        ) = priceFeed1.latestRoundData();
    }

     function getLatestPrice2() public view returns (int) {
        (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
        ) = priceFeed2.latestRoundData();
     }

}

     




   


   


 