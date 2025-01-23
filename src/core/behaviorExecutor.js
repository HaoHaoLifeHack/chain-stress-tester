import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { getFeeData } from '../utils/feeUtils.js';

const accountLocks = new Map();

async function acquireAccountLock(address) {
    while (accountLocks.get(address)) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    accountLocks.set(address, true);
}

async function releaseAccountLock(address) {
    accountLocks.delete(address);
}

async function getNonceForAccount(account, provider) {
    return await provider.getTransactionCount(account.address, 'pending');
}

async function transferNativeToken(sender, receiver, amount, nonce) {
    try {
        const feeData = await getFeeData();
        const tx = {
            to: receiver.address,
            value: ethers.parseEther(amount.toString()),
            nonce: nonce,
            gasLimit: 21000,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        };
        return await sender.sendTransaction(tx);
    } catch (error) {
        logger.error('Native token transfer failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
                nonce: nonce,
                amount: amount
            }
        });
        throw error;
    }
}

async function transferERC20Token(sender, receiver, tokenContract, amount, nonce) {
    try {
        const balance = await tokenContract.balanceOf(sender.address);
        if(balance < amount) {
            const faucetTx = await tokenContract.connect(sender).faucet(sender.address, {
                nonce: nonce
            });
            await faucetTx.wait(1);
        }
        
        return await tokenContract.connect(sender).transfer(receiver.address, amount, {
            nonce: nonce
        });

    } catch (error) {
        logger.error('ERC20 token transfer failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
                nonce: nonce,
                amount: amount.toString()
            }
        });
        throw error;
    }
}

async function sendHugeCalldata(sender, receiver, nonce) {
    try {
        // Generate random calldata in 100KB to 127KB (Limit: 128KB)
        const size = Math.floor(Math.random() * (127 - 100 + 1) + 100) * 1024;
        const hugeData = '0x' + '00'.repeat(size);
        const feeData = await getFeeData();
        const tx = await sender.sendTransaction({
            to: receiver.address,
            data: hugeData,
            nonce: nonce,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        });
        return tx;
    } catch (error) {
        logger.error('Huge calldata transaction failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
                nonce: nonce,
            }
        });
        throw error;
    }
}

async function deployContract(sender, abi, bytecode, nonce) {
    try {
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
                nonce: nonce
            }
        });
        throw error;
    }
}

async function ensureSufficientBalance(sender, provider, mainAccount, threshold = ethers.parseEther('0.01')) {
    const balance = await provider.getBalance(sender.address);
    if (balance < threshold) {
        try {
            await acquireAccountLock(mainAccount.address);
            const feeData = await getFeeData();
            const tx = {
                to: sender.address,
                value: threshold - balance,
                gasLimit: 21000,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
                };

                const txResponse = await mainAccount.sendTransaction(tx);
                await txResponse.wait();

                logger.info('Balance topped up', {
                    address: sender.address,
                    amount: threshold - balance,
                    txHash: txResponse.hash
            });
        } finally {
            releaseAccountLock(mainAccount.address);
        }
    }
}

async function executeRandomTransaction(sender, allAccounts, tokenContract, config, simpleStorageJson) {
    const {
        complexityLevel = 50,
        ethTransferAmount = '0.000000001',
        skipWait = false,
    } = config;

    let receiver, behavior, nonce;  
    
    try {
        // 1. Lock sender while the tx's sending
        await acquireAccountLock(sender.address);

        if (!sender || !allAccounts || allAccounts.length === 0) {
            throw new Error('No accounts available');
        }

        await ensureSufficientBalance(sender, sender.provider, allAccounts[0]);

        // Select a receiver that is not the sender
        do {
            const randomIndex = Math.floor(Math.random() * allAccounts.length);
            receiver = allAccounts[randomIndex];
        } while (receiver.address === sender.address);

        behavior = selectBehavior(calculateWeights(complexityLevel));
        nonce = await getNonceForAccount(sender, sender.provider);
        
        let result;
        switch (behavior) {
            case 0:
                result = await transferNativeToken(sender, receiver, ethTransferAmount, nonce);
                break;
            case 1:
                const decimals = await tokenContract.decimals();
                const amount = ethers.parseUnits("1", decimals);
                result = await transferERC20Token(sender, receiver, tokenContract, amount, nonce);
                break;
            case 2:
                // Randomly choose between contract deployment and huge calldata
                if (Math.random() < 0.5) {
                    result = await deployContract(sender, simpleStorageJson.abi, simpleStorageJson.bytecode, nonce);
                } else {
                    result = await sendHugeCalldata(sender, receiver, nonce);
                }
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
                from: sender?.address,
                to: receiver?.address,
            }
        });
        throw error;
    } finally {
        releaseAccountLock(sender.address);
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
        // most complex: only complex transactions
        return [0, 0, 100];
    }
    
    // dynamic calculate weights
    const nativeTokenTransferWeight = Math.max(0, 100 - level);  // ETH transfer weight
    const erc20TokenTransferWeight = Math.max(0, 50 - Math.abs(50 - level));  // ERC20 token transfer weight
    const hugeCalldataWeight = level;  // complex transactions weight (contract deployment or huge calldata)
    
    // normalize weights to ensure total is 100
    const total = nativeTokenTransferWeight + erc20TokenTransferWeight + hugeCalldataWeight;
    return [
        Math.round((nativeTokenTransferWeight / total) * 100),
        Math.round((erc20TokenTransferWeight / total) * 100),
        Math.round((hugeCalldataWeight / total) * 100)
    ];
}

export {
    executeRandomTransaction,
    transferNativeToken,
    transferERC20Token,
    deployContract,
    calculateWeights,
    ensureSufficientBalance,
    acquireAccountLock,
    releaseAccountLock
}; 