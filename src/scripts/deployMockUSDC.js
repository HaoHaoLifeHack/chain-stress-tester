import 'dotenv/config';
import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { loadContractJson } from '../utils/contractLoader.js';

async function deployMockUSDC() {
    try {
        const mockUSDCJson = await loadContractJson('MockUSDC');
        const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
        const wallet = new ethers.Wallet(process.env.PERSONAL_PRIVATE_KEY, provider);

        console.log('Deploying MockUSDC...');
        const factory = new ethers.ContractFactory(
            mockUSDCJson.abi,
            mockUSDCJson.bytecode,
            wallet
        );

        const contract = await factory.deploy(wallet.address);
        await contract.waitForDeployment();

        const address = await contract.getAddress();

        console.info('MockUSDC deployed', {
            address: address,
            deployer: wallet.address,
            txHash: contract.deploymentTransaction().hash
        });

        return address;
    } catch (error) {
        logger.error('Deployment failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

deployMockUSDC().catch(console.error);