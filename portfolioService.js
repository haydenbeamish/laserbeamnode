const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
require('isomorphic-fetch');
const XLSXFull = require('xlsx');
const AdmZip = require('adm-zip');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const LOG_FILE = path.join(DATA_DIR, 'update-log.json');

const USER_EMAIL = process.env.USER_EMAIL || 'hayden@laserbeamcapital.com';
const NAV_PORTFOLIO_EMAIL = 'Reporting@navbackoffice.com';
const NAV_PORTFOLIO_SUBJECT = 'Daily Reports';
const DATA_FOLDER = 'Data';

let msalClient = null;

function getMsalClient() {
  if (!msalClient) {
    const msalConfig = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      },
    };
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

async function getAccessToken() {
  try {
    const cca = getMsalClient();
    const result = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    return result?.accessToken;
  } catch (error) {
    console.error('[portfolio] Error acquiring token:', error.message);
    throw error;
  }
}

async function getGraphClient() {
  const token = await getAccessToken();
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

async function getEmailsFromSender(senderEmail, subject) {
  const client = await getGraphClient();

  try {
    const messages = await client
      .api(`/users/${USER_EMAIL}/messages`)
      .top(100)
      .select('id,subject,receivedDateTime,hasAttachments,from')
      .get();

    let filteredMessages = messages.value.filter((msg) => {
      const fromAddress = msg.from?.emailAddress?.address?.toLowerCase();
      return fromAddress === senderEmail.toLowerCase();
    });

    if (subject) {
      filteredMessages = filteredMessages.filter((msg) =>
        msg.subject?.toLowerCase().includes(subject.toLowerCase())
      );
    }

    filteredMessages.sort((a, b) => {
      return new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime();
    });

    return filteredMessages;
  } catch (error) {
    console.error('[portfolio] Error fetching emails:', error.message);
    throw error;
  }
}

async function getEmailsFromFolder(folderName, senderEmail, subject) {
  const client = await getGraphClient();

  try {
    // First, find the folder by name
    const folders = await client
      .api(`/users/${USER_EMAIL}/mailFolders`)
      .get();

    const targetFolder = folders.value.find(
      (folder) => folder.displayName.toLowerCase() === folderName.toLowerCase()
    );

    if (!targetFolder) {
      console.log(`[portfolio] Folder "${folderName}" not found`);
      return [];
    }

    console.log(`[portfolio] Found folder "${folderName}" with ID:`, targetFolder.id);

    // Fetch messages from the folder
    const messages = await client
      .api(`/users/${USER_EMAIL}/mailFolders/${targetFolder.id}/messages`)
      .top(100)
      .select('id,subject,receivedDateTime,hasAttachments,from')
      .get();

    let filteredMessages = messages.value.filter((msg) => {
      const fromAddress = msg.from?.emailAddress?.address?.toLowerCase();
      return fromAddress === senderEmail.toLowerCase();
    });

    if (subject) {
      filteredMessages = filteredMessages.filter((msg) =>
        msg.subject?.toLowerCase().includes(subject.toLowerCase())
      );
    }

    filteredMessages.sort((a, b) => {
      return new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime();
    });

    return filteredMessages;
  } catch (error) {
    console.error('[portfolio] Error fetching emails from folder:', error.message);
    throw error;
  }
}

async function getEmailAttachments(messageId) {
  const client = await getGraphClient();

  try {
    const attachments = await client
      .api(`/users/${USER_EMAIL}/messages/${messageId}/attachments`)
      .get();

    return attachments.value;
  } catch (error) {
    console.error('[portfolio] Error fetching attachments:', error.message);
    throw error;
  }
}

async function extractNAVPortfolioFromZip(zipBuffer) {
  try {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    console.log('[portfolio] ZIP contains', zipEntries.length, 'files');
    zipEntries.forEach(entry => {
      console.log('[portfolio] ZIP file:', entry.entryName);
    });

    // Find Excel file with "NAV Portfolio Notebook" in the name
    const navPortfolioEntry = zipEntries.find(entry => {
      const name = entry.entryName.toLowerCase();
      return name.includes('nav portfolio notebook') &&
             (name.endsWith('.xlsx') || name.endsWith('.xls'));
    });

    if (!navPortfolioEntry) {
      console.error('[portfolio] No NAV Portfolio Notebook Excel file found in ZIP');
      return null;
    }

    console.log('[portfolio] Found NAV Portfolio Notebook file:', navPortfolioEntry.entryName);
    return zip.readFile(navPortfolioEntry);
  } catch (error) {
    console.error('[portfolio] Error extracting ZIP:', error.message);
    return null;
  }
}

async function parseNAVPortfolioExcel(excelBuffer) {
  try {
    const workbook = XLSXFull.read(excelBuffer, { type: 'buffer' });

    console.log('[portfolio] Workbook sheets:', workbook.SheetNames);

    // Find "Portfolio Valuation" sheet
    const portfolioValuationSheet = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('portfolio valuation')
    );

    if (!portfolioValuationSheet) {
      console.error('[portfolio] Portfolio Valuation sheet not found');
      return { positions: [], totalAumPercent: 0 };
    }

    console.log('[portfolio] Found sheet:', portfolioValuationSheet);

    const worksheet = workbook.Sheets[portfolioValuationSheet];
    const data = XLSXFull.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('[portfolio] Total rows in sheet:', data.length);
    console.log('[portfolio] First 10 rows:', JSON.stringify(data.slice(0, 10), null, 2));

    const positions = [];
    let totalAumPercent = 0;

    // Start from row 7 (index 6)
    // Column A (0) = Stock names
    // Column B (1) = Currency
    // Column C (2) = Ticker
    // Column E (4) = Quantity
    // Column F (5) = Settlement Price
    // Column G (6) = Market Value (Native)
    // Column H (7) = Market Value (Base/AUD)
    // Column M (12) = % of AUM
    for (let i = 6; i < data.length; i++) {
      const row = data[i];

      // Column A - Stock name
      const stockName = row[0];
      if (!stockName || stockName.toString().trim() === '') continue;

      // Skip rows that are subtotals or totals
      const nameStr = stockName.toString().toUpperCase();
      if (nameStr.includes('SUB TOTAL') || nameStr.includes('GRAND TOTAL') || nameStr.includes('TOTAL')) {
        console.log('[portfolio] Stopping at row', i + 1, '- found total row:', nameStr);
        break;
      }

      // Column B - Currency
      const currency = row[1] || 'USD';

      // Column C - Ticker
      const ticker = row[2];
      if (!ticker || ticker.toString().trim() === '') continue;

      // Column E - Quantity (index 4)
      const positionValue = row[4];
      const quantity = typeof positionValue === 'number'
        ? positionValue
        : parseFloat(positionValue?.toString().replace(/,/g, '') || '0');

      if (quantity <= 0) continue;

      // Column F - Settlement Price (index 5) - fallback price
      const settlementPriceValue = row[5];
      const settlementPrice = typeof settlementPriceValue === 'number'
        ? settlementPriceValue
        : parseFloat(settlementPriceValue?.toString().replace(/,/g, '') || '0');

      // Column G - Market Value Native (index 6) - fallback market value
      const marketValueNativeValue = row[6];
      const marketValueNative = typeof marketValueNativeValue === 'number'
        ? marketValueNativeValue
        : parseFloat(marketValueNativeValue?.toString().replace(/,/g, '') || '0');

      // Column H - Market Value Base/AUD (index 7) - fallback AUD value
      const marketValueBaseValue = row[7];
      const marketValueBase = typeof marketValueBaseValue === 'number'
        ? marketValueBaseValue
        : parseFloat(marketValueBaseValue?.toString().replace(/,/g, '') || '0');

      // Column M - % of AUM (index 12)
      const aumPercentValue = row[12];
      const aumPercent = typeof aumPercentValue === 'number'
        ? aumPercentValue * 100 // Excel stores percentages as decimals
        : parseFloat(aumPercentValue?.toString().replace(/[%,]/g, '') || '0');

      totalAumPercent += aumPercent;

      positions.push({
        ticker: ticker.toString().trim(),
        stockName: stockName.toString().trim(),
        currency: currency.toString().trim(),
        quantity: quantity,
        aumPercent: aumPercent,
        fallbackPrice: settlementPrice,
        fallbackMarketValue: marketValueNative,
        fallbackMarketValueAUD: marketValueBase,
      });

      console.log(`[portfolio] Row ${i + 1}: ${ticker} - ${quantity} shares (${currency}) - ${aumPercent.toFixed(2)}% AUM`);
    }

    console.log('[portfolio] NAV Portfolio parsed:', positions.length, 'positions');
    console.log('[portfolio] Total AUM%:', totalAumPercent.toFixed(2), '%, Cash%:', (100 - totalAumPercent).toFixed(2));

    return { positions, totalAumPercent };
  } catch (error) {
    console.error('[portfolio] Error parsing NAV Portfolio Excel:', error.message);
    return { positions: [], totalAumPercent: 0 };
  }
}

