import { logger } from '../../utils/logger.js';
import * as accountPool from '../resourceManager/accountPool.js';
import * as stateManager from './stateManager.js';
import * as concurrentControl from './concurrentControl.js';
import * as transactionGenerator from './transactionGenerator.js';


export function scheduleTransaction(executeCallback, resources) {
    const { accounts, tokenContract, simpleStorageJson } = resources;

    if (stateManager.shouldStop()) return false;

    // Handle pending transactions first
    const pendingTx = concurrentControl.getNextPendingTransaction();
    if (pendingTx) {
        executeCallback(pendingTx.sender, pendingTx.behavior, resources);
        return true;
    }

    // Try to start a new transaction
    const newSender = accountPool.getAvailableAccount();
    if (newSender) {
        const nextBehavior = transactionGenerator.getNextTransactionType();
        executeCallback(newSender, nextBehavior, resources);
        return true;
    } else {
        // Retry logic when no available accounts
        scheduleRetry(executeCallback, resources);
    }

    return false;
}

function scheduleRetry(executeCallback, resources) {
    setTimeout(() => {
        const retryAccount = accountPool.getAvailableAccount();
        if (retryAccount && concurrentControl.canExecuteTransaction() && !stateManager.shouldStop()) {
            const behavior = transactionGenerator.getNextTransactionType();
            executeCallback(retryAccount, behavior, resources);
        }
    }, 5000);
}

export function startInitialTransactions(concurrentTx, executeCallback, resources) {
    for (let i = 0; i < concurrentTx && !stateManager.shouldStop(); i++) {
        const sender = accountPool.getAvailableAccount();
        if (sender) {
            const behavior = transactionGenerator.getNextTransactionType();
            executeCallback(sender, behavior, resources);
        } else {
            logger.warn(`Not enough available accounts, initiated only ${i} transactions`);
            break;
        }
    }
}