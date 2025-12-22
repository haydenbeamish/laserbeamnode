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
- `GET /posts` - Fetch posts from Beehiiv API
- `GET /selectedpost/:id` - Fetch specific post by ID

### Admin Endpoints
- `GET /admin` - Admin panel interface
- `POST /api/admin/login` - Admin authentication (username: admin, password: ADMIN_PASSWORD secret)
- `GET /api/admin/data` - Load all site data (requires auth)
- `POST /api/admin/data` - Save all site data (requires auth, full overwrite)

### Service Endpoints (for Make.com / automation)
- `POST /api/service/performance/nav` - Upsert monthly NAV (requires SERVICE_TOKEN)
  - Body: `{ "month": "YYYY-MM", "nav": 1.125 }`
  - Creates new month or updates existing; auto-sorts by month
- `GET /api/service/performance/latest` - Get latest month's data (requires SERVICE_TOKEN)
  - Returns: `{ "data": { "month", "nav", "mgwd" }, "totalMonths" }`

## Environment Variables (Secrets)
- `ADMIN_PASSWORD` - Password for admin login
- `BEEHIIV_API_KEY` - Beehiiv API key for blog posts
- `SERVICE_TOKEN` - Token for Make.com automation (used in Authorization header)
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

## Recent Changes (Dec 2025)
- **NEW**: Make.com service endpoints for automated NAV updates from SharePoint/email
- **NEW**: Redesigned admin panel with NAV/MGWD input and auto-calculated metrics
- **NEW**: Performance metrics now calculated server-side from raw NAV/MGWD data
- **NEW**: Text content section added for Strategy, Hedging, AI Analyst, Risk Management
- Migrated from Excel-based data to PostgreSQL database
- Created admin panel for manual data entry
- Simplified to single-table JSONB schema for easy full-data overwrites
- Created optimized /api/performance endpoint for frontend
- Added admin authentication using ADMIN_PASSWORD secret
- Moved Beehiiv API key to environment variable

## Make.com Integration Guide
1. In Make.com, add a SharePoint "Watch Rows" or "Get file content" module to read NAV from your spreadsheet
2. Add an HTTP module to POST to: `https://YOUR-REPLIT-URL/api/service/performance/nav`
3. Set Headers: `Authorization: Bearer YOUR_SERVICE_TOKEN`, `Content-Type: application/json`
4. Set Body: `{"month": "{{month_from_spreadsheet}}", "nav": {{nav_value}}}`
5. The endpoint will create a new month if it doesn't exist, or update the NAV if it does
6. MGWD Index still needs to be entered manually via the admin portal (or add another automation)