function cleanTicker(ticker) {
  // Remove exchange suffix like " AU", " US", " CN", " HK" from Bloomberg-style tickers
  const parts = ticker.trim().split(' ');
  if (parts.length > 1) {
    const suffix = parts[parts.length - 1].toUpperCase();
    if (['AU', 'US', 'CN', 'HK', 'LN', 'JP', 'GR', 'FP'].includes(suffix)) {
      return parts.slice(0, -1).join(' ');
    }
  }
  return ticker;
}

async function fetchLivePrice(rawTicker, currency) {
  try {
    // Clean ticker to remove exchange suffix
    const ticker = cleanTicker(rawTicker);
    
    // Convert ticker to Yahoo Finance format based on currency/exchange
    let yahooTicker = ticker;

    // Australian stocks
    if (currency === 'AUD' && !ticker.includes('.AX')) {
      yahooTicker = `${ticker}.AX`;
    }
    // Hong Kong stocks
    else if (currency === 'HKD' && !ticker.includes('.HK')) {
      yahooTicker = `${ticker}.HK`;
    }
    // Canadian stocks
    else if (currency === 'CAD' && !ticker.includes('.TO')) {
      yahooTicker = `${ticker}.TO`;
    }
    // US stocks - no suffix needed for most US tickers

    console.log(`[portfolio] Fetching price for ${rawTicker} -> ${yahooTicker} in ${currency}`);

    const quote = await yahooFinance.quote(yahooTicker);

    if (!quote || !quote.regularMarketPrice) {
      console.error(`[portfolio] No price found for ${yahooTicker}`);
      return null;
    }

    // Calculate daily change
    const currentPrice = quote.regularMarketPrice;
    const previousClose = quote.regularMarketPreviousClose || currentPrice;
    const priceChange = currentPrice - previousClose;
    const priceChangePercent = previousClose > 0 ? ((priceChange / previousClose) * 100) : 0;

    return {
      ticker: ticker,
      yahooTicker: yahooTicker,
      price: currentPrice,
      previousClose: previousClose,
      priceChange: priceChange,
      priceChangePercent: priceChangePercent,
      currency: quote.currency || currency,
      name: quote.shortName || quote.longName || ticker,
    };
  } catch (error) {
    console.error(`[portfolio] Error fetching price for ${rawTicker}:`, error.message);
    return null;
  }
}

