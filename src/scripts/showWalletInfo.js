import 'dotenv/config';
import { ethers } from 'ethers';

async function showMasterWalletInfo() {
    // Connect to the gudchain
    const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
    
    // Get the master wallet from the seed phrase
    const masterWallet = ethers.Wallet.fromPhrase(process.env.SEED_PHRASE, provider);
    const childWallet = masterWallet.deriveChild(0);
    
    // Get the balance
    const childBalance = await provider.getBalance(childWallet);
    console.log('=== Account 0 wallet info ===');
    console.log(`Address: ${childWallet.address}`);
    console.log(`Balance: ${ethers.formatEther(childBalance)} ETH`);
    return childWallet.address;
}

showMasterWalletInfo().catch(console.error); 