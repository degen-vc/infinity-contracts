const Ganache = require('./helpers/ganache');
const assert = require('assert');
const { BigNumber, utils } = require('ethers');
const { expect } = require('chai');

  describe('InfinityProtocol', function() {
    const bn = (input) => BigNumber.from(input);
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());

    const router = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const ganache = new Ganache();
    const baseUnit = 8;
    const totalSupply = utils.parseUnits('100000000', baseUnit);
    const HUNDRED_PERCENT = bn('10000');

    let accounts;
    let infinity;
    let owner;
    let user;
    let feeReceiver;
    let userTwo;

    beforeEach('setup others', async function() {
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
      const amount = utils.parseUnits('100', baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);

      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount);
      assertBNequal(await infinity.totalSupply(), totalSupply);
    });


    it('should be possible to transfer tokens, fees set to 5%, 2.5% - to burn and 2.5% fot, trade cycle updated', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      const amount = utils.parseUnits('100', baseUnit);
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
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = utils.parseUnits('1000000', baseUnit);
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
      amount = utils.parseUnits('1', baseUnit);
      await infinity.connect(user).transfer(userTwo.address, amount);

      const increasedPartFee = bn(275);
      assertBNequal(await infinity.getBurnFee(), increasedPartFee);
      assertBNequal(await infinity.getFee(), increasedPartFee);
    });

    it('should be possible reach 15 trade cycles, fees auto set to 12%, 6% - to burn and 6% fot, check total supply after rebase', async function() {
      const feeStart = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = utils.parseUnits('1000001', baseUnit);
      let fee = 250;

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);


      assertBNequal(await infinity.getCycle(), 0);
      amount = utils.parseUnits('416656', baseUnit);
      await infinity.transfer(user.address, amount);
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);


      const supplyBeforeRebase = await infinity.totalSupply();
      amount = utils.parseUnits('100000', baseUnit);
      await infinity.transfer(user.address, amount);

      const supplyAfterRebase = await infinity.totalSupply();

      const rebaseAmount = utils.parseUnits('500000', baseUnit);
      const totalSupplyExpected = supplyBeforeRebase.add(rebaseAmount).sub(amount.mul(fee).div(HUNDRED_PERCENT))
      assertBNequal(supplyAfterRebase, totalSupplyExpected);

      const balanceOwner = await infinity.balanceOf(owner.address);
      const balanceUser = await infinity.balanceOf(user.address);
      const balanceFeeReceiver = await infinity.balanceOf(feeReceiver.address);
      assertBNequal(balanceOwner.add(balanceUser).add(balanceFeeReceiver), totalSupplyExpected.sub(2));

      fee = 250;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);
      assertBNequal(await infinity.getCycle(), 1);
    });

    it('should be possible to make an admin burn for feeReceiver without trade cycles', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = utils.parseUnits('50000', baseUnit);
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


      const feeReceiverBalance = amount.mul(partFee).div(HUNDRED_PERCENT);

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), feeReceiverBalance);

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));

      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await expect(infinity.connect(feeReceiver).burn(feeReceiverBalance)).to.emit(infinity, 'Transfer');

      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);
      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)).sub(feeReceiverBalance));
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT).add(feeReceiverBalance));
    });

    it('should NOT be possible to make an admin burn for NOT feeReceiver without trade cycles.', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = utils.parseUnits('50000', baseUnit);
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

      const feeReceiverBalance = amount.mul(partFee).div(HUNDRED_PERCENT);

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), feeReceiverBalance);

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));

      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await expect(infinity.connect(user).burn(feeReceiverBalance)).to.revertedWith('Only feeReceiver');
    });

    it('should NOT be possible to make an admin burn for feeReceiver does not have amount tokens.', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = utils.parseUnits('50000', baseUnit);
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

      const feeReceiverBalance = amount.mul(partFee).div(HUNDRED_PERCENT);

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), feeReceiverBalance);

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));

      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await expect(infinity.connect(feeReceiver).burn(feeReceiverBalance.add(1))).to.revertedWith('Cannot burn more than on balance');
    });

    it('transfer to same user should not multiply user balance / total supply', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      const amount = utils.parseUnits('100', baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.transfer(owner.address, amount);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), amount.mul(fee).div(HUNDRED_PERCENT));
      assertBNequal(await infinity.getTradedCycle(), amount);
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));
    });

    it('should be possible reach 15 trade cycles with needed checks and burn with rebase WITH admin burns, check latest total supply', async function() {
      const feeStart = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      let amount = utils.parseUnits('1000001', baseUnit);
      let fee = 250;

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      let supplyBeforeBurn = await infinity.totalSupply();
      let totalBurnBeforeBurn = await infinity.totalBurn();
      let totalFeesBeforeBurn = await infinity.totalFees();
      let totalBurnWithFeesBeforeBurn = await infinity.totalBurnWithFees();
      let feeReceiverBalance = await infinity.balanceOf(feeReceiver.address);
      let amountToBurn = utils.parseUnits('500', baseUnit);
      await infinity.connect(feeReceiver).burn(amountToBurn);

      assertBNequal(await infinity.balanceOf(feeReceiver.address), feeReceiverBalance.sub(amountToBurn));
      assertBNequal(await infinity.totalSupply(), supplyBeforeBurn.sub(amountToBurn));
      assertBNequal(await infinity.totalBurn(), totalBurnBeforeBurn.add(amountToBurn));
      assertBNequal(await infinity.totalBurnWithFees(), totalBurnWithFeesBeforeBurn.add(amountToBurn));
      assertBNequal(await infinity.totalFees(), totalFeesBeforeBurn);

      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      await infinity.transfer(user.address, amount);
      fee += 25;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);


      assertBNequal(await infinity.getCycle(), 0);
      amount = utils.parseUnits('416656', baseUnit);
      await infinity.transfer(user.address, amount);
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);

      supplyBeforeBurn = await infinity.totalSupply();
      totalBurnBeforeBurn = await infinity.totalBurn();
      totalFeesBeforeBurn = await infinity.totalFees();
      totalBurnWithFeesBeforeBurn = await infinity.totalBurnWithFees();
      feeReceiverBalance = await infinity.balanceOf(feeReceiver.address);
      amountToBurn = utils.parseUnits('10000', baseUnit);
      await infinity.connect(feeReceiver).burn(amountToBurn);

      assertBNequal(await infinity.balanceOf(feeReceiver.address), feeReceiverBalance.sub(amountToBurn));
      assertBNequal(await infinity.totalSupply(), supplyBeforeBurn.sub(amountToBurn));
      assertBNequal(await infinity.totalBurn(), totalBurnBeforeBurn.add(amountToBurn));
      assertBNequal(await infinity.totalBurnWithFees(), totalBurnWithFeesBeforeBurn.add(amountToBurn));
      assertBNequal(await infinity.totalFees(), totalFeesBeforeBurn);

      const supplyBeforeRebase = supplyBeforeBurn.sub(amountToBurn);
      amount = utils.parseUnits('100000', baseUnit);
      await infinity.transfer(user.address, amount);

      const supplyAfterRebase = await infinity.totalSupply();

      const rebaseAmount = utils.parseUnits('500000', baseUnit);
      const totalSupplyExpected = supplyBeforeRebase.add(rebaseAmount).sub(amount.mul(fee).div(HUNDRED_PERCENT))
      assertBNequal(supplyAfterRebase, totalSupplyExpected);

      const balanceOwner = await infinity.balanceOf(owner.address);
      const balanceUser = await infinity.balanceOf(user.address);
      const balanceFeeReceiver = await infinity.balanceOf(feeReceiver.address);
      assertBNequal(balanceOwner.add(balanceUser).add(balanceFeeReceiver), totalSupplyExpected.sub(2));


      fee = 250;
      assertBNequal(await infinity.getBurnFee(), fee);
      assertBNequal(await infinity.getFee(), fee);
      assertBNequal(await infinity.getCycle(), 1);
    });

    it('should be possible reach all 156 cycles, fee NOT set to 0, check latest total supply', async function() {
      const feeStart = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);

      for (let i = 0; i < 52; i++) {
        await infinity.connect(owner).transfer(
          user.address,
          await infinity.balanceOf(owner.address)
        );

        await infinity.connect(feeReceiver).transfer(
          owner.address,
          await infinity.balanceOf(feeReceiver.address)
        );

        await infinity.connect(user).transfer(
          owner.address,
          await infinity.balanceOf(user.address)
        );
      }

      assertBNequal(await infinity.getBurnFee(), 250);
      assertBNequal(await infinity.getFee(), 250);
      assertBNequal(await infinity.getCycle(), 156);

      const amount = utils.parseUnits('1000001', baseUnit);
      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.getBurnFee(), 250);
      assertBNequal(await infinity.getFee(), 250);
      assertBNequal(await infinity.getCycle(), 157);

      const ownerTokens = await infinity.balanceOf(owner.address);
      const userTokens = await infinity.balanceOf(user.address);
      const feeReceiverTokens = await infinity.balanceOf(feeReceiver.address);
      const usersTokens = ownerTokens.add(userTokens).add(feeReceiverTokens);
      assertBNequal(await infinity.totalSupply(), usersTokens.add(2));

    });

    it('should be possible to set initial fee only once', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await expect(infinity.setInitialFee()).to.revertedWith('Initial fee already set');

      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);
    });

    it('should be possible reach maxCycles (156), fee set to 0, check latest total supply', async function() {
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);

      for (let i = 0; i < 52; i++) {
        await infinity.connect(owner).transfer(
          user.address,
          await infinity.balanceOf(owner.address)
        );

        await infinity.connect(feeReceiver).transfer(
          owner.address,
          await infinity.balanceOf(feeReceiver.address)
        );

        await infinity.connect(user).transfer(
          owner.address,
          await infinity.balanceOf(user.address)
        );
      }

      assertBNequal(await infinity.getBurnFee(), 250);
      assertBNequal(await infinity.getFee(), 250);
      assertBNequal(await infinity.getCycle(), 156);

      await infinity.setMaxCycles(156);

      const amount = utils.parseUnits('1000001', baseUnit);
      await infinity.transfer(user.address, amount);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      assertBNequal(await infinity.getCycle(), 157);

      const ownerTokens = await infinity.balanceOf(owner.address);
      const userTokens = await infinity.balanceOf(user.address);
      const feeReceiverTokens = await infinity.balanceOf(feeReceiver.address);
      const usersTokens = ownerTokens.add(userTokens).add(feeReceiverTokens);
      assertBNequal(await infinity.totalSupply(), usersTokens.add(2));

    });

    it('should be possible to set max cycles', async function() {
      assertBNequal(await infinity.maxCycles(), 500);

      await infinity.setMaxCycles(300);

      assertBNequal(await infinity.maxCycles(), 300);

    });

    it('should NOT be possible to set max cycles for not owner', async function() {
      assertBNequal(await infinity.maxCycles(), 500);

      await expect(infinity.connect(user).setMaxCycles(300)).to.revertedWith('Ownable: caller is not the owner');

      assertBNequal(await infinity.maxCycles(), 500);

    });

    it('should NOT be possible to set max cycles if less than current cycle', async function() {
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);

      for (let i = 0; i < 52; i++) {
        await infinity.connect(owner).transfer(
          user.address,
          await infinity.balanceOf(owner.address)
        );

        await infinity.connect(feeReceiver).transfer(
          owner.address,
          await infinity.balanceOf(feeReceiver.address)
        );

        await infinity.connect(user).transfer(
          owner.address,
          await infinity.balanceOf(user.address)
        );
      }

      assertBNequal(await infinity.getCycle(), 156);
      assertBNequal(await infinity.maxCycles(), 500);

      await expect(infinity.setMaxCycles(155)).to.revertedWith('Can not set more than current cycle');

      assertBNequal(await infinity.maxCycles(), 500);

    });

    it('should be possible to transfer tokens via transferFrom, fees set to 5%, 2.5% - to burn and 2.5% fot, trade cycle updated', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      const amount = utils.parseUnits('100', baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.approve(userTwo.address, amount);
      await infinity.connect(userTwo).transferFrom(owner.address, user.address, amount);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), amount.mul(fee).div(HUNDRED_PERCENT));
      assertBNequal(await infinity.getTradedCycle(), amount);
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));
    });

    it('should NOT be possible to transfer tokens via transferFrom, if sender does not have enough allowance', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      const amount = utils.parseUnits('100', baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.approve(userTwo.address, amount.sub(1));

      await expect(infinity.connect(userTwo).transferFrom(owner.address, user.address, amount)).to.revertedWith('transfer amount exceeds allowance');

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.totalSupply(), totalSupply);
    });

    it('should NOT be possible to transfer tokens via transferFrom, if spent all alowance', async function() {
      const fee = bn(500);
      const partFee = bn(250);

      assertBNequal(await infinity.getBurnFee(), 0);
      assertBNequal(await infinity.getFee(), 0);
      await infinity.setInitialFee();
      assertBNequal(await infinity.getBurnFee(), partFee);
      assertBNequal(await infinity.getFee(), partFee);

      await infinity.setFeeReceiver(feeReceiver.address);
      const amount = utils.parseUnits('100', baseUnit);
      assertBNequal(await infinity.balanceOf(owner.address), totalSupply);
      assertBNequal(await infinity.balanceOf(user.address), 0);
      assertBNequal(await infinity.balanceOf(feeReceiver.address), 0);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), 0);
      assertBNequal(await infinity.getTradedCycle(), 0);
      assertBNequal(await infinity.totalBurn(), 0);

      await infinity.approve(userTwo.address, amount);
      await infinity.connect(userTwo).transferFrom(owner.address, user.address, amount);

      assertBNequal(await infinity.getCycle(), 0);
      assertBNequal(await infinity.getBurnCycle(), amount.mul(fee).div(HUNDRED_PERCENT));
      assertBNequal(await infinity.getTradedCycle(), amount);
      assertBNequal(await infinity.totalBurn(), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.balanceOf(owner.address), totalSupply.sub(amount));
      assertBNequal(await infinity.balanceOf(user.address), amount.sub(amount.mul(fee).div(HUNDRED_PERCENT)));
      assertBNequal(await infinity.balanceOf(feeReceiver.address), amount.mul(partFee).div(HUNDRED_PERCENT));

      assertBNequal(await infinity.totalSupply(), totalSupply.sub(amount.mul(partFee).div(HUNDRED_PERCENT)));

      await expect(infinity.connect(userTwo).transferFrom(owner.address, user.address, amount)).to.revertedWith('transfer amount exceeds allowance');
    });


  });
