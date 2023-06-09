import Web3 from 'web3';
import {
  getTransactionWithRetry,
  getTransactionReceiptWithRetry,
} from '../transactionFeed/helpers';

describe('getTransactionWithRetry', () => {
  const mockGetTransaction = jest.fn();
  const mockWeb3 = {
    eth: {
      getTransaction: mockGetTransaction,
    },
  } as unknown as Web3;

  beforeEach(() => {
    console.error = jest.fn();
    jest.clearAllMocks();
  });

  it('should return transaction object if transaction exists', async () => {
    const mockTx = {hash: '0x123', from: '0x456', to: '0x789', value: '100'};
    mockGetTransaction.mockResolvedValueOnce(mockTx);

    const result = await getTransactionWithRetry(mockWeb3, '0x123', 3);

    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
    expect(mockGetTransaction).toHaveBeenCalledWith('0x123');
    expect(result).toEqual(mockTx);
  });

  it('should retry if transaction does not exist', async () => {
    mockGetTransaction
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({hash: '0x123'});

    const result = await getTransactionWithRetry(mockWeb3, '0x123', 3);

    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
    expect(result).toEqual({hash: '0x123'});
  }, 5000);

  it('should log error if transaction does not exist after max retries', async () => {
    mockGetTransaction.mockResolvedValue(null);
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});

    await expect(
      getTransactionWithRetry(mockWeb3, '0x123', 3)
    ).resolves.toBeNull();
    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'Failed to retrieve transaction 0x123'
    );
  }, 5000);
});

describe('getTransactionReceiptWithRetry', () => {
  const mockGetTransactionReceipt = jest.fn();
  const mockWeb3 = {
    eth: {
      getTransactionReceipt: mockGetTransactionReceipt,
    },
  } as unknown as Web3;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return transaction receipt if receipt exists', async () => {
    const mockReceipt = {
      transactionHash: '0x123',
      blockNumber: 123,
      status: true,
    };
    mockGetTransactionReceipt.mockResolvedValueOnce(mockReceipt);

    const result = await getTransactionReceiptWithRetry(mockWeb3, '0x123', 3);

    expect(mockGetTransactionReceipt).toHaveBeenCalledTimes(1);
    expect(mockGetTransactionReceipt).toHaveBeenCalledWith('0x123');
    expect(result).toEqual(mockReceipt);
  });

  it('should retry if transaction receipt does not exist', async () => {
    mockGetTransactionReceipt
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({transactionHash: '0x123'});

    const result = await getTransactionReceiptWithRetry(mockWeb3, '0x123', 3);

    expect(mockGetTransactionReceipt).toHaveBeenCalledTimes(3);
    expect(result).toEqual({transactionHash: '0x123'});
  }, 5000);

  it('should throw error if transaction receipt does not exist after max retries', async () => {
    mockGetTransactionReceipt.mockResolvedValue(null);

    await expect(
      getTransactionReceiptWithRetry(mockWeb3, '0x123', 3)
    ).rejects.toThrowError('Failed to retrieve receipt for transaction 0x123');
    expect(mockGetTransactionReceipt).toHaveBeenCalledTimes(3);
  }, 5000);
});

