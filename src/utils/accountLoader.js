import { logger } from './logger.js';
import { ethers } from 'ethers';
import { CONFIG } from '../config/simulation.config.js';
import 'dotenv/config';


export async function loadAccounts() {
    const accountCount = CONFIG.CREATE_ACCOUNT.ACCOUNT_COUNT;

    try {
        const mnemonic = process.env.SEED_PHRASE; // Ensure this is set in your environment variables
        if (!mnemonic) {
            throw new Error('Seed phrase is not defined in environment variables.');
        }

        const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
        const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);

        const signers = [];
        for (let i = 0; i < accountCount; i++) {
            const wallet = hdNode.deriveChild(i).connect(provider);
            signers.push(wallet);
        }

        logger.info('Successfully created signers from seed phrase', { count: signers.length });
        return signers;
        
    } catch (error) {
        logger.error('Error creating accounts from seed phrase', { error: error.message });
        throw error;
    }
}