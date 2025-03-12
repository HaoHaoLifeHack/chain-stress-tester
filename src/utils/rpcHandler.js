import { logger } from './logger.js';

async function withRetry(operation, options = {}) {
    const {
        retryCount = 1,
        delayMs = 3000,
        timeoutMs = 5000,
        operationName = 'RPC call'
    } = options;

    try {
        const operationPromise = operation();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('RPC request timeout')), timeoutMs);
        });

        return await Promise.race([operationPromise, timeoutPromise]);

    } catch (error) {
        const errorType = 
            error.message.includes('timeout') ? 'TIMEOUT' :
            error.message.includes('network') ? 'NETWORK' :
            error.code === 'SERVER_ERROR' ? 'SERVER' :
            'UNKNOWN';

        logger.warn(`${operationName} failed`, {
            errorType,
            error: error.message,
            retriesLeft: retryCount
        });

        if (retryCount > 0) {
            logger.info(`Retrying ${operationName} in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return withRetry(operation, {
                ...options,
                retryCount: retryCount - 1
            });
        }

        logger.error(`${operationName} failed after all retries`, {
            errorType,
            error: error.message
        });
        throw new Error(`RPC error (${errorType}): ${error.message}`);
    }
}

async function getBlockWithRetry(provider) {
    return withRetry(
        () => provider.getBlock('latest'),
        { operationName: 'getBlock' }
    );
}

async function getFeeDataWithRetry(provider) {
    return withRetry(
        () => provider.getFeeData(),
        { operationName: 'getFeeData' }
    );
}

async function getAccountNonceWithRetry(provider, account) {
    return withRetry(
        () => provider.getTransactionCount(account.address, 'latest'),
        { operationName: 'getAccountNonce' }
    );
}

export { withRetry, getBlockWithRetry, getFeeDataWithRetry, getAccountNonceWithRetry }; 