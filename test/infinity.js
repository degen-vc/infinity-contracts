const Ganache = require('./helpers/ganache');
const assert = require('assert');
const { BigNumber } = require('ethers');

  describe('InfinityProtocol', function() {

    const router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const ganache = new Ganache();

    let accounts;
    let infinity;
    let owner;

    const bn = (input) => BigNumber.from(input);
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());

    before('setup others', async function() {
      accounts = await ethers.getSigners();
      owner = accounts[0];
      afterEach('revert', function() { return ganache.revert(); });

      const InfinityProtocol = await ethers.getContractFactory('InfinityProtocol');
      infinity = await InfinityProtocol.deploy(router);
      await infinity.deployed();

      await ganache.snapshot();
    });

    it('should be possible to change ownership', async function() {
      assert.strictEqual(await infinity.owner(), owner.address);
      assert.strictEqual(await infinity.router(), router);

      const newOwner = accounts[1];
      await infinity.transferOwnership(newOwner.address);

      assert.strictEqual(await infinity.owner(), newOwner.address);
    });

    it('should be  possible to get old owner', async function() {
      assert.strictEqual(await infinity.owner(), owner.address);
    });

  });
