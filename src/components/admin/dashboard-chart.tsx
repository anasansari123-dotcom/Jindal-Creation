"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";

export function DashboardChart({
  data,
}: {
  data: Array<{ date: string; sales: number }>;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[280px] items-center justify-center text-sm text-gray-500">
        Is period mein koi sales nahi
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(d) =>
            new Date(d).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            })
          }
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
          labelFormatter={(label) => formatDate(String(label))}
        />
        <Bar dataKey="sales" fill="#8b6914" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
