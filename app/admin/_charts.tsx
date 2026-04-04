'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Rides Per Hour Area Chart ──────────────────────────────────────────────
export function RidesPerHourChart({
  data,
}: {
  data: Array<{ hour: string; label: string; rides: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#9CA3AF]">
        No ride data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="rideGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#E5E7EB',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            fontSize: 12,
            color: '#111111',
          }}
          labelStyle={{ color: '#9CA3AF' }}
        />
        <Area
          type="monotone"
          dataKey="rides"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#rideGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Revenue Bar Chart ──────────────────────────────────────────────────────
const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RevenueChart({
  data,
}: {
  data: Array<{ date: string; label: string; revenue: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#9CA3AF]">
        No revenue data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#E5E7EB',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            fontSize: 12,
            color: '#111111',
          }}
          labelStyle={{ color: '#9CA3AF' }}
          formatter={(value: unknown) => [usd(Number(value ?? 0)), 'Revenue']}
        />
        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
