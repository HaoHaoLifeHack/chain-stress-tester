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

// Manage concurrent transactions
let activeTransactions = 0;
const pendingTransactions = [];
let transactionTypes = []; // Transaction types generated based on complexity

function resetSimulationState() {
    stopSimulation = false;
    accountGroups = null;
    currentGroupIndex = 0;
    activeTransactions = 0;
    pendingTransactions.length = 0;
    transactionTypes = [];
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

    const CONCURRENT_TX = CONFIG.SIMULATION.CONCURRENT_TX;
    const TX_INTERVAL = CONFIG.SIMULATION.TX_INTERVAL;
    const GROUP_SIZE = CONFIG.SIMULATION.GROUP_SIZE;

    console.log(`\n=== Starting Simulation ===`);
    console.log(`Concurrent Transactions: ${CONCURRENT_TX}`);
    console.log(`Transaction Interval: ${TX_INTERVAL}ms\n`);

    let totalTx = 0;
    let successTx = 0;
    let failedTx = 0;
    const startTime = Date.now();
    let lastLogTime = Date.now();
    let firstTxTime = null;  // Record the time of the first successful transaction


    initializeTransactionTypes();

    async function runTransactions() {
        console.log(`\n== Starting Transaction Execution ==`);
        
        const senders = getRandomSenders(accounts, CONCURRENT_TX, GROUP_SIZE);

        // Pre-check balances
        try {
            const threshold = ethers.parseEther('0.01');
            await Promise.all(
                senders.map(sender =>
                    ensureSufficientBalance(sender, provider, accounts[0], threshold)
                )
            );
            logger.info('Initial balance check completed', {
                sendersCount: senders.length,
            });
        } catch (error) {
            logger.error('Initial balance check failed', {
                error: error.message,
                sendersCount: senders.length
            });
            throw error;
        }
        
        // Start executing initial transactions
        for (let i = 0; i < senders.length && !stopSimulation; i++) {
            const sender = senders[i];
            const behavior = getNextTransactionType();
            executeTransactionWithLimit(sender, behavior, accounts, tokenContract, simpleStorageJson);
        }
        
        // Wait for all transactions to complete before ending the simulation
        let simulationCompleted = false;
        while (!simulationCompleted) {
            if (stopSimulation) {
                // When the stop request is issued, wait for all active transactions to complete
                console.log(`\nWaiting for ${activeTransactions} active transactions to complete...`);
                
                // Wait for all active transactions to complete
                while (activeTransactions > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    console.log(`Remaining active transactions: ${activeTransactions}`);
                }
                
                simulationCompleted = true;
            } else if (activeTransactions === 0 && pendingTransactions.length === 0) {
                // All transactions have been completed eventually
                simulationCompleted = true;
            } else {
                // Continue waiting for transactions to complete
                await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION.TX_INTERVAL));
            }
        }
        
        return completeSimulation();
    }

    function completeSimulation() {
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;

        const simulationResults = {
            timestamp: new Date().toISOString(),
            parameters: {
                concurrentTx: CONFIG.SIMULATION.CONCURRENT_TX,
                txInterval: CONFIG.SIMULATION.TX_INTERVAL,
                complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                accounts: accounts.length,
                groupSize: CONFIG.SIMULATION.GROUP_SIZE
            },
            metrics: {
                firstTransactionTimestamp: firstTxTime ? `${(firstTxTime - startTime) / 1000}s` : 'N/A',
                totalTransactions: totalTx,
                successfulTransactions: successTx,
                failedTransactions: failedTx,
                totalTimeSeconds: totalTime.toFixed(0),
                tps: (successTx / totalTime).toFixed(2)
            }
        };

        console.log(`\n=== Simulation Completed ===`);
        console.log(`Total Transactions: ${totalTx}`);
        console.log(`Successful: ${successTx}`);
        console.log(`Failed: ${failedTx}`);

        simulationLogger.info('Simulation completed', simulationResults);
        return simulationResults;
    }

    function initializeTransactionTypes() {
        const weights = calculateWeights(CONFIG.SIMULATION.DEFAULT_COMPLEXITY);
        const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);

        // Calculate the number of each transaction type based on weights
        const numNativeTransfers = Math.round((weights[0] / totalWeight) * CONFIG.SIMULATION.CONCURRENT_TX);
        const numERC20Transfers = Math.round((weights[1] / totalWeight) * CONFIG.SIMULATION.CONCURRENT_TX);
        const numComplexTransactions = CONFIG.SIMULATION.CONCURRENT_TX - numNativeTransfers - numERC20Transfers;

        // Create transaction type list
        transactionTypes = [
            ...Array(numNativeTransfers).fill(0),
            ...Array(numERC20Transfers).fill(1),
            ...Array(numComplexTransactions).fill(2)
        ];

        shuffleArray(transactionTypes);
        
        logger.info('Transaction types initialized', {
            nativeTransfers: numNativeTransfers,
            erc20Transfers: numERC20Transfers,
            complexTransactions: numComplexTransactions,
            complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY
        });
    }

    function getNextTransactionType() {
        if (transactionTypes.length === 0) {
            initializeTransactionTypes();
        }
        return transactionTypes.shift();
    }

    // Async execute transaction (with concurrent limit)
    async function executeTransactionWithLimit(sender, behavior, accounts, tokenContract, simpleStorageJson) {
        if (stopSimulation) return;
        
        // Check if the current number of active transactions has reached the limit
        if (activeTransactions >= CONFIG.SIMULATION.CONCURRENT_TX) {
            // Add to the waiting queue
            pendingTransactions.push({ sender, behavior });
            logger.info('Transaction queued', {
                sender: sender.address,
                behavior,
                queueLength: pendingTransactions.length,
                activeTransactions
            });
            return;
        }
        
        // Increase the count of currently executing transactions
        activeTransactions++;
        totalTx++;
        
        try {
            // Execute transaction
            const result = await executeTransaction(sender, behavior, accounts, tokenContract, simpleStorageJson);
            
            // After the transaction is completed, wait for the specified time before executing the next transaction
            if (!stopSimulation) {
                setTimeout(() => {
                    const nextBehavior = getNextTransactionType();
                    executeTransactionWithLimit(sender, nextBehavior, accounts, tokenContract, simpleStorageJson);
                }, CONFIG.SIMULATION.TX_INTERVAL);
            }
            
            // Record transaction statistics
            if (result && result.duration) {
                recordTransactionMetrics(result);
            }
        } catch (error) {
            logger.error('Transaction execution failed', {
                error: error.message,
                sender: sender.address,
                behavior
            });
        } finally {
            // Decrease the count of currently executing transactions
            activeTransactions--;
            
            // Check if there are any pending transactions to execute
            if (pendingTransactions.length > 0 && !stopSimulation) {
                const nextTx = pendingTransactions.shift();
                executeTransactionWithLimit(nextTx.sender, nextTx.behavior, accounts, tokenContract, simpleStorageJson);
            }
            
            // Output simulation statistics periodically
            const currentTime = Date.now();
            if (currentTime - lastLogTime >= CONFIG.SIMULATION.LOG_INTERVAL) {
                console.log(`\n=== Simulation Stats ===`);
                console.log(`Total Transactions: ${totalTx}`);
                console.log(`Successful: ${successTx}`);
                console.log(`Failed: ${failedTx}`);
                console.log(`Active Transactions: ${activeTransactions}`);
                console.log(`Pending Transactions: ${pendingTransactions.length}`);
                lastLogTime = currentTime;
            }
        }
    }

    async function executeTransaction(sender, behavior, accounts, tokenContract, simpleStorageJson) {
        const startTime = Date.now();
        const TRANSACTION_TIMEOUT = CONFIG.SIMULATION.TX_TIMEOUT;

        try {
            const txPromise = executeRandomTransaction(
                sender,
                accounts,
                tokenContract,
                {
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

    // Record transaction statistics
    function recordTransactionMetrics(txResult) {
        const { duration, gasPrice } = txResult;
        
        recordDuration(duration, 'current');
        if (gasPrice) {
            recordGasPrice(gasPrice, 'current');
        }
    }

    function getRandomSenders(accounts, ccrTxSize, groupSize) {
        if (!accountGroups) {
            const availableAccounts = accounts.slice(1); // Skip account[0]
            const totalAccountCount = ccrTxSize * groupSize;

            // Check if there are enough accounts
            if (availableAccounts.length < totalAccountCount) {
                const error = new Error(
                    `Insufficient accounts for simulation. ` +
                    `Required: ${totalAccountCount} accounts ` +
                    `(${ccrTxSize} accounts × ${groupSize} groups), ` +
                    `Available: ${availableAccounts.length} accounts`
                );

                logger.error('Simulation stopped', {
                    error: error.message,
                    required: totalAccountCount,
                    available: availableAccounts.length,
                    ccrTxSize,
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
                const start = index * ccrTxSize;
                return selectedAccounts.slice(start, start + ccrTxSize);
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
        return array;
    }

    return runTransactions();
}

function stopCurrentSimulation() {
    stopSimulation = true;
    pendingTransactions.length = 0; // Clear the pending pool
    console.log('\nStopping simulation...');
}

export { runSimulation, stopCurrentSimulation };