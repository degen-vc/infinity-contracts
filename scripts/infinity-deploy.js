const hardhat = require('hardhat');
require('dotenv').config()

const { ROUTER, FEE_RECEIVER } = process.env;

async function main() {
  const liquidVaultShare = 60;
  const burnPercentage = 10;

  const InfinityProtocol = await hardhat.ethers.getContractFactory("InfinityProtocol");
  const infinityProtocol = await InfinityProtocol.deploy(ROUTER);
  await infinityProtocol.deployed();

  console.log("InfinityProtocol deployed to:", infinityProtocol.address);

  const LiquidVault = await hardhat.ethers.getContractFactory('LiquidVault');
  const liquidVault = await LiquidVault.deploy();
  await liquidVault.deployed();

  console.log("LiquidVault deployed to: ", liquidVault.address);

  const FeeDistributor = await hardhat.ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy();
  await feeDistributor.deployed();

  console.log("FeeDistributor deployed to:", feeDistributor.address);

  await feeDistributor.seed(
    infinityProtocol.address,
    liquidVault.address,
    FEE_RECEIVER,
    liquidVaultShare,
    burnPercentage
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });