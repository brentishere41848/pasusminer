const hashPatterns = [
  /(?<value>\d+(?:\.\d+)?)\s*(?<unit>[kKmMgGtTpP]?H\/s)/,
  /hashrate[^0-9]*(?<value>\d+(?:\.\d+)?)\s*(?<unit>[kKmMgGtTpP]?H\/s)/i,
  /speed[^0-9]*(?<value>\d+(?:\.\d+)?)\s*(?<unit>[kKmMgGtTpP]?H\/s)/i
];

export function parseHashrate(line: string): string | null {
  for (const pattern of hashPatterns) {
    const match = line.match(pattern);
    if (match?.groups?.value && match?.groups?.unit) {
      return `${match.groups.value} ${match.groups.unit.toUpperCase()}`;
    }
  }

  return null;
}
