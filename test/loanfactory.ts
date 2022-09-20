import chai from "chai"
import { solidity } from "ethereum-waffle"
import { BigNumber, ContractFactory, Signer } from "ethers"
import { solidityPack, formatBytes32String } from "ethers/lib/utils"
import { deployments, ethers } from "hardhat"
import { Address } from "hardhat-deploy/types"
import {
  Swap,
  SwapDeployer,
  SwapUtils,
  GenericERC20,
  LPToken,
  SwapFlashLoan,
  LoanFactory,
  LLUsd,
  LiquidLoans,
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
} from "./testUtils"

const salts = [formatBytes32String('1'), formatBytes32String('2')]
chai.use(solidity)
const { expect } = chai

describe("Loan Deployer", () => {
  let signers: Array<Signer>
  let llusd: LPToken
  let liquidloans: LiquidLoans
  let loansClone1: LiquidLoans
  let loansClone: Address
  let loanfactory: ContractFactory
  let swap: Swap
  let swapClone: Swap
  let swapDeployer: SwapDeployer
  let swapUtils: SwapUtils
  let DAI: GenericERC20
  let USDC: GenericERC20
  let loanFactory: LoanFactory
  let swapToken: LPToken
  let owner: Signer
  let user1: Signer
  let user2: Signer
  let attacker: Signer
  let ownerAddress: string
  let user1Address: string
  let user2Address: string
  const priceFeed1: Address = "0x773616E4d11A78F511299002da57A0a94577F1f4" //DAI mainet priceFeed address
  const priceFeed2: Address = "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4" //USDC mainet priceFeed address
  let swapStorage: {
    initialA: BigNumber
    futureA: BigNumber
    initialATime: BigNumber
    futureATime: BigNumber
    swapFee: BigNumber
    adminFee: BigNumber
    lpToken: string
  }

  // Test Values
  const INITIAL_A_VALUE = 50
  const SWAP_FEE = 1e7
  const LP_TOKEN_NAME = "Test LP Token Name"
  const LP_TOKEN_SYMBOL = "TESTLP"
  const TOKENS: GenericERC20[] = []

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      const { get, deploy } = deployments
      await deployments.fixture() // ensure you start from a fresh deployments

      TOKENS.length = 0
      signers = await ethers.getSigners()
      owner = signers[0]
      user1 = signers[1]
      user2 = signers[2]
      attacker = signers[10]
      ownerAddress = await owner.getAddress()
      user1Address = await user1.getAddress()
      user2Address = await user2.getAddress()

      await deploy("SUSD", {
        from: ownerAddress,
        contract: "GenericERC20",
        args: ["SUSD", "Synthetix USD", "18"],
        skipIfAlreadyDeployed: true,
      })

      DAI = await ethers.getContract("DAI")
      USDC = await ethers.getContract("USDC")
      llusd = await ethers.getContract("LPToken")
      loanfactory = await ethers.getContractFactory("LiquidLoans")


      TOKENS.push(DAI, USDC)

      // Mint dummy tokens
      await asyncForEach(
        [ownerAddress, user1Address, user2Address, await attacker.getAddress()],
        async (address) => {
          await DAI.mint(address, String(1e20))
          await USDC.mint(address, String(1e8))

        },
      )

      swap = await ethers.getContract("Swap")

      swapDeployer = await ethers.getContract("SwapDeployer")
      const lpToken = await ethers.getContract("LPToken")

      const swapCloneAddress = await swapDeployer.callStatic.deploy(
        swap.address,
        [DAI.address, USDC.address],
        [18, 6],
        LP_TOKEN_NAME,
        LP_TOKEN_SYMBOL,
        INITIAL_A_VALUE,
        SWAP_FEE,
        0,
        lpToken.address,
      )

      await swapDeployer.deploy(
        swap.address,
        [DAI.address, USDC.address],
        [18, 6],
        LP_TOKEN_NAME,
        LP_TOKEN_SYMBOL,
        INITIAL_A_VALUE,
        SWAP_FEE,
        0,
        lpToken.address,
      )

      swapClone = await ethers.getContractAt("Swap", swapCloneAddress)

      expect(await swapClone.getVirtualPrice()).to.be.eq(0)

      swapStorage = await swapClone.swapStorage()

      swapToken = (await ethers.getContractAt(
        "LPToken",
        swapStorage.lpToken,
      )) as LPToken

      await asyncForEach([owner, user1, user2, attacker], async (signer) => {
        await DAI.connect(signer).approve(swapClone.address, MAX_UINT256)
        await USDC.connect(signer).approve(swapClone.address, MAX_UINT256)

      })

      // Populate the pool with initial liquidity
      await swapClone.addLiquidity(
        [String(50e18), String(50e6)],
        0,
        MAX_UINT256,
      )

      expect(await swapClone.getTokenBalance(0)).to.be.eq(String(50e18))
      expect(await swapClone.getTokenBalance(1)).to.be.eq(String(50e6))

      expect(await getUserTokenBalance(owner, swapToken)).to.be.eq(
        String(100e18),
      )

    },
  )
  beforeEach(async () => {
    await setupTest()

  })


//try on existing saddle pools
  it("deploys a new loan cotnract", async () => {
    loansClone1 = (await loanfactory.deploy()) as LiquidLoans
    loansClone1.initialize(priceFeed1, priceFeed2, swapToken.address, swap.address, llusd.address)
    expect(loansClone1).to.exist;
    expect(loansClone1.usdA).to.be.not.null;
  })



  it("gets a loan", async () => {
    await loansClone1.connect(user1).mintAndLock(1);
      
  })

  it("gets price from oracles", async () => {
    const price1 = await loansClone1.getLatestPrice1();
    const price2 = await loansClone1.getLatestPrice2();
    expect(price1).to.be.not.null;
    expect(price2).to.be.not.null;
  })
//test scope
  it("updates the accounting parameters")

  it("repays the loan in llusd")

  it("repays the loan in usdc")

  it("repays the loan in Frax")

  it("emits the repayloan event")

  it("transfers the lp tokens to contract")

  it("calculates the interest correctly")

  it("calculates the loan correctly")

  it("locks the lp tokens")

  it("locks the correct lp tokens")

  it("distributes the fees to the contract")

  it("burns the llUsd tokens")

  it("releases lp tokens")
  
  it("calculates burn correctly")

  it("accepts the correct token addresses")

  it("emits repay event")

  it("allows contract to cashout fees")

  it("does not allow contract to misuse funds")
 

});


  //here starts the liquid loan cotnract testing after a pool was succesfully initialized

  //expect balance 