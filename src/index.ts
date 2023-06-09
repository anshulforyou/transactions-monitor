import Web3 from 'web3';
import {MongoClient} from 'mongodb';
import * as dotenv from 'dotenv';

import {
  subscribePendingTransactions,
  subscribeBlockHeaders,
} from './transactionFeed/transactionSources';

dotenv.config();

// RPC endpoint for the Polygon network
const rpcEndpoint = process.env.POLYGON_RPC_ENDPOINT || '';

// MongoDB connection URI
const mongoURI = process.env.MONGO_URI || '';

// Function to connect to MongoDB
export async function connectToMongoDB() {
  const client = await MongoClient.connect(mongoURI);
  return client.db('polygon');
}

// Function to start tracking transactions
async function trackTransactions() {
  const db = await connectToMongoDB();
  // Create a new Web3 instance
  const web3 = new Web3(rpcEndpoint);

  await subscribePendingTransactions(db, web3);
  await subscribeBlockHeaders(db, web3);
}

// Start tracking transactions
trackTransactions();
