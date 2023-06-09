import {constants} from './constants';

// Function to retrieve transaction with retry
export async function getTransactionWithRetry(
  web3: any,
  txHash: string,
  maxRetries: number
): Promise<any> {
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
    const delay = constants.DELAY_INTERVAL;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  if (!tx) {
    console.error(`Failed to retrieve transaction ${txHash}`);
  }

  return tx;
}

// Function to retrieve transaction receipt with retry
export async function getTransactionReceiptWithRetry(
  web3: any,
  txHash: string,
  maxRetries: number
): Promise<any> {
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
    const delay = 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  if (!receipt) {
    throw new Error(`Failed to retrieve receipt for transaction ${txHash}`);
  }

  return receipt;
}
