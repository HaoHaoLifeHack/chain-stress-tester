import express from 'express';
import { getMetrics } from '../core/monitoringSystem/metricsCollector.js';
import { runSimulation, stopCurrentSimulation } from '../core/simulationRunner.js';
import { initializeConfig, updateSimulationConfigInRuntime, getCurrentConfig } from '../config/configManager.js';
const app = express();
app.use(express.json());

let simulationRunning = false;
let simulationProcess = null;

const handleSimulation = async (req, res) => {
    const { method, params = [] } = req.body;

    if (method === 'start') {
        if (simulationRunning) {
            return res.status(400).json({ message: 'Simulation is already running' });
        }

        initializeConfig(params);
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
        setTimeout(() => {
            simulationRunning = false;
        }, 10000);
        
        return res.status(200).json({ message: 'Simulation stopping...' });
    }

    if (method === 'updateParams') {
        try {
            updateSimulationConfigInRuntime(params);
            return res.status(200).json({
                message: 'Parameters will be updated in next transaction',
                newConfig: getCurrentConfig()
            });
        } catch (error) {
            return res.status(500).json({ 
                message: 'Failed to update parameters',
                error: error.message 
            });
        }
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