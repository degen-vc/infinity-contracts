// const hre = require("hardhat/config")
const {DeployFunction} = require('hardhat-deploy')

// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) { const {deployments, getNamedAccounts} = hre; const {deploy} = deployments; const {deployer, tokenOwner} = await getNamedAccounts(); await deploy('Token', { from: deployer, args: [tokenOwner], log: true, });};export default func;func.tags = ['Token'];

// import {DeployFunction} from 'hardhat-deploy/types'
// require('dotenv').config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html

// const {FORNO_CELO_MAINNET, FORNO_CELO_TESTNET, DEPLOYER_PRIVATE_KEY, OWNER_PRIVATE_KEY, ETHERSCAN_API_KEY, ROUTER} = process.env;

// task("hello", "Prints 'Hello, World!'", async function(taskArguments, hre, runSuper) {
//   console.log("Hello, World!");
// });

task("deploy_infinityProtocol", "Deploys infinity protocol")
  .addParam("router", "Ube/Pancake/Uniswap Router Address")
  .setAction(async ({router}) => {
    const {deployments, getNamedAccounts} = hre; 
    const {deploy} = deployments;

    const {deployer, tokenOwner} = await getNamedAccounts(); 
    const infinityContract = await deploy('InfinityProtocol', { from: deployer, args: [router], log: true, })
    
    console.log("InfinityProtocol deployed to:", infinityContract.address);
    
    return infinityContract;
  });

  module.exports = {task};