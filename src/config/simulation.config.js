export const CONFIG = {
    CREATE_ACCOUNT: {
        ACCOUNT_COUNT: 5001,
        INITIAL_FUND: '0.3', // ETH
    },
    SIMULATION: {
        DEFAULT_COMPLEXITY: 20, // 0-100
        ETH_TRANSFER_AMOUNT: '0.00001', // ETH
        BATCH_SIZE: 15,          // tx count per batch
        BATCH_INTERVAL: 2000,    // ms
        SKIP_WAIT_CONFIRMATION: false,
        LOG_INTERVAL: 2000, // ms
        GROUP_SIZE: 4, // for rotation
    },
    MockUSDCAddress: '0x43d2f72548db94734f12bEE3676B0f7eF9A68ffC'
}; 