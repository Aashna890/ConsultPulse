import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#94a3b8",
  mixed: "#f59e0b",
};

export default function SentimentDonut({ data }) {
  const chartData = [
    { name: "Positive", value: data.positive || 0 },
    { name: "Negative", value: data.negative || 0 },
    { name: "Neutral", value: data.neutral || 0 },
    { name: "Mixed", value: data.mixed || 0 },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="relative h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={COLORS[entry.name.toLowerCase()]}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value} comments`, name]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-400">Total</p>
        </div>
      </div>
    </div>
  );
}