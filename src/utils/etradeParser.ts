/**
 * @deprecated Import from `./brokerParsers/etrade` or `./brokerParsers/index` instead.
 * This re-export exists for backward compatibility with existing tests.
 */
export { mmddyyyyToIso } from './brokerParsers/etrade';
export { etradeParser as default } from './brokerParsers/etrade';

/** @deprecated Use etradeParser.parse() instead. */
export async function parseEtradeFile(buffer: ArrayBuffer) {
  const { etradeParser } = await import('./brokerParsers/etrade');
  return etradeParser.parse(buffer);
}

