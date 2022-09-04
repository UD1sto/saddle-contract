import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, getChainId } = hre
    const { execute, deploy, get, getOrNull, log, read, save } = deployments
    const { deployer } = await getNamedAccounts()

    const liquidLoans = await getOrNull("LiquidLoans")
    if (liquidLoans) {
      log(`reusing "LiquidLoans" at ${liquidLoans.address}`)
    } else {
        await deploy("LiquidLoans", {
            from: deployer,
            log: true,
            skipIfAlreadyDeployed: true,
        });
    }

    const loanFactory = await getOrNull("LoanFactory")
    if (loanFactory) {
      log(`reusing "LoanFactory" at ${loanFactory.address}`)
    } else {
        await deploy("LoanFactory", {
            from: deployer,
            args: [liquidLoans],
            log: true,
            skipIfAlreadyDeployed: true,
        });
    }
}
  

export default func;
func.tags = ['LoanFactory'];