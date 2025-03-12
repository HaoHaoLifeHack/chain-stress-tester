import { ethers } from 'ethers';
import { loadContractJson } from './resourceManager/contractLoader.js';
import { CONFIG } from '../config/simulation.config.js';
import { logger } from '../utils/logger.js';
import * as accountPool from './resourceManager/accountPool.js';
import * as stateManager from './executionEngine/stateManager.js';
import * as concurrentControl from './executionEngine/concurrentControl.js';
import * as transactionGenerator from './executionEngine/transactionGenerator.js';
import * as scheduler from './executionEngine/scheduler.js';
import { executeTransaction } from './executionEngine/executor.js';
import { recordGasPrice, recordDuration, recordTransaction } from './monitoringSystem/metricsCollector.js';


async function runSimulation() {
    initialize();
    
    const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
    
    try {
        await accountPool.initialize();
        const accounts = accountPool.getAccounts();
        
        const threshold = ethers.parseEther('0.3');
        await accountPool.checkBalances(provider, threshold);
        logger.info('Initial balance check completed');
        
        const mockUSDCJson = await loadContractJson('MockUSDC');
        const simpleStorageJson = await loadContractJson('SimpleStorage');
        
        const tokenContract = new ethers.Contract(
            CONFIG.MockUSDCAddress,
            mockUSDCJson.abi,
            provider
        );
        
        stateManager.startSimulation();

        console.log(`\n=== Starting Simulation ===`);
        console.log(`Concurrent Transactions: ${CONFIG.SIMULATION.CONCURRENT_TX}`);
        console.log(`Transaction Interval: ${CONFIG.SIMULATION.TX_INTERVAL}ms\n`);

        transactionGenerator.initializeTransactionTypes();
        
        const resources = { accounts, tokenContract, simpleStorageJson, provider };
        scheduler.startInitialTransactions(
            CONFIG.SIMULATION.CONCURRENT_TX, 
            executeTransactionWithControl, 
            resources
        );
        
        return waitAndCompleteSimulation();
    } catch (error) {
        logger.error('Simulation initialization failed', { error: error.message });
        return { success: false, error: error.message };
    }
}

async function waitAndCompleteSimulation() {
    await waitForTransactionsToComplete();
    return completeSimulation();
}

function initialize() {
    // reset all modules state
    stateManager.reset();
    concurrentControl.reset();
    transactionGenerator.reset();
    accountPool.reset();
    
    // initialize config
    stateManager.initialize(CONFIG.SIMULATION);
    concurrentControl.initialize(CONFIG.SIMULATION);
    transactionGenerator.initialize(CONFIG.SIMULATION);
}

async function executeTransactionWithControl(sender, behavior, resources) {
    if (stateManager.shouldStop()) return;
    
    // if reach concurrent limit, queue the transaction
    if (!concurrentControl.canExecuteTransaction()) {
        console.log(`Concurrent limit reached, queueing transaction for ${sender.address}`);
        concurrentControl.queueTransaction({ sender, behavior });
        return;
    }

    concurrentControl.startTransaction();
    stateManager.incrementTotalTx();
    
    try {
        const result = await executeTransaction(
            sender, behavior, resources.accounts, 
            resources.tokenContract, resources.simpleStorageJson,
            CONFIG.SIMULATION
        );
        
        handleTransactionCompletion(sender, result);
    } catch (error) {
        logger.error('Transaction execution failed', {
            error: error.message,
            sender: sender.address,
            behavior
        });
        stateManager.incrementFailedTx();
    } finally {
        // release account and decrease active transaction count
        accountPool.releaseAccount(sender.address);
        concurrentControl.completeTransaction();
        
        // process next transaction immediately
        scheduler.scheduleTransaction(executeTransactionWithControl, resources);
        
        // show stats
        logStats();
    }
}

function handleTransactionCompletion(sender, result) {
    stateManager.incrementSuccessTx();
    
    // record gas price and transaction duration
    if (result) {
        recordGasPrice(result.gasPrice || result.maxFeePerGas, 'current_gas_price');
    }
    
    if (result.duration) {
        recordDuration(result.duration);
    }
    
    // record transaction completion for tps
    recordTransaction();
    
    logger.debug('Transaction completed successfully', {
        sender: sender.address,
        txHash: result.txHash
    });
}

async function waitForTransactionsToComplete() {
    let simulationCompleted = false;
    
    while (!simulationCompleted) {
        if (stateManager.shouldStop()) {
            // wait for all active transactions to complete
            console.log(`\nWaiting for ${concurrentControl.getState().activeTransactions} active transactions to complete...`);
            
            while (concurrentControl.getState().activeTransactions > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log(`Remaining active transactions: ${concurrentControl.getState().activeTransactions}`);
            }
            
            simulationCompleted = true;
        } else if (concurrentControl.getState().activeTransactions === 0 && !concurrentControl.hasPendingTransactions()) {
            // all transactions are completed
            simulationCompleted = true;
        } else {
            // continue waiting for transactions to complete
            await new Promise(resolve => setTimeout(resolve, CONFIG.SIMULATION.TX_INTERVAL));
        }
    }
}


function completeSimulation() {
    const stats = stateManager.getStats();
    
    const simulationResults = {
        success: true,
        totalTransactions: stats.totalTx,
        successfulTransactions: stats.successTx,
        failedTransactions: stats.failedTx,
        duration: stats.activeTime,
        tps: stats.totalTx / stats.activeTime
    };
    
    console.log('\n=== Simulation Complete ===');
    console.log(`Total Time: ${simulationResults.duration.toFixed(2)}s`);
    console.log(`Total Transactions: ${simulationResults.totalTransactions}`);
    console.log(`Successful: ${simulationResults.successfulTransactions}`);
    console.log(`Failed: ${simulationResults.failedTransactions}`);
    console.log(`TPS: ${simulationResults.tps.toFixed(2)}`);
    
    return simulationResults;
}

function stopCurrentSimulation() {
    stateManager.stopSimulation();
    console.log('\nStopping simulation...');
}

function logStats() {
    if (stateManager.shouldLogStats()) {
        const stats = stateManager.getStats();
        const concurrencyState = concurrentControl.getState();
        const poolStats = accountPool.getPoolStats();

        console.log(`\n=== Simulation Stats ===`);
        console.log(`Total Transactions: ${stats.totalTx}`);
        console.log(`Successful: ${stats.successTx}`);
        console.log(`Failed: ${stats.failedTx}`);
        console.log(`Active Transactions: ${concurrencyState.activeTransactions}`);
        console.log(`Pending Transactions: ${concurrencyState.pendingTransactions}`);
        console.log(`Account Pool: Available=${poolStats.available}, InUse=${poolStats.inUse}, Cooling=${poolStats.cooling}`);
        console.log(`Simulation Running Time: ${stats.activeTime.toFixed(2)}s`);
    }
}

export { runSimulation, stopCurrentSimulation };

