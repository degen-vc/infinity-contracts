const UniswapV2Pair = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const Ganache = require('./helpers/ganache');
const deployUniswap = require('./helpers/deployUniswap');
const assert = require('assert');
const { expect } = require('chai');
const { BigNumber, utils } = require('ethers');

describe('InfinityProtocol Uniswap', function() {
  const bn = (input) => BigNumber.from(input);
  const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());

  const ganache = new Ganache();
  const totalSupply = utils.parseUnits('100000000', 8);
  const HUNDRED_PERCENT = bn('10000');

  let accounts;
  let infinity;
  let owner;
  let user;
  let feeReceiver;
  let userTwo;

  let weth;
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

    await uniswapFactory.createPair(weth.address, infinity.address);
    pairAddress = await uniswapFactory.getPair(weth.address, infinity.address);
    uniswapPair = await ethers.getContractAt(UniswapV2Pair.abi, pairAddress);

    await ganache.snapshot();
  });

  it('should be able to check a Uniswap pair ETH/INFINITY', async function() {
    assert.strictEqual(await uniswapPair.token0(), weth.address);
    assert.strictEqual(await uniswapPair.token1(), infinity.address);
    assertBNequal(await uniswapPair.totalSupply(), 0);
  });

  it('should be able to top up ETH/INFINITY pair with the liquidity with 0% fees', async function() {
    const liquidityInfinityAmount = utils.parseUnits('10000', 8);
    const liquidityETHAmount = utils.parseEther('10');

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uniswapPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await infinity.totalSupply(), totalSupply);
    assertBNequal(await uniswapPair.balanceOf(owner.address), 0);
    assertBNequal(await infinity.getBurnFee(), 0);
    assertBNequal(await infinity.getFee(), 0);

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

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uniswapPair.getReserves();
    
    assertBNequal(reserve0After, liquidityInfinityAmount);
    assertBNequal(reserve1After, liquidityETHAmount);
  });

  it('should be able to do swap ETH for INFINITY with 0% fees', async function() {
    const liquidityInfinityAmount = utils.parseUnits('10000', 8);
    const liquidityETHAmount = utils.parseEther('10');

    assertBNequal(await infinity.getBurnFee(), 0);
    assertBNequal(await infinity.getFee(), 0);

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

    assertBNequal(await infinity.balanceOf(user.address), 0);

    await expect(uniswapRouter.connect(user).swapExactETHForTokens(
      0,
      [weth.address, infinity.address],
      user.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.emit(uniswapPair, 'Swap');

    assertBNequal(await infinity.balanceOf(user.address), '90661089388');
  });
});