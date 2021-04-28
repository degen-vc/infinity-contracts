// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/lib/contracts/libraries/FixedPoint.sol';
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol';
import "./IBEP20.sol";


contract PriceOracle {
    using FixedPoint for *;
    IUniswapV2Pair public immutable pair;
    uint public multiplier;
    uint private priceLast;
    uint public priceCumulativeLast;
    uint32 public blockTimestampLast;

    address public tokenA;
    address public tokenB;
    address public token0;

    constructor(IUniswapV2Pair _pair, address _tokenA, address _tokenB) public {
        pair = _pair;
        tokenA = _tokenA;
        tokenB = _tokenB;
        (token0, ) = _tokenA < _tokenB
            ? (_tokenA, _tokenB)
            : (_tokenB, _tokenA);

        if(token0 == _tokenA) {
          priceCumulativeLast = _pair.price0CumulativeLast();
          multiplier = uint(10)**(IBEP20(_pair.token0()).decimals());
        } else {
          priceCumulativeLast = _pair.price1CumulativeLast();
          multiplier = uint(10)**(IBEP20(_pair.token1()).decimals());
        }
    }
    function update() public returns(uint) {
        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = pair.getReserves();
        require(reserve0 != 0 && reserve1 != 0, 'PriceOracle: NO_RESERVES');

        uint _priceCumulative;
        (uint _price0Cumulative, uint _price1Cumulative, uint32 _blockTimestamp) =
            UniswapV2OracleLibrary.currentCumulativePrices(address(pair));
        if(token0 == tokenA) {
          _priceCumulative = _price0Cumulative;
        } else {
          _priceCumulative = _price1Cumulative;
        }
        uint _priceCumulativeLast = priceCumulativeLast;
        uint _blockTimestampLast = blockTimestampLast;
        uint _price;
        if (_blockTimestamp != _blockTimestampLast) {
            _price = FixedPoint.uq112x112(uint224((_priceCumulative - _priceCumulativeLast) /
                (_blockTimestamp - _blockTimestampLast))).mul(multiplier).decode144();
            priceLast = _price;
            priceCumulativeLast = _priceCumulative;
            blockTimestampLast = _blockTimestamp;
        } else {
            _price = priceLast;
        }
        return _price;
    }
    // note this will always return 0 before update has been called successfully for the first time.
    function consult() external view returns (uint) {
        uint _priceCumulative;

        (uint _price0Cumulative, uint _price1Cumulative, uint32 _blockTimestamp) =
            UniswapV2OracleLibrary.currentCumulativePrices(address(pair));

        if(token0 == tokenA) {
          _priceCumulative = _price0Cumulative;
        } else {
          _priceCumulative = _price1Cumulative;
        }
        uint _priceCumulativeLast = priceCumulativeLast;
        uint _blockTimestampLast = blockTimestampLast;
        // most recent price is already calculated.
        if (_blockTimestamp == _blockTimestampLast) {
            return priceLast;
        }
        return FixedPoint.uq112x112(uint224((_priceCumulative - _priceCumulativeLast) / 
            (_blockTimestamp - _blockTimestampLast))).mul(multiplier).decode144();
    }
    function updateAndConsult() external returns (uint) {
        return update();
    }
}