export const CONFIG = {
    CREATE_ACCOUNT:{
        ACCOUNT_COUNT: 100,
        INITIAL_FUND: '0.1', // ETH
    },
    SIMULATION: {
        DEFAULT_COMPLEXITY: 50, // 0-100
        ETH_TRANSFER_AMOUNT: '0.00001', // ETH
        BATCH_SIZE: 5,          // tx count per batch
        BATCH_INTERVAL: 1000,    // ms
        SKIP_WAIT_CONFIRMATION: false, 
        LOG_INTERVAL: 2000, // ms
        GROUP_SIZE: 3, // for rotation mechanism
    },
    MockUSDCAddress: '0x54215708FedF1B616E7b9db310f2F3F11Fc8Cf18'
}; 