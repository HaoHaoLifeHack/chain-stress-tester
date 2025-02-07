import 'dotenv/config';
import { ethers } from 'ethers';
import { loadAccounts } from '../utils/accountHandler.js';

async function fundTestAccounts() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
        const masterWallet = ethers.Wallet.fromPhrase(process.env.SEED_PHRASE, provider);

        const testAccounts = await loadAccounts();
        console.log(`Loaded ${testAccounts.length} test accounts`);
        
        const masterBalance = await provider.getBalance(masterWallet.address);
        
        console.log(`\nMaster wallet address: ${masterWallet.address}`);
        console.log(`Master wallet balance: ${ethers.formatEther(masterBalance)} ETH\n`);

        const fundAmount = ethers.parseEther('0.01'); 
        
        const totalRequired = fundAmount * BigInt(testAccounts.length);
        if (masterBalance < totalRequired) {
            throw new Error(`Insufficient funds in master wallet. Required: ${ethers.formatEther(totalRequired)} ETH`);
        }

        console.log('Starting to fund test accounts...\n');
        
        const batchSize = 20;
        let currentNonce = await provider.getTransactionCount(masterWallet.address);


        for (let i = 0; i < testAccounts.length; i += batchSize) {
            const batch = testAccounts.slice(i, i + batchSize);

            for (const account of batch) {
                try {
                    const currentBalance = await provider.getBalance(account.address);
                    if (currentBalance < fundAmount) {
                        const tx = await masterWallet.sendTransaction({
                            to: account.address,
                            value: fundAmount - currentBalance,
                            nonce: currentNonce++  
                        });

                        await tx.wait(1);
                        console.log(`✅ Funded ${ethers.formatEther(fundAmount - currentBalance)} ETH to ${account.address}`);
                    } else {
                        console.log(`ℹ️ Account ${account.address} already has sufficient funds`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`❌ Failed to fund account ${account.address}: ${error.message}`);
                }
            }

            console.log(`\nCompleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testAccounts.length / batchSize)}\n`);

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const finalMasterBalance = await provider.getBalance(masterWallet.address);
        console.log('\n=== Funding Complete ===');
        console.log(`Master wallet remaining balance: ${ethers.formatEther(finalMasterBalance)} ETH`);
        console.log(`Total accounts funded: ${testAccounts.length}`);
        console.log(`ETH per account: ${ethers.formatEther(fundAmount)} ETH`);
        
    } catch (error) {
        console.error('Failed to fund test accounts:', error);
        process.exit(1);
    }
}

fundTestAccounts().catch(console.error);
