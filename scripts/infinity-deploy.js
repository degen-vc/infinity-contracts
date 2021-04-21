const hardhat = require('hardhat');
require('dotenv').config()

const { ROUTER } = process.env;

async function main() {
  const InfinityProtocol = await hardhat.ethers.getContractFactory("InfinityProtocol");
  const infinityProtocol = await InfinityProtocol.deploy(ROUTER);

  await infinityProtocol.deployed();
  console.log("InfinityProtocol deployed to:", infinityProtocol.address);

  //TODO deploy vault
  const vaultAddress = ROUTER;

  const FeeDistributor = await hardhat.ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy();
  await feeDistributor.deployed();
  await feeDistributor.seed(infinityProtocol.address, vaultAddress);

  console.log("FeeDistributor deployed to:", feeDistributor.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });