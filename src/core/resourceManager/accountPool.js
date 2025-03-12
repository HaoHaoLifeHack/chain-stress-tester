import { ensureSufficientBalance, loadAccounts } from '../../utils/accountHandler.js';
import { logger } from '../../utils/logger.js';
import { CONFIG } from '../../config/simulation.config.js';

// Account status enum
const AccountStatus = {
    AVAILABLE: 'available',   // available
    IN_USE: 'in_use',         // in use
    COOLING_DOWN: 'cooling'   // cooling down (waiting for TX_INTERVAL)
};

const state = {
    accounts: [],
    accountPool: new Map(), // use Map to store account status {address => {account, status, releaseTime}}
    fundingAccount: null,   // the first account as funding source
};

// initialize account pool
export async function initialize() {
    try {
        state.accounts = await loadAccounts();
        logger.info(`Loaded ${state.accounts.length} accounts`);
        
        // set funding account (the first account)
        [state.fundingAccount, ...state.accounts] = state.accounts;
        
        // initialize account pool
        state.accounts.forEach(account => {
            state.accountPool.set(account.address, {
                account,
                status: AccountStatus.AVAILABLE,
                releaseTime: 0
            });
        });
        
        logger.info(`Account pool initialized with ${state.accountPool.size} accounts`);
        return state.accounts;
    } catch (error) {
        logger.error('Failed to load accounts', { error: error.message });
        throw error;
    }
}

export async function checkBalances(provider, threshold) {
    try {
        // only check available accounts
        const accounts = Array.from(state.accountPool.values())
            .filter(item => item.status === AccountStatus.AVAILABLE)
            .map(item => item.account);
            
        await Promise.all(
            accounts.map(account =>
                ensureSufficientBalance(account, provider, state.fundingAccount, threshold)
            )
        );
        return true;
    } catch (error) {
        logger.error('Balance check failed', { error: error.message });
        throw error;
    }
}

// Get an available account
export function getAvailableAccount() {
    // update cooling down account status
    const now = Date.now();
    for (const [address, data] of state.accountPool.entries()) {
        if (data.status === AccountStatus.COOLING_DOWN && now >= data.releaseTime) {
            data.status = AccountStatus.AVAILABLE;
        }
    }
    
    // find the first available account
    for (const [address, data] of state.accountPool.entries()) {
        if (data.status === AccountStatus.AVAILABLE) {
            // mark as in use
            data.status = AccountStatus.IN_USE;
            return data.account;
        }
    }
    
    // no available account
    return null;
}

// cooling down
export function releaseAccount(accountAddress) {
    const accountData = state.accountPool.get(accountAddress);
    if (!accountData) {
        logger.warn(`Attempt to release unknown account: ${accountAddress}`);
        return false;
    }
    
    if (accountData.status !== AccountStatus.IN_USE) {
        logger.warn(`Account ${accountAddress} is not in use, current status: ${accountData.status}`);
        return false;
    }
    
    // set to cooling down, and calculate release time
    accountData.status = AccountStatus.COOLING_DOWN;
    accountData.releaseTime = Date.now() + CONFIG.SIMULATION.TX_INTERVAL;
    return true;
}

// get account pool stats
export function getPoolStats() {
    const stats = {
        total: state.accountPool.size,
        available: 0,
        inUse: 0,
        cooling: 0
    };
    
    for (const data of state.accountPool.values()) {
        switch (data.status) {
            case AccountStatus.AVAILABLE:
                stats.available++;
                break;
            case AccountStatus.IN_USE:
                stats.inUse++;
                break;
            case AccountStatus.COOLING_DOWN:
                stats.cooling++;
                break;
        }
    }
    
    return stats;
}

export function reset() {
    state.accounts.forEach(account => {
        state.accountPool.set(account.address, {
            account,
            status: AccountStatus.AVAILABLE,
            releaseTime: 0
        });
    });
}

// Get all accounts
export function getAccounts() {
    return [state.fundingAccount, ...state.accounts];
}

// Get funding account
export function getFundingAccount() {
    return state.fundingAccount;
}
