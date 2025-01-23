import 'dotenv/config';
import { ethers } from 'ethers';

async function fundMainAccount() {
    try {
        // Connect to the gudchain
        const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
        
        // Main account (receiver)
        const hdNode = ethers.HDNodeWallet.fromPhrase(process.env.SEED_PHRASE);
        const childNode = hdNode.deriveChild(0);
        const mainAccount = new ethers.Wallet(childNode.privateKey, provider);

        // Personal wallet (sender)
        const personalWallet = new ethers.Wallet(process.env.PERSONAL_PRIVATE_KEY, provider);
        
        // Check the sender's balance
        const balance = await provider.getBalance(personalWallet.address);
        console.log(`Your wallet balance: ${ethers.formatEther(balance)} ETH`);
        
        // Send transaction
        const tx = await personalWallet.sendTransaction({
            to: mainAccount.address,
            value: ethers.parseEther('100') // Transfer 10 ETH
        });
        
        console.log('Transaction sent, waiting for confirmation...');
        console.log(`Transaction hash: ${tx.hash}`);
        
        // Wait for transaction confirmation
        await tx.wait();
        
        // Confirm new balance
        const newBalance = await provider.getBalance(mainAccount.address);
        console.log(`Transfer successful!`);
        console.log(`Main account new balance: ${ethers.formatEther(newBalance)} ETH`);
        
    } catch (error) {
        console.error('Transfer failed:', error.message);
    }
}

fundMainAccount().catch(console.error); 