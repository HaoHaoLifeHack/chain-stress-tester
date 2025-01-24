import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import { createAccounts } from '../scripts/initAccounts.js';
import { logger } from './logger.js';
import { ethers } from 'ethers';
import { CONFIG } from '../config/simulation.config.js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadAccounts() {
    const accountsPath = path.join(__dirname, '../data/accounts.json');
    const accountCount = CONFIG.CREATE_ACCOUNT.ACCOUNT_COUNT;

    // Check if accountCount exceeds 100
    if (accountCount > 100) {
        logger.error('Account count exceeds the maximum limit of 100.');
        throw new Error('Account count exceeds the maximum limit of 100.');
    }

    try {
        let accounts;
        if (fs.existsSync(accountsPath)) {
            accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
            accounts = accounts.slice(0, accountCount);
            logger.info('Loaded existing accounts', { count: accounts.length });     
        } else {
            logger.info('Accounts file not found. Creating new accounts...');
            accounts = await createAccounts(accountCount);
            logger.info('Successfully created new accounts', { count: accounts.length });
        }

        const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
        const signers = accounts.map(account => {
            return new ethers.Wallet(account.privateKey, provider);
        });
        
        logger.info('Successfully created signers', { count: signers.length });
        return signers;
        
    } catch (error) {
        logger.error('Error loading/creating accounts', { error: error.message });
        throw error;
    }
}