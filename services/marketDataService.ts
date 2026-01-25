import { PricePoint, VolatilityAlert, ConnectionStatus, SearchResult, MarketStatusInfo } from '../types';

/**
 * ARCHITECTURAL NOTE:
 * In a real Node.js backend, this class would wrap a `ws` server or `socket.io` instance.
 * It would subscribe to Finnhub/Polygon, process the stream, and emit 'message' events to connected clients.
 * 
 * For this SPA, we simulate the "Backend" logic here to demonstrate:
 * 1. Data Generation (simulating live socket frames)
 * 2. Enrichment (SMA Calculation on the fly)
 * 3. Broadcasting (Observer pattern)
 */

type Listener<T> = (data: T) => void;

const MOCK_DB: SearchResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 150.00, sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 310.00, sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 2750.00, sector: 'Communication' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 3300.00, sector: 'Consumer Cyclical' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 240.00, sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 480.00, sector: 'Technology' },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 140.00, sector: 'Financial' },
  { symbol: 'V', name: 'Visa Inc.', price: 230.00, sector: 'Financial' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 160.00, sector: 'Healthcare' },
  { symbol: 'WMT', name: 'Walmart Inc.', price: 155.00, sector: 'Consumer Defensive' },
];

class MarketDataService {
  private subscribers: Listener<PricePoint>[] = [];
  private alertSubscribers: Listener<VolatilityAlert>[] = [];
  private statusSubscribers: Listener<ConnectionStatus>[] = [];
  
  private intervalId: number | null = null;
  private currentTicker = 'AAPL';
  private currentPrice = 150.00;
  private priceHistory: number[] = [];
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  
  // Configuration
  private readonly SMA_PERIOD = 20;
  private readonly UPDATE_RATE_MS = 200; // 5 updates per second for demo (can go faster)
  private volatilityThreshold = 2.5; // $2.50 swing triggers alert

  constructor() {
    this.startConnection();
  }

  // --- Public API (mimicking WebSocket client) ---

  public getMarketStatus(): MarketStatusInfo {
    const now = new Date();
    
    // Convert to New York Time (Eastern Time)
    const nyTimeStr = now.toLocaleString("en-US", {timeZone: "America/New_York"});
    const nyDate = new Date(nyTimeStr);
    
    const day = nyDate.getDay(); // 0 = Sun, 6 = Sat
    const hour = nyDate.getHours();
    const minute = nyDate.getMinutes();
    const totalMinutes = hour * 60 + minute;
    
    const OPEN_MINUTES = 9 * 60 + 30; // 9:30 AM -> 570
    const CLOSE_MINUTES = 16 * 60;    // 4:00 PM -> 960

    const isWeekend = day === 0 || day === 6;
    const isBusinessDay = !isWeekend;
    
    // Check if within trading hours (Mon-Fri, 09:30 - 16:00)
    const isOpen = isBusinessDay && totalMinutes >= OPEN_MINUTES && totalMinutes < CLOSE_MINUTES;

    let countdown = "";
    
    if (isOpen) {
      // Time to close
      const diff = CLOSE_MINUTES - totalMinutes;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      countdown = `Closes in ${h}h ${m}m`;
    } else {
      // Logic for "Opens in..."
      if (isBusinessDay && totalMinutes < OPEN_MINUTES) {
        // Same day, before open
        const diff = OPEN_MINUTES - totalMinutes;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        countdown = `Opens in ${h}h ${m}m`;
      } else {
        // After close or weekend
        if (day === 5 && totalMinutes >= CLOSE_MINUTES) { // Friday after close
             countdown = "Opens Monday 9:30 AM";
        } else if (day === 6) { // Saturday
             countdown = "Opens Monday 9:30 AM";
        } else if (day === 0) { // Sunday
             countdown = "Opens Monday 9:30 AM";
        } else {
             // Weekday after close (Mon-Thu)
             countdown = "Opens Tomorrow 9:30 AM";
        }
      }
    }

    return {
      isOpen,
      message: isOpen ? "Market Open" : "Market Closed",
      countdown
    };
  }

