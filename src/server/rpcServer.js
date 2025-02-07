import express from 'express';
import { runSimulation, stopCurrentSimulation } from '../core/simulationRunner.js';
import { CONFIG } from '../config/simulation.config.js';

const app = express();
app.use(express.json());

let simulationRunning = false;
let simulationProcess = null;

app.post('/simulation', (req, res) => {
    const { method, params = [] } = req.body;
    const [batchSize, batchInterval, complexityLevel, accountCount, groupSize] = params;

    if (method === 'start') {
        if (simulationRunning) {
            return res.status(400).json({ message: 'Simulation is already running' });
        }

        // Update configuration based on request
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

        // Stop the simulation
        stopCurrentSimulation();
        simulationRunning = false;

        return res.status(200).json({ message: 'Simulation stopped' });
    }

    return res.status(400).json({ message: 'Invalid method' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`RPC Server running on port ${PORT}`);
}); 