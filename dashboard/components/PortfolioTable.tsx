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

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded overflow-hidden">
      <div className="px-6 py-4 border-b border-[#2a2a2a]">
        <h3 className="text-lg font-semibold text-white uppercase tracking-wide">Top Holdings</h3>
        <p className="text-sm text-gray-500">Ranked by market value</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-black">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Portfolio
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
              positions.map((position, index) => {
                const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0)
                const percentage = totalValue > 0 ? (position.marketValue / totalValue) * 100 : 0

                return (
                  <tr key={`${position.ticker}-${position.source}-${index}`} className="hover:bg-[#252525] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {position.ticker}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      ${position.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white text-right">
                      ${position.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        position.source === 'IB'
                          ? 'bg-blue-900/30 text-blue-400 border border-blue-800'
                          : 'bg-green-900/30 text-green-400 border border-green-800'
                      }`}>
                        {position.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {percentage.toFixed(2)}%
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
