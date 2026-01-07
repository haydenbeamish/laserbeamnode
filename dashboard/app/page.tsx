'use client'

import { useState, useEffect } from 'react'
import PortfolioTable from '@/components/PortfolioTable'
import PortfolioCharts from '@/components/PortfolioCharts'
import PositionCalculator from '@/components/PositionCalculator'
import StopLossManager from '@/components/StopLossManager'
import { Position, PortfolioSummary } from '@/types'
import { RefreshCw } from 'lucide-react'

export default function Home() {
  const [positions, setPositions] = useState<Position[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calculator' | 'stoploss'>('dashboard')

  const fetchPortfolioData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/portfolio')
      const data = await response.json()
      setPositions(data.positions)
      setSummary(data.summary)
      setLastUpdate(new Date().toLocaleString())
    } catch (error) {
      console.error('Error fetching portfolio data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPortfolioData()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchPortfolioData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-black text-white p-6 border-b border-[#2a2a2a]">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">THE LASER BEAM FUND</h1>
          <p className="text-gray-400 text-sm mt-1">Portfolio Management Dashboard</p>
        </div>
      </header>

      <nav className="bg-black border-b border-[#2a2a2a]">
        <div className="container mx-auto px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-2 border-b-2 font-medium text-sm uppercase tracking-wider transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`py-4 px-2 border-b-2 font-medium text-sm uppercase tracking-wider transition-colors ${
                activeTab === 'calculator'
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Position Calculator
            </button>
            <button
              onClick={() => setActiveTab('stoploss')}
              className={`py-4 px-2 border-b-2 font-medium text-sm uppercase tracking-wider transition-colors ${
                activeTab === 'stoploss'
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Risk Management
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-6">
        {activeTab === 'dashboard' && (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white uppercase tracking-wide">Portfolio Snapshot</h2>
                {lastUpdate && (
                  <p className="text-sm text-gray-500 mt-1">Last updated: {lastUpdate}</p>
                )}
              </div>
              <button
                onClick={fetchPortfolioData}
                disabled={loading}
                className="flex items-center space-x-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white px-4 py-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm">Refresh</span>
              </button>
            </div>

            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 rounded">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Portfolio Value</p>
                  <p className="text-2xl font-bold text-white">
                    ${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 rounded">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Cash Balance</p>
                  <p className="text-2xl font-bold text-white">
                    ${summary.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 rounded">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Holdings</p>
                  <p className="text-2xl font-bold text-white">{summary.totalPositions}</p>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 rounded">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total FUM</p>
                  <p className="text-2xl font-bold text-white">
                    ${summary.fum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <PortfolioTable positions={positions} loading={loading} />
              </div>
              <div>
                <PortfolioCharts positions={positions} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'calculator' && (
          <PositionCalculator fum={summary?.fum || 0} />
        )}

        {activeTab === 'stoploss' && (
          <StopLossManager positions={positions} onUpdate={fetchPortfolioData} />
        )}
      </main>
    </div>
  )
}
