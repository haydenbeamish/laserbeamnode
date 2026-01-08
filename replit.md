# Laser Beam Capital API

## Overview
Backend API for Laser Beam Capital that provides financial data endpoints and an admin panel for managing site content. Data is stored in a PostgreSQL database and can be updated through the admin interface.

## Project Structure
- `index.js` - Main Express server with all API routes, admin authentication, and performance calculation logic
- `public/admin.html` - Admin panel interface for data management with auto-calculated metrics display
- `shared/schema.ts` - Database schema (single site_data table with JSONB columns)
- `migrate-excel.js` - Script to migrate/seed data to database
- `LaserBeamExcel.xlsx` - Original Excel data source (for reference)

## Database
PostgreSQL database with simplified schema:
- `site_data` - Single table storing all site content as JSONB:
  - `performance` - Contains `monthlyData` array with NAV and MGWD index values
  - `stats` - Manual statistics (avgNet, avgCash only)
  - `funds` - Fund information
  - `holdings` - Top holdings
  - `exposure` - Net exposure, sector, and market cap data
  - `text` - Text content sections
  - `date_updated` - Auto-set timestamp when data is saved

## API Endpoints

### Public Endpoints
- `GET /` - Welcome message
- `GET /api/performance` - Optimized endpoint returning ALL site data with calculated metrics
- `GET /api/markets` - Live market data for ~100 tickers from Yahoo Finance (cached 20 min)
- `GET /api/portfolio` - Portfolio positions and summary from IB emails + external holdings (cached 5 min)
- `GET /posts` - Fetch posts from Beehiiv API
- `GET /selectedpost/:id` - Fetch specific post by ID

### Admin Endpoints
- `GET /admin` - Admin panel interface
- `POST /api/admin/login` - Admin authentication (username: admin, password: ADMIN_PASSWORD secret)
- `GET /api/admin/data` - Load all site data (requires auth)
- `POST /api/admin/data` - Save all site data (requires auth, full overwrite)

## Environment Variables (Secrets)
- `ADMIN_PASSWORD` - Password for admin login
- `BEEHIIV_API_KEY` - Beehiiv API key for blog posts
- `OPENROUTER` - OpenRouter API key for AI market summaries
- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Replit)
- `AZURE_CLIENT_ID` - Microsoft Azure app client ID for Graph API
- `AZURE_CLIENT_SECRET` - Microsoft Azure app client secret
- `AZURE_TENANT_ID` - Microsoft Azure tenant ID
- `IB_EMAIL_ADDRESS` - Interactive Brokers email address (default: donotreply@interactivebrokers.com)

## Admin Panel Features
- Login with username "admin" and password from ADMIN_PASSWORD secret
- **Performance Data Input**: Enter LBF NAV and MGWD Index per month
- **Auto-Calculated Metrics** (displayed in green, read-only):
  - Month % (current NAV / previous NAV - 1)
  - Quarter % (rolling 3 months compounded)
  - FY26 % (compounded from July 2025)
  - 1 Year % (calculated when 12+ months exist)
  - Best/Worst Month (LBF)
  - MSCI AW Best/Worst
  - Upside Capture (avg positive LBF / avg positive MGWD when MGWD > 0)
  - Downside Capture (avg negative LBF / avg negative MGWD when MGWD < 0)
  - Beta (SLOPE of LBF returns vs MGWD returns)
- **Manual Input**: Avg Net Exposure, Avg Cash Balance
- Edit: Fund details, Holdings, Exposure (sectors, market cap), Text content
- Visual highlighting of changed fields
- Date auto-updates on save

## Running the Project
- Start: `npm start` (runs on port 5000, host 0.0.0.0)
- Migrate/Seed data: `node migrate-excel.js`

## Data Format Notes
- NAV values stored with full precision (e.g., 1.03, 1.12)
- MGWD Index stored as the index value (e.g., 425.45, 468.65)
- First month (June 2025) is baseline: NAV = 1.00, MGWD = 425.45
- Calculated percentages rounded to 1 decimal place
- Capture ratios and Beta rounded to whole numbers
- The /api/performance endpoint calculates all metrics on-the-fly from monthlyData

## Performance Calculation Logic (in index.js)
```javascript
// Monthly return: (currentNAV / previousNAV) - 1
// Quarter: Rolling 3-month compound return
// FY26: Compound from July 2025 onwards
// Upside Capture: avgLBF(when MGWD>0) / avgMGWD(when MGWD>0) * 100
// Downside Capture: avgLBF(when MGWD<0) / avgMGWD(when MGWD<0) * 100
// Beta: SLOPE formula (linear regression of LBF vs MGWD returns)
```

## Markets Endpoint Details (/api/markets)
Fetches live market data from Yahoo Finance for ~100 tickers across 9 categories:
- Global Markets, Commodities, Forex, USA Sectors, ASX Sectors, USA Equal Weight Sectors, USA Thematics

