import React from 'react';
import { VolatilityAlert } from '../types';

interface AlertLogProps {
  alerts: VolatilityAlert[];
}

export const AlertLog: React.FC<AlertLogProps> = ({ alerts }) => {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 h-full flex flex-col">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Live Alerts</h3>
        <span className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded-full border border-red-700">
          Volatility Monitor Active
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 text-sm">No recent anomalies detected.</div>
        ) : (
          alerts.slice().reverse().map((alert) => (
            <div 
              key={alert.id} 
              className={`p-3 rounded-lg border-l-4 ${
                alert.severity === 'high' ? 'border-red-500 bg-red-900/20' : 'border-yellow-500 bg-yellow-900/10'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-xs font-bold uppercase ${
                  alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {alert.type}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-300 text-sm mt-1">{alert.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
