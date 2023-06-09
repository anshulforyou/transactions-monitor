# Polygon Transaction Monitor

This application allows you to track the lifecycle of transactions on the Polygon blockchain network and save them into a MongoDB database. It provides functionality to monitor the status of transactions, including queued, pending, confirmed, cancelled, and failed transactions.

## Functionality

- Subscribes to pending transactions on the Polygon network and updates their status in real-time.
- Tracks new block headers and processes the transactions included in each block.
- Determines the status of each transaction based on its receipt and other properties.
- Saves the transaction details to a MongoDB database, including the transaction hash, sender and recipient addresses, value, gas price, gas limit, and status.

## Prerequisites

To run the application, you'll need the following:

- Node.js installed on your machine.
- Access to a MongoDB database or a MongoDB connection string.

## Installation

1. Clone the repository:

```sh
    git clone <repository-url>
```

2. Install the dependencies:

```sh
    cd transactions-monitor
    npm install
```

## Configuration

1. Create a `.env` file in the root directory of the project.

2. Set the following environment variables in the `.env` file:
```sh
    POLYGON_RPC_ENDPOINT=<Polygon RPC endpoint>
    MONGO_URI=<MongoDB connection string>
```

3. Create a database named "polygon" and a collection named "transactions" in your MongoDB cluster. 

Replace `<Polygon RPC endpoint>` with the RPC endpoint URL for the Polygon network you want to connect to.

Replace `<MongoDB connection string>` with the connection string for your MongoDB database.

## Usage

1. Start the application:

```sh
    npm start
```

    The application will connect to the Polygon network and begin tracking transactions.

2. Open your MongoDB client to view the saved transactions in the specified database and collection.

3. The application will output logs indicating the status of each tracked transaction in real-time.

## Testing
1. Install jest and other dependencies
```sh
    npm install --save-dev jest ts-jest @types/jest
```

2. Run the tests
```sh
    npm test
```

## Notes

- The application uses the Web3 library to interact with the Polygon network and the MongoDB Node.js driver to connect to the database.
- The `trackTransactions` function subscribes to pending transactions and new block headers to monitor and update transaction statuses.
- The `getTransactionWithRetry` function is used to retrieve transaction with retry logic to handle network failures. The function logs error if it fails even after retries.
- The `getTransactionReceiptWithRetry` function is used to retrieve transaction receipts with retry logic to handle network failures. The function throws error if it fails even after retries.
- The code can be extended to include additional functionality or customize the database structure as per your requirements.