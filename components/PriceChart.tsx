import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line
} from 'recharts';
import { PricePoint } from '../types';

interface PriceChartProps {
  data: PricePoint[];
  color?: string;
}

const PriceChart: React.FC<PriceChartProps> = ({ data, color = "#10b981" }) => {
  // Optimization: Only render the last N points to keep the chart performant
  const visibleData = useMemo(() => {
    return data.slice(-100); 
  }, [data]);

  const minPrice = useMemo(() => {
    if (visibleData.length === 0) return 0;
    return Math.min(...visibleData.map(d => d.price)) * 0.995;
  }, [visibleData]);

  const maxPrice = useMemo(() => {
    if (visibleData.length === 0) return 0;
    return Math.max(...visibleData.map(d => d.price)) * 1.005;
  }, [visibleData]);

  if (visibleData.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">Waiting for data...</div>;
  }

  return (
    <div className="w-full h-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={visibleData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], {minute: '2-digit', second:'2-digit'})}
            stroke="#9ca3af"
            tick={{fontSize: 12}}
            minTickGap={50}
          />
          <YAxis 
            domain={[minPrice, maxPrice]} 
            stroke="#9ca3af"
            tick={{fontSize: 12}}
            width={60}
            tickFormatter={(val) => val.toFixed(2)}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563', color: '#f3f4f6' }}
            labelFormatter={(ts) => new Date(ts).toLocaleTimeString()}
            itemStyle={{ color: '#f3f4f6' }}
            formatter={(value: number) => [value.toFixed(2), '']}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={color} 
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            isAnimationActive={false}
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="sma20" 
            stroke="#f59e0b" 
            dot={false} 
            strokeWidth={2}
            strokeDasharray="5 5"
            isAnimationActive={false}
            name="SMA (20)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(PriceChart);
