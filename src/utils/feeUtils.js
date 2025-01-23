import { ethers } from 'ethers';
import { logger } from './logger.js';

export async function getFeeData() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.DEVCHAIN_ENDPOINT_URL);
        const feeData = await provider.getFeeData();
        const {
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas
        } = feeData;

        const block = await provider.getBlock('latest');
        const baseFee = block.baseFeePerGas;

        return {
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas,
            baseFee
        };
    } catch (error) {
        logger.error('Error getting fee data', { error: error.message });
        throw error;
    }
}