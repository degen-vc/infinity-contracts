const hardhat = require('hardhat');
const UniswapV2Factory = require("@ubeswap/core/build/metadata/UniswapV2Factory/artifact.json");
const UniswapV2Pair = require("@ubeswap/core/build/metadata/UniswapV2Pair/artifact.json");
require('dotenv').config();

const { ROUTER, FACTORY, FEE_RECEIVER, ALFAJORES_CELO } = process.env;

async function main() {

  // Deploy InfinityProtocol stone, LiquidVault, and FeeDistributor
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

  console.log("FeeDistributor seeded");

  // Load Uniswap Factory
  const uniswapFactory = await hardhat.ethers.getContractAt(JSON.parse(UniswapV2Factory.abi), FACTORY);

  console.log("UbeswapFactory deployed at:", uniswapFactory.address)

  await uniswapFactory.createPair(ALFAJORES_CELO, infinityProtocol.address);
  
  const pairAddress = await uniswapFactory.getPair(ALFAJORES_CELO, infinityProtocol.address);
  const uniswapPair = await hardhat.ethers.getContractAt(JSON.parse(UniswapV2Pair.abi), pairAddress);

  console.log("Ubeswap LP Token Pair deployed at:", pairAddress)

  // Deploy PriceOracle
  const PriceOracle = await hardhat.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(pairAddress, ALFAJORES_CELO, infinityProtocol.address);
  await priceOracle.deployed();

  console.log("PriceOracle deployed to:", priceOracle.address);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });