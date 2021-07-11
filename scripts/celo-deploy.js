// const hardhat = require('hardhat');
const UniswapV2Factory = require("@ubeswap/core/build/metadata/UniswapV2Factory/artifact.json");
const UniswapV2Pair = require("@ubeswap/core/build/metadata/UniswapV2Pair/artifact.json");
require('dotenv').config();

const { ROUTER, FACTORY, FEE_RECEIVER, ALFAJORES_CELO } = process.env;

async function main() {

  // Deploy InfinityProtocol - Reality
  const liquidVaultShare = 60;
  const burnPercentage = 10;

  const InfinityProtocol = await ethers.getContractFactory("InfinityProtocol");
  const infinityProtocol = await InfinityProtocol.deploy(ROUTER);
  await infinityProtocol.deployed();

  console.log("InfinityProtocol deployed to:", infinityProtocol.address);

  // Deploy LiquidVault - Reality
  await pausePromise('Deploying LiquidVault');
  const LiquidVault = await hardhat.ethers.getContractFactory('LiquidVault');
  const liquidVault = await LiquidVault.deploy();
  await liquidVault.deployed();

  console.log("LiquidVault deployed to: ", liquidVault.address);

  // Deploy FeeDistributor
  const FeeDistributor = await hardhat.ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy();
  await feeDistributor.deployed();

  console.log("FeeDistributor deployed to:", feeDistributor.address);

  await pausePromise('Seeding FeeDistributor');
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
  
  await pausePromise('Deploying Ubeswap Pair');
  await uniswapFactory.createPair(ALFAJORES_CELO, infinityProtocol.address);

  await pausePromise('Fetching pairAddress');
  const pairAddress = await uniswapFactory.getPair(ALFAJORES_CELO, infinityProtocol.address);

  await pausePromise('Loading uniswapPair instance');
  const uniswapPair = await hardhat.ethers.getContractAt(JSON.parse(UniswapV2Pair.abi), pairAddress);

  console.log("Ubeswap LP Token Pair deployed at:", pairAddress)

  // Deploy PriceOracle
  await pausePromise('Deploying PriceOracle');
  const PriceOracle = await hardhat.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(pairAddress, ALFAJORES_CELO, infinityProtocol.address);
  await priceOracle.deployed();

  console.log("PriceOracle deployed to:", priceOracle.address);

  await pausePromise('Deploying PowerVault');
  const PowerLiquidVault = await hardhat.ethers.getContractFactory('PowerLiquidVault');
  const powerLiquidVault = await PowerLiquidVault.deploy();
  await powerLiquidVault.deployed();

  console.log("PowerLiquidVault deployed to: ", powerLiquidVault.address);
  
  await pausePromise('Fetching Ubeswap Pair Tokens and LP Total Supply');
  const token0 = await uniswapPair.token0();
  const token1 = await uniswapPair.token1();
  let pairTotalSupply = await uniswapPair.totalSupply();

  console.log("Token0 Infinity:", token0);
  console.log("Token1 CELO:", token1);
  console.log("Ubeswap LP Total Supply", pairTotalSupply.toString());

  await pausePromise('Fetching Ubeswap Pair and Total Supply');
}

function pausePromise(message, durationInSeconds = 3) {
	return new Promise(function (resolve, error) {
		setTimeout(() => {
			console.log(message);
			return resolve();
		}, durationInSeconds * 1000);
	});
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });