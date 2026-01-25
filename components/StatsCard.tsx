import React from 'react';

interface StatsCardProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  subValue?: string;
  icon?: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, trend, subValue, icon }) => {
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">{label}</span>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold text-white`}>{value}</span>
        {subValue && (
          <span className={`text-sm mb-1 font-medium ${trendColor}`}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
};
