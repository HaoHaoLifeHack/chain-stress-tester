export const CONFIG = {
    CREATE_ACCOUNT:{
        ACCOUNT_COUNT: 100,
        INITIAL_FUND: '0.1', // ETH
    },
    SIMULATION: {
        DEFAULT_COMPLEXITY: 50, // 0-100
        ETH_TRANSFER_AMOUNT: '0.000001', // ETH
        BATCH_SIZE: 5,          // tx count per batch
        BATCH_INTERVAL: 1000,    // ms
        WAIT_CONFIRMATION: false, 
        LOG_INTERVAL: 2000, // ms
    },
    MockUSDCAddress: '0x43d2f72548db94734f12bEE3676B0f7eF9A68ffC'
}; 