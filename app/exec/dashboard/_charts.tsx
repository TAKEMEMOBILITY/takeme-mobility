'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RevenueBarChart({
  data,
}: {
  data: Array<{ date: string; label: string; revenue: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#71717a]">
        No revenue data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={{ stroke: '#1e1e2e' }}
          tickLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={{ stroke: '#1e1e2e' }}
          tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e1e2e',
            border: '1px solid #2e2e3e',
            borderRadius: 8,
            fontSize: 12,
            color: '#e4e4e7',
          }}
          labelStyle={{ color: '#71717a' }}
          formatter={(value: unknown) => [usd(Number(value ?? 0)), 'Revenue']}
        />
        <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
