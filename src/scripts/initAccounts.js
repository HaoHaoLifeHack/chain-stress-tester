import 'dotenv/config';
import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config/simulation.config.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
const masterWallet = ethers.Wallet.fromPhrase(process.env.SEED_PHRASE, provider);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createAccounts() {
    const accounts = [];
    const hdNode = ethers.HDNodeWallet.fromPhrase(process.env.SEED_PHRASE);
    let nonce = await provider.getTransactionCount(masterWallet.address);

    for (let i = 0; i < CONFIG.CREATE_ACCOUNT.ACCOUNT_COUNT; i++) {
        const childNode = hdNode.deriveChild(i);
        const childWallet = new ethers.Wallet(childNode.privateKey, provider);
        accounts.push({
            address: childWallet.address,
            privateKey: childWallet.privateKey
        });

        try {
            const tx = {
                to: childWallet.address,
                value: ethers.parseEther(CONFIG.CREATE_ACCOUNT.INITIAL_FUND),
                nonce: nonce++,
                maxFeePerGas: ethers.parseUnits(2, 'gwei'),
                maxPriorityFeePerGas: ethers.parseUnits(1, 'gwei')
            };

            const txResponse = await masterWallet.sendTransaction(tx);
            await txResponse.wait();

            logger.info('Account created', {
                index: i,
                address: childWallet.address,
                txHash: txResponse.hash
            });
            console.log(`✅ Account ${childWallet.address} created`);
            await sleep(100);
        } catch (error) {
            console.error(`❌ Error creating account ${childWallet.address}: ${error.message}`);
            logger.error('Error funding account', {
                index: i,
                address: childWallet.address,
                error: error.message
            });
            await sleep(1000);
        }
    }

    await fs.writeFileSync(
        path.join(__dirname, '../data/accounts.json'), 
        JSON.stringify(accounts, null, 2)
    );

    return accounts;
}

export { createAccounts, masterWallet }; 

if (import.meta.url === `file://${process.argv[1]}`) {
    createAccounts().then(accounts => {
        logger.info('All accounts created successfully', {
            totalAccounts: accounts.length,
            masterWallet: masterWallet.address,
            childAddresses: accounts.map(acc => acc.address)
        });
    }).catch(error => {
        logger.error('Error creating accounts', { error: error.message });
    });
}