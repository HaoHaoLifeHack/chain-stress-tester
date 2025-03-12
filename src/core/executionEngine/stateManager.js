const state = {
    stopSimulation: false,
    totalTx: 0,
    successTx: 0,
    failedTx: 0,
    startTime: null,
    lastLogTime: null,
    firstTxTime: null,
    config: null
};

export function initialize(config) {
    state.config = config;
    return state;
}

export function startSimulation() {
    state.stopSimulation = false;
    state.startTime = Date.now();
    state.lastLogTime = Date.now();
    return { startTime: state.startTime };
}

export function stopSimulation() {
    state.stopSimulation = true;
}

export function shouldStop() {
    return state.stopSimulation;
}

export function incrementTotalTx() {
    state.totalTx++;
    return state.totalTx;
}

export function incrementSuccessTx() {
    state.successTx++;
    return state.successTx;
}

export function incrementFailedTx() {
    state.failedTx++;
    return state.failedTx;
}

export function setFirstTxTime() {
    if (!state.firstTxTime) {
        state.firstTxTime = Date.now();
        return true;
    }
    return false;
}

export function shouldLogStats() {
    const currentTime = Date.now();
    if (currentTime - state.lastLogTime >= state.config.LOG_INTERVAL) {
        state.lastLogTime = currentTime;
        return true;
    }
    return false;
}

export function getStats() {
    return {
        totalTx: state.totalTx,
        successTx: state.successTx,
        failedTx: state.failedTx,
        activeTime: (Date.now() - state.startTime) / 1000,
        firstTxTime: state.firstTxTime ?
            `${(state.firstTxTime - state.startTime) / 1000}s` : 'N/A'
    };
}

export function reset() {
    state.stopSimulation = false;
    state.totalTx = 0;
    state.successTx = 0;
    state.failedTx = 0;
    state.startTime = null;
    state.lastLogTime = null;
    state.firstTxTime = null;
}
