const Ganache = require('./helpers/ganache');
const assert = require('assert');
const { BigNumber, utils } = require('ethers');
const { expect } = require('chai');

  describe('FeeDistributor', function() {
    const bn = (input) => BigNumber.from(input);
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    const router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const ganache = new Ganache();
    const baseUnit = 8;
    const totalSupply = utils.parseUnits('100000000', baseUnit);
    const HUNDRED_PERCENT = bn('100');

    const liquidVaultShare = 60;
    const burnPercentage = 10;

    let accounts;
    let feeDistributor;
    let owner;
    let user;
    let feeReceiver;
    let userTwo;
    let infinity;
    let vaultFake;

    beforeEach('setup others', async function() {
      accounts = await ethers.getSigners();
      owner = accounts[0];
      user = accounts[1];
      feeReceiver = accounts[2];
      userTwo = accounts[3];
      vaultFake = accounts[4];

      afterEach('revert', function() { return ganache.revert(); });

      const FeeDistributor = await ethers.getContractFactory('FeeDistributor');
      feeDistributor = await FeeDistributor.deploy();

      const InfinityProtocol = await ethers.getContractFactory('InfinityProtocol');
      infinity = await InfinityProtocol.deploy(router);

      await ganache.snapshot();
    });

    it('should be possible to change ownership', async function() {
      assert.strictEqual(await feeDistributor.owner(), owner.address);

      const newOwner = accounts[1];
      await feeDistributor.transferOwnership(newOwner.address);

      assert.strictEqual(await feeDistributor.owner(), newOwner.address);
    });

    it('should be possible to seed', async function() {
      const recipientsBefore = await feeDistributor.recipients();

      assert.strictEqual(await feeDistributor.infinity(), zeroAddress);
      assert.strictEqual(await feeDistributor.initialized(), false);
      assert.strictEqual(recipientsBefore.liquidVault, zeroAddress);
      assert.strictEqual(recipientsBefore.secondaryAddress, zeroAddress);
      assertBNequal(recipientsBefore.liquidVaultShare, 0);
      assertBNequal(recipientsBefore.burnPercentage, 0);

      await feeDistributor.seed(
        infinity.address, 
        vaultFake.address, 
        feeReceiver.address,
        liquidVaultShare,
        burnPercentage
      );

      const recipientsAfter = await feeDistributor.recipients();

      assert.strictEqual(await feeDistributor.infinity(), infinity.address);
      assert.strictEqual(await feeDistributor.initialized(), true);
      assert.strictEqual(recipientsAfter.liquidVault, vaultFake.address);
      assert.strictEqual(recipientsAfter.secondaryAddress, feeReceiver.address);
      assertBNequal(recipientsAfter.liquidVaultShare, liquidVaultShare);
      assertBNequal(recipientsAfter.burnPercentage, burnPercentage);
    });

    it('should be possible to seed more than one time', async function() {
      const vaultNew = accounts[3];
      const userNew = accounts[5];
      const tokenNew = accounts[6];

      const liquidVaultShareNew = 70;
      const burnPercentageNew = 5;

      await feeDistributor.seed(
        infinity.address, 
        vaultFake.address, 
        feeReceiver.address,
        liquidVaultShare,
        burnPercentage
      );

      const recipientsBefore = await feeDistributor.recipients();

      assert.strictEqual(await feeDistributor.infinity(), infinity.address);
      assert.strictEqual(await feeDistributor.initialized(), true);
      assert.strictEqual(recipientsBefore.liquidVault, vaultFake.address);
      assert.strictEqual(recipientsBefore.secondaryAddress, feeReceiver.address);
      assertBNequal(recipientsBefore.liquidVaultShare, liquidVaultShare);
      assertBNequal(recipientsBefore.burnPercentage, burnPercentage);

      await feeDistributor.seed(
        tokenNew.address, 
        vaultNew.address, 
        userNew.address,
        liquidVaultShareNew,
        burnPercentageNew
      );

      const recipientsAfter = await feeDistributor.recipients();

      assert.strictEqual(await feeDistributor.infinity(), tokenNew.address);
      assert.strictEqual(await feeDistributor.initialized(), true);
      assert.strictEqual(recipientsAfter.liquidVault, vaultNew.address);
      assert.strictEqual(recipientsAfter.secondaryAddress, userNew.address);
      assertBNequal(recipientsAfter.liquidVaultShare, liquidVaultShareNew);
      assertBNequal(recipientsAfter.burnPercentage, burnPercentageNew);
    });

    it('should revert seed() if caller is not the owner', async function() {
      await expect(feeDistributor.connect(user).seed(
        infinity.address, 
        vaultFake.address, 
        user.address, 
        liquidVaultShare, 
        burnPercentage
      )).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should distribute fees according to seeded parameters', async function() {
      const distributeAmount = utils.parseUnits('10000', 8);
      await feeDistributor.seed(
        infinity.address, 
        vaultFake.address, 
        feeReceiver.address,
        liquidVaultShare,
        burnPercentage
      );

      await infinity.setFeeReceiver(feeDistributor.address);
      await infinity.transfer(feeDistributor.address, distributeAmount);
      assertBNequal(await infinity.balanceOf(feeDistributor.address), distributeAmount);

      await feeDistributor.distributeFees();
      const expectedVaultBalance = bn(liquidVaultShare).mul(distributeAmount).div(HUNDRED_PERCENT);
      const expectedBurnPercentage = bn(burnPercentage).mul(distributeAmount).div(HUNDRED_PERCENT);
      const expectedSecondaryAddress = bn(distributeAmount).sub(expectedBurnPercentage).sub(expectedVaultBalance);

      assertBNequal(await infinity.balanceOf(vaultFake.address), expectedVaultBalance);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), expectedSecondaryAddress);
    });
  });
