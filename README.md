# Blockchain Stress Testing Framework

## Overview
A flexible framework for conducting stress tests on blockchain networks, featuring:
- Multi-account transaction simulation
- Configurable test scenarios
- Real-time performance monitoring
- Support for various transaction types (Native, ERC20, Contract Deployment)

## Setup Environment
1. **Clone the Repository**

   Clone this repository to your local machine using the following command:

   ```Shell
   git clone https://github.com/HaoHaoLifeHack/chain-stress-tester
   cd chain-stress-tester
   ```

2. **Configure Environment Variables**
   Copy the `.env.example` file to `.env` and fill in the necessary environment variables:

   ```Shell
   cp .env.example .env
   ```
   ```
    SEED_PHRASE=<YOUR_SEED_PHRASE>
    DEVCHAIN_ENDPOINT_URL=<YOUR_RPC_ENDPOINT>
    PERSONAL_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
   ```

3. **Install dependencies:**
```Shell
npm install
```

## Initialize
1. **Compile contracts:**
```Shell
npx hardhat compile
```

2. **Create Test Accounts:**
```Shell
node src/scripts/initAccounts.js
```
This will create 100 test accounts.

3. **Fund Main Account:**
```Shell
node src/scripts/fundMainAccount.js
```

4. **Fund test accounts:**
```Shell
node src/scripts/fundTestAccounts.js
```

5. **Configure Test Settings:**
Customize your test scenarios in `config/simulation.config.js`:

#### Account Creation Settings
```javascript
CREATE_ACCOUNT: {
    ACCOUNT_COUNT: 100,        // Number of test accounts to create
    INITIAL_FUND: '0.1',       // Initial ETH amount for each account
}
```

#### Simulation Settings
```javascript
SIMULATION: {
    DEFAULT_COMPLEXITY: 50,     // 0-100: Higher values increase huge calldata probability
    ETH_TRANSFER_AMOUNT: '0.000001', // Amount of ETH per transfer
    CONCURRENT_TX: 100, // Number of transactions to execute concurrently
    TX_INTERVAL: 5000, // Interval between transactions (ms)
    TX_TIMEOUT: 30000, // Transaction timeout (ms)
    SKIP_WAIT_CONFIRMATION: false,  // Whether to skip waiting for transaction confirmation
    LOG_INTERVAL: 2000        // Interval between logging stats (ms)
}
```
## Run
1. **Execute Stress Testing:**

```Shell
npm start
```
This will run the simulation and log the results.

2. **View Results:**
The simulation results are displayed in the console real-time, and detailed logs are stored in `./logs/simulation.log`.

3. **Debugging:**
If you encounter issues, check the output for error messages in `./logs/error.log` and ensure your environment variables and configurations are suitable.

## Additional Information

### Project Structure
```
chain-stress-tester/
├── contracts/          # Test contracts
├── logs/               # Log files
├── src/
│   ├── config/         # Configuration files
│   ├── core/           # Core functionality
│   ├── scripts/        # Executable scripts
│   └── utils/          # Utility functions
```

### Key Components
- **Behavior Executor** (`src/core/behaviorExecutor.js`): 
  - Executes blockchain transactions (Native transfer, ERC20 transfer, Send huge calldata)
  - Handles transaction signing and nonce management
  - Manages error handling and retries

- **Simulation Runner** (`src/core/simulationRunner.js`):
  - Coordinates test accounts and transaction patterns
  - Tracks performance metrics (TPS, success rates)
  - Generates real-time test reports

## Run RPC Server
1. **Start the server:**
```Shell
node src/server/rpcServer.js
```

2. **Start Simulation:**
```Shell
# Sample
# params: [batchSize, batchInterval, complexityLevel, accountCount]
curl -X POST http://localhost:3000/simulation \
-H "Content-Type: application/json" \
-d '{
    "method": "start",
    "params": [10, 1000, 10, 50],
}'
```

3. **Stop Simulation:**
```Shell
# Sample
curl -X POST http://localhost:3000/simulation \
-H "Content-Type: application/json" \
-d '{
    "method": "stop",
}'
```