export const CONFIG = {
    CREATE_ACCOUNT: {
        ACCOUNT_COUNT: 5001,
        INITIAL_FUND: '0.3', // ETH
    },
    SIMULATION: {
        DEFAULT_COMPLEXITY: 20, // 0-100
        ETH_TRANSFER_AMOUNT: '0.00001', // ETH
        SKIP_WAIT_CONFIRMATION: false,
        LOG_INTERVAL: 2000, // ms
        GROUP_SIZE: 4, // for rotation
        CONCURRENT_TX: 100, // Number of transactions to execute concurrently
        TX_INTERVAL: 5000, // Interval between transactions (ms)
        TX_TIMEOUT: 30000, // Transaction timeout (ms)
    },
    MockUSDCAddress: '0x43d2f72548db94734f12bEE3676B0f7eF9A68ffC'
};