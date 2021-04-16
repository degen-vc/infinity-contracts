const Ganache = require('./helpers/ganache');
const assert = require('assert');
const { BigNumber } = require('ethers');

  describe('InfinityProtocol', function() {
    const bn = (input) => BigNumber.from(input);
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());

    const router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const ganache = new Ganache();
    const baseUnit = bn('100000000');
    const totalSupply = bn('100000000').mul(baseUnit);
    const HUNDRED_PERCENT = bn('10000');

    let accounts;
    let infinity;
    let owner;
    let user;
    let feeReceiver;
    let userTwo;

    before('setup others', async function() {
      accounts = await ethers.getSigners();
      owner = accounts[0];
      user = accounts[1];
      feeReceiver = accounts[2];
      userTwo = accounts[3];
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

    it('deployer should be receive all tokens after deploy', async function() {
      const balance = await infinity.balanceOf(owner.address);
      assertBNequal(balance, totalSupply);

      assertBNequal(await infinity.totalSupply(), totalSupply);
    });

    it('should be possible to transfer tokens, fees are not set', async function() {
      const amount = bn('100').mul(baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);

      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount);
      assertBNequal(await infinity.totalSupply(), totalSupply);
    });

    it('should be possible to transfer tokens, fees set to 4%, 2% - to burn and 2% fot', async function() {
      const fee = bn(400); // 4%
      const partFee = bn(200); // 2%

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setFee(fee);
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      const amount = bn('100').mul(baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), amount.mul(fee).div(HUNDRED_PERCENT));
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));
    });


    it('should be possible to transfer tokens, fees set to 5%, 2.5% - to burn and 2.5% fot, trade cycle updated', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setFee(fee);
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      const amount = bn('100').mul(baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), amount.mul(fee).div(HUNDRED_PERCENT));
      assertBNequal(await infinity.getTradedCycle(), amount);
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));
    });

    it('should be possible to transfer tokens, trade cycle reached, fees auto set to 5.5%, 2.75% - to burn and 2.75% fot', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setFee(fee);
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = bn('999999').mul(baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), amount.mul(fee).div(HUNDRED_PERCENT));
      assertBNequal(await infinity.getTradedCycle(), amount);
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));

      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      // cycle reached
      amount = bn('1').mul(baseUnit);
      await infinity.connect(user).transfer(userTwo.address, amount);

      const increasedPartFee = bn(275);
      assertBNequal(await infinity.getBurnFee(), increasedPartFee);
      assertBNequal(await infinity.getFee(), increasedPartFee);
    });


    it.only('should be possible reach 15 trade cycles, fees auto set to 12%, 6% - to burn and 6% fot, after additional 1.000.001 tokens traded fee is the same', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setFee(fee);
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = bn('999999').mul(baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), amount.mul(fee).div(HUNDRED_PERCENT));
      assertBNequal(await infinity.getTradedCycle(), amount);
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));

      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      // cycle reached
      amount = bn('1').mul(baseUnit);
      await infinity.connect(user).transfer(userTwo.address, amount);

      const increasedPartFee = bn(275);
      assertBNequal(await infinity.getBurnFee(), increasedPartFee);
      assertBNequal(await infinity.getFee(), increasedPartFee);
    });

    // set fee to 5 percent and make burns without trade cycles
    // set fee to 5 percent and make all trade cycles with needed checks and burn with rebase WITH admin burns, check latest total supply
    // test all 156 cycles




  });
