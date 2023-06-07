import Web3 from 'web3';
import { MongoClient } from 'mongodb';

// RPC endpoint for the Polygon network
const rpcEndpoint = 'wss://polygon-mainnet.g.alchemy.com/v2/0NdAgFm3jlV84U6KXvxy0FzpXWySIBZP';

// MongoDB connection URI
const mongoURI = 'mongodb+srv://anshulky:yU84gO0H4S2DnzZC@cluster0.bzu7sb8.mongodb.net/?retryWrites=true&w=majority';

// Create a new Web3 instance
const web3 = new Web3(rpcEndpoint);

// Function to track transactions
async function trackTransactions() {
  // Connect to MongoDB cluster
  const client = await MongoClient.connect(mongoURI);
  const db = client.db("polygon");

  // Subscribe to pending transactions
  web3.eth.subscribe('pendingTransactions', async (error, txHash) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('New Pending Transaction:', txHash);

    // Get the transaction details
    const tx = await web3.eth.getTransaction(txHash);
    // console.log(tx);

    const receipt = await web3.eth.getTransactionReceipt(txHash);
    // console.log("Receipt", receipt);
    // console.log('From:', tx.from);
    // console.log('To:', tx.to);
    // console.log('Value:', web3.utils.fromWei(tx.value, 'ether'));
    // console.log('Gas Price:', web3.utils.fromWei(tx.gasPrice, 'gwei'));
    // console.log('Gas Limit:', tx.gas);

    // Create a transaction object to be inserted in the database
    const transaction = {
      txHash: txHash,
      from: tx.from,
      to: tx.to,
      value: web3.utils.fromWei(tx.value, 'ether'),
      gasPrice: web3.utils.fromWei(tx.gasPrice, 'gwei'),
      gasLimit: tx.gas,
      status: 'Pending',
    };

    // Insert the transaction into the MongoDB collection
    await db.collection('transactions').insertOne(transaction);

    // console.log('Status: Pending');
  });
}

// Start tracking transactions
trackTransactions().catch(console.error);
