const hre = require('hardhat');

async function main() {
  const LightningProtocol = await hre.ethers.getContractFactory("LightningProtocol");
  const lightningProtocol = await LightningProtocol.deploy();

  await lightningProtocol.deployed();

  console.log("LightningProtocol deployed to:", lightningProtocol.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });