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
    const HUNDRED_PERCENT = bn('10000');

    let accounts;
    let feeDistributor;
    let owner;
    let user;
    let feeReceiver;
    let userTwo;
    let infinity;

    beforeEach('setup others', async function() {
      accounts = await ethers.getSigners();
      owner = accounts[0];
      user = accounts[1];
      feeReceiver = accounts[2];
      userTwo = accounts[3];
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
      const vaultFake = accounts[2];

      assert.strictEqual(await feeDistributor.infinity(), zeroAddress);
      assert.strictEqual(await feeDistributor.liquidVault(), zeroAddress);
      assert.strictEqual(await feeDistributor.initialized(), false);

      await feeDistributor.seed(infinity.address, vaultFake.address);

      assert.strictEqual(await feeDistributor.infinity(), infinity.address);
      assert.strictEqual(await feeDistributor.liquidVault(), vaultFake.address);
      assert.strictEqual(await feeDistributor.initialized(), true);
    });

    it('should be possible to seed more than one time', async function() {
      const vaultFake = accounts[2];
      const vaultNew = accounts[3];
      const tokenNew = accounts[4];

      await feeDistributor.seed(infinity.address, vaultFake.address);

      assert.strictEqual(await feeDistributor.infinity(), infinity.address);
      assert.strictEqual(await feeDistributor.liquidVault(), vaultFake.address);
      assert.strictEqual(await feeDistributor.initialized(), true);

      await feeDistributor.seed(tokenNew.address, vaultNew.address);

      assert.strictEqual(await feeDistributor.infinity(), tokenNew.address);
      assert.strictEqual(await feeDistributor.liquidVault(), vaultNew.address);
      assert.strictEqual(await feeDistributor.initialized(), true);
    });

    // should NOT be possible to seed for not owner

    // should be possible to burn infinity tokens from fee distributor
    // should NOT be possible to burn infinity tokens from fee distributor for not owner call

    // should be possible to distribute fees to liquid vault for owner
    // should NOT be possible to distribute fees for NOT owner


  });
