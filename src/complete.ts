import Web3 from 'web3';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

// RPC endpoint for the Polygon network
const rpcEndpoint = process.env.POLYGON_RPC_ENDPOINT || '';

// MongoDB connection URI
const mongoURI = process.env.MONGO_URI || '';

// Create a new Web3 instance
const web3 = new Web3(rpcEndpoint);

// Function to track transactions
async function trackTransactions() {
  // Connect to MongoDB cluster
  const client = await MongoClient.connect(mongoURI);
  const db = client.db("polygon");
  const collection = db.collection("transactions");

  // Subscribe to pending transactions
  web3.eth.subscribe('pendingTransactions', async (error, txHash) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    // Get the transaction details
    const tx = await web3.eth.getTransaction(txHash);

    // Create a transaction object to be inserted in the database
    let transaction = {
        txHash,
        from: tx ? tx.from : null,
        to: tx ? tx.to : null,
        value: tx ? web3.utils.fromWei(tx.value, 'ether') : null,
        gasPrice: tx ? web3.utils.fromWei(tx.gasPrice, 'gwei') : null,
        gasLimit: tx ? tx.gas : null,
        status: 'Pending',
    };

    // Check if the transaction exists in the database
    const existingTransaction = await collection.findOne({ txHash });
    if (existingTransaction) {
        // Update the status to "queued"
        await collection.updateOne({ txHash }, { $set: { status: 'Queued' } });
        console.log('Status: Queued');
    } else {
        // Insert a new document with the status as "pending"
        await collection.insertOne(transaction);
        console.log('Status: Pending');
    }
  });

  // Subscribe to new block headers
  web3.eth.subscribe('newBlockHeaders', async (error, blockHeader) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('New Block Header:', blockHeader.hash);

    // Get the block details
    const block = await web3.eth.getBlock(blockHeader.hash);

    // Iterate through the transactions in the block
    for (const txHash of block.transactions) {
      const tx = await web3.eth.getTransaction(txHash);
        
      let status;
      // Get the transaction receipt
        const receipt = await getTransactionReceiptWithRetry(txHash, 3);

        // Check for confirmed, failed and cancelled transactions
        if (receipt.status === true) {
            status = 'Confirmed';
        } else {
            // Failed transactions with value > 0 are considered as cancelled
            if (+tx.value > 0) {
              status = 'Cancelled';
            }else {
              status = 'Failed';
            }
        }
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
    }
  });
}

async function getTransactionReceiptWithRetry(txHash: string, maxRetries: number): Promise<any> {
  let retries = 0;
  let receipt: any;

  while (retries < maxRetries) {
    try {
      receipt = await web3.eth.getTransactionReceipt(txHash);
      // If receipt is successfully obtained, break out of the loop
      if (receipt) {
        break;
      }
    } catch (error) {
      console.error('Error retrieving transaction receipt:', error);
    }

    // Increment retries and apply exponential backoff
    retries++;
    const delay = Math.pow(2, retries) * 1000; // Exponential backoff in milliseconds
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return receipt;
}

// Start tracking transactions
trackTransactions();
