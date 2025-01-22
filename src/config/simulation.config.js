export const CONFIG = {
    CREATE_ACCOUNT:{
        ACCOUNT_COUNT: 100,
        INITIAL_FUND: '0.1', // ETH
    },
    SIMULATION: {
        DEFAULT_COMPLEXITY: 50, // 0-100
        DURATION: 60000, // ms
        ETH_TRANSFER_AMOUNT: '0.000001', // ETH
        BATCH_SIZE: 10, // tx sent per batch
        BATCH_INTERVAL: 1000, // ms
        WAIT_CONFIRMATION: true, // false: skip wait confirmation; true: wait confirmation
        LOG_INTERVAL: 2000, // ms
    },
    MockUSDCAddress: '0x43d2f72548db94734f12bEE3676B0f7eF9A68ffC'
}; 