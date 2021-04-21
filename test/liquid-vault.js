const UniswapV2Pair = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const Ganache = require('./helpers/ganache');
const deployUniswap = require('./helpers/deployUniswap');
const assert = require('assert');
const { expect } = require('chai');
const { BigNumber, utils } = require('ethers');

describe('LiquidVault', function () {
  const bn = (input) => BigNumber.from(input);
  const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());

  const ganache = new Ganache();
  const baseUnit = 8;
  const totalSupply = utils.parseUnits('100000000', baseUnit);

  const stakeDuration = 1;
  const donationShare = 10;
  const purchaseFee = 30;

  let accounts;
  let owner;
  let user;
  let feeReceiver;

  let weth;
  let infinity;
  let liquidVault;
  let uniswapFactory;
  let uniswapRouter;
  let uniswapPair;
  let pairAddress;

  beforeEach('setup others', async function() {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    feeReceiver = accounts[2];
    userTwo = accounts[3];

    afterEach('revert', function() { return ganache.revert(); });

    const contracts = await deployUniswap(accounts);

    weth = contracts.weth;
    uniswapFactory = contracts.uniswapFactory;
    uniswapRouter = contracts.uniswapRouter;

    const InfinityProtocol = await ethers.getContractFactory('InfinityProtocol');
    infinity = await InfinityProtocol.deploy(uniswapRouter.address);
    await infinity.deployed();

    const LiquidVault = await ethers.getContractFactory('LiquidVault');
    liquidVault = await LiquidVault.deploy();
    await liquidVault.deployed();

    await uniswapFactory.createPair(weth.address, infinity.address);
    pairAddress = await uniswapFactory.getPair(weth.address, infinity.address);
    uniswapPair = await ethers.getContractAt(UniswapV2Pair.abi, pairAddress);

    await liquidVault.seed(
      stakeDuration,
      infinity.address,
      pairAddress,
      uniswapRouter.address,
      feeReceiver.address,
      donationShare,
      purchaseFee
    );

    await ganache.snapshot();
  });

  it('should revert seed() if caller is not the owner', async function() {
    await expect(liquidVault.connect(user).seed(
      stakeDuration,
      infinity.address,
      pairAddress,
      uniswapRouter.address,
      feeReceiver.address,
      donationShare,
      purchaseFee
    )).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should check liquid vault\'s parameters', async function() {
    const config = await liquidVault.config();

    assert.strictEqual(config.infinityToken, infinity.address);
    assert.strictEqual(config.tokenPair, pairAddress);
    assert.strictEqual(config.uniswapRouter, uniswapRouter.address);
    assert.strictEqual(config.feeReceiver, feeReceiver.address);
    assert.strictEqual(config.weth, weth.address);
    assertBNequal(config.stakeDuration, 86400);
    assertBNequal(config.donationShare, donationShare);
    assertBNequal(config.purchaseFee, purchaseFee);
  });
});