const UniswapV2Pair = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const Ganache = require('./helpers/ganache');
const deployUniswap = require('./helpers/deployUniswap');
const { expect, assert, util } = require('chai');
const { BigNumber, utils } = require('ethers');

describe('HodlerVaultSpace', function () {
  const bn = (input) => BigNumber.from(input);
  const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());

  const ganache = new Ganache();
  const baseUnit = 8;

  const liquidityInfinityAmount = utils.parseUnits('10000', baseUnit);
  const liquidityETHAmount = utils.parseEther('10');
  
  const stakeDuration = 1;
  const donationShare = 0;
  const purchaseFee = 30;

  let accounts;
  let owner;
  let user;
  let acceleratorVaultFake;

  let weth;
  let infinity;
  let hodlerVault;
  let uniswapFactory;
  let uniswapRouter;
  let uniswapPair;
  let pairAddress;

  beforeEach('setup others', async function() {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];
    acceleratorVaultFake = accounts[2];
    userTwo = accounts[3];

    afterEach('revert', function() { return ganache.revert(); });

    const contracts = await deployUniswap(accounts);

    weth = contracts.weth;
    uniswapFactory = contracts.uniswapFactory;
    uniswapRouter = contracts.uniswapRouter;

    const InfinityProtocol = await ethers.getContractFactory('InfinityProtocol');
    infinity = await InfinityProtocol.deploy(uniswapRouter.address);
    await infinity.deployed();

    const HodlerVault = await ethers.getContractFactory('HodlerVaultSpace');
    hodlerVault = await HodlerVault.deploy();
    await hodlerVault.deployed();

    await uniswapFactory.createPair(weth.address, infinity.address);
    pairAddress = await uniswapFactory.getPair(weth.address, infinity.address);
    uniswapPair = await ethers.getContractAt(UniswapV2Pair.abi, pairAddress);

    await hodlerVault.seed(
      stakeDuration,
      infinity.address,
      pairAddress,
      uniswapRouter.address,
      acceleratorVaultFake.address,
      purchaseFee
    );

    await infinity.approve(uniswapRouter.address, liquidityInfinityAmount);
    await expect(uniswapRouter.addLiquidityETH(
      infinity.address,
      liquidityInfinityAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityETHAmount }
    )).to.emit(uniswapPair, 'Mint');

    await ganache.snapshot();
  });

  it('should revert seed() if caller is not the owner', async function() {
    await expect(hodlerVault.connect(user).seed(
      stakeDuration,
      infinity.address,
      pairAddress,
      uniswapRouter.address,
      acceleratorVaultFake.address,
      purchaseFee
    )).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should revert setParameters() if caller is not the owner', async function() {
    await expect(hodlerVault.connect(user).setParameters(
      stakeDuration,
      donationShare,
      purchaseFee
    )).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should revert setFeeReceiver() if caller is not the owner', async function() {
    await expect(hodlerVault.connect(user).setFeeReceiver(acceleratorVaultFake.address))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should revert enableLPForceUnlock() if caller is not the owner', async function() {
    await expect(hodlerVault.connect(user).enableLPForceUnlock())
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should check accelerator vault\'s parameters', async function() {
    const config = await hodlerVault.config();

    assert.strictEqual(config.infinityToken, infinity.address);
    assert.strictEqual(config.tokenPair, pairAddress);
    assert.strictEqual(config.uniswapRouter, uniswapRouter.address);
    assert.strictEqual(config.feeReceiver, acceleratorVaultFake.address);
    assert.strictEqual(config.weth, weth.address);
    assertBNequal(config.stakeDuration, 86400);
    assertBNequal(config.donationShare, donationShare);
    assertBNequal(config.purchaseFee, purchaseFee);
  });

  it('should revert purchaseLP() if there are 0 ETH on the balance', async function() {
    const purchaseValue = utils.parseUnits('100', baseUnit);
    await infinity.approve(hodlerVault.address, ethers.constants.MaxUint256);
    await expect(hodlerVault.purchaseLP(purchaseValue))
      .to.be.revertedWith('HodlerVaultSpace: insufficient ETH on HodlerVaultSpace');
  });

  it('should revert purchaseLP() if 0 INFINITY is passed', async function() {
    await expect(hodlerVault.purchaseLP(0))
      .to.be.revertedWith('HodlerVaultSpace: INFINITY required to mint LP');
  });

  it('should revert purchaseLP() if there is not enough approval', async function() {
    const purchaseValue = utils.parseUnits('100', baseUnit);
    await expect(hodlerVault.purchaseLP(purchaseValue))
      .to.be.revertedWith('HodlerVaultSpace: Not enough INFINITY tokens allowance');
  });

  it('should purchase LP tokens with 0% fees', async function() {
    const transferToHodlerVault = utils.parseEther('10');
    const purchaseValue = utils.parseUnits('5000', baseUnit);

    await owner.sendTransaction({ to: hodlerVault.address, value: transferToHodlerVault });
    assertBNequal(await ethers.provider.getBalance(hodlerVault.address), transferToHodlerVault);


    const feeReceiverBalanceBefore = await infinity.balanceOf(acceleratorVaultFake.address);
    await infinity.approve(hodlerVault.address, ethers.constants.MaxUint256);
    const purchaseLP = await hodlerVault.purchaseLP(purchaseValue);
    const receipt = await purchaseLP.wait();

    const lockedLpLength = await hodlerVault.lockedLPLength(owner.address);
    assertBNequal(lockedLpLength, 1);

    const lockedLP = await hodlerVault.getLockedLP(owner.address, 0);
    const amount = receipt.events[9].args[1];
    const timestamp = receipt.events[9].args[4];
    assert.equal(lockedLP[0], owner.address);
    assertBNequal(lockedLP[1], amount);
    assertBNequal(lockedLP[2], timestamp);

    const { feeReceiver: expectedFeeReceiver } = await hodlerVault.config();
    const { percentageAmount } = receipt.events[10].args;
    const estimatedReceiverAmount = (purchaseValue * purchaseFee) / 100;
    const feeReceiverBalanceAfter = await infinity.balanceOf(acceleratorVaultFake.address);

    assert.equal(expectedFeeReceiver, acceleratorVaultFake.address);
    assertBNequal(feeReceiverBalanceAfter.sub(feeReceiverBalanceBefore), estimatedReceiverAmount);
    assertBNequal(estimatedReceiverAmount, percentageAmount);
  });

  it('should revert claimLP() if there is no locked LP', async () => {
    await expect(hodlerVault.claimLP())
      .to.be.revertedWith('HodlerVaultSpace: nothing to claim.');
  });

  it('should revert claimLP() if the lock period is not over', async function() {
    const transferToHodlerVault = utils.parseEther('10');
    const purchaseValue = utils.parseUnits('5000', baseUnit);

    await owner.sendTransaction({ to: hodlerVault.address, value: transferToHodlerVault });
    assertBNequal(await ethers.provider.getBalance(hodlerVault.address), transferToHodlerVault);


    await infinity.approve(hodlerVault.address, ethers.constants.MaxUint256);
    const purchaseLP = await hodlerVault.purchaseLP(purchaseValue);
    await expect(hodlerVault.claimLP())
      .to.be.revertedWith('HodlerVaultSpace: LP still locked.');
  });
});