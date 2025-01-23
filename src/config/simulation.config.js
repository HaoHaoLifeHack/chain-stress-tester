export const CONFIG = {
    CREATE_ACCOUNT:{
        ACCOUNT_COUNT: 100,
        INITIAL_FUND: '0.1', // ETH
    },
    SIMULATION: {
        DEFAULT_COMPLEXITY: 50, // 0-100
        DURATION: 60000, // ms
        ETH_TRANSFER_AMOUNT: '0.000001', // ETH
        BATCH_SIZE: 30,          // 每批次 30 筆交易
        BATCH_INTERVAL: 1000,    // 每秒執行一次批次
        WAIT_CONFIRMATION: false, // 不等待確認，允許並行執行
        LOG_INTERVAL: 2000, // ms
    },
    MockUSDCAddress: '0x43d2f72548db94734f12bEE3676B0f7eF9A68ffC'
}; 