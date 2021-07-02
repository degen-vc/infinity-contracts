const {DeployFunction} = require('hardhat-deploy')

task("deploy_liquidVault", "Deploys LiquidVault, 1st Vault of Infinity Protocol")
    //   .addParam()
    .setAction(async () => {
    const {deployments, getNamedAccounts} = hre; 
    const {deploy} = deployments;

    const {deployer, tokenOwner} = await getNamedAccounts(); 
    const liquidVaultContract = await deploy('LiquidVault', { from: deployer, args: [], log: true, })
    
    console.log("LiquidVault deployed to:", liquidVaultContract.address);
    
    return liquidVaultContract;
});

  module.exports = {task};