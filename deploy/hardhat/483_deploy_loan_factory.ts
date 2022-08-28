import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

//constructor arguments

/*0x0 addresses will innevitably throw an error, in this case they are used to mock deployment, replace with the 
desired addresses to succesfully deploy*/

const PRICE_A = "0X0000000000000000000000000000000000000000";
const PRICE_B = "0X0000000000000000000000000000000000000000";
const LP_ADDRESS = "0X0000000000000000000000000000000000000000";
const SWAP_ADDRESS = "0X0000000000000000000000000000000000000000";
const LL_ADDRESS = "0X0000000000000000000000000000000000000000";
const USD_TOKEN_NAME = "LUSD_USDC_FRAX";
const USD_TOKEN_SYMBOL = "LUSD-UF";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, getChainId } = hre
    const { execute, deploy, get, getOrNull, log, read, save } = deployments
    const { deployer } = await getNamedAccounts()
    
    await deploy("loanfactory", {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    })

    await execute(
        "loanfactory",
        { from: deployer, log: true },
        "createLoanContract",
        PRICE_A,
        PRICE_B,
        LP_ADDRESS,
        SWAP_ADDRESS,
        LL_ADDRESS,
        USD_TOKEN_NAME,
        USD_TOKEN_SYMBOL,
    )


}
export default func
func.tags = ["loanfactory"]

    