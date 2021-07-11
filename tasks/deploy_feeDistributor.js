const {DeployFunction} = require('hardhat-deploy')

task("deploy_feeDistributor", "Deploys FeeDistributor, In charge of Fee Distributions")
    //   .addParam()
    .setAction(async () => {
    const {deployments, getNamedAccounts} = hre; 
    const {deploy} = deployments;

    const {deployer, tokenOwner} = await getNamedAccounts(); 
    const feeDistributorContract = await deploy('FeeDistributor', { from: deployer, args: [], log: true, })
    
    console.log("FeeDistributor deployed to:", feeDistributorContract.address);
    
    return feeDistributorContract;
});

module.exports = {task};