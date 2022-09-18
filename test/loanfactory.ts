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
  const priceFeed1: Address = "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9" //DAI mainet priceFeed address
  const priceFeed2: Address = "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6" //USDC mainet priceFeed address
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
  describe("liquidloans", () => {


    it("should deploy a new loan cotnract", async () => {
      loansClone1 = (await loanfactory.deploy()) as LiquidLoans
      loansClone1.initialize(llusd.address, swap.address, swapToken.address, priceFeed1, priceFeed2)
      expect(loansClone1).to.exist;
    })

    })
  });


  //here starts the liquid loan cotnract testing after a pool was succesfully initialized
