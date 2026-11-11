export interface PricePoint {
  timestamp: number;
  price: number;
  sma20: number | null;
  volume: number;
  open: number;
  high: number;
  low: number;
  cumulativeVolume: number;
}

export interface MarketStats {
  currentPrice: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  change: number;
  changePercent: number;
}

export interface VolatilityAlert {
  id: string;
  timestamp: number;
  type: "SPIKE" | "DROP" | "HIGH_VOLATILITY";
  message: string;
  severity: "low" | "medium" | "high";
}

export enum ConnectionStatus {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  ERROR = "ERROR",
}

export interface SearchResult {
  symbol: string;
  name: string;
  price: number;
  sector: string;
}

export interface MarketStatusInfo {
  isOpen: boolean;
  message: string;
  countdown: string;
}
