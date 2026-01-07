'use client'

import { useState, useEffect } from 'react'
import { Position, StopLossData } from '@/types'
import { Shield, AlertTriangle } from 'lucide-react'

interface StopLossManagerProps {
  positions: Position[]
  onUpdate: () => void
}

export default function StopLossManager({ positions, onUpdate }: StopLossManagerProps) {
  const [stopLossData, setStopLossData] = useState<{ [ticker: string]: StopLossData }>({})
  const [editingTicker, setEditingTicker] = useState<string | null>(null)

  useEffect(() => {
    // Load stop loss data from localStorage or API
    const savedData = localStorage.getItem('stopLossData')
    if (savedData) {
      setStopLossData(JSON.parse(savedData))
    }
  }, [])

  const handleSaveStopLoss = (ticker: string, data: StopLossData) => {
    const newData = { ...stopLossData, [ticker]: data }
    setStopLossData(newData)
    localStorage.setItem('stopLossData', JSON.stringify(newData))
    setEditingTicker(null)
  }

  const calculateRisk = (position: Position, stopLoss: number) => {
    const riskPerShare = Math.abs(position.currentPrice - stopLoss)
    return riskPerShare * position.quantity
  }

  const totalPortfolioRisk = positions.reduce((total, position) => {
    const data = stopLossData[position.ticker]
    if (data) {
      return total + calculateRisk(position, data.stopLoss)
    }
    return total
  }, 0)

  const totalPortfolioValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0)
  const maxDrawdownPercentage = totalPortfolioValue > 0 ? (totalPortfolioRisk / totalPortfolioValue) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Stop Loss Manager</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Portfolio Risk</p>
            <p className="text-2xl font-bold text-red-600">
              ${totalPortfolioRisk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Max Portfolio Drawdown</p>
            <p className="text-2xl font-bold text-amber-600">
              {maxDrawdownPercentage.toFixed(2)}%
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Positions with Stop Loss</p>
            <p className="text-2xl font-bold text-green-600">
              {Object.keys(stopLossData).length} / {positions.length}
            </p>
          </div>
        </div>

        {maxDrawdownPercentage > 20 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">High Risk Warning</p>
              <p className="text-sm text-red-700">
                Your maximum portfolio drawdown exceeds 20%. Consider reviewing your stop losses.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Market Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stop Loss
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk ($)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {positions.map((position) => {
                const data = stopLossData[position.ticker]
                const isEditing = editingTicker === position.ticker
                const risk = data ? calculateRisk(position, data.stopLoss) : 0

                return (
                  <tr key={position.ticker} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {position.ticker}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${position.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${position.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isEditing ? (
                        <StopLossEditor
                          position={position}
                          existingData={data}
                          onSave={(newData) => handleSaveStopLoss(position.ticker, newData)}
                          onCancel={() => setEditingTicker(null)}
                        />
                      ) : (
                        <span className="text-gray-900">
                          {data ? `$${data.stopLoss.toFixed(2)}` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {data && !isEditing && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          data.stopLossType === 'initial'
                            ? 'bg-blue-100 text-blue-800'
                            : data.stopLossType === 'trailing'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {data.stopLossType}
                          {data.trailingDays ? ` (${data.trailingDays}d)` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {data && !isEditing && (
                        <span className={risk > position.marketValue * 0.1 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                          ${risk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!isEditing && (
                        <button
                          onClick={() => setEditingTicker(position.ticker)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {data ? 'Edit' : 'Set Stop'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface StopLossEditorProps {
  position: Position
  existingData?: StopLossData
  onSave: (data: StopLossData) => void
  onCancel: () => void
}

function StopLossEditor({ position, existingData, onSave, onCancel }: StopLossEditorProps) {
  const [stopLoss, setStopLoss] = useState(existingData?.stopLoss.toString() || '')
  const [stopLossType, setStopLossType] = useState<'initial' | 'trailing' | 'breakeven'>(
    existingData?.stopLossType || 'initial'
  )
  const [trailingDays, setTrailingDays] = useState(existingData?.trailingDays?.toString() || '10')

  const handleSave = () => {
    if (!stopLoss) return

    onSave({
      ticker: position.ticker,
      stopLoss: parseFloat(stopLoss),
      stopLossType,
      trailingDays: stopLossType === 'trailing' ? parseInt(trailingDays) : undefined,
    })
  }

  return (
    <div className="space-y-2 py-2">
      <input
        type="number"
        step="0.01"
        value={stopLoss}
        onChange={(e) => setStopLoss(e.target.value)}
        className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
        placeholder="Price"
      />
      <select
        value={stopLossType}
        onChange={(e) => setStopLossType(e.target.value as any)}
        className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
      >
        <option value="initial">Initial</option>
        <option value="trailing">Trailing</option>
        <option value="breakeven">Breakeven</option>
      </select>
      {stopLossType === 'trailing' && (
        <input
          type="number"
          value={trailingDays}
          onChange={(e) => setTrailingDays(e.target.value)}
          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
          placeholder="Days"
        />
      )}
      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
