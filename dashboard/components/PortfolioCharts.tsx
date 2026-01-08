'use client'

import { Position } from '@/types'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface PortfolioChartsProps {
  positions: Position[]
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
]

export default function PortfolioCharts({ positions }: PortfolioChartsProps) {
  // Prepare data for pie chart - show top 10 positions, group rest as "Others"
  const topPositions = positions.slice(0, 10)
  const othersValue = positions.slice(10).reduce((sum, pos) => sum + (pos.marketValueAUD || pos.marketValue), 0)

  const chartData = topPositions.map((pos) => ({
    name: pos.ticker,
    value: pos.marketValueAUD || pos.marketValue,
  }))

  if (othersValue > 0) {
    chartData.push({
      name: 'Others',
      value: othersValue,
    })
  }

  const totalValue = positions.reduce((sum, pos) => sum + (pos.marketValueAUD || pos.marketValue), 0)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Breakdown</h3>

      {positions.length === 0 ? (
        <p className="text-center text-gray-500">No data to display</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Top Holdings</h4>
            {topPositions.map((position, index) => {
              const valueAUD = position.marketValueAUD || position.marketValue
              const percentage = (valueAUD / totalValue) * 100
              return (
                <div key={`${position.ticker}-${index}`} className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-gray-700">{position.ticker}</span>
                  </div>
                  <span className="font-medium text-gray-900">{percentage.toFixed(2)}%</span>
                </div>
              )
            })}
            {othersValue > 0 && (
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[10 % COLORS.length] }}
                  ></div>
                  <span className="text-gray-700">Others</span>
                </div>
                <span className="font-medium text-gray-900">
                  {((othersValue / totalValue) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
