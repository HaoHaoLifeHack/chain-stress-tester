import { Registry, Histogram, Gauge } from 'prom-client';
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

function recordGasPrice(value, type) {
    const gweiValue = Number(ethers.formatUnits(value, 'gwei'));
    gasPriceGauge.set({ type }, gweiValue);
}

function recordDuration(durationMs) {
    txDurationHistogram.observe(durationMs / 1000);
}

async function getMetrics() {
    return await registry.metrics();
}

export {
    recordGasPrice,
    recordDuration,
    getMetrics
}; 