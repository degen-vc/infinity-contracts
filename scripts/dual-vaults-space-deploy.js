const hardhat = require('hardhat');
require('dotenv').config();

async function main() {
  const AcceleratorVaultSpace = await hardhat.ethers.getContractFactory('AcceleratorVaultSpace');
  const acceleratorVaultSpace = await AcceleratorVaultSpace.deploy();
  await acceleratorVaultSpace.deployed();

  console.log("AcceleratorVaultSpace deployed to: ", acceleratorVaultSpace.address);

  const HodlerVaultSpace = await hardhat.ethers.getContractFactory('HodlerVaultSpace');
  const hodlerVaultSpace = await HodlerVaultSpace.deploy();
  await hodlerVaultSpace.deployed();

  console.log("HodlerVaultSpace deployed to: ", hodlerVaultSpace.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });