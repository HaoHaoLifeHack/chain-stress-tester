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

// Mutually used console format
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? serializeBigInt(meta) : ''}`;
    })
);

const serializeBigInt = (obj) => {
    return JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
        , 2);
};

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
        }),
        new winston.transports.Console({
            format: consoleFormat
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
        }),
        new winston.transports.Console({
            format: consoleFormat
        })
    ]
});
