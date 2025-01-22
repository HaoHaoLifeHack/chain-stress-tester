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
1. **Create Test Accounts:**
```Shell
node src/scripts/initAccounts.js
```
This will create 100 test accounts and save them to `./data/accounts.json`.

2. **Fund the master wallet:**
```Shell
node src/scripts/fundMasterAccount.js
```

3. **Fund test accounts:**
```Shell
node src/scripts/fundTestAccounts.js
```

4. **Configure Test Settings:**
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
    DURATION: 60000,          // Total simulation duration (ms)
    ETH_TRANSFER_AMOUNT: '0.000001', // Amount of ETH per transfer
    BATCH_SIZE: 10,           // Number of transactions per batch
    BATCH_INTERVAL: 100,      // Interval between batches (ms)
    WAIT_CONFIRMATION: true,  // Whether to wait for transaction confirmation
    LOG_INTERVAL: 2000        // Interval between logging stats (ms)
}
```
## Run
1. **Execute Tests:**

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
│   ├── data/           # Data files
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
