# Laser Beam Capital - Portfolio Dashboard

A comprehensive portfolio management dashboard for hedge funds, built with Next.js and React.

## Features

### 📊 Portfolio Dashboard
- Real-time portfolio overview with holdings ranked by market value
- Integration with Interactive Brokers email data
- External holdings tracking via Excel
- Interactive pie charts showing portfolio breakdown
- Automatic data refresh every 5 minutes

### 📈 Position Size Calculator
- Calculate optimal position sizes based on risk percentage
- Display risk/reward ratios
- Show potential profit and maximum loss
- Warning system for unfavorable risk/reward ratios

### 🛡️ Stop Loss Management
- Set and manage stop losses for all positions
- Three stop loss types:
  - **Initial**: Fixed stop loss price
  - **Trailing**: Moving average-based stops (configurable days)
  - **Breakeven**: Move stop to entry price
- Real-time risk calculation per position
- Portfolio-wide maximum drawdown calculation
- Visual warnings for high-risk positions

## Data Sources

The dashboard integrates three data sources:

1. **Interactive Brokers Portfolio CSV** - Email attachments with `.Portfolio.` in filename
2. **Interactive Brokers NAV CSV** - Email attachments with `.NAV.` in filename (cash balance)
3. **External Holdings Excel** - Local Excel file with external positions

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Microsoft Azure App Registration with Graph API access
- Access to Interactive Brokers email account

### 1. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Microsoft Graph API Configuration
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# Email Configuration
IB_EMAIL_ADDRESS=donotreply@interactivebrokers.com

# External Holdings Path (Windows path format)
EXTERNAL_HOLDINGS_PATH=C:\Users\hbeam\OneDrive - Hedge Partners Pty Ltd (Laser Beam Capital)\Laser Beam Capital - Documents\Research\PortfolioDashboard\Externalholdings.xlsx

# Data Storage Path
DATA_STORAGE_PATH=./data
```

### 2. Azure App Registration Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "App registrations" and select your app (OutlookAPIAccess)
3. Ensure the following API permissions are granted:
   - `Mail.Read` (Application permission)
   - `User.Read.All` (Application permission)
4. Grant admin consent for your organization
5. Create a client secret and copy it to `.env.local`

### 3. Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### 4. Production Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Usage Guide

### Dashboard Tab

The main dashboard shows:
- **Portfolio Summary Cards**: Total value, cash balance, number of positions, FUM
- **Holdings Table**: All positions ranked by market value
- **Portfolio Breakdown Chart**: Visual pie chart of top 10 holdings

Click the "Refresh" button to manually fetch latest data from all sources.

### Position Calculator Tab

1. Enter the ticker symbol
2. Input entry price, stop loss price, and target price
3. Set risk percentage (% of FUM you're willing to risk)
4. The calculator shows:
   - Optimal position size (number of shares)
   - Dollar amount at risk
   - Potential profit
   - Risk/reward ratio

### Stop Loss Manager Tab

1. View all positions with their current prices and market values
2. Click "Set Stop" or "Edit" to configure stop loss for each position
3. Choose stop loss type:
   - **Initial**: Set a fixed price
   - **Trailing**: Follows moving average (specify days)
   - **Breakeven**: Marks position at entry price
4. Monitor portfolio-wide risk metrics:
   - Total portfolio risk (sum of all potential losses)
   - Maximum drawdown percentage
   - Warning alerts for high-risk situations

## File Structure

```
lbfdashboard/
├── app/
│   ├── api/
│   │   └── portfolio/
│   │       └── route.ts          # Main API endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Main dashboard page
├── components/
│   ├── PortfolioTable.tsx        # Holdings table component
│   ├── PortfolioCharts.tsx       # Pie chart visualization
│   ├── PositionCalculator.tsx    # Position sizing tool
│   └── StopLossManager.tsx       # Stop loss management
├── lib/
│   ├── graphClient.ts            # Microsoft Graph API client
│   ├── fileUtils.ts              # File operations and logging
│   └── dataParser.ts             # CSV/Excel parsing utilities
├── types/
│   └── index.ts                  # TypeScript type definitions
├── data/                         # Auto-created for CSV storage
│   └── update-log.json           # Update history log
└── .env.local                    # Environment variables
```

## Data Updates

### Automatic Updates
- Dashboard automatically refreshes every 5 minutes
- Each refresh fetches latest emails and reads external holdings file

### Manual Updates
- Click the "Refresh" button to trigger immediate update
- Stop loss data is saved locally in browser localStorage

### Update Logs
All data updates are logged in `data/update-log.json` with:
- Timestamp
- File name
- Status (success/error)
- Message

## CSV File Format Requirements

### Portfolio CSV (Interactive Brokers)
Expected columns:
- `Symbol` or `Ticker`
- `Quantity` or `Shares`
- `Price` or `Current Price`
- `Market Value`

### NAV CSV (Interactive Brokers)
- Cash balance should be in **Column B** of the **last row**

### External Holdings Excel
- **Column A**: Ticker symbol
- **Column B**: Number of shares held
- **Column D**: Total market value

## Troubleshooting

### Cannot fetch emails
- Verify Azure app permissions are granted
- Check that client ID, secret, and tenant ID are correct
- Ensure mailbox name matches the one configured in Graph API calls

### External holdings not loading
- Verify the file path is correct (use Windows format with backslashes)
- Ensure the Excel file is not open in another application
- Check that columns A, B, and D contain the expected data

### No data showing
- Check browser console for errors
- Verify API endpoint is responding: `http://localhost:3000/api/portfolio`
- Review logs in `data/update-log.json`

## Security Notes

- Never commit `.env.local` to version control (already in `.gitignore`)
- Store Azure credentials securely
- CSV files are saved locally and not committed to git
- Stop loss data is stored in browser localStorage

## License

Proprietary - Laser Beam Capital

## Support

For issues or questions, contact the development team.
