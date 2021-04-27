const UniswapV2Pair = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const Ganache = require('./helpers/ganache');
const deployUniswap = require('./helpers/deployUniswap');
const { expect, assert, util } = require('chai');
const { BigNumber, utils } = require('ethers');

describe('AcceleratorVaultSpace', function () {
  const bn = (input) => BigNumber.from(input);
  const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());

  const ganache = new Ganache();
  const baseUnit = 8;

  const acceleratorityInfinityAmount = utils.parseUnits('10000', baseUnit);
  const acceleratorityETHAmount = utils.parseEther('10');
  
  const stakeDuration = 1;
  const donationShare = 10;
  const purchaseFee = 30;
  const acceleratorVaultShare = 80;
  const burnPercentage = 10;

  let accounts;
  let owner;
  let user;
  let ethHodler;

  let weth;
  let infinity;
  let acceleratorVault;
  let uniswapFactory;
  let uniswapRouter;
  let uniswapPair;
  let pairAddress;

  beforeEach('setup others', async function() {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    ethHodler = accounts[2];
    userTwo = accounts[3];

    afterEach('revert', function() { return ganache.revert(); });

    const contracts = await deployUniswap(accounts);

    weth = contracts.weth;
    uniswapFactory = contracts.uniswapFactory;
    uniswapRouter = contracts.uniswapRouter;

    const InfinityProtocol = await ethers.getContractFactory('InfinityProtocol');
    infinity = await InfinityProtocol.deploy(uniswapRouter.address);
    await infinity.deployed();

    const FeeDistributor = await ethers.getContractFactory('FeeDistributor');
    feeDistributor = await FeeDistributor.deploy();
    await feeDistributor.deployed();  

    const AcceleratorVault = await ethers.getContractFactory('AcceleratorVaultSpace');
    acceleratorVault = await AcceleratorVault.deploy();
    await acceleratorVault.deployed();

    await uniswapFactory.createPair(weth.address, infinity.address);
    pairAddress = await uniswapFactory.getPair(weth.address, infinity.address);
    uniswapPair = await ethers.getContractAt(UniswapV2Pair.abi, pairAddress);

    await feeDistributor.seed(
      infinity.address, 
      acceleratorVault.address, 
      ethHodler.address,
      acceleratorVaultShare,
      burnPercentage
    );

    await acceleratorVault.seed(
      stakeDuration,
      infinity.address,
      pairAddress,
      uniswapRouter.address,
      feeDistributor.address,
      ethHodler.address,
      donationShare,
      purchaseFee
    );

    await infinity.approve(uniswapRouter.address, acceleratorityInfinityAmount);
    await expect(uniswapRouter.addLiquidityETH(
      infinity.address,
      acceleratorityInfinityAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: acceleratorityETHAmount }
    )).to.emit(uniswapPair, 'Mint');

    await ganache.snapshot();
  });

  it('should revert seed() if caller is not the owner', async function() {
    await expect(acceleratorVault.connect(user).seed(
      stakeDuration,
      infinity.address,
      pairAddress,
      uniswapRouter.address,
      feeDistributor.address,
      ethHodler.address,
      donationShare,
      purchaseFee
    )).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should revert setParameters() if caller is not the owner', async function() {
    await expect(acceleratorVault.connect(user).setParameters(
      stakeDuration,
      donationShare,
      purchaseFee
    )).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should revert setEthHodlerAddress() if caller is not the owner', async function() {
    await expect(acceleratorVault.connect(user).setEthHodlerAddress(ethHodler.address))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should revert enableLPForceUnlock() if caller is not the owner', async function() {
    await expect(acceleratorVault.connect(user).enableLPForceUnlock())
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should check accelerator vault\'s parameters', async function() {
    const config = await acceleratorVault.config();

    assert.strictEqual(config.infinityToken, infinity.address);
    assert.strictEqual(config.tokenPair, pairAddress);
    assert.strictEqual(config.uniswapRouter, uniswapRouter.address);
    assert.strictEqual(config.ethHodler, ethHodler.address);
    assert.strictEqual(config.weth, weth.address);
    assertBNequal(config.stakeDuration, 86400);
    assertBNequal(config.donationShare, donationShare);
    assertBNequal(config.purchaseFee, purchaseFee);
  });

  it('should set new parameters', async function() {
    const newStakeDuration = 8;
    const newDonationShare = 20;
    const newPurchaseFee = 20;
    
    await acceleratorVault.setParameters(newStakeDuration, newDonationShare, newPurchaseFee);
    const { stakeDuration, donationShare, purchaseFee } = await acceleratorVault.config();

    assertBNequal(stakeDuration, 691200);
    assertBNequal(donationShare, newDonationShare);
    assertBNequal(purchaseFee, newPurchaseFee);
  });

  it('should do a forced unlock and set lock period to 0', async function() {
    await acceleratorVault.enableLPForceUnlock();
    const stakeDuration = await acceleratorVault.getStakeDuration();

    assert.isTrue(await acceleratorVault.forceUnlock());
    assertBNequal(stakeDuration, 0);
  });

  it('should set a new fee receiver address', async function() {
    await acceleratorVault.setEthHodlerAddress(user.address);
    const { ethHodler } = await acceleratorVault.config();

    assert.equal(ethHodler, user.address);
  });

  it('should revert purchaseLP() if there are 0 INFINITY on the balance', async function() {
    const purchaseValue = utils.parseEther('1');
    await expect(acceleratorVault.purchaseLP({ value: purchaseValue }))
      .to.be.revertedWith('AcceleratorVaultSpace: insufficient INFINITY tokens in AcceleratorVaultSpace');
  });

  it('should revert purchaseLP() if 0 ETH is passed', async function() {
    await expect(acceleratorVault.purchaseLP())
      .to.be.revertedWith('AcceleratorVaultSpace: ETH required to mint INFINITY LP');
  });

});