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
- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Replit)

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

## Recent Changes (Jan 2026)
- **NEW**: AI Analyst Summary - GPT-4o-mini generates market commentary on each refresh
- **NEW**: Added /api/markets endpoint for live market data from Yahoo Finance
- **NEW**: Added marketDataService.js for ticker fetching, calculations, and caching

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
