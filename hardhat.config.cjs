require('@nomicfoundation/hardhat-toolbox');
require('@openzeppelin/hardhat-upgrades');
require('dotenv/config');

const config = {
  mocha: {
    timeout: 120000,
  },
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || 'https://polygon-amoy.drpc.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    kairos: {
      url: process.env.KAIROS_RPC_URL || 'https://public-en-kairos.node.kaia.io',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1001,
    },
    kaia: {
      url: process.env.KAIA_RPC_URL || 'https://public-en.node.kaia.io',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8217,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
    },
  },
  etherscan: {
    // hardhat-verify 2.x enables the Etherscan v2 multichain API only when
    // apiKey is a single STRING (isV2 = typeof apiKey === 'string'); an object
    // forces the deprecated per-explorer v1 API. Kaia/Kairos use Kaiascan (not
    // Etherscan v2), so use the object form for them and the single v2 key for
    // every other (Etherscan-family) chain — switched by the --network arg.
    apiKey:
      process.argv.includes('kaia') || process.argv.includes('kairos')
        ? {
            kaia: process.env.APIKEY_KAIA || 'unnecessary',
            kairos: process.env.APIKEY_KAIA || 'unset',
          }
        : process.env.ETHERSCAN_API_KEY ||
          process.env.POLYGONSCAN_API_KEY ||
          '',
    customChains: [
      // 'polygon' (chainId 137) is built into hardhat-verify with native
      // Etherscan v2 support (auto-sends chainid) — no customChain needed.
      // A customChain pointing at the v2 apiURL skips chainid injection and
      // fails with "Missing chainid parameter".
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
      {
        network: 'amoy',
        chainId: 80002,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
      {
        network: 'sepolia',
        chainId: 11155111,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api',
          browserURL: 'https://sepolia.etherscan.io',
        },
      },
      {
        network: 'kaia',
        chainId: 8217,
        urls: {
          // Kaiascan's hardhat-verify endpoint (the /oapi/api endpoint rejects
          // verifysourcecode with 400). API key is "unnecessary" per Kaiascan docs.
          apiURL: 'https://compiler-api-v2.kaiascan.io/mainnet/hardhat-verify',
          browserURL: 'https://kaiascan.io',
        },
      },
      {
        network: 'kairos',
        chainId: 1001,
        urls: {
          apiURL: 'https://kairos-oapi.kaiascan.io/api',
          browserURL: 'https://kairos.kaiascan.io',
        },
      },
    ],
  },
  // Sourcify fallback verifier (Kaiascan's Etherscan-style API rejects the
  // verifysourcecode request for viaIR contracts; Kaia chainId 8217 is on Sourcify).
  sourcify: {
    enabled: true,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
};

module.exports = config;
