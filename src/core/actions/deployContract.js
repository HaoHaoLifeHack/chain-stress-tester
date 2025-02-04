import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';

export async function deployContract(sender, abi, bytecode) {
    try {
        const factory = new ethers.ContractFactory(abi, bytecode, sender);
        const contract = await factory.deploy();
        return contract.deploymentTransaction();
    } catch (error) {
        logger.error('Contract deployment failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
            }
        });
        throw error;
    }
}
