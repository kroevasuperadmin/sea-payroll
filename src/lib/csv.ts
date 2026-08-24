import { parse } from "csv-parse/sync";
import { parsePayoutRow, type ParsedPayoutRow } from "./rules";

export function parseCsvPayouts(file: string): ParsedPayoutRow[] {
  const records = parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    skip_records_with_empty_values: false,
  }) as Record<string, string>[];

  return records.map((record) => parsePayoutRow(record));
}
