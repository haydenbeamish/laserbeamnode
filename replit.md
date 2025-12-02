# Laser Beam Capital API

## Overview
Backend API for Laser Beam Capital that provides financial data endpoints and an admin panel for managing site content. Data is stored in a PostgreSQL database and can be updated through the admin interface.

## Project Structure
- `index.js` - Main Express server with all API routes and admin authentication
- `public/admin.html` - Admin panel interface for data management
- `shared/schema.ts` - Database schema (single site_data table with JSONB columns)
- `migrate-excel.js` - Script to migrate initial data from Excel to database
- `LaserBeamExcel.xlsx` - Original Excel data source (for reference)

## Database
PostgreSQL database with simplified schema:
- `site_data` - Single table storing all site content as JSONB:
  - `performance` - Performance metrics and chart data
  - `stats` - Statistics data
  - `funds` - Fund information
  - `holdings` - Top holdings
  - `exposure` - Net exposure, sector, and market cap data
  - `date_updated` - Auto-set timestamp when data is saved

## API Endpoints

### Public Endpoints
- `GET /` - Welcome message
- `GET /api/performance` - Optimized endpoint returning ALL site data for frontend
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
- Edit all data sections: Performance, Stats, Funds, Holdings, Exposure
- Add/remove chart data points, holdings, sector exposure, market cap entries
- Visual highlighting of changed fields
- Date auto-updates on save
- Data fully overwrites previous values (no merging)

## Running the Project
- Start: `npm start` (runs on port 5000, host 0.0.0.0)
- Migrate Excel data: `node migrate-excel.js`

## Data Format Notes
- All percentage values are stored as whole numbers (e.g., 10 for 10%, not 0.1)
- Chart months use YYYY-MM format
- The /api/performance endpoint formats data for the frontend with all needed fields

## Recent Changes (Dec 2025)
- Migrated from Excel-based data to PostgreSQL database
- Created admin panel for manual data entry
- Simplified to single-table JSONB schema for easy full-data overwrites
- Created optimized /api/performance endpoint for frontend
- Added admin authentication using ADMIN_PASSWORD secret
- Moved Beehiiv API key to environment variable