  public async searchSymbols(query: string): Promise<SearchResult[]> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 150));
    
    if (!query) return [];
    
    const lowerQ = query.toLowerCase();
    return MOCK_DB.filter(s => 
      s.symbol.toLowerCase().includes(lowerQ) || 
      s.name.toLowerCase().includes(lowerQ)
    );
  }

  public subscribeToTicker(ticker: string, callback: Listener<PricePoint>) {
    // If switching ticker, reset simulation state
    if (ticker !== this.currentTicker) {
      this.currentTicker = ticker;
      const stock = MOCK_DB.find(s => s.symbol === ticker);
      this.currentPrice = stock ? stock.price : 100.00;
      this.priceHistory = [];
      // Notify listeners of status reset (optional but good for UI)
      this.updateStatus(ConnectionStatus.CONNECTING);
      setTimeout(() => this.updateStatus(ConnectionStatus.CONNECTED), 500);
    }

    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  public onAlert(callback: Listener<VolatilityAlert>) {
    this.alertSubscribers.push(callback);
    return () => {
      this.alertSubscribers = this.alertSubscribers.filter(cb => cb !== callback);
    };
  }

  public onStatusChange(callback: Listener<ConnectionStatus>) {
    this.statusSubscribers.push(callback);
    callback(this.status); // Emit current immediately
    return () => {
      this.statusSubscribers = this.statusSubscribers.filter(cb => cb !== callback);
    };
  }

  public setVolatilityThreshold(value: number) {
    this.volatilityThreshold = value;
  }

  public getVolatilityThreshold(): number {
    return this.volatilityThreshold;
  }

  // --- "Backend" Logic ---

  private startConnection() {
    this.updateStatus(ConnectionStatus.CONNECTING);
    
    // Simulate connection delay
    setTimeout(() => {
      this.updateStatus(ConnectionStatus.CONNECTED);
      this.startDataStream();
    }, 1000);
  }

  private updateStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.statusSubscribers.forEach(cb => cb(newStatus));
  }

  private startDataStream() {
    if (this.intervalId) window.clearInterval(this.intervalId);

    this.intervalId = window.setInterval(() => {
      // Don't emit if connecting
      if (this.status !== ConnectionStatus.CONNECTED) return;
      
      const newPoint = this.generateNextTick();
      this.subscribers.forEach(cb => cb(newPoint));
      this.checkForVolatility(newPoint);
    }, this.UPDATE_RATE_MS);
  }

  private generateNextTick(): PricePoint {
    // Random Walk (Geometric Brownian Motion simulation simplified)
    // Adjust volatility based on price magnitude (higher price = bigger swings usually)
    const baseVolatility = 0.002; 
    const volatility = baseVolatility * (Math.random() * 0.5 + 0.8);
    const drift = 0.0001; // slight upward drift
    const change = this.currentPrice * (drift + volatility * (Math.random() - 0.5));
    
    this.currentPrice += change;
    
    // Maintain history for SMA
    this.priceHistory.push(this.currentPrice);
    if (this.priceHistory.length > this.SMA_PERIOD) {
      this.priceHistory.shift(); // Keep memory footprint low
    }

    const sma = this.calculateSMA();

    return {
      timestamp: Date.now(),
      price: Number(this.currentPrice.toFixed(2)),
      sma20: sma ? Number(sma.toFixed(2)) : null,
      volume: Math.floor(Math.random() * 1000) + 100
    };
  }

  private calculateSMA(): number | null {
    if (this.priceHistory.length < this.SMA_PERIOD) return null;
    
    const sum = this.priceHistory.reduce((a, b) => a + b, 0);
    return sum / this.SMA_PERIOD;
  }

  private checkForVolatility(point: PricePoint) {
    if (!point.sma20) return;

    const diff = Math.abs(point.price - point.sma20);
    if (diff > this.volatilityThreshold) {
      const type = point.price > point.sma20 ? 'SPIKE' : 'DROP';
      const alert: VolatilityAlert = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type,
        message: `${this.currentTicker} Price deviating from SMA-20 ($${diff.toFixed(2)})`,
        severity: diff > (this.volatilityThreshold * 2) ? 'high' : 'medium'
      };
      
      // Debounce alerts slightly to avoid spamming
      if (Math.random() > 0.7) { 
        this.alertSubscribers.forEach(cb => cb(alert));
      }
    }
  }
}

export const marketService = new MarketDataService();