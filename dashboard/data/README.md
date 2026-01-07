# Data Directory

This directory is used to store portfolio data files.

## External Holdings File

To display external holdings in the dashboard, place your Excel file here:

**Required file:** `Externalholdings.xlsx`

**Expected format:**
- Row 1-2: Headers (will be skipped)
- Column A: Company name with ticker in format: `COMPANY NAME (EXCHANGE:TICKER)`
- Column B: Number of shares
- Column D: Market value

**Example:**
```
LOYAL METALS LTD (XASX:LLM)    1000    ...    $5,000
```

## Auto-generated Files

The following files are automatically created when the dashboard fetches data from Interactive Brokers emails:

- `*.Portfolio.*.csv` - Latest portfolio positions from IB
- `*.NAV.*.csv` - Latest NAV/cash balance from IB
- `update-log.json` - Log of all data updates with timestamps
