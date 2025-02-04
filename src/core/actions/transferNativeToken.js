import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { getFeeDataWithRetry } from '../../utils/rpcUtils.js';

export async function transferNativeToken(sender, receiver, amount) {
    try {
        const feeData = await getFeeDataWithRetry(sender.provider);
        const tx = {
            to: receiver.address,
            value: ethers.parseEther(amount),
            gasLimit: 21000,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        };
        return await sender.sendTransaction(tx);
    } catch (error) {
        logger.error('Native token transfer failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
                amount: amount
            }
        });
        throw error;
    }
}
