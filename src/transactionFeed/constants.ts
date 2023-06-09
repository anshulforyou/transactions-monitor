export namespace constants {
  // status constants
  export const PENDING = 'Pending';
  export const CONFIRMED = 'Confirmed';
  export const CANCELLED = 'Cancelled';
  export const FAILED = 'Failed';

  // web3 module constants
  export const GWEI = 'gwei';
  export const ETHER = 'ether';

  // mongodb constants
  export const COLLECTION_NAME = 'transactions';

  // general application constants
  export const MAX_RETRIES = 3;
  export const DELAY_INTERVAL = 1000;
}
