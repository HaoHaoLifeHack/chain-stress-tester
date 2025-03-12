import { logger } from '../../utils/logger.js';

const state = {
    config: null,
    transactionTypes: []
};

export function initialize(config) {
    state.config = config;
    return state;
}

export function initializeTransactionTypes() {
    const weights = calculateWeights(state.config.DEFAULT_COMPLEXITY);
    const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);

    // calculate the number of each transaction type based on weights
    const numNativeTransfers = Math.round((weights[0] / totalWeight) * state.config.CONCURRENT_TX);
    const numERC20Transfers = Math.round((weights[1] / totalWeight) * state.config.CONCURRENT_TX);
    const numComplexTransactions = state.config.CONCURRENT_TX - numNativeTransfers - numERC20Transfers;

    // create transaction type list
    state.transactionTypes = [
        ...Array(numNativeTransfers).fill(0),
        ...Array(numERC20Transfers).fill(1),
        ...Array(numComplexTransactions).fill(2)
    ];

    shuffleArray(state.transactionTypes);

    logger.info('Transaction types initialized', {
        nativeTransfers: numNativeTransfers,
        erc20Transfers: numERC20Transfers,
        complexTransactions: numComplexTransactions,
        complexityLevel: state.config.DEFAULT_COMPLEXITY
    });
}

// get next transaction type
export function getNextTransactionType() {
    if (state.transactionTypes.length === 0) {
        initializeTransactionTypes();
    }
    return state.transactionTypes.shift();
}

export function reset() {
    state.transactionTypes = [];
}
function shuffleArray(array) {
    const newArray = [...array]; // avoid modifying original array
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export function calculateWeights(complexityLevel) {
    // ensure complexityLevel is between 0-100
    const level = Math.max(0, Math.min(100, complexityLevel));
    // simplest: only transfer ETH
    if (level === 0) return [100, 0, 0];
    // most complex: only complex transactions
    if (level === 100) return [0, 0, 100];

    // dynamic calculate weights
    const nativeTokenTransferWeight = Math.max(0, 100 - level);  // ETH transfer weight
    const erc20TokenTransferWeight = Math.max(0, 50 - Math.abs(50 - level));  // ERC20 token transfer weight
    const hugeCalldataWeight = level;  // complex transactions weight (contract deployment or huge calldata)

    // normalize weights to ensure total is 100
    const total = nativeTokenTransferWeight + erc20TokenTransferWeight + hugeCalldataWeight;
    return [
        Math.round((nativeTokenTransferWeight / total) * 100),
        Math.round((erc20TokenTransferWeight / total) * 100),
        Math.round((hugeCalldataWeight / total) * 100)
    ];
}

export function updateComplexityLevel(newLevel) {
    const oldLevel = state.config.DEFAULT_COMPLEXITY;
    state.config.DEFAULT_COMPLEXITY = newLevel;

    logger.info('Transaction complexity level updated', {
        oldLevel,
        newLevel,
        remainingTransactions: state.transactionTypes.length
    });
}