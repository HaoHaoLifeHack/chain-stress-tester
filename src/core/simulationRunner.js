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
    
    
    const duration = CONFIG.SIMULATION.DURATION || 3600000; // default 1 hour
    console.log(`\n=== Starting Simulation ===`);
    console.log(`Batch Size: ${BATCH_SIZE}`);
    console.log(`Interval: ${BATCH_INTERVAL}ms\n`);

    let totalTx = 0;
    let successTx = 0;
    let failedTx = 0;
    const startTime = Date.now();

    const LOG_INTERVAL = CONFIG.SIMULATION.LOG_INTERVAL;
    let lastLogTime = Date.now();

    const intervalId = setInterval(async () => {
        const batchPromises = [];
        
        for (let i = 0; i < BATCH_SIZE; i++) {
            batchPromises.push(
                executeRandomTransaction(
                    accounts,
                    tokenContract,
                    {
                        complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                        ethTransferAmount: CONFIG.SIMULATION.ETH_TRANSFER_AMOUNT,
                        skipWait: CONFIG.SIMULATION.WAIT_CONFIRMATION,
                        resetNonceMap: i === 0  // Reset nonce map only for first batch
                    },
                    simpleStorageJson
                ).then(() => {
                    successTx++;
                    return true;
                }).catch(error => {
                    failedTx++;
                    logger.error('Execute Random Behavior failed', {error: error.message});
                    return false;
                })
            );
        }

        try {
            await Promise.allSettled(batchPromises);
            totalTx += BATCH_SIZE;
            
            // Start to log every LOG_INTERVAL seconds
            const currentTime = Date.now();
            if (currentTime - lastLogTime >= LOG_INTERVAL) {
                const elapsedSeconds = (currentTime - startTime) / 1000;
                
                console.log(`\n=== Simulation Stats ===`);
                console.log(`Total Transactions: ${totalTx}`);
                console.log(`Successful: ${successTx}`);
                console.log(`Failed: ${failedTx}`);
                console.log(`Elapsed Time: ${elapsedSeconds.toFixed(0)}s\n`);
                
                lastLogTime = currentTime;
            }
        } catch (error) {
            logger.error('Batch execution failed', {error: error.message});
        }
    }, BATCH_INTERVAL);

    // Execute after duration
    const timeoutId = setTimeout(() => {
        // Clear both intervals
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        const finalTPS = (successTx / totalTime).toFixed(2);
        
        // Log simulation results only
        const simulationResults = {
            timestamp: new Date().toISOString(),
            parameters: {
                // Batch settings
                batchSize: CONFIG.SIMULATION.BATCH_SIZE,
                batchInterval: CONFIG.SIMULATION.BATCH_INTERVAL,
                duration: CONFIG.SIMULATION.DURATION,
                logInterval: CONFIG.SIMULATION.LOG_INTERVAL,
                
                // Transaction settings
                complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
                ethTransferAmount: CONFIG.SIMULATION.ETH_TRANSFER_AMOUNT,
                waitConfirmation: CONFIG.SIMULATION.WAIT_CONFIRMATION,
            },
            metrics: {
                totalTransactions: totalTx,
                successfulTransactions: successTx,
                failedTransactions: failedTx,
                averageTPS: finalTPS,
                totalTimeSeconds: totalTime.toFixed(0)
            }
        };

        // Console output
        console.log(`\n=== Simulation Completed ===`);
        console.log(`Total Transactions: ${totalTx}`);
        console.log(`Successful: ${successTx}`);
        console.log(`Failed: ${failedTx}`);
        console.log(`Average TPS: ${finalTPS}`);
        console.log(`Total Time: ${totalTime.toFixed(0)}s\n`);

        // Log only simulation results to simulation.log
        simulationLogger.info('Simulation completed', simulationResults);

        process.exit(0);
    }, duration);
}

export { runSimulation };