const HASHRATE_PATTERN =
  /(?<value>\d+(?:[.,]\d+)?)\s*(?<unit>(?:[kKmMgGtTpP]?H\/s)|(?:sol\/s))/i;

const UNIT_FACTORS: Record<string, number> = {
  "H/S": 1,
  "KH/S": 1e3,
  "MH/S": 1e6,
  "GH/S": 1e9,
  "TH/S": 1e12,
  "PH/S": 1e15,
  "SOL/S": 1
};

export interface ParsedHashrate {
  text: string;
  normalizedValue: number;
}

export function parseHashrateReading(line: string): ParsedHashrate | null {
  const match = line.match(HASHRATE_PATTERN);
  if (!match?.groups?.value || !match.groups.unit) {
    return null;
  }

  const value = Number(match.groups.value.replace(",", "."));
  const unit = match.groups.unit.toUpperCase();
  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    text: `${value} ${unit}`,
    normalizedValue: value * (UNIT_FACTORS[unit] ?? 1)
  };
}

export function parseHashrate(line: string): string | null {
  return parseHashrateReading(line)?.text ?? null;
}
