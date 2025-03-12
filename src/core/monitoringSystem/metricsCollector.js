import { Registry, Histogram, Gauge, Counter } from 'prom-client';
import { ethers } from 'ethers';


const registry = new Registry();

const gasPriceGauge = new Gauge({
    name: 'eth_gas_price_gwei',
    help: 'Ethereum gas price in gwei',
    labelNames: ['type'],
    registers: [registry]
});

const txDurationHistogram = new Histogram({
    name: 'eth_tx_duration_seconds',
    help: 'Ethereum transaction duration in seconds',
    buckets: [1, 2, 5, 10, 20, 30, 60],
    registers: [registry]
});

const tpsGauge = new Gauge({
    name: 'eth_transactions_per_second',
    help: 'Transaction throughput (transactions per second)',
    labelNames: ['type'],
    registers: [registry]
});

const txCounter = new Counter({
    name: 'eth_transactions_total',
    help: 'Total number of transactions',
    registers: [registry]
});

const txTimeWindow = {
    startTime: Date.now(),
    transactions: 0,
    lastCalculationTime: Date.now()
};

const TPS_CALCULATION_INTERVAL = 10 * 60 * 1000;

function recordGasPrice(value, type) {
    const gweiValue = Number(ethers.formatUnits(value, 'gwei'));
    gasPriceGauge.set({ type }, gweiValue);
}

function recordDuration(durationMs) {
    txDurationHistogram.observe(durationMs / 1000);
}

function recordTransaction() {
    txCounter.inc();
    txTimeWindow.transactions++;
    
    const now = Date.now();
    
    if (now - txTimeWindow.lastCalculationTime >= TPS_CALCULATION_INTERVAL) {
        const windowDurationSeconds = (now - txTimeWindow.startTime) / 1000;
        const currentTps = txTimeWindow.transactions / windowDurationSeconds;
        
        tpsGauge.set({ type: 'current_tps' }, currentTps);
        
        console.log(`\n=== TPS Report ===`);
        console.log(`Time window: ${(windowDurationSeconds / 60).toFixed(2)} minutes`);
        console.log(`Total transactions: ${txTimeWindow.transactions}`);
        console.log(`Current TPS: ${currentTps.toFixed(2)}`);
        
        txTimeWindow.startTime = now;
        txTimeWindow.transactions = 0;
        txTimeWindow.lastCalculationTime = now;
    }
}

async function getMetrics() {
    return await registry.metrics();
}

export {
    recordGasPrice,
    recordDuration,
    recordTransaction,
    getMetrics
}; 