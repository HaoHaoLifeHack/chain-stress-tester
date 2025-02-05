import { ethers } from 'ethers';
import { executeRandomTransaction, calculateWeights} from './behaviorExecutor.js';
import { loadAccounts } from '../utils/accountLoader.js';
import { loadContractJson } from '../utils/contractLoader.js';
import { CONFIG } from '../config/simulation.config.js';
import { logger, simulationLogger } from '../utils/logger.js';

let stopSimulation = false;
let accountGroups = null; // Store the account groups for reuse
let currentGroupIndex = 0; // Track the current group being used

async function runSimulation() {
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
                accounts: accounts.length
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

        // Shuffle the transaction types
        shuffleArray(transactionTypes);

        // Get unique senders
        const uniqueSenders = getRandomSenders(accounts, BATCH_SIZE);

        // Create all transactions as promises
        const batchPromises = uniqueSenders.map((sender, i) => 
            executeTransaction(sender, transactionTypes[i])
        );

        // Execute all transactions simultaneously
        await Promise.all(batchPromises);

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
        const TRANSACTION_TIMEOUT = 120000; // 120 seconds timeout
        
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
                    initializationTime: `${(firstTxTime - startTime) / 1000}s`
                });
            }

            successTx++;
            return result;
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

    function getRandomSenders(accounts, batchSize) {
        if (!accountGroups) {
            const availableAccounts = accounts.slice(1); // Skip account[0]
            const selectedAccounts = [];
            const totalAccountCount = batchSize * 3;

            // Select totalAccountCount unique accounts
            while (selectedAccounts.length < totalAccountCount && availableAccounts.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableAccounts.length);
                const account = availableAccounts.splice(randomIndex, 1)[0];
                selectedAccounts.push(account);
            }

            if (selectedAccounts.length < totalAccountCount) {
                logger.warn(`Not enough unique accounts available to select ${totalAccountCount}.`);
            }

            // Divide into three groups
            accountGroups = [
                selectedAccounts.slice(0, batchSize),
                selectedAccounts.slice(batchSize, 2 * batchSize),
                selectedAccounts.slice(2 * batchSize, 3 * batchSize)
            ];
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