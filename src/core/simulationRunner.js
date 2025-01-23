import { ethers } from 'ethers';
import { executeRandomTransaction } from './behaviorExecutor.js';
import { loadAccounts } from '../utils/accountLoader.js';
import { loadContractJson } from '../utils/contractLoader.js';
import { CONFIG } from '../config/simulation.config.js';
import { logger, simulationLogger } from '../utils/logger.js';

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
    const duration = CONFIG.SIMULATION.DURATION || 3600000;
    
    console.log(`\n=== Starting Simulation ===`);
    console.log(`Batch Size: ${BATCH_SIZE}`);
    console.log(`Interval: ${BATCH_INTERVAL}ms\n`);

    let totalTx = 0;
    let successTx = 0;
    let failedTx = 0;
    const startTime = Date.now();
    let lastLogTime = Date.now();

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
                        skipWait: CONFIG.SIMULATION.WAIT_CONFIRMATION
                    },
                    simpleStorageJson
                );
                
                successTx++;
                return result;
            } catch (error) {
                failedTx++;
                logger.error('Execute Random Behavior failed', {error: error.message});
                return false;
            }
        });

        await Promise.all(batchPromises);
        totalTx += BATCH_SIZE;

        const currentTime = Date.now();
        if (currentTime - lastLogTime >= CONFIG.SIMULATION.LOG_INTERVAL) {
            const elapsedSeconds = (currentTime - startTime) / 1000;
            console.log(`\n=== Simulation Stats ===`);
            console.log(`Total Transactions: ${totalTx}`);
            console.log(`Successful: ${successTx}`);
            console.log(`Failed: ${failedTx}`);
            // console.log(`Elapsed Time: ${elapsedSeconds.toFixed(0)}s\n`);
            lastLogTime = currentTime;
        }
    }

    async function runBatches() {
        if (Date.now() - startTime >= duration) {
            return completeSimulation();
        }

        // run current batch 
        await executeBatch();
        
        // wait for the interval (e.g. 1 second)
        await new Promise(resolve => setTimeout(resolve, BATCH_INTERVAL));
        
        // run next batch
        return runBatches();
    }

    function completeSimulation() {
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        //const finalTPS = (successTx / totalTime).toFixed(2);
        
        const simulationResults = {
            timestamp: new Date().toISOString(),
            parameters: {
                batchSize: CONFIG.SIMULATION.BATCH_SIZE,
                batchInterval: CONFIG.SIMULATION.BATCH_INTERVAL,
                duration: CONFIG.SIMULATION.DURATION,
                logInterval: CONFIG.SIMULATION.LOG_INTERVAL,
                complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                ethTransferAmount: CONFIG.SIMULATION.ETH_TRANSFER_AMOUNT,
                waitConfirmation: CONFIG.SIMULATION.WAIT_CONFIRMATION,
            },
            metrics: {
                totalTransactions: totalTx,
                successfulTransactions: successTx,
                failedTransactions: failedTx,
                // averageTPS: finalTPS,
                totalTimeSeconds: totalTime.toFixed(0)
            }
        };

        console.log(`\n=== Simulation Completed ===`);
        console.log(`Total Transactions: ${totalTx}`);
        console.log(`Successful: ${successTx}`);
        console.log(`Failed: ${failedTx}`);
        // console.log(`Average TPS: ${finalTPS}`);
        // console.log(`Total Time: ${totalTime.toFixed(0)}s\n`);

        simulationLogger.info('Simulation completed', simulationResults);
        process.exit(0);
    }

    await runBatches();
}

export { runSimulation };