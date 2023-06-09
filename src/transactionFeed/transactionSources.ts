import {constants} from './constants';
import {
  getTransactionWithRetry,
  getTransactionReceiptWithRetry,
} from './helpers';

// Function to subscribe to pending transactions
export async function subscribePendingTransactions(db: any, web3: any) {
  const collection = db.collection(constants.COLLECTION_NAME);

  web3.eth.subscribe(
    'pendingTransactions',
    async (error: any, txHash: string) => {
      if (error) {
        console.error('Error:', error);
        return;
      }

      const tx = await getTransactionWithRetry(
        web3,
        txHash,
        constants.MAX_RETRIES
      );

      const transaction = {
        txHash,
        from: tx ? tx.from : null,
        to: tx ? tx.to : null,
        value: tx ? web3.utils.fromWei(tx.value, 'ether') : null,
        gasPrice: tx ? web3.utils.fromWei(tx.gasPrice, 'gwei') : null,
        gasLimit: tx ? tx.gas : null,
        status: constants.PENDING,
      };

      const existingTransaction = await collection.findOne({txHash});

      if (existingTransaction) {
        await collection.updateOne({txHash}, {$set: {status: 'Queued'}});
        console.log(`Transaction ${txHash} status: Queued`);
      } else {
        await collection.insertOne(transaction);
        console.log(`Transaction ${txHash} status: Pending`);
      }
    }
  );
}

// Function to subscribe to block headers
export async function subscribeBlockHeaders(db: any, web3: any) {
  const collection = db.collection(constants.COLLECTION_NAME);

  web3.eth.subscribe(
    'newBlockHeaders',
    async (error: any, blockHeader: {hash: any}) => {
      if (error) {
        console.error('Error:', error);
        return;
      }

      console.log('New Block Header:', blockHeader.hash);

      const block = await web3.eth.getBlock(blockHeader.hash);

      for (const txHash of block.transactions) {
        const tx = await getTransactionWithRetry(
          web3,
          txHash,
          constants.MAX_RETRIES
        );

        try {
          const receipt = await getTransactionReceiptWithRetry(
            web3,
            txHash,
            constants.MAX_RETRIES
          );

          let status;

          if (receipt.status === true && receipt.gasUsed > 0) {
            status = constants.CONFIRMED;
          } else if (+tx.value > 0) {
            // polygonscan logic for cancelled transactions
            status = constants.CANCELLED;
          } else {
            status = constants.FAILED;
          }

          await collection.updateOne(
            {txHash: txHash},
            {
              $set: {status},
              $setOnInsert: {
                txHash: txHash,
                from: tx.from,
                to: tx.to,
                value: web3.utils.fromWei(tx.value, constants.ETHER),
                gasPrice: web3.utils.fromWei(tx.gasPrice, constants.GWEI),
                gasUsed: tx.gas,
                blockNumber: receipt.blockNumber,
              },
            },
            {upsert: true}
          );

          console.log(`Transaction ${txHash} status: ${status}`);
        } catch (error) {
          console.error('Error retrieving transaction receipt:', error);
          console.log(`Transaction ${txHash} status: Pending`);
        }
      }
    }
  );
}
