import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import type { MonthResult } from '../types';

interface Props { userPath: MonthResult[]; ghostPath: MonthResult[]; markerMonth: number }

export default function NetWorthChart({ userPath, ghostPath, markerMonth }: Props) {
  const data = userPath.map((m, i) => ({
    month: m.month,
    year: Math.round((m.month / 12) * 10) / 10,
    you: m.netWorth,
    benchmark: ghostPath[i]?.netWorth ?? null,
  }));

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 13, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#41513c" strokeDasharray="3 3" />
          <XAxis dataKey="year" stroke="#c1cbb9" tick={{ fontSize: 11 }} label={{ value: 'Year', position: 'insideBottom', offset: -4, fill: '#c1cbb9', fontSize: 11 }} />
          <YAxis stroke="#c1cbb9" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
          <Tooltip
            contentStyle={{ background: '#344238', border: '1px solid #68785f', borderRadius: 8, fontSize: 12, color: '#f5f1e7' }}
            formatter={(v) => `$${Number(v ?? 0).toLocaleString()}`}
          />
          <Line type="monotone" dataKey="you" name="You" stroke="#d4dfc7" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#e7dca0" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <ReferenceLine x={Math.round((markerMonth / 12) * 10) / 10} stroke="#c5d0bf" strokeDasharray="2 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
