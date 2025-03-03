import { ethers } from 'ethers';
import { executeRandomTransaction, calculateWeights } from './behaviorExecutor.js';
import { loadAccounts } from '../utils/accountHandler.js';
import { loadContractJson } from '../utils/contractLoader.js';
import { CONFIG } from '../config/simulation.config.js';
import { logger, simulationLogger, metricsLogger, batchMetricsLogger } from '../utils/logger.js';
import { ensureSufficientBalance } from '../utils/accountHandler.js';
import { recordDuration, recordGasPrice } from '../metrics/collector.js';

let stopSimulation = false;
let accountGroups = null; // Store the account groups for reuse
let currentGroupIndex = 0; // Track the current group being used

function resetSimulationState() {
    stopSimulation = false;
    accountGroups = null;
    currentGroupIndex = 0;
}

async function runSimulation() {
    resetSimulationState();
    const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
    let accounts;

    try {
        accounts = await loadAccounts();
        console.log(`Loaded ${accounts.length} accounts`);
    } catch (error) {
        console.error(error.message);
        return;
    }

    const mockUSDCJson = await loadContractJson('MockUSDC');
    const simpleStorageJson = await loadContractJson('SimpleStorage');

    const tokenContract = new ethers.Contract(
        CONFIG.MockUSDCAddress,
        mockUSDCJson.abi,
        provider
    );

    const BATCH_SIZE = CONFIG.SIMULATION.BATCH_SIZE;
    const BATCH_INTERVAL = CONFIG.SIMULATION.BATCH_INTERVAL;
    const GROUP_SIZE = CONFIG.SIMULATION.GROUP_SIZE;

    console.log(`\n=== Starting Simulation ===`);
    console.log(`Batch Size: ${BATCH_SIZE}`);
    console.log(`Interval: ${BATCH_INTERVAL}ms\n`);

    let totalTx = 0;
    let successTx = 0;
    let failedTx = 0;
    const startTime = Date.now();
    let lastLogTime = Date.now();
    let firstTxTime = null;  // Record the time of the first successful transaction

    async function runBatches() {
        let i = 1;
        while (!stopSimulation) {
            console.log(`\n== runBatches: ${i} ==`);
            await executeBatch();
            await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION.BATCH_INTERVAL));
            i++;
        }
        return completeSimulation();
    }

    function completeSimulation() {
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;

        const simulationResults = {
            timestamp: new Date().toISOString(),
            parameters: {
                batchSize: CONFIG.SIMULATION.BATCH_SIZE,
                batchInterval: CONFIG.SIMULATION.BATCH_INTERVAL,
                complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                accounts: accounts.length,
                groupSize: CONFIG.SIMULATION.GROUP_SIZE
            },
            metrics: {
                firstTransactionTimestamp: firstTxTime ? `${(firstTxTime - startTime) / 1000}s` : 'N/A',
                totalTransactions: totalTx,
                successfulTransactions: successTx,
                failedTransactions: failedTx,
                totalTimeSeconds: totalTime.toFixed(0)
            }
        };

        console.log(`\n=== Simulation Completed ===`);
        console.log(`Total Transactions: ${totalTx}`);
        console.log(`Successful: ${successTx}`);
        console.log(`Failed: ${failedTx}`);

        simulationLogger.info('Simulation completed', simulationResults);
        stopSimulation = false; // Reset stop flag
        return simulationResults;
    }

    async function executeBatch() {
        const weights = calculateWeights(CONFIG.SIMULATION.DEFAULT_COMPLEXITY);
        const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);

        // Calculate the number of transactions for each behavior type
        const numNativeTransfers = Math.round((weights[0] / totalWeight) * BATCH_SIZE);
        const numERC20Transfers = Math.round((weights[1] / totalWeight) * BATCH_SIZE);
        const numComplexTransactions = BATCH_SIZE - numNativeTransfers - numERC20Transfers;

        // Create a list of transaction types
        const transactionTypes = [
            ...Array(numNativeTransfers).fill(0),
            ...Array(numERC20Transfers).fill(1),
            ...Array(numComplexTransactions).fill(2)
        ];

        shuffleArray(transactionTypes);

        const uniqueSenders = getRandomSenders(accounts, BATCH_SIZE, GROUP_SIZE);

        // Batch balance check for all senders
        try {
            const threshold = ethers.parseEther('0.01');
            await Promise.all(
                uniqueSenders.map(sender =>
                    ensureSufficientBalance(sender, provider, accounts[0], threshold)
                )
            );

            logger.info('Batch balance check completed', {
                sendersCount: uniqueSenders.length,
            });
        } catch (error) {
            logger.error('Batch balance check failed', {
                error: error.message,
                sendersCount: uniqueSenders.length
            });
            throw error;
        }

        // Create and execute all transactions
        const txResults = await Promise.all(
            uniqueSenders.map((sender, i) =>
                executeTransaction(sender, transactionTypes[i])
            )
        );

        // Calculate batch statistics
        const successfulTxs = txResults.filter(r => r && r.duration);
        if (successfulTxs.length > 0) {
            const durations = successfulTxs.map(r => r.duration);
            const gasPrices = successfulTxs.map(r => r.gasPrice).filter(Boolean);

            recordDuration(Math.min(...durations), 'min');
            recordDuration(Math.max(...durations), 'max');
            recordDuration(
                durations.reduce((a, b) => a + b, 0) / durations.length,
                'avg'
            );

            if (gasPrices.length > 0) {
                const minGasPrice = gasPrices.reduce((a, b) => a < b ? a : b);
                const maxGasPrice = gasPrices.reduce((a, b) => a > b ? a : b);
                const avgGasPrice = gasPrices.reduce((a, b) => a + b, BigInt(0)) /
                    BigInt(gasPrices.length);

                recordGasPrice(minGasPrice, 'min');
                recordGasPrice(maxGasPrice, 'max');
                recordGasPrice(avgGasPrice, 'avg');
            }

            batchMetricsLogger.info('Batch metrics', {
                batchId: Math.floor(totalTx / BATCH_SIZE),
                timestamp: new Date().toISOString(),
                txCount: {
                    total: BATCH_SIZE,
                    successful: successfulTxs.length
                },
                duration: {
                    min: Math.min(...durations),
                    max: Math.max(...durations),
                    avg: durations.reduce((a, b) => a + b, 0) / durations.length
                },
                gasPrice: gasPrices.length ? {
                    min: ethers.formatUnits(gasPrices.reduce((a, b) => a < b ? a : b), 'gwei'),
                    max: ethers.formatUnits(gasPrices.reduce((a, b) => a > b ? a : b), 'gwei'),
                    avg: ethers.formatUnits(
                        gasPrices.reduce((a, b) => a + b, BigInt(0)) / BigInt(gasPrices.length),
                        'gwei'
                    )
                } : null
            });
        }

        totalTx += BATCH_SIZE;

        const currentTime = Date.now();
        if (currentTime - lastLogTime >= CONFIG.SIMULATION.LOG_INTERVAL) {
            console.log(`\n=== Simulation Stats ===`);
            console.log(`Total Transactions: ${totalTx}`);
            console.log(`Successful: ${successTx}`);
            console.log(`Failed: ${failedTx}`);
            lastLogTime = currentTime;
        }
    }

    async function executeTransaction(sender, behavior) {
        const startTime = Date.now();
        const TRANSACTION_TIMEOUT = 300000;

        try {
            const txPromise = executeRandomTransaction(
                sender,
                accounts,
                tokenContract,
                {
                    complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                    ethTransferAmount: CONFIG.SIMULATION.ETH_TRANSFER_AMOUNT,
                    skipWait: CONFIG.SIMULATION.SKIP_WAIT_CONFIRMATION
                },
                simpleStorageJson,
                behavior
            );

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Transaction timeout after ${TRANSACTION_TIMEOUT}ms`));
                }, TRANSACTION_TIMEOUT);
            });

            // Race between transaction and timeout
            const result = await Promise.race([txPromise, timeoutPromise]);

            if (result && !firstTxTime) {
                firstTxTime = Date.now();
                logger.info('First successful transaction', {
                    sender: sender.address,
                    txHash: result.hash,
                    initializationTime: `${(firstTxTime - startTime) / 1000}s`
                });
            }

            if (result) {
                // Wait for the transaction receipt
                const receipt = await result.wait();
                const endTime = Date.now();
                const duration = endTime - startTime;
                const gasPrice = result.gasPrice || result.maxFeePerGas; // deal with different tx type

                // Record single transaction metrics
                metricsLogger.info('Transaction metrics', {
                    gasPrice: gasPrice ? ethers.formatUnits(gasPrice, 'gwei') : null,
                    duration: duration,
                    txHash: result.hash,
                    sender: sender.address,
                    type: behavior,
                    status: receipt.status === 1 ? 'success' : 'failed',
                });

                successTx++;
                return { result, duration, gasPrice };
            }
        } catch (error) {
            failedTx++;
            logger.error('Execute Random Behavior failed', {
                error: error.message,
                sender: sender.address,
                behavior,
                isTimeout: error.message.includes('timeout')
            });
            return false;
        }
    }

    function getRandomSenders(accounts, batchSize, groupSize) {
        if (!accountGroups) {
            const availableAccounts = accounts.slice(1); // Skip account[0]
            const totalAccountCount = batchSize * groupSize;

            // Check if there are enough accounts
            if (availableAccounts.length < totalAccountCount) {
                const error = new Error(
                    `Insufficient accounts for simulation. ` +
                    `Required: ${totalAccountCount} accounts ` +
                    `(${batchSize} accounts × ${groupSize} groups), ` +
                    `Available: ${availableAccounts.length} accounts`
                );

                logger.error('Simulation stopped', {
                    error: error.message,
                    required: totalAccountCount,
                    available: availableAccounts.length,
                    batchSize,
                    groupSize
                });

                // Stop simulation
                stopSimulation = true;
                throw error;
            }

            const selectedAccounts = [];

            // Select accounts
            while (selectedAccounts.length < totalAccountCount && availableAccounts.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableAccounts.length);
                const account = availableAccounts.splice(randomIndex, 1)[0];
                selectedAccounts.push(account);
            }

            // Dynamic grouping
            accountGroups = Array.from({ length: groupSize }, (_, index) => {
                const start = index * batchSize;
                return selectedAccounts.slice(start, start + batchSize);
            });
        }

        // Use the current group and update the index for the next call
        const currentGroup = accountGroups[currentGroupIndex];
        currentGroupIndex = (currentGroupIndex + 1) % accountGroups.length;
        return currentGroup;
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    return runBatches();
}

function stopCurrentSimulation() {
    stopSimulation = true;
    logger.info('Simulation stopped', { timestamp: new Date().toISOString() });
}

export { runSimulation, stopCurrentSimulation };