// Cache forex rates to avoid repeated API calls
const forexCache = {};
const FOREX_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

async function fetchAUDConversionRate(fromCurrency) {
  try {
    if (fromCurrency === 'AUD') return 1.0;

    // Check cache
    const cached = forexCache[fromCurrency];
    if (cached && (Date.now() - cached.fetchedAt) < FOREX_CACHE_DURATION_MS) {
      return cached.rate;
    }

    // Fetch forex rate from Yahoo Finance
    const forexPair = `${fromCurrency}AUD=X`;
    console.log(`[portfolio] Fetching forex rate: ${forexPair}`);

    const quote = await yahooFinance.quote(forexPair);

    if (!quote || !quote.regularMarketPrice) {
      console.error(`[portfolio] No forex rate found for ${forexPair}`);
      return 1.0; // Default to 1.0 if rate not found
    }

    const rate = quote.regularMarketPrice;
    forexCache[fromCurrency] = { rate, fetchedAt: Date.now() };
    
    console.log(`[portfolio] ${fromCurrency} to AUD rate: ${rate}`);
    return rate;
  } catch (error) {
    console.error(`[portfolio] Error fetching forex rate for ${fromCurrency}:`, error.message);
    return 1.0;
  }
}

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function logUpdate(file, status, message) {
  ensureDataDirectory();

  let logs = [];

  if (fs.existsSync(LOG_FILE)) {
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    logs = JSON.parse(content);
  }

  logs.push({
    timestamp: new Date().toISOString(),
    file,
    status,
    message,
  });

  if (logs.length > 100) {
    logs = logs.slice(-100);
  }

  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function getLatestUpdateTime(fileName) {
  if (!fs.existsSync(LOG_FILE)) {
    return null;
  }

  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const logs = JSON.parse(content);
  const fileLog = logs
    .filter((log) => log.file === fileName && log.status === 'success')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  return fileLog ? fileLog.timestamp : null;
}

let portfolioCache = {
  data: null,
  fetchedAt: null,
};

const PORTFOLIO_CACHE_DURATION_MS = 5 * 60 * 1000;

async function fetchPortfolioData() {
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
    console.log('[portfolio] Missing Azure credentials, skipping portfolio fetch');
    return null;
  }

  let positions = [];
  let cashBalance = 0;

  try {
    console.log('[portfolio] Fetching NAV Portfolio');
    console.log('[portfolio] Looking for emails from:', NAV_PORTFOLIO_EMAIL);
    console.log('[portfolio] With subject containing:', NAV_PORTFOLIO_SUBJECT);

    // First try Data folder, then fall back to inbox
    let emails = await getEmailsFromFolder(DATA_FOLDER, NAV_PORTFOLIO_EMAIL, NAV_PORTFOLIO_SUBJECT);
    
    if (!emails || emails.length === 0) {
      console.log('[portfolio] No emails in Data folder, trying inbox...');
      emails = await getEmailsFromSender(NAV_PORTFOLIO_EMAIL, NAV_PORTFOLIO_SUBJECT);
    }

    if (!emails || emails.length === 0) {
      console.log('[portfolio] No Daily Reports email found');
      logUpdate('NAVPortfolio.xlsx', 'error', 'No email found');
      return null;
    }

    console.log(`[portfolio] Found ${emails.length} matching emails, using most recent`);
    const latestEmail = emails[0];

    console.log('[portfolio] Latest email:', {
      subject: latestEmail.subject,
      received: latestEmail.receivedDateTime,
      hasAttachments: latestEmail.hasAttachments,
    });

    if (!latestEmail.hasAttachments) {
      console.log('[portfolio] Email has no attachments');
      logUpdate('NAVPortfolio.xlsx', 'error', 'Email has no attachments');
      return null;
    }

    // Get attachments
    const attachments = await getEmailAttachments(latestEmail.id);
    console.log(`[portfolio] Email has ${attachments.length} attachments`);

    // Find ZIP attachment
    const zipAttachment = attachments.find(att =>
      att.name.toLowerCase().endsWith('.zip')
    );

    if (!zipAttachment) {
      console.log('[portfolio] No ZIP attachment found');
      logUpdate('NAVPortfolio.xlsx', 'error', 'No ZIP attachment found');
      return null;
    }

    console.log('[portfolio] Found ZIP attachment:', zipAttachment.name);

    // Extract ZIP
    const zipBuffer = Buffer.from(zipAttachment.contentBytes, 'base64');
    const excelBuffer = await extractNAVPortfolioFromZip(zipBuffer);

    if (!excelBuffer) {
      console.log('[portfolio] Failed to extract NAV Portfolio from ZIP');
      logUpdate('NAVPortfolio.xlsx', 'error', 'Failed to extract Excel from ZIP');
      return null;
    }

    // Parse Excel to get tickers, quantities, and % AUM
    const parseResult = await parseNAVPortfolioExcel(excelBuffer);

    if (!parseResult || !parseResult.positions || parseResult.positions.length === 0) {
      console.log('[portfolio] No positions found in NAV Portfolio');
      logUpdate('NAVPortfolio.xlsx', 'error', 'No positions found in Excel');
      return null;
    }

    const { positions: navPositions, totalAumPercent } = parseResult;
    console.log(`[portfolio] Found ${navPositions.length} positions in NAV Portfolio`);

    // Calculate cash % from 100% - sum of % AUM
    const cashPercent = 100 - totalAumPercent;
    console.log(`[portfolio] Cash %: ${cashPercent.toFixed(2)}%`);

    // Fetch live prices for each position
    console.log('[portfolio] Fetching live prices...');
    for (const position of navPositions) {
      const priceData = await fetchLivePrice(position.ticker, position.currency);

      let currentPrice, previousClose, priceChange, priceChangePercent, currency, yahooTicker;
      let marketValueNative, marketValueAUD, audRate, pnl;
      let isLivePrice = true;

      if (priceData) {
        // Use live Yahoo Finance data
        currentPrice = priceData.price;
        previousClose = priceData.previousClose;
        priceChange = priceData.priceChange;
        priceChangePercent = priceData.priceChangePercent;
        currency = priceData.currency;
        yahooTicker = priceData.yahooTicker;

        marketValueNative = position.quantity * currentPrice;
        audRate = await fetchAUDConversionRate(currency);
        marketValueAUD = marketValueNative * audRate;
        pnl = (priceChangePercent / 100) * marketValueAUD;
      } else {
        // Use fallback data from Excel (settlement price, market value)
        console.log(`[portfolio] Using fallback data for ${position.ticker}`);
        isLivePrice = false;
        
        currentPrice = position.fallbackPrice || 0;
        previousClose = currentPrice;
        priceChange = 0;
        priceChangePercent = 0;
        currency = position.currency;
        yahooTicker = position.ticker;

        marketValueNative = position.fallbackMarketValue || 0;
        marketValueAUD = position.fallbackMarketValueAUD || marketValueNative;
        audRate = marketValueNative > 0 ? marketValueAUD / marketValueNative : 1;
        pnl = 0; // No P&L for stale prices
      }

      positions.push({
        ticker: cleanTicker(position.ticker),
        symbol: yahooTicker,
        name: position.stockName,
        quantity: position.quantity,
        currentPrice: currentPrice,
        previousClose: previousClose,
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        currency: currency,
        marketValue: marketValueNative,
        marketValueAUD: marketValueAUD,
        audConversionRate: audRate,
        pnl: pnl,
        portfolioWeight: position.aumPercent,
        isLivePrice: isLivePrice,
      });

      console.log(`[portfolio] ${position.ticker}: ${position.quantity} @ ${currentPrice} ${currency} = ${marketValueNative.toFixed(2)} (${marketValueAUD.toFixed(2)} AUD), Change: ${priceChangePercent.toFixed(2)}%${isLivePrice ? '' : ' [STALE]'}`);
    }

    // Sort by portfolio weight descending
    positions.sort((a, b) => b.portfolioWeight - a.portfolioWeight);

    const totalMarketValueAUD = positions.reduce((sum, pos) => sum + pos.marketValueAUD, 0);

    // Calculate cash balance in AUD based on cash %
    // If cash is X% of total, then: cashBalance / FUM = X/100
    // FUM = totalMarketValue + cashBalance
    // cashBalance = (totalMarketValue * cashPercent) / (100 - cashPercent)
    let cashBalance = 0;
    if (cashPercent > 0 && cashPercent < 100) {
      cashBalance = (totalMarketValueAUD * cashPercent) / (100 - cashPercent);
    }
    console.log(`[portfolio] Calculated cash balance: $${cashBalance.toFixed(2)} AUD`);

    // Add cash position
    if (cashBalance > 0 || cashPercent > 0) {
      positions.push({
        ticker: 'CASH',
        symbol: 'CASH',
        name: 'Cash Holdings',
        quantity: 1,
        currentPrice: cashBalance,
        previousClose: cashBalance,
        priceChange: 0,
        priceChangePercent: 0,
        currency: 'AUD',
        marketValue: cashBalance,
        marketValueAUD: cashBalance,
        audConversionRate: 1.0,
        pnl: 0,
        portfolioWeight: cashPercent,
      });
    }

    const fum = totalMarketValueAUD + cashBalance;

    // Calculate total P&L and % change for the day
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
    const totalChangePercent = fum > 0 ? (totalPnL / fum) * 100 : 0;

    const summary = {
      totalValue: totalMarketValueAUD,
      cashBalance,
      totalPositions: positions.length,
      fum,
      totalPnL,
      totalChangePercent,
    };

    logUpdate('NAVPortfolio.xlsx', 'success', `Fetched ${positions.length} positions from NAV Portfolio`);

    const updateTime = new Date().toISOString();

    return {
      positions: positions,
      summary,
      lastUpdate: {
        portfolio: updateTime,
        nav: updateTime,
      },
    };
  } catch (error) {
    console.error('[portfolio] Error fetching NAV Portfolio:', error.message);
    console.error('[portfolio] Stack trace:', error.stack);
    logUpdate('NAVPortfolio.xlsx', 'error', `Failed to fetch: ${error.message}`);
    return null;
  }
}

async function getPortfolioData() {
  if (portfolioCache.data && portfolioCache.fetchedAt && 
      (Date.now() - portfolioCache.fetchedAt) < PORTFOLIO_CACHE_DURATION_MS) {
    console.log('[portfolio] Returning cached data');
    return portfolioCache.data;
  }

  console.log('[portfolio] Fetching fresh portfolio data...');
  const data = await fetchPortfolioData();

  if (data) {
    portfolioCache.data = data;
    portfolioCache.fetchedAt = Date.now();
  }

  return data;
}

module.exports = {
  getPortfolioData,
  fetchPortfolioData,
};
