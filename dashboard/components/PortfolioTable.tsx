import { Position } from '@/types'

interface PortfolioTableProps {
  positions: Position[]
  loading: boolean
}

export default function PortfolioTable({ positions, loading }: PortfolioTableProps) {
  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[#2a2a2a] rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-[#2a2a2a] rounded"></div>
            <div className="h-4 bg-[#2a2a2a] rounded"></div>
            <div className="h-4 bg-[#2a2a2a] rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate totals
  const totalMarketValueAUD = positions.reduce((sum, p) => sum + (p.marketValueAUD || p.marketValue), 0)
  const totalPnL = positions.reduce((sum, p) => sum + (p.pnl || 0), 0)
  const totalChangePercent = totalMarketValueAUD > 0 ? (totalPnL / totalMarketValueAUD) * 100 : 0

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded overflow-hidden">
      <div className="px-6 py-4 border-b border-[#2a2a2a]">
        <h3 className="text-lg font-semibold text-white uppercase tracking-wide">Portfolio Holdings</h3>
        <p className="text-sm text-gray-500">Live prices with daily P&L</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-black">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ticker
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Port
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Share Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market Value
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market Value (AUD)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Change
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                P&L
              </th>
            </tr>
          </thead>
          <tbody className="bg-[#1a1a1a] divide-y divide-[#2a2a2a]">
            {positions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No positions found
                </td>
              </tr>
            ) : (
              <>
                {positions.map((position, index) => {
                  const valueAUD = position.marketValueAUD || position.marketValue
                  const portfolioWeight = position.portfolioWeight || 0
                  const priceChangePercent = position.priceChangePercent || 0
                  const pnl = position.pnl || 0
                  const isCash = position.ticker === 'CASH'

                  return (
                    <tr key={`${position.ticker}-${position.source}-${index}`} className={`hover:bg-[#252525] transition-colors ${isCash ? 'bg-[#1f1f1f]' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                        {position.ticker}
                        {position.currency && position.currency !== 'AUD' && !isCash && (
                          <span className="ml-2 px-1.5 py-0.5 bg-[#2a2a2a] text-gray-400 rounded text-xs">
                            {position.currency}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right font-medium">
                        {portfolioWeight.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right">
                        {isCash ? '-' : position.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-right">
                        {isCash ? '-' : position.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-white text-right">
                        ${valueAUD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                        priceChangePercent > 0 ? 'text-green-400' : priceChangePercent < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {isCash ? '-' : `${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                        pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {isCash ? '-' : `${pnl > 0 ? '+' : ''}$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                  )
                })}
                {/* Totals Row */}
                <tr className="bg-black border-t-2 border-[#3a3a3a] font-bold">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                    TOTAL
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-white text-right">
                    100.00%
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400 text-right">
                    -
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400 text-right">
                    -
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-white text-right text-lg">
                    ${totalMarketValueAUD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm text-right text-lg ${
                    totalChangePercent > 0 ? 'text-green-400' : totalChangePercent < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {totalChangePercent > 0 ? '+' : ''}{totalChangePercent.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm text-right text-lg ${
                    totalPnL > 0 ? 'text-green-400' : totalPnL < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {totalPnL > 0 ? '+' : ''}${Math.abs(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
