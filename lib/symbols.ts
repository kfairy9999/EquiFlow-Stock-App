import type { SearchResult } from "../types";

/**
 * A fixed sample list. The `price` field is the simulated starting price
 * for that symbol, not a quote from an exchange.
 */
export const SAMPLE_SYMBOLS: readonly SearchResult[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: 150, sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corp.", price: 310, sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: 175, sector: "Communication" },
  { symbol: "AMZN", name: "Amazon.com Inc.", price: 190, sector: "Consumer Cyclical" },
  { symbol: "TSLA", name: "Tesla Inc.", price: 240, sector: "Consumer Cyclical" },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 130, sector: "Technology" },
  { symbol: "JPM", name: "JPMorgan Chase", price: 210, sector: "Financial" },
  { symbol: "V", name: "Visa Inc.", price: 280, sector: "Financial" },
  { symbol: "JNJ", name: "Johnson & Johnson", price: 160, sector: "Healthcare" },
  { symbol: "WMT", name: "Walmart Inc.", price: 85, sector: "Consumer Defensive" },
];

export function findSymbol(symbol: string): SearchResult | undefined {
  const upper = symbol.toUpperCase();
  return SAMPLE_SYMBOLS.find((entry) => entry.symbol === upper);
}

export function searchSymbols(query: string, catalog: readonly SearchResult[] = SAMPLE_SYMBOLS): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return catalog.filter(
    (entry) =>
      entry.symbol.toLowerCase().includes(needle) ||
      entry.name.toLowerCase().includes(needle) ||
      entry.sector.toLowerCase().includes(needle),
  );
}
