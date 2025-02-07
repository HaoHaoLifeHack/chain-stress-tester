import { ethers } from 'ethers';
import { logger } from './logger.js';
import { getFeeDataWithRetry } from './rpcUtils.js';
import { CONFIG } from '../config/simulation.config.js';
import 'dotenv/config';


const accountLocks = new Map();

async function acquireAccountLock(address) {
    while (accountLocks.get(address)) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    accountLocks.set(address, true);
}

async function releaseAccountLock(address) {
    accountLocks.delete(address);
}


async function ensureSufficientBalance(sender, provider, mainAccount, threshold = ethers.parseEther('0.01')) {
    const balance = await provider.getBalance(sender.address);
    if (balance < threshold) {
        try {
            await acquireAccountLock(mainAccount.address);
            const feeData = await getFeeDataWithRetry(sender.provider);
            const tx = {
                to: sender.address,
                value: threshold,
                gasLimit: 21000,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            };

            const txResponse = await mainAccount.sendTransaction(tx);
            await txResponse.wait();

            logger.info('Balance topped up', {
                address: sender.address,
                amount: threshold,
                txHash: txResponse.hash
            });
        } finally {
            releaseAccountLock(mainAccount.address);
        }
    }
}

async function loadAccounts() {
    const accountCount = CONFIG.CREATE_ACCOUNT.ACCOUNT_COUNT;

    try {
        const mnemonic = process.env.SEED_PHRASE;
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

export {
    loadAccounts,
    acquireAccountLock,
    releaseAccountLock,
    ensureSufficientBalance
}; 