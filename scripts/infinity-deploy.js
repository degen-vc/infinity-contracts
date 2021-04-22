const hardhat = require('hardhat');
require('dotenv').config()

const { ROUTER, UNISWAP_PAIR, FEE_RECEIVER } = process.env;

async function main() {
  const stakeDuration = 1;
  const donationShare = 10;
  const purchaseFee = 30;

  const InfinityProtocol = await hardhat.ethers.getContractFactory("InfinityProtocol");
  const infinityProtocol = await InfinityProtocol.deploy(ROUTER);
  await infinityProtocol.deployed();

  console.log("InfinityProtocol deployed to:", infinityProtocol.address);

  const LiquidVault = await hardhat.ethers.getContractFactory('LiquidVault');
  const liquidVault = await LiquidVault.deploy();
  await liquidVault.deployed();
  await liquidVault.seed(
    stakeDuration,
    infinityProtocol.address,
    UNISWAP_PAIR,
    ROUTER,
    FEE_RECEIVER,
    donationShare,
    purchaseFee
  );

  console.log("LiquidVault deployed to: ", liquidVault.address);

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