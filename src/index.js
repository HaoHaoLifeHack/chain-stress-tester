import 'dotenv/config';
import { runSimulation } from './core/simulationRunner.js';
import { logger } from './utils/logger.js';
import { CONFIG } from './config/simulation.config.js';

const main = async () => {
    try {
        logger.info('Starting chain stress test', {
            config: {
                batchSize: CONFIG.SIMULATION.BATCH_SIZE,
                duration: CONFIG.SIMULATION.DURATION,
                complexity: CONFIG.SIMULATION.DEFAULT_COMPLEXITY
            }
        });

        await runSimulation();

    } catch (error) {
        logger.error('Stress test failed', { error: error.message });
        process.exit(1);
    }
};

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('Unhandled error', { error: error.message });
        process.exit(1);
    });
} 