import type { BrokerParser } from './types';
import { etradeParser } from './etrade';

/**
 * Registry of all supported broker parsers.
 * Add new brokers here as they are implemented.
 */
export const BROKER_PARSERS: BrokerParser[] = [etradeParser];

export type { BrokerParser } from './types';
