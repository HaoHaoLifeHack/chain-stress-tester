import 'dotenv/config';
import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config/simulation.config.js';
import { getFeeDataWithRetry } from '../utils/rpcUtils.js';


const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
const masterWallet = ethers.Wallet.fromPhrase(process.env.SEED_PHRASE, provider);
const personalWallet = ethers.Wallet.fromPhrase(process.env.PERSONAL_SEED_PHRASE, provider);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createAccounts() {
    const accounts = [];
    const hdNode = ethers.HDNodeWallet.fromPhrase(process.env.SEED_PHRASE);

    // Fund master wallet
    const tx = await personalWallet.sendTransaction({
        to: masterWallet.address,
        value: ethers.parseEther("0.1"),
    });

    await tx.wait();
    console.log(`✅ Master wallet init funded`);

    let nonce = await provider.getTransactionCount(masterWallet.address);

    for (let i = 0; i < CONFIG.CREATE_ACCOUNT.ACCOUNT_COUNT; i++) {
        const childNode = hdNode.deriveChild(i);
        const childWallet = new ethers.Wallet(childNode.privateKey, provider);
        accounts.push({
            address: childWallet.address,
            privateKey: childWallet.privateKey
        });

        try {
            const feeData = await getFeeDataWithRetry(provider);
            const tx = {
                to: childWallet.address,
                value: ethers.parseEther(CONFIG.CREATE_ACCOUNT.INITIAL_FUND),
                nonce: nonce++,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
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