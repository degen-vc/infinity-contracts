const hardhat = require('hardhat');
require('dotenv').config()

const { PAIR, TOKENA, TOKENB } = process.env;

async function main() {
  const PriceOracle = await hardhat.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(PAIR, TOKENA, TOKENB);
  await priceOracle.deployed();

  console.log("PriceOracle deployed to:", priceOracle.address);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });