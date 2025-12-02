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
- `syncOneDrive.js` - OneDrive sync script for automatic Excel file updates
- `LaserBeamExcel.xlsx` - Excel data source (synced from OneDrive)

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
- @microsoft/microsoft-graph-client - OneDrive API client

## Running the Project
The server runs on port 5000 and binds to 0.0.0.0 for external access.

Start command: `npm start`

## OneDrive Sync
The Excel file is automatically synced from OneDrive. To manually sync:
- Run: `npm run sync`

The sync script searches for `LaserBeamExcel.xlsx` in your connected OneDrive and downloads it to the project directory.

## Recent Changes
- Configured for Replit environment (port 5000, host 0.0.0.0)
- Added npm scripts for starting the server
- Added .gitignore for Node.js projects
- Added OneDrive sync integration for automatic Excel file updates
- Fixed percentage display for holdings, funds, and performance endpoints
- Added disclaimer and dateUpdated to performance endpoint
