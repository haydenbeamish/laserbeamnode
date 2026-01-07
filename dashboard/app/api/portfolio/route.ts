import { NextResponse } from 'next/server'
import { getLatestEmailWithAttachment } from '@/lib/graphClient'
import { parsePortfolioCSV, parseNAVCSV, parseExternalHoldings, combinePositions } from '@/lib/dataParser'
import { saveFile, logUpdate, getLatestUpdateTime } from '@/lib/fileUtils'
import { Position, PortfolioSummary } from '@/types'

const IB_EMAIL = process.env.IB_EMAIL_ADDRESS || 'donotreply@interactivebrokers.com'
const EXTERNAL_HOLDINGS_PATH = process.env.EXTERNAL_HOLDINGS_PATH || ''

export async function GET() {
  try {
    let ibPositions: Position[] = []
    let cashBalance = 0
    let externalPositions: Position[] = []

    // 1. Fetch Portfolio CSV from Interactive Brokers
    try {
      console.log('Searching for Portfolio email from:', IB_EMAIL)
      const portfolioEmail = await getLatestEmailWithAttachment(IB_EMAIL, '.Portfolio.')

      if (portfolioEmail) {
        const { attachment } = portfolioEmail
        console.log('Found Portfolio attachment:', attachment.name)
        const csvContent = Buffer.from(attachment.contentBytes, 'base64').toString('utf-8')

        // Save file
        const fileName = attachment.name
        saveFile(fileName, csvContent)

        // Parse CSV
        ibPositions = parsePortfolioCSV(csvContent)

        console.log('Parsed positions:', ibPositions.length)
        // Log success
        logUpdate(fileName, 'success', `Fetched ${ibPositions.length} positions from IB Portfolio`)
      } else {
        console.log('No Portfolio email found with attachment containing ".Portfolio."')
        logUpdate('Portfolio.csv', 'error', 'No email found with Portfolio attachment')
      }
    } catch (error) {
      console.error('Error fetching portfolio email:', error)
      logUpdate('Portfolio.csv', 'error', `Failed to fetch: ${error}`)
    }

    // 2. Fetch NAV CSV from Interactive Brokers
    try {
      console.log('Searching for NAV email from:', IB_EMAIL)
      const navEmail = await getLatestEmailWithAttachment(IB_EMAIL, '.NAV.')

      if (navEmail) {
        const { attachment } = navEmail
        console.log('Found NAV attachment:', attachment.name)
        const csvContent = Buffer.from(attachment.contentBytes, 'base64').toString('utf-8')

        // Save file
        const fileName = attachment.name
        saveFile(fileName, csvContent)

        // Parse CSV for cash balance
        cashBalance = parseNAVCSV(csvContent)

        console.log('Parsed cash balance:', cashBalance)
        // Log success
        logUpdate(fileName, 'success', `Fetched cash balance: $${cashBalance.toLocaleString()}`)
      } else {
        console.log('No NAV email found with attachment containing ".NAV."')
      }
    } catch (error) {
      console.error('Error fetching NAV email:', error)
      logUpdate('NAV.csv', 'error', `Failed to fetch: ${error}`)
    }

    // 3. Read External Holdings Excel
    try {
      if (EXTERNAL_HOLDINGS_PATH) {
        externalPositions = parseExternalHoldings(EXTERNAL_HOLDINGS_PATH)
        logUpdate('Externalholdings.xlsx', 'success', `Read ${externalPositions.length} external positions`)
      }
    } catch (error) {
      console.error('Error reading external holdings:', error)
      logUpdate('Externalholdings.xlsx', 'error', `Failed to read: ${error}`)
    }

    // Combine and sort positions
    const allPositions = combinePositions(ibPositions, externalPositions)

    // Calculate summary
    const totalMarketValue = allPositions.reduce((sum, pos) => sum + pos.marketValue, 0)
    const fum = totalMarketValue + cashBalance

    const summary: PortfolioSummary = {
      totalValue: totalMarketValue,
      cashBalance,
      totalPositions: allPositions.length,
      fum,
    }

    // Add update timestamps
    const portfolioUpdateTime = getLatestUpdateTime('Portfolio.csv')
    const navUpdateTime = getLatestUpdateTime('NAV.csv')

    return NextResponse.json({
      positions: allPositions,
      summary,
      lastUpdate: {
        portfolio: portfolioUpdateTime,
        nav: navUpdateTime,
      },
    })
  } catch (error) {
    console.error('Error in portfolio API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500 }
    )
  }
}
