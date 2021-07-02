// Hardhat Global Imports
const { task } = require('hardhat/config');
require('hardhat-deploy')
require('hardhat-deploy-ethers')
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('dotenv').config()

// Hardhat Tasks
require('./tasks/deploy_infinityProtocol')
require('./tasks/deploy_liquidVault')
require('./tasks/deploy_feeDistributor')

const {FORNO_CELO_MAINNET, FORNO_CELO_TESTNET, DEPLOYER_PRIVATE_KEY, OWNER_PRIVATE_KEY, ETHERSCAN_API_KEY, ROUTER} = process.env;

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html

// task(
//   "infinity-deploy", 
//   "Deploys - Infinity Protocol, Reality LVault, FeeD, seeds FeeD", 
//   ).addParam(
//     "router", 
//     "Uniswap / Ubeswap Router Address for Infinity Protocol").setAction(async () => {

//   });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    alfajores: {
      url: FORNO_CELO_TESTNET,
      accounts: [DEPLOYER_PRIVATE_KEY, OWNER_PRIVATE_KEY],
      live: true,
      gasPrice: 0.5 * 10 ** 9,
      gas: 8000000,
    },
    celo_mainnet: {
      url: FORNO_CELO_MAINNET,
      accounts: [DEPLOYER_PRIVATE_KEY, OWNER_PRIVATE_KEY]
    }
  },
  solidity: {
    version: "0.7.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  namedAccounts: { deployer: 0, tokenOwner: 1},
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
};

