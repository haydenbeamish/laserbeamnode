export interface Position {
  ticker: string
  symbol: string
  securityDescription?: string
  quantity: number
  currentPrice: number
  previousClose?: number
  priceChange?: number
  priceChangePercent?: number
  currency?: string
  marketValue: number
  marketValueAUD?: number
  audConversionRate?: number
  pnl?: number
  portfolioWeight?: number
  source: 'IB' | 'External' | 'NAV'
  stopLoss?: number
  stopLossType?: 'initial' | 'trailing' | 'breakeven'
  trailingDays?: number
  targetPrice?: number
  riskAmount?: number
}

export interface PortfolioSummary {
  totalValue: number
  cashBalance: number
  totalPositions: number
  fum: number
  totalPnL?: number
  totalChangePercent?: number
  maxDrawdown?: number
  totalRisk?: number
}

export interface StopLossData {
  ticker: string
  stopLoss: number
  stopLossType: 'initial' | 'trailing' | 'breakeven'
  trailingDays?: number
}

export interface PositionCalculation {
  ticker: string
  entryPrice: number
  stopLoss: number
  targetPrice: number
  riskPercentage: number
  fum: number
  positionSize: number
  dollarRisk: number
  potentialProfit: number
  riskRewardRatio: number
}

export interface EmailAttachment {
  name: string
  contentBytes: string
  contentType: string
}

export interface UpdateLog {
  timestamp: string
  file: string
  status: 'success' | 'error'
  message: string
}
