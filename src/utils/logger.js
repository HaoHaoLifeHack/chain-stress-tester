import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Clear log files
const logFiles = ['error.log', 'combined.log'];
logFiles.forEach(file => {
    const logPath = path.join(logsDir, file);
    if (fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '');
    }
});

// Main logger for other operations
export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error'
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log')
        })
    ]
});

// Create separate logger for simulation results
export const simulationLogger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'simulation.log'),
            options: { flags: 'a' }
        })
    ]
});
