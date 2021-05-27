const hardhat = require('hardhat');
require('dotenv').config();

async function main() {
  const PowerLiquidVault = await hardhat.ethers.getContractFactory('PowerLiquidVault');
  const powerLiquidVault = await PowerLiquidVault.deploy();
  await powerLiquidVault.deployed();

  console.log("PowerLiquidVault deployed to: ", powerLiquidVault.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });