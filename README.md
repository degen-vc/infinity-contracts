# Infinity Protocol
## Infinity Token
Infinity token is a dynamic fee on transfer (FOT) deflationary token with 100 million total supply.
The FOT changes throughout cycles. We call each change a “jump”.
The starting dynamic FOT at the beginning of each cycle is 5%.
It autonomously increases (jumps) by 0.5% each time 1 million tokens have been transferred (transfers occur during trading of course).
When 14 million tokens have been transferred the FOT reaches its maximum of 12%.
50% of the FOT tokens are burnt and 50% of the FOT tokens are sent to a Liquid Vault. (Each cycle 637,500 tokens are burnt and 637,500 are sent to a Liquid Vault).
When the quantum of Fee On Transfer tokens transferred reaches 1.275 million tokens a positive rebase expands the supply by 500,000.
Note that Liquid Vaults also include the capacity to burn tokens and therefore further increase the degree to which $INFINITY is deflationary. 

## Liquid Vault
A Liquid Vault is a smart contract that holds a project’s tokens but to which anyone can send ETH and receive back LP tokens.
This smart contract — “Liquid Vault”- could also:
- Lock the UNI-V2 LP tokens for a period before the buyer could claim them;
- Charge an “ETH fee” thus reducing the 50% discount. This ETH could then be used for other purposes;
- Permanently lock some LP tokens by sending them to the zero address while still giving the buyer LP at a discount.

## Power Vault
A Power Vault is the similar contract as a Liquid Vault hovewer with additional functianality - Buy Pressure. Because of this option, the ETH balance of Power Vault can be swapped for Infinity tokens on Uniswap at any time.

In-depth information on Infinity Protocol is available at [Medium](https://medium.com/infinitywin/infinity-protocol-ec2e3b84e988) and [infinityprotocol.io](https://infinityprotocol.io/)

# Local development
## Prerequisites 
- [node v10.16.0](https://www.npmjs.com/package/node/v/10.16.0) or higher
- [hardhat v2.1.2](https://www.npmjs.com/package/hardhat/v/2.1.2)
- [solidity v0.7.4](https://github.com/ethereum/solidity/releases/tag/v0.7.4)

## Setup and tests
- Install the dependencies
```
npm i
```
- Run the tests
```
npm run test
```
- Compile the contracts
```
npm run compile
```

# Hardhat Tasks
- Deploy InfinityProtocol
```
npx hardhat deploy_infinityProtocol --router [router_address] --network [network_name]
```
- Deploy LiquidVault
```
npx hardhat deploy_liquidVault --network [network_name]
```
- Deploy FeeDistributor
```
npx hardhat deploy_liquidVault --network [network_name]
```

