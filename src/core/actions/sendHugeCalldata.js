import { logger } from '../../utils/logger.js';
import { getFeeDataWithRetry } from '../../utils/rpcUtils.js';

export async function sendHugeCalldata(sender, receiver) {
    try {
        // Generate random calldata in 100KB to 127KB (Limit: 128KB)
        const size = Math.floor(Math.random() * (127 - 100 + 1) + 100) * 1024;
        const hugeData = '0x' + '00'.repeat(size);
        const feeData = await getFeeDataWithRetry(sender.provider);
        const tx = await sender.sendTransaction({
            to: receiver.address,
            data: hugeData,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        });
        return tx;
    } catch (error) {
        logger.error('Huge calldata transaction failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
            }
        });
        throw error;
    }
}