**Response format:**
```json
{
  "markets": [
    {
      "ticker": "SPX",
      "name": "S&P 500",
      "category": "Global Markets",
      "lastPrice": 6902.05,
      "chg1d": 0.6,
      "chg1m": 0.8,
      "chg1q": 2.8,
      "chg1y": 17.4,
      "pxVs10d": 0.2,
      "pxVs20d": 0.6,
      "pxVs100d": 3.1,
      "pxVs200d": 9.6
    }
  ],
  "updatedAt": "2026-01-06T03:46:53.687Z"
}
```

**Implementation details:**
- Uses yahoo-finance2 Node.js library with p-limit for rate limiting
- Fetches ~400 days of historical data per ticker to calculate moving averages
- **Refreshes every 20 minutes** (visitors always see cached data)
- Trading day lookbacks: 1d=1, 1m=21, 1q=63, 1y=252 days
- Moving average windows: 10, 20, 200 days
- Ticker mapping stored in `ticker_map.json`
- Service logic in `marketDataService.js`

## Portfolio Endpoint Details (/api/portfolio)
Parses NAV Portfolio Notebook Excel files from daily emails to display portfolio positions with live pricing.

**Data source:** Reporting@navbackoffice.com emails with subject "Daily Reports"
- Extracts ZIP attachment, finds "NAV Portfolio Notebook" Excel file
- Parses "Portfolio Valuation" tab for positions

**Excel columns parsed:**
- Column A: Stock name
- Column C: Ticker (Bloomberg format, e.g., "AMZN US", "S32 AU")
- Column E: Quantity
- Column F: Settlement Price (fallback)
- Column G/H: Market Value (fallback in native/AUD)
- Column M: % of AUM

**Response format:**
```json
{
  "positions": [
    {
      "ticker": "AMZN",
      "symbol": "AMZN",
      "name": "Amazon.Com Inc",
      "quantity": 3400,
      "currentPrice": 241.56,
      "previousClose": 240.92,
      "priceChange": 0.64,
      "priceChangePercent": 0.27,
      "currency": "USD",
      "marketValue": 821304,
      "marketValueAUD": 1225467.70,
      "audConversionRate": 1.4921,
      "pnl": 3308.76,
      "portfolioWeight": 4.69,
      "isLivePrice": true
    }
  ],
  "summary": {
    "totalValue": 19481609.99,
    "cashBalance": 5945793.32,
    "totalPositions": 21,
    "fum": 25427403.31,
    "totalPnL": -53898.98,
    "totalChangePercent": -0.21
  },
  "updatedAt": "2026-01-08T08:09:53.123Z"
}
```

**Implementation details:**
- Ticker cleaning: Strips exchange suffix ("AMZN US" → "AMZN", "S32 AU" → "S32.AX")
- Live pricing: Yahoo Finance with forex rate caching (USDAUD, CADAUD)
- Fallback pricing: Uses Excel settlement price/market value when Yahoo unavailable (marked isLivePrice: false)
- Cash calculation: 100% - sum of position % AUM values
- **Refreshes every 5 minutes** (cached between refreshes)
- Service logic in `portfolioService.js`

## Recent Changes (Jan 2026)
- **REFACTORED**: Portfolio endpoint now uses single source: Reporting@navbackoffice.com "Daily Reports" emails
- **NEW**: ZIP extraction and "NAV Portfolio Notebook" Excel parsing
- **NEW**: Fallback to Excel settlement prices when Yahoo Finance unavailable (derivatives, options, commodities)
- **NEW**: isLivePrice flag to indicate live vs stale pricing
- **REMOVED**: All legacy IB CSV and external holdings email parsing
- **UPDATED**: AI Analyst now uses OpenRouter API (DeepSeek V3.2 model) instead of direct OpenAI
- **NEW**: AI Analyst Summary - generates market commentary 3x daily:
  - US mid-session: 12:30 PM ET (after first data refresh)
  - US after close: 4:30 PM ET (after first data refresh)
  - ASX after close: 4:10 PM AEST (after first data refresh)
- **NEW**: Added /api/markets endpoint for live market data from Yahoo Finance
- **NEW**: Added marketDataService.js for ticker fetching, calculations, and caching
- **IMPROVED**: Rate limiting (100 requests/min) on public API endpoints
- **IMPROVED**: Standardized error responses to { error: true, message: "..." } format
- **IMPROVED**: 30-second timeout on OpenAI API calls
- **IMPROVED**: CORS now allows *.replit.dev and *.repl.co preview domains

## Recent Changes (Dec 2025)
- **NEW**: Redesigned admin panel with NAV/MGWD input and auto-calculated metrics
- **NEW**: Performance metrics now calculated server-side from raw NAV/MGWD data
- **NEW**: Text content section added for Strategy, Hedging, AI Analyst, Risk Management
- Migrated from Excel-based data to PostgreSQL database
- Created admin panel for manual data entry
- Simplified to single-table JSONB schema for easy full-data overwrites
- Created optimized /api/performance endpoint for frontend
- Added admin authentication using ADMIN_PASSWORD secret
- Moved Beehiiv API key to environment variable
