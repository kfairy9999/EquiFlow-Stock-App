import React, { useEffect, useState, useRef, useCallback } from 'react';
import { marketService } from './services/marketDataService';
import { generateMarketAnalysis } from './services/geminiService';
import { PricePoint, VolatilityAlert, ConnectionStatus, MarketStats, SearchResult, MarketStatusInfo } from './types';
import PriceChart from './components/PriceChart';
import { StatsCard } from './components/StatsCard';
import { AlertLog } from './components/AlertLog';

// Icons
const ActivityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>;
const ChipIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;

function App() {
  // --- STATE ---
  const [ticker, setTicker] = useState('AAPL');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Market Status State
  const [marketStatus, setMarketStatus] = useState<MarketStatusInfo>(marketService.getMarketStatus());

  // High-frequency data buffer
  const dataRef = useRef<PricePoint[]>([]);
  
  // Throttled UI state
  const [displayData, setDisplayData] = useState<PricePoint[]>([]);
  const [alerts, setAlerts] = useState<VolatilityAlert[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [stats, setStats] = useState<MarketStats>({
    currentPrice: 0, high: 0, low: 0, open: 0, volume: 0, change: 0, changePercent: 0
  });

  // Settings State
  const [threshold, setThreshold] = useState(marketService.getVolatilityThreshold());

  // AI Analysis State
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- EFFECTS ---

  // Handle Search Debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (searchQuery.trim().length > 0) {
      setIsSearching(true);
      searchTimeoutRef.current = window.setTimeout(async () => {
        const results = await marketService.searchSymbols(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
        setShowResults(true);
      }, 300);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  // Handle Data Subscription
  useEffect(() => {
    // 1. Subscribe to Status
    const unsubStatus = marketService.onStatusChange(setStatus);

    // Reset data on ticker change
    dataRef.current = [];
    setDisplayData([]);
    setAlerts([]); 
    setAnalysis(null);

    // 2. Subscribe to Ticker Data
    const unsubTicker = marketService.subscribeToTicker(ticker, (point) => {
      dataRef.current.push(point);
      if (dataRef.current.length > 500) dataRef.current.shift();
      
      const currentPrice = point.price;
      const open = dataRef.current[0]?.price || currentPrice;
      const change = currentPrice - open;
      const changePercent = (change / open) * 100;
      
      setStats({
        currentPrice,
        open,
        high: Math.max(...dataRef.current.slice(-50).map(p => p.price)),
        low: Math.min(...dataRef.current.slice(-50).map(p => p.price)),
        volume: dataRef.current.reduce((acc, p) => acc + p.volume, 0),
        change,
        changePercent
      });
    });

    // 3. Subscribe to Alerts
    const unsubAlerts = marketService.onAlert((alert) => {
      setAlerts(prev => [...prev.slice(-19), alert]); // Keep last 20
    });

    // 4. Throttled UI Update Loop & Market Status Polling
    const renderLoop = setInterval(() => {
      setDisplayData([...dataRef.current]); 
      // Update market status every second (or same tick as data update for simplicity)
      setMarketStatus(marketService.getMarketStatus());
    }, 200); 

    // Additional slower poll for market status to ensure countdown accuracy even if data pauses
    const statusInterval = setInterval(() => {
      setMarketStatus(marketService.getMarketStatus());
    }, 1000);

    return () => {
      unsubStatus();
      unsubTicker();
      unsubAlerts();
      clearInterval(renderLoop);
      clearInterval(statusInterval);
    };
  }, [ticker]);

  // --- HANDLERS ---

  const handleSelectTicker = (symbol: string) => {
    setTicker(symbol);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysis("Connecting to Gemini...");
    const result = await generateMarketAnalysis(ticker, dataRef.current, alerts);
    setAnalysis(result);
    setIsAnalyzing(false);
  }, [alerts, ticker]);

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setThreshold(val);
    marketService.setVolatilityThreshold(val);
  };

  // --- RENDER ---

  const isConnected = status === ConnectionStatus.CONNECTED;

  // Helper to determine text color based on analysis content (error vs success)
  const getAnalysisColor = () => {
    if (!analysis) return 'text-gray-500 italic';
    const lower = analysis.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('access denied')) {
      return 'text-red-400';
    }
    return 'text-gray-200';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col" onClick={() => setShowResults(false)}>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden sm:block">EquiFlow <span className="text-gray-500 font-normal ml-2 text-sm">Real-Time Dashboard</span></h1>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-md mx-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500"><SearchIcon /></span>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg leading-5 bg-gray-900 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-800 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
              placeholder="Search Ticker (e.g. AAPL, MSFT, TSLA)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
          
          {/* Dropdown Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute mt-1 w-full bg-gray-800 shadow-xl rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto max-h-60 focus:outline-none sm:text-sm z-50 border border-gray-700">
              {searchResults.map((result) => (
                <div
                  key={result.symbol}
                  className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-700 flex justify-between items-center group"
                  onClick={() => handleSelectTicker(result.symbol)}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-white">{result.symbol}</span>
                    <span className="text-gray-400 text-xs">{result.name}</span>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-gray-300 font-mono">${result.price.toFixed(2)}</span>
                     <span className="text-gray-500 text-xs">{result.sector}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Market Status Widget */}
          <div className="hidden lg:flex items-center gap-2 text-sm bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-700">
             <div className={`w-2 h-2 rounded-full ${marketStatus.isOpen ? 'bg-green-400' : 'bg-gray-500'}`}></div>
             <div className="flex flex-col leading-none">
               <span className="text-gray-300 font-semibold text-xs">{marketStatus.message}</span>
               <span className="text-gray-500 text-[10px] uppercase tracking-wide">{marketStatus.countdown}</span>
             </div>
          </div>

          <div className="w-px h-8 bg-gray-700 hidden lg:block"></div>

          <div className="flex items-center gap-2 text-sm bg-gray-900 px-3 py-1.5 rounded-full border border-gray-700 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-gray-400 hidden sm:inline">{status}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
        
        {/* Left Col: Chart & Stats */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard 
              label="Current Price" 
              value={`$${stats.currentPrice.toFixed(2)}`} 
              subValue={`${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(2)} (${stats.changePercent.toFixed(2)}%)`}
              trend={stats.change >= 0 ? 'up' : 'down'}
            />
            <StatsCard 
              label="SMA (20)" 
              value={displayData.length > 0 ? `$${displayData[displayData.length-1]?.sma20?.toFixed(2) || '--'}` : '--'} 
              trend="neutral"
              icon={<ActivityIcon />}
            />
             <StatsCard 
              label="Session High" 
              value={`$${stats.high.toFixed(2)}`} 
              trend="up"
            />
             <StatsCard 
              label="Session Volume" 
              value={stats.volume.toLocaleString()} 
              trend="neutral"
            />
          </div>

          {/* Chart Area */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-1 h-[500px] relative shadow-lg">
             {/* Chart Overlay Header */}
            <div className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur px-3 py-1 rounded text-xs text-gray-400 border border-gray-700 flex gap-2 items-center">
              <span className="font-bold text-white">{ticker}</span>
              <span className="w-px h-3 bg-gray-600"></span>
              <span>US Equity</span>
              <span className="w-px h-3 bg-gray-600"></span>
              <span>1s Interval</span>
            </div>
            <PriceChart data={displayData} />
          </div>

          {/* AI Analysis Panel */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl border border-blue-900/30 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <ChipIcon />
            </div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-blue-100">
                <span className="text-blue-500"><ChipIcon /></span>
                Gemini Market Analyst
              </h2>
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing || !isConnected}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                  isAnalyzing 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                }`}
              >
                {isAnalyzing ? 'Analyzing...' : 'Generate Analysis'}
              </button>
            </div>
            
            <div className={`p-4 rounded-lg bg-gray-900/50 border border-gray-700/50 text-sm leading-relaxed ${getAnalysisColor()}`}>
              {analysis || "Click 'Generate Analysis' to get real-time technical insights from Gemini based on the current chart pattern and volatility alerts."}
            </div>
          </div>
        </div>

        {/* Right Col: Alerts & Feed & Config */}
        <div className="lg:col-span-1 flex flex-col gap-6 h-full min-h-[500px]">
          
          {/* Configuration Panel */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Configuration</h3>
              </div>
              
              <div>
                  <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Volatility Threshold</span>
                      <span className="font-mono text-blue-400 font-bold">${threshold.toFixed(2)}</span>
                  </div>
                  <input 
                      type="range" 
                      min="0.5" 
                      max="10.0" 
                      step="0.1" 
                      value={threshold}
                      onChange={handleThresholdChange}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-gray-500 font-mono">
                      <span>$0.50</span>
                      <span>$10.00</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                      Adjusts sensitivity for "Spike" and "Drop" alerts relative to SMA-20. Lower values trigger more alerts.
                  </p>
              </div>
          </div>

          <div className="flex-1 min-h-0">
             <AlertLog alerts={alerts} />
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;