describe('subscribePendingTransactions', () => {
  const helpers = require('../transactionFeed/helpers');
  const transactionSources = require('../transactionFeed/transactionSources');
  const mockInsertOne = jest.fn();
  const mockUpdateOne = jest.fn();
  const mockFindOne = jest.fn();
  const mockSubscribe = jest.fn();
  const mockWeb3 = {
    eth: {
      subscribe: mockSubscribe,
    },
    utils: {
      fromWei: jest.fn().mockReturnValue('1'),
    },
  } as unknown as Web3;
  const mockDb = {
    collection: jest.fn().mockReturnValue({
      insertOne: mockInsertOne,
      updateOne: mockUpdateOne,
      findOne: mockFindOne,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should insert new transaction if it does not exist in the database', async () => {
    const mockTxHash = '0x123';
    const mockTx = {
      from: '0xabc',
      to: '0xdef',
      value: '1000000000000000000',
      gasPrice: '1000000000',
      gas: 21000,
    };
    mockSubscribe.mockImplementationOnce((_, callback) => {
      callback(null, mockTxHash);
    });
    jest
      .spyOn(helpers, 'getTransactionWithRetry')
      .mockResolvedValueOnce(mockTx);

    mockFindOne.mockResolvedValueOnce(null);
    mockInsertOne.mockResolvedValueOnce({
      acknowledged: true,
      insertedId: '123',
    });

    try {
      await expect(
        transactionSources.subscribePendingTransactions(mockDb, mockWeb3)
      ).resolves.toEqual(undefined);
    } catch (error) {
      console.log(error);
    }

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(
      'pendingTransactions',
      expect.any(Function)
    );

    expect(helpers.getTransactionWithRetry).toHaveBeenCalledTimes(1);
    expect(helpers.getTransactionWithRetry).toHaveBeenCalledWith(
      mockWeb3,
      mockTxHash,
      3
    );

    expect(mockFindOne).toHaveBeenCalledTimes(1);
    expect(mockFindOne).toHaveBeenCalledWith({txHash: mockTxHash});

    expect(mockInsertOne).toHaveBeenCalledTimes(1);
    expect(mockInsertOne).toHaveBeenCalledWith({
      txHash: mockTxHash,
      from: mockTx.from,
      to: mockTx.to,
      value: expect.any(String),
      gasPrice: expect.any(String),
      gasLimit: mockTx.gas,
      status: 'Pending',
    });

    expect(mockWeb3.utils.fromWei).toHaveBeenCalledTimes(2);
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(mockTx.value, 'ether');
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(
      mockTx.gasPrice,
      'gwei'
    );
  });

  it('should update existing transaction if it exists in the database', async () => {
    const mockTxHash = '0x123';
    const mockTx = {
      from: '0xabc',
      to: '0xdef',
      value: '1000000000000000000',
      gasPrice: '1000000000',
      gas: 21000,
    };

    jest.spyOn(helpers, 'getTransactionWithRetry').mockReturnValue(mockTx);
    mockSubscribe.mockImplementationOnce((_, callback) => {
      callback(null, mockTxHash);
    });
    mockFindOne.mockResolvedValueOnce({txHash: mockTxHash});

    try {
      await expect(
        transactionSources.subscribePendingTransactions(mockDb, mockWeb3)
      ).resolves.toEqual(undefined);
    } catch (error) {
      console.log(error);
    }

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(
      'pendingTransactions',
      expect.any(Function)
    );
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      {txHash: mockTxHash},
      {$set: {status: 'Queued'}}
    );
    expect(helpers.getTransactionWithRetry).toHaveBeenCalledTimes(1);
    expect(helpers.getTransactionWithRetry).toHaveBeenCalledWith(
      mockWeb3,
      mockTxHash,
      3
    );
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledTimes(2);
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(mockTx.value, 'ether');
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(
      mockTx.gasPrice,
      'gwei'
    );
  });
});

