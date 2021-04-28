# Infinity Protocol
Infinity token is a dynamic fee on transfer (FOT) deflationary token with 100 million total supply. In-depth information on Infinity Protocol is available at [Medium](https://medium.com/infinitywin/infinity-protocol-ec2e3b84e988) and [infinityprotocol.io](https://infinityprotocol.io/)

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

## Verify Contracts
```
npx hardhat verify --network bscTestnet address "address" "address" "address"
```
