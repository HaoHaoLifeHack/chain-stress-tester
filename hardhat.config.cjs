require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {},
    devchain: {
      url: process.env.DEVCHAIN_ENDPOINT_URL,
      accounts: [process.env.PERSONAL_PRIVATE_KEY]
    }
  }
}; 