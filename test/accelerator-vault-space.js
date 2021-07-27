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

  const liquidityInfinityAmount = utils.parseUnits('10000', baseUnit);
  const liquidityETHAmount = utils.parseEther('10');
  const stakeDuration = 1;
  const donationShare = 10;
  const purchaseFee = 30;
  const acceleratorVaultShare = 80;
  const burnPercentage = 10;

  let accounts;
  let owner;
  let user;
  let ethHodler;
  let feeReceiver;

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
    feeReceiver = accounts[4];

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
      feeReceiver.address,
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

    const PriceOracle = await ethers.getContractFactory('PriceOracle');
    uniswapOracle = await PriceOracle.deploy(pairAddress, infinity.address, weth.address);
    await uniswapOracle.deployed();

    await acceleratorVault.setOracleAddress(uniswapOracle.address);

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

  it('should purchase LP tokens with 0% fees and non-empty FeeDistributor', async function() {
    const purchaseValue = utils.parseEther('1');
    const transferToAcceleratorVault = utils.parseUnits('20000', baseUnit); // 20.000 tokens
    const transferToDistributor = utils.parseUnits('5000', baseUnit);

    await infinity.transfer(acceleratorVault.address, transferToAcceleratorVault);
    assertBNequal(await infinity.balanceOf(acceleratorVault.address), transferToAcceleratorVault);

    const feeReceiverInfinityBalance = await infinity.balanceOf(feeReceiver.address);
    assertBNequal(feeReceiverInfinityBalance, 0);

    await infinity.setFeeReceiver(feeDistributor.address);
    await infinity.transfer(feeDistributor.address, transferToDistributor);
    const distributorBalance = await infinity.balanceOf(feeDistributor.address);
    assertBNequal(distributorBalance, transferToDistributor);

    const ethHodlerBalanceBefore = await ethers.provider.getBalance(ethHodler.address);
    const purchaseLP = await acceleratorVault.purchaseLP({ value: purchaseValue });
    const receipt = await purchaseLP.wait();

    const lockedLpLength = await acceleratorVault.lockedLPLength(owner.address);
    assertBNequal(lockedLpLength, 1);

    const lockedLP = await acceleratorVault.getLockedLP(owner.address, 0);
    const { amount, timestamp } = receipt.events[9].args;
    assert.equal(lockedLP[0], owner.address);
    assertBNequal(lockedLP[1], amount);
    assertBNequal(lockedLP[2], timestamp);

    const { ethHodler: expectedEthHodler } = await acceleratorVault.config();
    const { percentageAmount } = receipt.events[10].args;
    const estimatedHodlerAmount = (purchaseValue * purchaseFee) / 100;
    const ethHodlerBalanceAfter = await ethers.provider.getBalance(ethHodler.address);

    assert.equal(expectedEthHodler, ethHodler.address);
    assertBNequal(ethHodlerBalanceAfter.sub(ethHodlerBalanceBefore), estimatedHodlerAmount);
    assertBNequal(estimatedHodlerAmount, percentageAmount);

    const expectedInfinityToReceiver = transferToDistributor.mul('10').div('100');
    const expectedInfinity = transferToDistributor.mul(acceleratorVaultShare + burnPercentage).div('100');
    const feeDistributorBalanceAfter = await infinity.balanceOf(feeDistributor.address);
    const feeReceiverInfinityBalanceAfter = await infinity.balanceOf(feeReceiver.address);
    assertBNequal(feeReceiverInfinityBalanceAfter, expectedInfinityToReceiver);
    assertBNequal(feeDistributorBalanceAfter, distributorBalance.sub(expectedInfinityToReceiver).sub(expectedInfinity));
  });

  it('should revert purchaseLP() if too much ETH provided', async function() {
    const purchaseValue = utils.parseEther('10');
    const transferToAcceleratorVault = utils.parseUnits('200', baseUnit); // 200 tokens

    await infinity.transfer(acceleratorVault.address, transferToAcceleratorVault);
    assertBNequal(await infinity.balanceOf(acceleratorVault.address), transferToAcceleratorVault);

    await expect(acceleratorVault.purchaseLP({ value: purchaseValue }))
      .to.be.revertedWith('AcceleratorVaultSpace: insufficient INFINITY tokens in AcceleratorVault');
  });

  it('should revert claimLP() if there is no locked LP', async () => {
    await expect(acceleratorVault.claimLP())
      .to.be.revertedWith('AcceleratorVaultSpace: nothing to claim.');
  });

  it('should revert claimLP() if the lock period is not over', async function() {
    const purchaseValue = utils.parseEther('1');
    const transferToAcceleratorVault = utils.parseUnits('20000', baseUnit); // 20.000 tokens

    await infinity.transfer(acceleratorVault.address, transferToAcceleratorVault);
    assertBNequal(await infinity.balanceOf(acceleratorVault.address), transferToAcceleratorVault);

    await acceleratorVault.purchaseLP({ value: purchaseValue });
    await expect(acceleratorVault.claimLP())
      .to.be.revertedWith('AcceleratorVaultSpace: LP still locked.');
  });

  it('should be able to claim 1 batch after 1 purchase with 0% fees', async function() {
    const purchaseValue = utils.parseEther('1');
    const transferToAcceleratorVault = utils.parseUnits('20000', baseUnit); // 20.000 tokens

    await infinity.transfer(acceleratorVault.address, transferToAcceleratorVault);
    assertBNequal(await infinity.balanceOf(acceleratorVault.address), transferToAcceleratorVault);

    await acceleratorVault.purchaseLP({ value: purchaseValue });
    const lockedLP = await acceleratorVault.getLockedLP(owner.address, 0);
    const { donationShare } = await acceleratorVault.config();
    const stakeDuration = await acceleratorVault.getStakeDuration();
    const lpBalanceBefore = await uniswapPair.balanceOf(owner.address);

    await ganache.setTime((bn(lockedLP[2]).add(stakeDuration)).toNumber());
    const claimLP = await acceleratorVault.claimLP();
    const receipt = await claimLP.wait();

    const { holder, amount, exitFee, claimed } = receipt.events[0].args;
    const estimatedFeeAmount = lockedLP[1].mul(donationShare).div(bn('100'));
    const lpBalanceAfter = await uniswapPair.balanceOf(owner.address);

    assert.strictEqual(holder, owner.address);
    assert.isTrue(claimed);
    assertBNequal(amount, lockedLP[1]);
    assertBNequal(exitFee, estimatedFeeAmount);
    assertBNequal(amount.sub(exitFee), lpBalanceAfter.sub(lpBalanceBefore));
  });

  it('should be able to claim 2 batches after 2 purchases and 1 3rd party purchase with 0% fees', async function() {
    const purchaseValue = utils.parseEther('1');
    const transferToAcceleratorVault = utils.parseUnits('20000', baseUnit); // 20.000 tokens

    await infinity.transfer(acceleratorVault.address, transferToAcceleratorVault);
    assertBNequal(await infinity.balanceOf(acceleratorVault.address), transferToAcceleratorVault);

    await acceleratorVault.purchaseLP({ value: purchaseValue });
    await acceleratorVault.purchaseLP({ value: purchaseValue });
    await acceleratorVault.connect(user).purchaseLP({ value: purchaseValue });

    assertBNequal(await acceleratorVault.lockedLPLength(owner.address), 2);
    assertBNequal(await acceleratorVault.lockedLPLength(user.address), 1);

    const lockedLP1 = await acceleratorVault.getLockedLP(owner.address, 0);
    const lockedLP2 = await acceleratorVault.getLockedLP(owner.address, 1);
    const lockedLP3 = await acceleratorVault.getLockedLP(user.address, 0);

    const stakeDuration = await acceleratorVault.getStakeDuration();
    const lpBalanceBefore = await uniswapPair.balanceOf(owner.address);

    await ganache.setTime((bn(lockedLP3[2]).add(stakeDuration)).toNumber());
    const claimLP1 = await acceleratorVault.claimLP();
    const receipt1 = await claimLP1.wait();
    const { amount: amount1, exitFee: exitFee1 } = receipt1.events[0].args;

    const claimLP2 = await acceleratorVault.claimLP();
    const receipt2 = await claimLP2.wait();
    const { amount: amount2, exitFee: exitFee2 } = receipt2.events[0].args;

    const expectedLpAmount = amount1.sub(exitFee1).add(amount2.sub(exitFee2));
    const lpBalanceAfter = await uniswapPair.balanceOf(owner.address);

    assertBNequal(lpBalanceAfter.sub(lpBalanceBefore), expectedLpAmount);
    assertBNequal(amount1, lockedLP1[1]);
    assertBNequal(amount2, lockedLP2[1]);

    // an attempt to claim nonexistent batch
    await expect(acceleratorVault.claimLP())
      .to.be.revertedWith('AcceleratorVaultSpace: nothing to claim.');

    const lpBalanceBefore3 = await uniswapPair.balanceOf(user.address);
    const claimLP3 = await acceleratorVault.connect(user).claimLP();
    const receipt3 = await claimLP3.wait();
    const { holder: holder3, amount: amount3, exitFee: exitFee3 } = receipt3.events[0].args;

    const expectedLpAmount3 = amount3.sub(exitFee3);
    const lpBalanceAfter3 = await uniswapPair.balanceOf(user.address);

    assert.equal(holder3, user.address);
    assertBNequal(amount3, lockedLP3[1]);
    assertBNequal(lpBalanceAfter3.sub(lpBalanceBefore3), expectedLpAmount3);
  });
});
