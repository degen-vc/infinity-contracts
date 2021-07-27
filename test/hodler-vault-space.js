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
    await hodlerVault.purchaseLP(purchaseValue);
    await expect(hodlerVault.claimLP())
      .to.be.revertedWith('HodlerVaultSpace: LP still locked.');
  });

  it('should be able to claim 2 batches after 2 purchases and 1 3rd party purchase with 0% fees', async function() {
    const transferToHodlerVault = utils.parseEther('50');
    const purchaseValue = utils.parseUnits('5000', baseUnit);

    await owner.sendTransaction({ to: hodlerVault.address, value: transferToHodlerVault });
    assertBNequal(await ethers.provider.getBalance(hodlerVault.address), transferToHodlerVault);


    await infinity.approve(hodlerVault.address, ethers.constants.MaxUint256);

    await hodlerVault.purchaseLP(purchaseValue);
    await hodlerVault.purchaseLP(purchaseValue);

    await infinity.transfer(user.address, purchaseValue);
    await infinity.connect(user).approve(hodlerVault.address, ethers.constants.MaxUint256);
    await hodlerVault.connect(user).purchaseLP(purchaseValue);

    assertBNequal(await hodlerVault.lockedLPLength(owner.address), 2);
    assertBNequal(await hodlerVault.lockedLPLength(user.address), 1);

    const lockedLP1 = await hodlerVault.getLockedLP(owner.address, 0);
    const lockedLP2 = await hodlerVault.getLockedLP(owner.address, 1);
    const lockedLP3 = await hodlerVault.getLockedLP(user.address, 0);

    const stakeDuration = await hodlerVault.getStakeDuration();
    const lpBalanceBefore = await uniswapPair.balanceOf(owner.address);

    await ganache.setTime((bn(lockedLP3[2]).add(stakeDuration)).toNumber());
    const claimLP1 = await hodlerVault.claimLP();
    const receipt1 = await claimLP1.wait();
    const amount1 = receipt1.events[0].args[1];
    const exitFee1 = receipt1.events[0].args[3];
    const claimLP2 = await hodlerVault.claimLP();
    const receipt2 = await claimLP2.wait();
    const amount2 = receipt2.events[0].args[1];
    const exitFee2 = receipt2.events[0].args[3];
    const expectedLpAmount = amount1.sub(exitFee1).add(amount2.sub(exitFee2));
    const lpBalanceAfter = await uniswapPair.balanceOf(owner.address);

    assertBNequal(lpBalanceAfter.sub(lpBalanceBefore), expectedLpAmount);
    assertBNequal(amount1, lockedLP1[1]);
    assertBNequal(amount2, lockedLP2[1]);

    // an attempt to claim nonexistent batch
    await expect(hodlerVault.claimLP())
      .to.be.revertedWith('HodlerVaultSpace: nothing to claim.');

    const lpBalanceBefore3 = await uniswapPair.balanceOf(user.address);
    const claimLP3 = await hodlerVault.connect(user).claimLP();
    const receipt3 = await claimLP3.wait();
    const holder3 = receipt3.events[0].args[0];
    const amount3 = receipt3.events[0].args[1];
    const exitFee3 = receipt3.events[0].args[3];
    const expectedLpAmount3 = amount3.sub(exitFee3);
    const lpBalanceAfter3 = await uniswapPair.balanceOf(user.address);

    assert.equal(holder3, user.address);
    assertBNequal(amount3, lockedLP3[1]);
    assertBNequal(lpBalanceAfter3.sub(lpBalanceBefore3), expectedLpAmount3);
  });
});
