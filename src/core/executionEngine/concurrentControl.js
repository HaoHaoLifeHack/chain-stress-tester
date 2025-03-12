import { logger } from '../../utils/logger.js';

const state = {
    activeTransactions: 0,
    pendingTransactions: [],
    config: null
};

export function initialize(config) {
    state.config = config;
    return state;
}

export function canExecuteTransaction() {
    return state.activeTransactions < state.config.CONCURRENT_TX;
}

export function queueTransaction(transaction) {
    state.pendingTransactions.push(transaction);
    logger.info('Transaction queued', {
        sender: transaction.sender.address,
        behavior: transaction.behavior,
        queueLength: state.pendingTransactions.length,
        activeTransactions: state.activeTransactions
    });
}

export function startTransaction() {
    state.activeTransactions++;
    return state.activeTransactions;
}

export function completeTransaction() {
    state.activeTransactions--;
    return state.activeTransactions;
}

export function getNextPendingTransaction() {
    if (state.pendingTransactions.length > 0) {
        return state.pendingTransactions.shift();
    }
    return null;
}

export function hasPendingTransactions() {
    return state.pendingTransactions.length > 0;
}

export function reset() {
    state.activeTransactions = 0;
    state.pendingTransactions = [];
}

export function getState() {
    return {
        activeTransactions: state.activeTransactions,
        pendingTransactions: state.pendingTransactions.length
    };
}

export function updateConcurrentLimit(newLimit) {
    const oldLimit = state.config.CONCURRENT_TX;
    state.config.CONCURRENT_TX = newLimit;

    logger.info('Concurrent transaction limit updated', {
        oldLimit,
        newLimit,
        currentActive: state.activeTransactions,
        pendingCount: state.pendingTransactions.length
    });
}