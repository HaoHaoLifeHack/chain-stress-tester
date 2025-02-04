import { logger } from '../../utils/logger.js';

export async function transferERC20Token(sender, receiver, tokenContract, amount) {
    try {
        const balance = await tokenContract.balanceOf(sender.address);
        if (balance < amount) {
            const faucetTx = await tokenContract.connect(sender).faucet(sender.address);
            await faucetTx.wait(1);
        }

        return await tokenContract.connect(sender).transfer(receiver.address, amount);

    } catch (error) {
        logger.error('ERC20 token transfer failed', {
            error: error.message,
            code: error.code,
            transaction: {
                from: sender?.address,
                to: receiver?.address,
                amount: amount.toString()
            }
        });
        throw error;
    }
}