import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Position } from '@/types'

export function parsePortfolioCSV(csvContent: string): Position[] {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  })

  const positions: Position[] = []

  parsed.data.forEach((row: any) => {
    // IB Flex Query format uses these column names
    const symbol = row.Symbol || row.Ticker
    // Column H is PositionValueInBase (position value in base currency)
    const marketValue = parseFloat(
      row.PositionValueInBase ||
      row.PositionValue ||
      row['Market Value'] ||
      row.Value ||
      0
    )
    const multiplier = parseFloat(row.Multiplier || row.Quantity || row.Shares || 1)
    const costBasis = parseFloat(row.CostBasisPrice || row.CostBasis || row.Price || 0)

    // Only include positions with valid symbol and market value
    if (symbol && marketValue !== 0) {
      // Calculate current price if not provided
      let currentPrice = 0
      if (multiplier > 0 && marketValue > 0) {
        currentPrice = Math.abs(marketValue / multiplier)
      }

      positions.push({
        ticker: symbol,
        symbol: symbol,
        quantity: multiplier,
        currentPrice: currentPrice,
        marketValue: Math.abs(marketValue),
        source: 'IB',
      })
    }
  })

  console.log('CSV parsing debug:', {
    totalRows: parsed.data.length,
    positionsFound: positions.length,
    firstRow: parsed.data[0]
  })

  return positions
}

export function parseNAVCSV(csvContent: string): number {
  const parsed = Papa.parse(csvContent, {
    header: false,
    skipEmptyLines: true,
  })

  // Get the last row, column B (index 1)
  const rows = parsed.data as string[][]
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1]
    const cashBalance = parseFloat(lastRow[1] || '0')
    return cashBalance
  }

  return 0
}

export function parseExternalHoldings(filePath: string): Position[] {
  try {
    const fs = require('fs')
    const path = require('path')

    // Resolve the file path relative to the project root
    const resolvedPath = path.resolve(process.cwd(), filePath)

    console.log('Attempting to read external holdings:', {
      originalPath: filePath,
      resolvedPath: resolvedPath,
      fileExists: fs.existsSync(resolvedPath)
    })

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error('External holdings file not found at:', resolvedPath)
      console.error('Please place the Externalholdings.xlsx file in the data/ directory')
      return []
    }

    const workbook = XLSX.readFile(resolvedPath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    const positions: Position[] = []

    console.log('External holdings file structure:', {
      totalRows: data.length,
      firstThreeRows: data.slice(0, 3)
    })

    // Skip header rows (rows 0 and 1), start from index 2
    for (let i = 2; i < data.length; i++) {
      const row = data[i]

      // Skip empty rows
      if (!row[0] || row[0].toString().trim() === '') continue

      // Column A has format: "COMPANY NAME (EXCHANGE:TICKER)"
      const codeCell = row[0].toString()

      // Extract ticker from parentheses
      const tickerMatch = codeCell.match(/\(([^:]+):([^)]+)\)/)
      let ticker = ''

      if (tickerMatch) {
        // Extract just the ticker symbol (e.g., "LLM" from "XASX:LLM")
        ticker = tickerMatch[2]
      } else {
        // If no parentheses, use the whole cell value
        ticker = codeCell
      }

      // Column B: Shares (may have commas)
      const sharesValue = row[1]
      const quantity = typeof sharesValue === 'number'
        ? sharesValue
        : parseFloat(sharesValue?.toString().replace(/,/g, '') || '0')

      // Column D: Value (may have $ and commas)
      const valueCell = row[3]
      const marketValue = typeof valueCell === 'number'
        ? valueCell
        : parseFloat(valueCell?.toString().replace(/[$,]/g, '') || '0')

      // Only add positions with valid data
      if (ticker && quantity > 0 && marketValue > 0) {
        const currentPrice = marketValue / quantity

        positions.push({
          ticker,
          symbol: ticker,
          quantity,
          currentPrice,
          marketValue,
          source: 'External',
        })
      }
    }

    console.log('External holdings parsed:', positions.length, 'positions')
    return positions
  } catch (error) {
    console.error('Error parsing external holdings:', error)
    return []
  }
}

export function combinePositions(ibPositions: Position[], externalPositions: Position[]): Position[] {
  const allPositions = [...ibPositions, ...externalPositions]

  // Sort by market value descending
  return allPositions.sort((a, b) => b.marketValue - a.marketValue)
}
