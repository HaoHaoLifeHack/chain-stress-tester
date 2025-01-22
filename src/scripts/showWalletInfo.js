import 'dotenv/config';
import { ethers } from 'ethers';

async function showMasterWalletInfo() {
    // Connect to the gudchain
    const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
    
    // Get the master wallet from the seed phrase
    const masterWallet = ethers.Wallet.fromPhrase(process.env.SEED_PHRASE, provider);
    
    // Get the balance
    const balance = await provider.getBalance(masterWallet.address);
    
    console.log('=== Master wallet info ===');
    console.log(`Address: ${masterWallet.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    
    return masterWallet.address;
}

showMasterWalletInfo().catch(console.error); 