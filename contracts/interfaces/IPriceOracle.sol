pragma solidity 0.7.4;


interface IPriceOracle {
    function update() external returns(uint);
}