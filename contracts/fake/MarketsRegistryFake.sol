// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
import "../interfaces/IMarketsRegistry.sol";
import "../interfaces/IBEP20.sol";
import "./SafeBEP20.sol";

contract MarketsRegistryFake is IMarketsRegistry {
    using SafeBEP20 for IBEP20;
    address public secondary;

    /**
     * Allow owner to move tokens from the registry
     */
    function recoverTokens(IBEP20 token, address destination)
        override
        public
    {

        // Get the balance
        uint256 balance = token.balanceOf(address(this));

        if (secondary == address(0)) {
            token.safeTransfer(destination, balance);
        } else {
            token.safeTransfer(destination, balance * 80 / 100);
            token.safeTransfer(secondary, balance * 20 / 100);
        }

    }

    function enableSecondaryReceiver(address _secondary) public {
        secondary = _secondary;
    }
}