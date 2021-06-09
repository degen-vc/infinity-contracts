pragma solidity 0.7.4;


import "./IBEP20.sol";

interface IMarketsRegistry {
    function recoverTokens(IBEP20 token, address destination) external;
}
