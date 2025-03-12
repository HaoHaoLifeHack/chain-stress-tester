import { CONFIG } from './simulation.config.js';
import { logger } from '../utils/logger.js';
import * as concurrentControl from '../core/executionEngine/concurrentControl.js';
import * as transactionGenerator from '../core/executionEngine/transactionGenerator.js';


export function initializeConfig(params) {
    const [concurrentTx, complexityLevel, txInterval, accountCount] = params;
    if (concurrentTx !== undefined) CONFIG.SIMULATION.CONCURRENT_TX = concurrentTx;
    if (complexityLevel !== undefined) CONFIG.SIMULATION.DEFAULT_COMPLEXITY = complexityLevel;
    if (txInterval !== undefined) CONFIG.SIMULATION.TX_INTERVAL = txInterval;
    if (accountCount !== undefined) CONFIG.CREATE_ACCOUNT.ACCOUNT_COUNT = accountCount;
}

export function updateSimulationConfigInRuntime(params) {
    const [concurrentTx, complexityLevel] = params;
    concurrentControl.updateConcurrentLimit(concurrentTx);
    transactionGenerator.updateComplexityLevel(complexityLevel);

    logger.info('Simulation parameters updated during runtime', {
        ...getCurrentConfig(),
        timestamp: new Date().toISOString()
    });
}

export function getCurrentConfig() {
    return {
        concurrentTx: CONFIG.SIMULATION.CONCURRENT_TX,
        complexityLevel: CONFIG.SIMULATION.DEFAULT_COMPLEXITY,
    };
}
