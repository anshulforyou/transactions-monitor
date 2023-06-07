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

// Function to connect to MongoDB
async function connectToMongoDB() {
  const client = await MongoClient.connect(mongoURI);
  return client.db('polygon');
}

// Function to subscribe to pending transactions
async function subscribePendingTransactions(db: any) {
  const collection = db.collection('transactions');

  web3.eth.subscribe('pendingTransactions', async (error, txHash) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    const tx = await getTransactionWithRetry(txHash, 3);

    const transaction = {
      txHash,
      from: tx ? tx.from : null,
      to: tx ? tx.to : null,
      value: tx ? web3.utils.fromWei(tx.value, 'ether') : null,
      gasPrice: tx ? web3.utils.fromWei(tx.gasPrice, 'gwei') : null,
      gasLimit: tx ? tx.gas : null,
      status: 'Pending',
    };

    const existingTransaction = await collection.findOne({ txHash });

    if (existingTransaction) {
      await collection.updateOne({ txHash }, { $set: { status: 'Queued' } });
      console.log(`Transaction ${txHash} status: Queued`);
    } else {
      await collection.insertOne(transaction);
      console.log(`Transaction ${txHash} status: Pending`);
    }
  });
}

// Function to subscribe to block headers
async function subscribeBlockHeaders(db: any) {
  const collection = db.collection('transactions');

  web3.eth.subscribe('newBlockHeaders', async (error, blockHeader) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('New Block Header:', blockHeader.hash);

    const block = await web3.eth.getBlock(blockHeader.hash);

    for (const txHash of block.transactions) {
      const tx = await getTransactionWithRetry(txHash, 3);

      try {
        const receipt = await getTransactionReceiptWithRetry(txHash, 3);

        let status;

        if (receipt.status === true && receipt.gasUsed > 0) {
          status = 'Confirmed';
        } else if (+tx.value > 0) {
          status = 'Cancelled';
        } else {
          status = 'Failed';
        }

        await db.collection('transactions').updateOne(
          { txHash: txHash },
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
            },
          },
          { upsert: true }
        );

        console.log(`Transaction ${txHash} status: ${status}`);
      } catch (error) {
        console.error('Error retrieving transaction receipt:', error);
        console.log(`Transaction ${txHash} status: Pending`);
      }
    }
  });
}

// Function to retrieve transaction with retry
async function getTransactionWithRetry(txHash: string, maxRetries: number): Promise<any> {
  let retries = 0;
  let tx: any;

  while (retries < maxRetries) {
    try {
      tx = await web3.eth.getTransaction(txHash);
      if (tx) {
        break;
      }
    } catch (error) {
      console.error('Error retrieving transaction:', error);
    }

    retries++;
    const delay = Math.pow(2, retries) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (!tx) {
    console.error(`Failed to retrieve transaction ${txHash}`);
  }

  return tx;
}

// Function to retrieve transaction receipt with retry
async function getTransactionReceiptWithRetry(txHash: string, maxRetries: number): Promise<any> {
  let retries = 0;
  let receipt: any;

  while (retries < maxRetries) {
    try {
      receipt = await web3.eth.getTransactionReceipt(txHash);
      if (receipt) {
        break;
      }
    } catch (error) {
      console.error('Error retrieving transaction receipt:', error);
    }

    retries++;
    const delay = Math.pow(2, retries) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (!receipt) {
    throw new Error(`Failed to retrieve receipt for transaction ${txHash}`);
  }

  return receipt;
}

// Function to start tracking transactions
async function trackTransactions() {
  const db = await connectToMongoDB();

  await subscribePendingTransactions(db);
  await subscribeBlockHeaders(db);
}

// Start tracking transactions
trackTransactions();