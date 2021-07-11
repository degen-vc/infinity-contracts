// Imports
const hardhat = require("hardhat");
require('dotenv').config();

// Load env var
const { ROUTER, FACTORY, FEE_RECEIVER, ALFAJORES_CELO } = process.env;

async function main() {
  await hardhat.run("deploy_infinityProtocol", {router: ROUTER})
  await hardhat.run("deploy_liquidVault", {})
  await hardhat.run("deploy_feeDistributor", {})
}    

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });