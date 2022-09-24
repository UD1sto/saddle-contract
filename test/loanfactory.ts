import chai from "chai"
import { solidity } from "ethereum-waffle"
import { BigNumber, ContractFactory, Signer } from "ethers"
import { solidityPack, formatBytes32String } from "ethers/lib/utils"
import { deployments, ethers } from "hardhat"

import { Address } from "hardhat-deploy/types"
import {
  
  LPToken,
  LoanFactory,
  LLUsd,
  LiquidLoans,
  PriceConsumerV3,
} from "../build/typechain/"
import {
  asyncForEach,
  forceAdvanceOneBlock,
  getCurrentBlockTimestamp,
  getPoolBalances,
  getUserTokenBalance,
  getUserTokenBalances,
  MAX_UINT256,
  setTimestamp,
  TIME,
  impersonateAccount,
} from "./testUtils"

//0x927E6f04609A45B107C789aF34BA90Ebbf479f7f LPtoken usdc frax
//0x13Cc34Aa8037f722405285AD2C82FE570bfa2bdc pool address
//0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6 usdc price feed
//0xB9E1E3A9feFf48998E45Fa90847ed4D467E8BcfD frax price feed



const salts = [formatBytes32String('1'), formatBytes32String('2')]
chai.use(solidity)
const { expect } = chai

describe("Loan Deployer", async () => {

  const abi = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "burn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "burnFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "subtractedValue",
                "type": "uint256"
            }
        ],
        "name": "decreaseAllowance",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "addedValue",
                "type": "uint256"
            }
        ],
        "name": "increaseAllowance",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "symbol",
                "type": "string"
            }
        ],
        "name": "initialize",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "sender",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]
  let signers: Array<Signer>
  let impersonateSinger: Signer
  
  let llusd: LLUsd
  let liquidloans: LiquidLoans
  let loansClone1: LiquidLoans
  let loansClone: Address
  let firstToken: LLUsd
  let loanFactory: ContractFactory
  let llTokenFactory: ContractFactory
  let priceFactory: ContractFactory

  let priceConsumerV3: PriceConsumerV3
  let loanfactory: LoanFactory
  let owner: Signer
  let user1: Signer
  let user2: Signer
  let attacker: Signer
  let ownerAddress: string
  let user1Address: string
  let user2Address: string
  const priceFeed1: string = "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6" //USDC mainet priceFeed address
  const priceFeed2: string = "0xB9E1E3A9feFf48998E45Fa90847ed4D467E8BcfD" //Frax mainet priceFeed address
  const poolAddress: string = "0x13Cc34Aa8037f722405285AD2C82FE570bfa2bdc" //USDC-Frax mainet pool address
  const lpAddress: string = "0x927E6f04609A45B107C789aF34BA90Ebbf479f7f"
  const impersonate1: string = "0xAcF01994330A01C9de6c282BCF6c62231AbCf8E4"
  let lpContract: LPToken
  

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      const { get } = deployments
      await deployments.fixture()
      // await helpers.impersonateAccount(impersonate1)
      // const impersonateSinger = await ethers.getSigner(impersonate1);
      
      signers = await ethers.getSigners()
      owner = signers[0]
      user1 = signers[1]
      user2 = signers[2]
      attacker = signers[10]
      //before function
   
      ownerAddress = await owner.getAddress()
      user1Address = await user1.getAddress()
      user2Address = await user2.getAddress()
      llTokenFactory = await ethers.getContractFactory("LLUsd")
      firstToken = (await llTokenFactory.deploy()) as LLUsd

      await firstToken.deployed()

      firstToken.initialize("ll", "llUSD")
      
      loanFactory = await ethers.getContractFactory("LiquidLoans", owner)
      loansClone1 = (await loanFactory.deploy()) as LiquidLoans
      await loansClone1.deployed()
      expect(loansClone1.address).to.exist
      loansClone1.initialize(priceFeed1, priceFeed2, lpAddress, poolAddress, firstToken.address)

      // lpContract = new ethers.Contract("0x927E6f04609A45B107C789aF34BA90Ebbf479f7f", "LPToken")
      lpContract = await ethers.getContractAt(abi, "0x927E6f04609A45B107C789aF34BA90Ebbf479f7f")
    },
  )
  
  beforeEach(async () => {
  await setupTest()
  })
  

     

   
  
  

//try on existing saddle pools
  it("verifies new loan cotnract", async () => {
    //need to initialize the contract
    
    expect((await loansClone1.lpAddress())).to.equal(lpAddress)
    expect ((await loansClone1.connect(owner).getLatestPrice())).to.be.not.null
    //expect(loansClone1.usdA).to.be.not.null;
  })

  it("gets price from oracles", async () => {
    expect ((await loansClone1.connect(owner).getLatestPrice())).to.be.not.null
    expect ((await loansClone1.connect(owner).getLatestPrice2())).to.be.not.null 
  })




  it("does not get a loan", async () => {
    await expect ((loansClone1.connect(user1).mintAndLock(1))).to.be.reverted
      
  })

  it("gets a loan", async () => {
    await lpContract.connect(await impersonateAccount(impersonate1)).approve(loansClone1.address, MAX_UINT256)
    await loansClone1.connect(await impersonateAccount(impersonate1)).mintAndLock(1)
  })

  
//test scope
  // it("updates the accounting parameters")

  // it("repays the loan in llusd")

  // it("repays the loan in usdc")

  // it("repays the loan in Frax")

  // it("emits the repayloan event")

  // it("transfers the lp tokens to contract")

  // it("calculates the interest correctly")

  // it("calculates the loan correctly")

  // it("locks the lp tokens")

  // it("locks the correct lp tokens")

  // it("distributes the fees to the contract")

  // it("burns the llUsd tokens")

  // it("releases lp tokens")
  
  // it("calculates burn correctly")

  // it("accepts the correct token addresses")

  // it("emits repay event")

  // it("allows contract to cashout fees")

  // it("does not allow contract to misuse funds")
 

});


  //here starts the liquid loan cotnract testing after a pool was succesfully initialized

  //expect balance 

  