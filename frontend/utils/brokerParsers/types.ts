import type { TaxTransaction } from '../../types/tax';

/**
 * A broker-specific file parser that converts an exported broker report
 * into a list of TaxTransaction objects for the Belka tax calculator.
 *
 * All parsing runs entirely in the browser — the file never leaves the device.
 */
export interface BrokerParser {
  /** Unique identifier used in state and selectors. */
  id: string;
  /** Display name shown in the broker dropdown. */
  name: string;
  /** Short description of the required file format, e.g. "Gains & Losses (.xlsx)". */
  fileLabel: string;
  /** Value for the `accept` attribute on the file input, e.g. ".xlsx". */
  fileAccept: string;
  /** Step-by-step Polish instructions for downloading the export from the broker. */
  downloadInstructions: string[];
  /** Note shown below the instructions (format restrictions, caveats). */
  formatNote?: string;
  /**
   * Parse the given file buffer and return TaxTransaction objects.
   * Throws a user-friendly Polish error string on failure.
   */
  parse(buffer: ArrayBuffer): Promise<TaxTransaction[]>;
}
