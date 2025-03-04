import 'dotenv/config';
import { runSimulation } from './core/simulationRunner.js';
import { logger } from './utils/logger.js';
import { CONFIG } from './config/simulation.config.js';

async function main() {
    try {
        logger.info('Starting chain stress test', {
            config: {
                CONCURRENT_TX: CONFIG.SIMULATION.CONCURRENT_TX,
                TX_INTERVAL: CONFIG.SIMULATION.TX_INTERVAL,
                TX_TIMEOUT: CONFIG.SIMULATION.TX_TIMEOUT,
                complexity: CONFIG.SIMULATION.DEFAULT_COMPLEXITY
            }
        });

        await runSimulation();

    } catch (error) {
        logger.error('Stress test failed', { error: error.message });
        process.exit(1);
    }
}

main();