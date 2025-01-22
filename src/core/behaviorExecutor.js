import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

const nonceMap = new Map();

async function getNonceForAccount(account) {
    if (!nonceMap.has(account.address)) {
        nonceMap.set(account.address, await account.getNonce());
    }
    const currentNonce = nonceMap.get(account.address);
    nonceMap.set(account.address, currentNonce + 1);
    return currentNonce;
}

async function transferNativeToken(sender, receiver, amount) {
    let nonce;  
    try {
        nonce = await getNonceForAccount(sender);
        const tx = {
            to: receiver.address,
            value: ethers.parseEther(amount.toString()),
            nonce: nonce,
            gasLimit: 21000,
            maxFeePerGas: ethers.parseUnits('2', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
        };
        return await sender.sendTransaction(tx);
    } catch (error) {
        logger.error('Native token transfer failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
                nonce: nonce || 'undefined',
                amount: amount
            }
        });
        throw error;
    }
}

async function transferERC20Token(sender, receiver, tokenContract, amount) {
    let nonce;  
    try {
        nonce = await getNonceForAccount(sender);
        const balance = await tokenContract.balanceOf(sender.address);
        if(balance < amount) {
            const faucetTx = await tokenContract.connect(sender).faucet(sender.address, {
                nonce: nonce
            });
            await faucetTx.wait(1);
            nonce = await getNonceForAccount(sender); 
        }
        
        const tx = await tokenContract.connect(sender).transfer(receiver.address, amount, {
            nonce: nonce
        });
        return tx;
    } catch (error) {
        logger.error('ERC20 token transfer failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
                nonce: nonce || 'undefined',
                amount: amount.toString()
            }
        });
        throw error;
    }
}

async function deployContract(sender, abi, bytecode) {
    let nonce;  
    try {
        nonce = await getNonceForAccount(sender);
        const factory = new ethers.ContractFactory(abi, bytecode, sender);
        const contract = await factory.deploy({
            nonce: nonce
        });
        return contract.deploymentTransaction();
    } catch (error) {
        logger.error('Contract deployment failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                nonce: nonce || 'undefined'
            }
        });
        throw error;
    }
}

async function executeRandomTransaction(accounts, tokenContract, config, simpleStorageJson) {
    const {
        complexityLevel = 50,
        ethTransferAmount = '0.000000001',
        skipWait = false,
        resetNonceMap = false
    } = config;

    if (resetNonceMap) {
        nonceMap.clear();
    }

    let sender, receiver, behavior;  
    
    try {
        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts available');
        }

        const randomIndex = Math.floor(Math.random() * accounts.length);
        sender = accounts[randomIndex];

        let receiverIndex;
        do {
            receiverIndex = Math.floor(Math.random() * accounts.length);
        } while (receiverIndex === randomIndex);
        receiver = accounts[receiverIndex];

        behavior = selectBehavior(calculateWeights(complexityLevel));
        
        let result;
        switch (behavior) {
            case 0:
                result = await transferNativeToken(sender, receiver, ethTransferAmount);
                break;
            case 1:
                const decimals = await tokenContract.decimals();
                const amount = ethers.parseUnits("1", decimals);
                result = await transferERC20Token(sender, receiver, tokenContract, amount);
                break;
            case 2:
                result = await deployContract(sender, simpleStorageJson.abi, simpleStorageJson.bytecode);
                break;
            default:
                throw new Error(`Invalid behavior: ${behavior}`);
        }

        if (!skipWait && result) {
            await result.wait(1);
        }
        
        return result;
    } catch (error) {
        logger.error('Transaction failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender.address,
                to: receiver.address,
            }
        });
        throw error;
    }
}

function selectBehavior(weights) {
    const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (let i = 0; i < weights.length; i++) {
        cumulativeWeight += weights[i];
        if (random < cumulativeWeight) {
            return i;
        }
    }
    return 0;
}

function calculateWeights(complexityLevel) {
    // ensure complexityLevel is between 0-100
    const level = Math.max(0, Math.min(100, complexityLevel));
    
    if (level === 0) {
        // simplest: only transfer ETH
        return [100, 0, 0];
    }
    
    if (level === 100) {
        // most complex: only deploy contract
        return [0, 0, 100];
    }
    
    // dynamic calculate weights
    const simpleWeight = Math.max(0, 100 - level);  // ETH transfer weight
    const complexWeight = level;  // contract deployment weight
    const mediumWeight = Math.max(0, 50 - Math.abs(50 - level));  // ERC20 token transfer weight
    
    // normalize weights to ensure total is 100
    const total = simpleWeight + mediumWeight + complexWeight;
    return [
        Math.round((simpleWeight / total) * 100),
        Math.round((mediumWeight / total) * 100),
        Math.round((complexWeight / total) * 100)
    ];
}

export {
    executeRandomTransaction,
    transferNativeToken,
    transferERC20Token,
    deployContract,
    calculateWeights
}; 