describe('subscribeBlockHeaders', () => {
  const helpers = require('../transactionFeed/helpers');
  const transactionSources = require('../transactionFeed/transactionSources');
  const mockUpdateOne = jest.fn();
  const mockSubscribe = jest.fn();
  const mockGetBlock = jest.fn();

  const mockWeb3 = {
    eth: {
      subscribe: mockSubscribe,
      getBlock: mockGetBlock,
    },
    utils: {
      fromWei: jest.fn().mockReturnValue('1'),
    },
  } as unknown as Web3;

  const mockDb = {
    collection: jest.fn().mockReturnValue({
      updateOne: mockUpdateOne,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should insert new transaction if it does not exist in the database', async () => {
    const mockBlockHash = '0x123';
    const mockTxHash = '0x456';
    const mockTx = {
      from: '0xabc',
      to: '0xdef',
      value: '1000000000000000000',
      gasPrice: '1000000000',
      gas: 21000,
    };
    const mockReceipt = {
      status: true,
      gasUsed: 21000,
      blockNumber: 123,
    };
    mockSubscribe.mockImplementationOnce((_, callback) => {
      callback(null, {hash: mockBlockHash});
    });
    mockGetBlock.mockResolvedValueOnce({
      transactions: [mockTxHash],
    });
    helpers.getTransactionWithRetry = jest.fn().mockResolvedValueOnce(mockTx);
    helpers.getTransactionReceiptWithRetry = jest
      .fn()
      .mockResolvedValueOnce(mockReceipt);

    await await expect(
      transactionSources.subscribeBlockHeaders(mockDb, mockWeb3)
    ).resolves.toBeUndefined();

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(
      'newBlockHeaders',
      expect.any(Function)
    );

    expect(mockGetBlock).toHaveBeenCalledTimes(1);
    expect(mockGetBlock).toHaveBeenCalledWith(mockBlockHash);

    expect(helpers.getTransactionWithRetry).toHaveBeenCalledTimes(1);
    expect(helpers.getTransactionWithRetry).toHaveBeenCalledWith(
      mockWeb3,
      mockTxHash,
      3
    );

    expect(helpers.getTransactionReceiptWithRetry).toHaveBeenCalledTimes(1);
    expect(helpers.getTransactionReceiptWithRetry).toHaveBeenCalledWith(
      mockWeb3,
      mockTxHash,
      3
    );

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      {txHash: mockTxHash},
      {
        $set: {status: 'Confirmed'},
        $setOnInsert: {
          txHash: mockTxHash,
          from: mockTx.from,
          to: mockTx.to,
          value: expect.any(String),
          gasPrice: expect.any(String),
          gasUsed: mockTx.gas,
          blockNumber: mockReceipt.blockNumber,
        },
      },
      {upsert: true}
    );

    expect(mockWeb3.utils.fromWei).toHaveBeenCalledTimes(2);
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(mockTx.value, 'ether');
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(
      mockTx.gasPrice,
      'gwei'
    );
  });

  it('should update the collection with the correct status when the receipt status is false and value is greater than 0', async () => {
    const mockBlockHash = '0x123';
    const mockTxHash = '0x456';
    const mockTx = {
      from: '0xabc',
      to: '0xdef',
      value: '1000000000000000000',
      gasPrice: '1000000000',
      gas: 21000,
    };
    const mockReceipt = {
      status: false,
      gasUsed: 21000,
      blockNumber: 123,
    };
    mockSubscribe.mockImplementationOnce((_, callback) => {
      callback(null, {hash: mockBlockHash});
    });
    mockGetBlock.mockResolvedValueOnce({
      transactions: [mockTxHash],
    });
    helpers.getTransactionWithRetry = jest.fn().mockResolvedValueOnce(mockTx);
    helpers.getTransactionReceiptWithRetry = jest
      .fn()
      .mockResolvedValueOnce(mockReceipt);

    await await expect(
      transactionSources.subscribeBlockHeaders(mockDb, mockWeb3)
    ).resolves.toBeUndefined();

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(
      'newBlockHeaders',
      expect.any(Function)
    );

    expect(mockGetBlock).toHaveBeenCalledTimes(1);
    expect(mockGetBlock).toHaveBeenCalledWith(mockBlockHash);

    expect(helpers.getTransactionWithRetry).toHaveBeenCalledTimes(1);
    expect(helpers.getTransactionWithRetry).toHaveBeenCalledWith(
      mockWeb3,
      mockTxHash,
      3
    );

    expect(helpers.getTransactionReceiptWithRetry).toHaveBeenCalledTimes(1);
    expect(helpers.getTransactionReceiptWithRetry).toHaveBeenCalledWith(
      mockWeb3,
      mockTxHash,
      3
    );

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      {txHash: mockTxHash},
      {
        $set: {status: 'Cancelled'},
        $setOnInsert: {
          txHash: mockTxHash,
          from: mockTx.from,
          to: mockTx.to,
          value: expect.any(String),
          gasPrice: expect.any(String),
          gasUsed: mockTx.gas,
          blockNumber: mockReceipt.blockNumber,
        },
      },
      {upsert: true}
    );

    expect(mockWeb3.utils.fromWei).toHaveBeenCalledTimes(2);
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(mockTx.value, 'ether');
    expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(
      mockTx.gasPrice,
      'gwei'
    );
  });
});
