import { ethers } from 'ethers';
import { executeRandomTransaction } from './behaviorExecutor.js';
import { loadAccounts } from '../utils/accountLoader.js';
import { loadContractJson } from '../utils/contractLoader.js';
import { CONFIG } from '../config/simulation.config.js';
import { logger, simulationLogger } from '../utils/logger.js';

let stopSimulation = false;

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

    async function runBatches() {
        while (!stopSimulation) {
            await executeBatch();
            await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION.BATCH_INTERVAL));
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
                logInterval: CONFIG.SIMULATION.LOG_INTERVAL,
                complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                ethTransferAmount: CONFIG.SIMULATION.ETH_TRANSFER_AMOUNT,
                skipWait: CONFIG.SIMULATION.SKIP_WAIT_CONFIRMATION,
            },
            metrics: {
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
        const uniqueSenders = getRandomSenders(accounts, BATCH_SIZE);
        const batchPromises = uniqueSenders.map(async (sender) => {
            try {
                const result = await executeRandomTransaction(
                    sender,
                    accounts,
                    tokenContract,
                    {
                        complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                        ethTransferAmount: CONFIG.SIMULATION.ETH_TRANSFER_AMOUNT,
                        skipWait: CONFIG.SIMULATION.SKIP_WAIT_CONFIRMATION
                    },
                    simpleStorageJson
                );

                successTx++;
                return result;
            } catch (error) {
                failedTx++;
                logger.error('Execute Random Behavior failed', { error: error.message });
                return false;
            }
        });

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

    function getRandomSenders(accounts, batchSize) {
        const selected = new Set();
        const result = [];

        while (result.length < batchSize && result.length < accounts.length) {
            const randomIndex = Math.floor(Math.random() * accounts.length);
            if (!selected.has(randomIndex)) {
                selected.add(randomIndex);
                result.push(accounts[randomIndex]);
            }
        }
        return result;
    }

    return runBatches();
}

function stopCurrentSimulation() {
    stopSimulation = true;
    logger.info('Simulation stopped', { timestamp: new Date().toISOString() });
}

export { runSimulation, stopCurrentSimulation };