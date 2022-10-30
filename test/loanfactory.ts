import chai from "chai"
import { solidity } from "ethereum-waffle"
import { BigNumber, ContractFactory, Signer } from "ethers"
import { solidityPack, formatBytes32String } from "ethers/lib/utils"
import { deployments, ethers } from "hardhat"

import { Address } from "hardhat-deploy/types"
import { string } from "hardhat/internal/core/params/argumentTypes"
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

      const poolTokens = [firstToken.address, secondToken.address]

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

      await swap.addLiquidity([String(100e18), String(100e18)], 0, MAX_UINT256)

      expect(await firstToken.balanceOf(swap.address)).to.eq(String(100e18))
      expect(await secondToken.balanceOf(swap.address)).to.eq(String(100e18))
            
      loanFactory = await ethers.getContractFactory("LiquidLoans", owner)
      loansClone1 = (await loanFactory.deploy()) as LiquidLoans
      await loansClone1.deployed()
      expect(loansClone1.address).to.exist
      llTokenFactory = await ethers.getContractFactory("LLUsd")
      loanToken = (await llTokenFactory.connect(owner).deploy()) as LLUsd

      await loanToken.deployed()
      await loansClone1.connect(owner).initialize(swapToken.address, swap.address, loanToken.address, poolTokens)

      await loanToken.connect(owner).transfer(loansClone1.address, String(100e18))

      await swapToken.connect(user1).approve(loansClone1.address, MAX_UINT256)

      await loanToken.connect(user1).approve(loansClone1.address, MAX_UINT256)

      await swapToken.connect(user2).approve(loansClone1.address, MAX_UINT256)

      await loanToken.connect(user2).approve(loansClone1.address, MAX_UINT256) 

      await swap.connect(user1).addLiquidity([String(100e18), String(100e18)], 0, MAX_UINT256)
      await swap.connect(user2).addLiquidity([String(100e18), String(100e18)], 0, MAX_UINT256)


      
     
    },
  )
  
  beforeEach(async () => {
  await setupTest()
  })
  

     

   
  
  

  it("verifies new loan cotnract", async () => {
    expect((await loansClone1.lpAddress())).to.equal(swapToken.address)
    expect((await loanToken.balanceOf(loansClone1.address))).to.equal(String(100e18))
  })

  it("reverts if attacker claims loan", async () => {
    await expect ((loansClone1.connect(attacker).mintAndLock(1e18))).to.be.reverted
  })

  it("gets a loan and repay partially", async () => {
    const actualPoolTokenAmount = await swapToken.balanceOf(user1Address)
    expect(actualPoolTokenAmount).to.eq(String(200e18))
    await loansClone1.connect(user1).mintAndLock(String(50e18))
    expect ((await loanToken.balanceOf(user1Address))).to.equal(String(40e18))
    expect((await loanToken.balanceOf(loansClone1.address))).to.equal(String(60e18))
    await loansClone1.connect(user1).burnAndUnlock(loanToken.address, String(30e18))
    expect((await loanToken.balanceOf(user1Address))).to.equal(String(16e18))
  })

  it("gets a loan and repay fully", async () => {
    await loansClone1.connect(user1).mintAndLock(String(50e18))
    await loansClone1.connect(user1).burnAndUnlock(loanToken.address, String(50e18))
    expect((await loanToken.balanceOf(user1Address))).to.equal(0)
  })

  it("updates accounting info correctly", async () => {
    await loansClone1.connect(user1).mintAndLock(String(50e18))
    expect ((await loansClone1.accounting(user1Address)).owedBalance).to.equal(String(40e18))
    expect ((await loansClone1.accounting(user1Address)).lpLocked).to.equal(String(50e18))
    await loansClone1.connect(user1).burnAndUnlock(loanToken.address, String(50e18))
    expect ((await loansClone1.accounting(user1Address)).lpLocked).to.equal(0)
    expect ((await loansClone1.accounting(user1Address)).owedBalance).to.equal(0)
  })

  it("repays loan in pool token currency", async () => {
    await loansClone1.connect(user1).mintAndLock(String(50e18))
    await loansClone1.connect(user1).burnAndUnlock(firstToken.address, String(50e18))
    expect((await loanToken.balanceOf(user1Address))).to.equal(0)
    expect ((await loansClone1.accounting(user1Address)).lpLocked).to.equal(0)
    expect ((await loansClone1.accounting(user1Address)).owedBalance).to.equal(0)
    await loansClone1.connect(user2).mintAndLock(String(50e18))
    await loansClone1.connect(user2).burnAndUnlock(secondToken.address, String(50e18))
    expect ((await loansClone1.accounting(user2Address)).lpLocked).to.equal(0)
    expect ((await loansClone1.accounting(user2Address)).owedBalance).to.equal(0)
  })

});

  