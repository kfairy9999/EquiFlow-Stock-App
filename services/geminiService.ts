import { GoogleGenAI } from "@google/genai";
import { PricePoint, VolatilityAlert } from "../types";

// Access the API key safely. 
// Note: process.env.API_KEY is assumed to be injected by the build system/environment.
const processApiKey = process.env.API_KEY;

export const generateMarketAnalysis = async (
  ticker: string, 
  data: PricePoint[], 
  alerts: VolatilityAlert[]
): Promise<string> => {
  if (!processApiKey) {
    console.warn("API Key is missing in process.env.API_KEY");
    return "Configuration Error: API Key is missing. Please ensure process.env.API_KEY is set correctly.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: processApiKey });

    // Format data for the prompt to save tokens, sample every 5th point if array is large
    // We take the last 50 points to give the model context of recent movement
    const recentData = data.slice(-50).map(p => 
      `[${new Date(p.timestamp).toLocaleTimeString()}] Price: ${p.price}, SMA20: ${p.sma20}`
    ).join('\n');

    const recentAlerts = alerts.slice(-3).map(a => `${a.type}: ${a.message}`).join('; ');

    const prompt = `
      Act as a Senior Technical Analyst. Analyze the following real-time market data snippet for ticker "${ticker}".
      
      Context:
      - This is high-frequency simulated data.
      - SMA (Simple Moving Average) period is 20.
      
      Data (Last 50 ticks):
      ${recentData}

      Recent Volatility Alerts:
      ${recentAlerts || "None"}

      Task:
      Provide a concise (max 3 sentences) technical assessment. 
      1. Identify the immediate trend (Bullish/Bearish/Neutral).
      2. Comment on the relationship between Price and SMA-20.
      3. Advise on potential volatility risks.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "Analysis currently unavailable (Empty response).";
    
  } catch (error: any) {
    console.error("Gemini Analysis Error Full Object:", error);
    
    const errorMessage = error.message || JSON.stringify(error);
    
    // Handle specific error codes for better user feedback
    if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
       return "Access Denied: API Key permission error. If using a key restricted by HTTP Referrer, ensure this domain is allowed in Google Cloud Console.";
    }
    
    if (errorMessage.includes('400') || errorMessage.includes('INVALID_ARGUMENT')) {
       return "Request Error: Invalid request format or model parameter.";
    }
    
    if (errorMessage.includes('429')) {
       return "Rate Limit Exceeded: Too many requests. Please try again later.";
    }

    return `Analysis Failed: ${errorMessage.substring(0, 150)}...`;
  }
};
