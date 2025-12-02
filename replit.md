# Express API Project

## Overview
This is a Node.js Express backend API that provides endpoints for:
- Reading and serving data from an Excel file (LaserBeamExcel.xlsx)
- Fetching posts from the Beehiiv API
- Various data endpoints for stats, funds, exposure, performance, and holdings

## Project Structure
- `index.js` - Main Express server and route definitions
- `stats.js` - Stats data endpoint handler
- `funds.js` - Funds data endpoint handler
- `holdings.js` - Holdings data endpoint handler
- `exposure.js` - Exposure data endpoint handler
- `performance.js` - Performance data endpoint handler
- `Text.js` - Text data endpoint handler
- `getPost.js` - Individual post fetching handler
- `LaserBeamExcel.xlsx` - Excel data source
- `server/db.ts` - Database connection setup
- `shared/schema.ts` - Database schema definitions
- `drizzle.config.ts` - Drizzle ORM configuration

## Database
The project uses a PostgreSQL database (Neon) with Drizzle ORM. Tables include:
- `performance_data` - Performance metrics
- `stats_data` - Statistics data
- `funds_data` - Fund information
- `holdings_data` - Holdings information
- `exposure_data` - Exposure data

To push schema changes: `npm run db:push`

## API Endpoints
- `GET /` - Welcome message
- `GET /posts` - Fetch posts from Beehiiv API
- `GET /selectedpost/:id` - Fetch specific post by ID
- `GET /stats` - Get stats data from Excel
- `GET /funds` - Get funds data from Excel
- `GET /text` - Get text data from Excel
- `GET /exposure` - Get exposure data from Excel
- `GET /performance` - Get performance data from Excel
- `GET /holdings` - Get holdings data from Excel

## Dependencies
- express - Web framework
- cors - CORS middleware
- node-fetch - HTTP requests
- read-excel-file - Excel file parsing
- @neondatabase/serverless - PostgreSQL database
- drizzle-orm - ORM for database operations
- drizzle-kit - Database migrations

## Running the Project
The server runs on port 5000 and binds to 0.0.0.0 for external access.

Start command: `npm start`

## Recent Changes
- Added PostgreSQL database with Drizzle ORM
- Added database schema for performance, stats, funds, holdings, and exposure data
- Configured for Replit environment (port 5000, host 0.0.0.0)
- Added npm scripts for starting the server and database operations
- Added .gitignore for Node.js projects
