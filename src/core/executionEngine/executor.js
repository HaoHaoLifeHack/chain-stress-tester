import { logger, metricsLogger } from '../../utils/logger.js';
import { ethers } from 'ethers';
import * as stateManager from './stateManager.js';
import { acquireAccountLock, releaseAccountLock } from '../../utils/accountHandler.js';
import { transferNativeToken, transferERC20Token, deployContract, sendHugeCalldata } from '../actions/index.js';


export async function executeTransaction(sender, behavior, accounts, tokenContract, simpleStorageJson, config) {
    const startTime = Date.now();
    const TRANSACTION_TIMEOUT = config.TX_TIMEOUT;

    try {
        const txPromise = executeRandomBehavior(
            sender,
            accounts,
            tokenContract,
            {
                ethTransferAmount: config.ETH_TRANSFER_AMOUNT,
                skipWait: config.SKIP_WAIT_CONFIRMATION
            },
            simpleStorageJson,
            behavior
        );

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Transaction timeout after ${TRANSACTION_TIMEOUT}ms`));
            }, TRANSACTION_TIMEOUT);
        });

        const result = await Promise.race([txPromise, timeoutPromise]);

        if (result && stateManager.setFirstTxTime()) {
            const firstTxTime = Date.now();
            logger.info('First successful transaction', {
                sender: sender.address,
                txHash: result.hash,
                initializationTime: `${(firstTxTime - startTime) / 1000}s`
            });
        }

        if (result) {
            const receipt = await result.wait();
            const endTime = Date.now();
            const duration = endTime - startTime;
            const gasPrice = result.gasPrice || result.maxFeePerGas;

            metricsLogger.info('Transaction metrics', {
                gasPrice: gasPrice ? ethers.formatUnits(gasPrice, 'gwei') : null,
                duration: duration,
                txHash: result.hash,
                sender: sender.address,
                type: behavior,
                status: receipt.status === 1 ? 'success' : 'failed',
            });

            stateManager.incrementSuccessTx();
            return { result, duration, gasPrice };
        }

        return null;
    } catch (error) {
        stateManager.incrementFailedTx();
        logger.error('Execute Random Behavior failed', {
            error: error.message,
            sender: sender.address,
            behavior,
            isTimeout: error.message.includes('timeout')
        });
        return null;
    }
}

export async function executeRandomBehavior(sender, allAccounts, tokenContract, config, simpleStorageJson, behavior) {
    const {
        ethTransferAmount = '0.000000001',
        skipWait = false,
    } = config;

    let receiver;

    try {
        // Lock sender while the tx's sending
        await acquireAccountLock(sender.address);

        if (!sender || !allAccounts || allAccounts.length === 0) {
            throw new Error('No accounts available');
        }

        // Select a receiver that is not the sender
        do {
            const randomIndex = Math.floor(Math.random() * allAccounts.length);
            receiver = allAccounts[randomIndex];
        } while (receiver.address === sender.address || receiver.address === allAccounts[0].address);

        let result;
        switch (behavior) {
            case 0:
                receiver = sender; // enhance stability
                result = await transferNativeToken(sender, receiver, ethTransferAmount);
                break;
            case 1:
                const decimals = await tokenContract.decimals();
                const amount = ethers.parseUnits("1", decimals);
                result = await transferERC20Token(sender, receiver, tokenContract, amount);
                break;
            case 2:
                if (Math.random() < 0.5) {
                    result = await deployContract(sender, simpleStorageJson.abi, simpleStorageJson.bytecode);
                } else {
                    result = await sendHugeCalldata(sender, receiver);
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