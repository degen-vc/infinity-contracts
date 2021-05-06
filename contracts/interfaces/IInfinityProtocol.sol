import "./IBEP20.sol";

interface IInfinityProtocol is IBEP20 {
    function burn(uint amount) external returns (bool);
}