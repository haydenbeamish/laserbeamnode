'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'

interface PositionCalculatorProps {
  fum: number
}

export default function PositionCalculator({ fum }: PositionCalculatorProps) {
  const [ticker, setTicker] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [riskPercentage, setRiskPercentage] = useState('1')

  const calculatePosition = () => {
    const entry = parseFloat(entryPrice)
    const stop = parseFloat(stopLoss)
    const target = parseFloat(targetPrice)
    const risk = parseFloat(riskPercentage)

    if (!entry || !stop || !target || !risk || fum === 0) {
      return null
    }

    const riskPerShare = Math.abs(entry - stop)
    const dollarRisk = (fum * risk) / 100
    const positionSize = Math.floor(dollarRisk / riskPerShare)
    const potentialProfit = (target - entry) * positionSize
    const riskRewardRatio = Math.abs((target - entry) / (entry - stop))

    return {
      positionSize,
      dollarRisk,
      potentialProfit,
      riskRewardRatio,
      positionValue: positionSize * entry,
    }
  }

  const calculation = calculatePosition()

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Calculator className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-800">Position Size Calculator</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ticker Symbol
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., AAPL"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entry Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stop Loss Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk (% of FUM)
            </label>
            <input
              type="number"
              step="0.1"
              value={riskPercentage}
              onChange={(e) => setRiskPercentage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1.0"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Calculation Results</h3>

          {calculation ? (
            <div className="space-y-4">
              <div className="border-b border-gray-200 pb-3">
                <p className="text-sm text-gray-600">FUM</p>
                <p className="text-xl font-bold text-gray-900">
                  ${fum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="border-b border-gray-200 pb-3">
                <p className="text-sm text-gray-600">Position Size</p>
                <p className="text-2xl font-bold text-blue-600">
                  {calculation.positionSize.toLocaleString()} shares
                </p>
              </div>

              <div className="border-b border-gray-200 pb-3">
                <p className="text-sm text-gray-600">Position Value</p>
                <p className="text-xl font-semibold text-gray-900">
                  ${calculation.positionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="border-b border-gray-200 pb-3">
                <p className="text-sm text-gray-600">Dollar Risk (if stop hit)</p>
                <p className="text-xl font-semibold text-red-600">
                  ${calculation.dollarRisk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="border-b border-gray-200 pb-3">
                <p className="text-sm text-gray-600">Potential Profit (if target hit)</p>
                <p className="text-xl font-semibold text-green-600">
                  ${calculation.potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Risk/Reward Ratio</p>
                <p className="text-3xl font-bold text-blue-600">
                  1:{calculation.riskRewardRatio.toFixed(2)}
                </p>
                {calculation.riskRewardRatio < 2 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Warning: Risk/Reward ratio is below 2:1
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center">
              Enter all values to calculate position size
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
