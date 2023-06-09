import type {Config} from '@jest/types';
// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  transform: {
  '^.+\\.tsx?$': 'ts-jest',
  },
  preset: 'ts-jest',
  moduleNameMapper: {
    // "^web3$": "./src/web3.mock.ts",
    },
};
export default config;