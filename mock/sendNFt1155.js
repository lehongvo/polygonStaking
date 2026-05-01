require('dotenv').config();
const { ethers } = require('ethers');
const polygon = "https://polygon-rpc.com";


// ERC1155 ABI for basic operations
const ERC1155_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256[]",
                "name": "ids",
                "type": "uint256[]"
            },
            {
                "internalType": "uint256[]",
                "name": "amounts",
                "type": "uint256[]"
            },
            {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "safeBatchTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint256[]",
                "name": "ids",
                "type": "uint256[]"
            }
        ],
        "name": "balanceOfBatch",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            }
        ],
        "name": "isApprovedForAll",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "approved",
                "type": "bool"
            }
        ],
        "name": "setApprovalForAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const privateKey = process.env.PRIVATE_KEY;
const contractAddress = "0x23d080a6a04a170b0a323e5e9ca580679d593b90";
const amount = 1;
const tokenId = 0;

const sendNFT1155 = async (network, contractAddress, privateKey, toAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(network);
        let signer = new ethers.Wallet(privateKey, provider);
        const fromAddress = signer.address;
        console.log("Active by account:", signer.address);

        const nftContract = new ethers.Contract(
            contractAddress,
            ERC1155_ABI,
            signer
        );

        // Check if the sender has enough tokens
        const balance = await nftContract.balanceOf(fromAddress, tokenId);
        console.log(`Balance of ${fromAddress} for token ${tokenId}: ${balance}`);

        if (balance < amount) {
            throw new Error(`Insufficient balance. Required: ${amount}, Available: ${balance}`);
        }

        // Get fee data for gas estimation
        const feeData = await provider.getFeeData();

        // Estimate gas for the transfer
        const data = "0x";
        const estimatedGas = await nftContract.safeTransferFrom.estimateGas(
            fromAddress,
            toAddress,
            tokenId,
            amount,
            data
        );

        // Execute the transfer
        const transferTx = await nftContract.safeTransferFrom(
            fromAddress,
            toAddress,
            tokenId,
            amount,
            data,
            {
                gasLimit: ethers.toBeHex(Math.ceil(Number(estimatedGas) * 1.1)),
                gasPrice: ethers.toBeHex(Math.ceil(Number(feeData.gasPrice) * 1.1)),
            }
        );

        await transferTx.wait();
        console.log("NFT1155 transfer successful!");
        console.log("Transaction hash:", transferTx.hash);
        console.log(`Transferred ${amount} of token ${tokenId} from ${fromAddress} to ${toAddress}`);

        return transferTx.hash;
    } catch (error) {
        console.error("Error sending NFT1155:", error);
        throw error;
    }
};


sendNFT1155(
    polygon,
    contractAddress,
    privateKey,
    "0x7ee3327a3E65970507673C7b8D4817898D87d2a5"
)