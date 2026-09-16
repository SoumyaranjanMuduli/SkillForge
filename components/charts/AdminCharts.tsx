'use client'

import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const DONUT_COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9']

export function ActivityLineChart({ data }: { data: { day: string; count: number }[] }) {
  return <div className="h-56 w-full animate-fade-in">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
        <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} fill="url(#activityFill)" isAnimationActive animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}

export function ProgramBarChart({ data }: { data: { name: string; value: number }[] }) {
  return <div className="h-64 w-full animate-fade-in">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={900}>
          {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
}

export function ProgramDonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  return <div className="flex items-center gap-6">
    <div className="h-40 w-40 shrink-0 animate-scale-in">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3} isAnimationActive animationDuration={800}>
            {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <div className="stagger space-y-2 text-sm">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
          <span className="text-slate-600">{d.name}</span>
          <span className="font-semibold text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  </div>
}
