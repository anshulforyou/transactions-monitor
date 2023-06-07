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

  // Subscribe to new block headers
  web3.eth.subscribe('newBlockHeaders', async (error, blockHeader) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('New Block:', blockHeader.number);

    // Get the block details
    const block = await web3.eth.getBlock(blockHeader.hash);

    // Loop through the transactions in the block
    for (const txHash of block.transactions) {
      // Get the transaction details
      const tx = await web3.eth.getTransaction(txHash);

      console.log('Transaction:', txHash);
      console.log('From:', tx.from);
      console.log('To:', tx.to);
      console.log('Value:', web3.utils.fromWei(tx.value, 'ether'));
      console.log('Gas Price:', web3.utils.fromWei(tx.gasPrice, 'gwei'));
      console.log('Gas Used:', tx.gas);

      // Get the transaction receipt
      const receipt = await web3.eth.getTransactionReceipt(txHash);

      console.log('Receipt Status:', receipt.status);
      console.log('Block Number:', receipt.blockNumber);
      // console.log("Receipt",receipt);

      if (receipt === null) {
        console.log("Receipt is null");
      }

      // Map the status code to a readable status
      let status;
      if (receipt.status === true) {
        status = 'Confirmed';
      } else {
        status = 'Failed';
      } 
      // else {
      //   // Handle pending and queued transactions
      //   const currentBlock = await web3.eth.getBlock('latest');
      //   if (tx.blockNumber === null) {
      //     // Transaction is queued
      //     status = 'Queued';
      //   } else if (currentBlock.number - tx.blockNumber <= 12) {
      //     // Transaction is pending
      //     status = 'Pending';
      //   } else {
      //     // Transaction status cannot be determined
      //     status = 'Unknown';
      //   }
      // }

      // Update the transaction status in MongoDB
      await db.collection('transactions').updateOne(
        { txHash: txHash},
        { 
          $set: { status },
          $setOnInsert: {
            txHash: txHash,
            from: tx.from,
            to: tx.to,
            value: web3.utils.fromWei(tx.value, 'ether'),
            gasPrice: web3.utils.fromWei(tx.gasPrice, 'gwei'),
            gasUsed: tx.gas,
            blockNumber: receipt.blockNumber,
          } 
        },
        { upsert: true }
      );

      console.log('Status:', status);
    }
  });
}

// Start tracking transactions
trackTransactions().catch(console.error);
