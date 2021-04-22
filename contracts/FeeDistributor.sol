// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IInfinityProtocol.sol";

contract FeeDistributor is Ownable {

    IInfinityProtocol public infinity;
    address public liquidVault;
    bool public initialized;

    modifier seeded {
        require(
            initialized,
            "FeeDistributor: Fees cannot be distributed until Distributor seeded."
        );
        _;
    }

    function seed(
        address _infinity,
        address _vault
    ) external onlyOwner {
        infinity = IInfinityProtocol(_infinity);
        liquidVault = _vault;
        initialized = true;
    }

    function burn(uint amount) external seeded onlyOwner {
        infinity.burn(amount);
    }

    function distributeFees() external seeded onlyOwner {
        uint balance = infinity.balanceOf(address(this));
        infinity.transfer(liquidVault, balance);
    }
}