// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IInfinityProtocol.sol";

contract FeeDistributor is Ownable {
    using SafeMath for uint;

    struct FeeRecipient {
        address liquidVault;
        address secondaryAddress;
        uint256 liquidVaultShare; //percentage between 0 and 100
        uint256 burnPercentage;
    }
    
    IInfinityProtocol public infinity;
    FeeRecipient public recipients;

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
        address _vault,
        address _secondaryAddress,
        uint _liquidVaultShare,
        uint _burnPercentage
    ) external onlyOwner {
        require(
            _liquidVaultShare.add(_burnPercentage) <= 100,
            "FeeDistributor: liquidVault + burnPercentage incorrect sets"
        );
        infinity = IInfinityProtocol(_infinity);
        recipients.liquidVault = _vault;
        recipients.secondaryAddress = _secondaryAddress;
        recipients.liquidVaultShare = _liquidVaultShare;
        recipients.burnPercentage = _burnPercentage;
        initialized = true;
    }

    function distributeFees() public seeded {
        uint balance = infinity.balanceOf(address(this));

        if (balance < 100) {
            return;
        }

        uint liquidShare;
        uint burningShare;

        if (recipients.liquidVaultShare > 0) {
            liquidShare = recipients.liquidVaultShare.mul(balance).div(100);

            require(
                infinity.transfer(recipients.liquidVault, liquidShare),
                "FeeDistributor: transfer to LiquidVault failed"
            );
        }

        if (recipients.burnPercentage > 0) {
            burningShare = recipients.burnPercentage.mul(balance).div(100);
            infinity.burn(burningShare);
        }

        require(
            infinity.transfer(recipients.secondaryAddress, balance.sub(liquidShare).sub(burningShare)),
            "FeeDistributor: transfer to the secondary address failed"
        );
    }
}