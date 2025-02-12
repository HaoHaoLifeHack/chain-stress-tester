import express from 'express';
import { getMetrics } from '../metrics/collector.js';
import { runSimulation, stopCurrentSimulation } from '../core/simulationRunner.js';
import { CONFIG } from '../config/simulation.config.js';

const app = express();
app.use(express.json());

let simulationRunning = false;
let simulationProcess = null;

const handleSimulation = async (req, res) => {
    const { method, params = [] } = req.body;
    const [batchSize, batchInterval, complexityLevel, accountCount, groupSize] = params;

    if (method === 'start') {
        if (simulationRunning) {
            return res.status(400).json({ message: 'Simulation is already running' });
        }

        if (batchSize !== undefined) CONFIG.SIMULATION.BATCH_SIZE = batchSize;
        if (batchInterval !== undefined) CONFIG.SIMULATION.BATCH_INTERVAL = batchInterval;
        if (complexityLevel !== undefined) CONFIG.SIMULATION.DEFAULT_COMPLEXITY = complexityLevel;
        if (accountCount !== undefined) CONFIG.CREATE_ACCOUNT.ACCOUNT_COUNT = accountCount;
        if (groupSize !== undefined) CONFIG.SIMULATION.GROUP_SIZE = groupSize;

        simulationRunning = true;
        simulationProcess = runSimulation()
            .then(() => {
                simulationRunning = false;
            })
            .catch(error => {
                console.error('Simulation error:', error);
                simulationRunning = false;
            });

        return res.status(200).json({ message: 'Simulation started' });
    }

    if (method === 'stop') {
        if (!simulationRunning) {
            return res.status(400).json({ message: 'No simulation is running' });
        }

        stopCurrentSimulation();
        simulationRunning = false;
        return res.status(200).json({ message: 'Simulation stopped' });
    }

    return res.status(400).json({ message: 'Invalid method' });
};

const handleMetrics = async (req, res) => {
    res.set('Content-Type', 'text/plain');
    const metrics = await getMetrics();
    res.send(metrics);
};

const setupRoutes = () => {
    app.post('/simulation', handleSimulation);
    app.get('/metrics', handleMetrics);
};

const startServer = (port = 3000) => {
    setupRoutes();
    
    return new Promise((resolve) => {
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            console.log(`Metrics endpoint: http://localhost:${port}/metrics`);
            resolve();
        });
    });
};

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export { startServer }; 