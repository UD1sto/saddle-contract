import "@nomiclabs/hardhat-vyper"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-web3"
import "@nomiclabs/hardhat-etherscan"
import "@typechain/hardhat"
import "hardhat-gas-reporter"
import "solidity-coverage"
import "hardhat-deploy"
import "hardhat-spdx-license-identifier"
//import "hardhat-tracer"

import { HardhatUserConfig, task } from "hardhat/config"
import dotenv from "dotenv"
import { ALCHEMY_BASE_URL, CHAIN_ID } from "./utils/network"
import { MULTISIG_ADDRESSES, PROD_DEPLOYER_ADDRESS } from "./utils/accounts"
import { Deployment } from "hardhat-deploy/dist/types"
import { HttpNetworkUserConfig } from "hardhat/types"


dotenv.config()

if (process.env.HARDHAT_FORK) {
  process.env["HARDHAT_DEPLOY_FORK"] = process.env.HARDHAT_FORK
}

let config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // forking: {
      //   url: "https://eth-mainnet.g.alchemy.com/v2/", //paste your alchemy key here
      //   blockNumber: 15605576, 
      // },
      deploy: ["./deploy/hardhat/"],
      autoImpersonate: true,
    },
   
  },
  paths: {
    sources: "./contracts",
    artifacts: "./build/artifacts",
    cache: "./build/cache",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
      {
        version: "0.5.16",
      },
    ],
    overrides: {
      "contracts/helper/Multicall3.sol": {
        version: "0.8.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000000,
          },
        },
      },
    },
  },
  vyper: {
    compilers: [
      { version: "0.2.12" },
      { version: "0.2.16" },
      { version: "0.2.15" },
      { version: "0.2.7" },
      { version: "0.3.1" },
      { version: "0.3.2" },
    ],
  },
  typechain: {
    outDir: "./build/typechain/",
    target: "ethers-v5",
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 21,
  },
  mocha: {
    timeout: 200000,
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
 
    },
    libraryDeployer: {
      default: 1, // use a different account for deploying libraries on the hardhat network
 
    },
    multisig: {
      default: 0,
 
    },
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: true,
  },
}



if (process.env.FORK_NETWORK && config.networks) {
  const forkNetworkName = process.env.FORK_NETWORK as string
  const blockNumber = process.env.FORK_BLOCK_NUMBER
    ? parseInt(process.env.FORK_BLOCK_NUMBER)
    : undefined
  console.log(`FORK_NETWORK is set to ${forkNetworkName}`)
  console.log(
    `FORK_BLOCK_NUMBER is set to ${
      blockNumber ? blockNumber : "undefined (using latest block number)"
    }`,
  )

  if (!config.networks[forkNetworkName]) {
    throw new Error(
      `FORK_NETWORK is set to ${forkNetworkName}, but no network with that name is defined in the config.`,
    )
  }
  if (!(config.networks[forkNetworkName] as HttpNetworkUserConfig).url) {
    throw new Error(
      `FORK_NETWORK is set to ${forkNetworkName}, but no url is defined for that network in the config.`,
    )
  }
  if (!CHAIN_ID[forkNetworkName.toUpperCase()]) {
    throw new Error(
      `FORK_NETWORK is set to ${forkNetworkName}, but no chainId is defined for that network in the CHAIN_ID constant.`,
    )
  }
  const forkingURL = (config.networks[forkNetworkName] as HttpNetworkUserConfig)
    .url as string
  const forkingChainId = parseInt(CHAIN_ID[forkNetworkName.toUpperCase()])
  const externalDeploymentsFolder = `deployments/${forkNetworkName.toLowerCase()}`
  const deployPaths = config.networks[forkNetworkName]?.deploy as string[]

  console.log(
    `Attempting to fork ${forkNetworkName} from ${forkingURL} with chainID of ${forkingChainId}. External deployments folder is ${externalDeploymentsFolder}`,
  )

  config = {
    ...config,
    networks: {
      ...config.networks,
      hardhat: {
        ...config.networks.hardhat,
        forking: {
          url: forkingURL,
          blockNumber: blockNumber,
        },
        chainId: forkingChainId,
        deploy: deployPaths,
      },
    },
    namedAccounts: {
      ...config.namedAccounts,
      deployer: {
        [String(forkingChainId)]: PROD_DEPLOYER_ADDRESS,
      },
      multisig: {
        [String(forkingChainId)]: MULTISIG_ADDRESSES[forkingChainId.toString()],
      },
    },
    external: {
      deployments: {
        localhost: [externalDeploymentsFolder],
      },
    },
  }
}

// Override the default deploy task
task("deploy", async (taskArgs, hre, runSuper) => {
  const { all } = hre.deployments
  /*
   * Pre-deployment actions
   */

  // Load exiting deployments
  const existingDeployments: { [p: string]: Deployment } = await all()
  // Create hard copy of existing deployment name to address mapping
  const existingDeploymentToAddressMap: { [p: string]: string } = Object.keys(
    existingDeployments,
  ).reduce((acc: { [p: string]: string }, key) => {
    acc[key] = existingDeployments[key].address
    return acc
  }, {})

  /*
   * Run super task
   */
  await runSuper(taskArgs)

  /*
   * Post-deployment actions
   */
  const updatedDeployments: { [p: string]: Deployment } = await all()

  // Filter out any existing deployments that have not changed
  const newDeployments: { [p: string]: Deployment } = Object.keys(
    updatedDeployments,
  ).reduce((acc: { [p: string]: Deployment }, key) => {
    if (
      !existingDeploymentToAddressMap.hasOwnProperty(key) ||
      existingDeploymentToAddressMap[key] !== updatedDeployments[key].address
    ) {
      acc[key] = updatedDeployments[key]
    }
    return acc
  }, {})

  // Print the new deployments to the console
  if (Object.keys(newDeployments).length > 0) {
    console.log("\nNew deployments:")
    console.table(
      Object.keys(newDeployments).map((k) => [k, newDeployments[k].address]),
    )
  } else {
    console.warn("\nNo new deployments found")
  }
})

export default config
