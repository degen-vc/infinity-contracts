const hre = require('hardhat');

async function main() {
  const InfinityProtocol = await hre.ethers.getContractFactory("InfinityProtocol");
  const infinityProtocol = await InfinityProtocol.deploy();

  await infinityProtocol.deployed();

  console.log("InfinityProtocol deployed to:", infinityProtocol.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });