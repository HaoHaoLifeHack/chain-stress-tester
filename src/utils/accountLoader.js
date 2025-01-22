import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import { createAccounts } from '../scripts/initAccounts.js';
import { logger } from './logger.js';
import { ethers } from 'ethers';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadAccounts() {
    const accountsPath = path.join(__dirname, '../data/accounts.json');
    
    try {
        let accounts;
        if (fs.existsSync(accountsPath)) {
            accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
            if (accounts.length === 0) {
                logger.info('Accounts file is empty. Creating new accounts...');
                accounts = await createAccounts();
                logger.info('Successfully created new accounts', { count: accounts.length });
            } else {
                logger.info('Loaded existing accounts', { count: accounts.length });
            }
        } else {
            logger.info('Accounts file not found. Creating new accounts...');
            accounts = await createAccounts();
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