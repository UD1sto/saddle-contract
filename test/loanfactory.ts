import chai from "chai"
import { solidity } from "ethereum-waffle"
import { BigNumber, ContractFactory, Signer } from "ethers"
import { solidityPack, formatBytes32String } from "ethers/lib/utils"
import { deployments, ethers } from "hardhat"

import { Address } from "hardhat-deploy/types"
import {
  
  
  LoanFactory,
  LLUsd,
  LiquidLoans,
  PriceConsumerV3,
  GenericERC20,
  LPToken,
  Swap,
  SwapUtils,
  TestSwapReturnValues,
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


  let impersonateSinger: Signer
  
  let llusd: LLUsd
  let liquidloans: LiquidLoans
  let loansClone1: LiquidLoans
  let loansClone: Address
  let loanToken: LLUsd
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
  const sentValue: BigNumber = BigNumber.from("1000000000000000000")
  const depositPayValue: BigNumber = BigNumber.from("10000")
  let signers: Array<Signer>
  let swap: Swap
  let testSwapReturnValues: TestSwapReturnValues
  let swapUtils: SwapUtils
  let firstToken: GenericERC20
  let secondToken: GenericERC20
  let swapToken: LPToken
  let swapStorage: {
    initialA: BigNumber
    futureA: BigNumber
    initialATime: BigNumber
    futureATime: BigNumber
    swapFee: BigNumber
    adminFee: BigNumber
    lpToken: string
  }
  const INITIAL_A_VALUE = 50
  const SWAP_FEE = 1e7
  const LP_TOKEN_NAME = "Test LP Token Name"
  const LP_TOKEN_SYMBOL = "TESTLP"
  

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      const { get } = deployments
      await deployments.fixture()
      
      signers = await ethers.getSigners()
      owner = signers[0]
      user1 = signers[1]
      user2 = signers[2]
      attacker = signers[10]
      //before function
   
      ownerAddress = await owner.getAddress()
      user1Address = await user1.getAddress()
      user2Address = await user2.getAddress()

      const erc20Factory = await ethers.getContractFactory("GenericERC20")

      firstToken = (await erc20Factory.deploy(
        "First Token",
        "FIRST",
        "18",
      )) as GenericERC20

      secondToken = (await erc20Factory.deploy(
        "Second Token",
        "SECOND",
        "18",
      )) as GenericERC20

      // Mint dummy tokens
      await asyncForEach([owner, user1, user2], async (signer) => {
        const address = await signer.getAddress()
        await firstToken.mint(address, String(1e20))
        await secondToken.mint(address, String(1e20))
      })

      // Get Swap contract
      swap = await ethers.getContract("Swap")

      await swap.initialize(
        [firstToken.address, secondToken.address],
        [18, 18],
        LP_TOKEN_NAME,
        LP_TOKEN_SYMBOL,
        INITIAL_A_VALUE,
        SWAP_FEE,
        0,
        (
          await get("LPToken")
        ).address,
      )

      expect(await swap.getVirtualPrice()).to.be.eq(0)

      swapStorage = await swap.swapStorage()

      swapToken = (await ethers.getContractAt(
        "LPToken",
        swapStorage.lpToken,
      )) as LPToken

      const testSwapReturnValuesFactory = await ethers.getContractFactory(
        "TestSwapReturnValues",
      )
      testSwapReturnValues = (await testSwapReturnValuesFactory.deploy(
        swap.address,
        swapToken.address,
        2,
      )) as TestSwapReturnValues

      await asyncForEach([owner, user1, user2], async (signer) => {
        await firstToken.connect(signer).approve(swap.address, MAX_UINT256)
        await secondToken.connect(signer).approve(swap.address, MAX_UINT256)
        await swapToken.connect(signer).approve(swap.address, MAX_UINT256)
      })

      await swap.addLiquidity([String(1e18), String(1e18)], 0, MAX_UINT256)

      expect(await firstToken.balanceOf(swap.address)).to.eq(String(1e18))
      expect(await secondToken.balanceOf(swap.address)).to.eq(String(1e18))
            
      loanFactory = await ethers.getContractFactory("LiquidLoans", owner)
      loansClone1 = (await loanFactory.deploy()) as LiquidLoans
      await loansClone1.deployed()
      expect(loansClone1.address).to.exist
      llTokenFactory = await ethers.getContractFactory("LLUsd")
      loanToken = (await llTokenFactory.connect(owner).deploy()) as LLUsd

      await loanToken.deployed()
      loansClone1.initialize(swapToken.address, swap.address, loanToken.address)

      await firstToken.connect(owner).transfer(loansClone1.address, sentValue)


      
     
    },
  )
  
  beforeEach(async () => {
  await setupTest()
  })
  

     

   
  
  

//try on existing saddle pools
  it("verifies new loan cotnract", async () => {
    //need to initialize the contract
    
    expect((await loansClone1.lpAddress())).to.equal(swapToken.address)
    
    //expect(loansClone1.usdA).to.be.not.null;
  })

//   it("does not get a loan", async () => {
//     await expect ((loansClone1.connect(await impersonateAccount(impersonate1)).mintAndLock(depositPayValue))).to.be.reverted
      
//   })

  it("gets a loan", async () => {
    await swap.connect(user1).addLiquidity([String(1e18), String(3e18)], 0, MAX_UINT256)

    const actualPoolTokenAmount = await swapToken.balanceOf(user1Address)
    expect(actualPoolTokenAmount).to.eq(BigNumber.from("3991672211258372957"))
    await swapToken.connect(user1).approve(loansClone1.address, MAX_UINT256)
    await loansClone1.connect(user1).mintAndLock(BigNumber.from("3991672"))
    expect ((await loanToken.balanceOf(impersonate1))).to.be.above(1)
    // expect ((await loansClone1.accounting(impersonate1)).owedBalance).to.be.above(1)
    // expect ((await loansClone1.accounting(impersonate1)).lpLocked).to.be.above(1)
  })

  it("can repay the loan", async () => {
    await swapToken.connect(user1).approve(loansClone1.address, MAX_UINT256)
    await loansClone1.connect(user1).mintAndLock(BigNumber.from("3991672"))
    expect ((await loansClone1.accounting(user1Address)).owedBalance).to.be.above(1)
    await loansClone1.connect(user1).burnAndUnlock(loanToken.address, BigNumber.from("3991672"))
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

  