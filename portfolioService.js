const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
require('isomorphic-fetch');
const Papa = require('papaparse');
const XLSX = require('read-excel-file/node');
const XLSXFull = require('xlsx');
const AdmZip = require('adm-zip');
const YahooFinance = require('yahoo-finance2').default;
const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const LOG_FILE = path.join(DATA_DIR, 'update-log.json');

const IB_EMAIL = process.env.IB_EMAIL_ADDRESS || 'donotreply@interactivebrokers.com';
const USER_EMAIL = process.env.USER_EMAIL || 'hayden@laserbeamcapital.com';
const EXTERNAL_HOLDINGS_EMAIL = process.env.EXTERNAL_HOLDINGS_EMAIL || 'hayden@laserbeamcapital.com';
const EXTERNAL_HOLDINGS_SUBJECT = 'External Holdings';
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

async function getLatestEmailWithAttachment(senderEmail, fileNamePattern) {
  const emails = await getEmailsFromSender(senderEmail);

  for (const email of emails) {
    if (email.hasAttachments) {
      const attachments = await getEmailAttachments(email.id);

      const matchingAttachment = attachments.find((att) =>
        att.name.includes(fileNamePattern)
      );

      if (matchingAttachment) {
        return {
          email,
          attachment: matchingAttachment,
        };
      }
    }
  }

  return null;
}

async function getLatestExternalHoldingsEmail(senderEmail, subject) {
  const emails = await getEmailsFromSender(senderEmail, subject);
  const client = await getGraphClient();

  for (const email of emails) {
    if (email.hasAttachments) {
      const attachments = await getEmailAttachments(email.id);
      const excelAttachment = attachments.find((att) => 
        att.name.endsWith('.xlsx') || att.name.endsWith('.xls') ||
        att.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        att.contentType === 'application/vnd.ms-excel'
      );
      if (excelAttachment) {
        return {
          email,
          attachment: excelAttachment,
          type: 'excel'
        };
      }
    }
    
    try {
      const fullEmail = await client
        .api(`/users/${USER_EMAIL}/messages/${email.id}`)
        .select('body')
        .get();
      
      if (fullEmail.body && fullEmail.body.content) {
        return {
          email,
          body: fullEmail.body.content,
          type: 'body'
        };
      }
    } catch (err) {
      console.error('[portfolio] Error fetching email body:', err.message);
    }
  }

  return null;
}

function parsePortfolioCSV(csvContent) {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const positions = [];

  parsed.data.forEach((row) => {
    const symbol = row.Symbol || row.Ticker;
    const marketValue = parseFloat(
      row.PositionValueInBase ||
      row.PositionValue ||
      row['Market Value'] ||
      row.Value ||
      0
    );
    const multiplier = parseFloat(row.Multiplier || row.Quantity || row.Shares || 1);

    if (symbol && marketValue !== 0) {
      let currentPrice = 0;
      if (multiplier > 0 && marketValue > 0) {
        currentPrice = Math.abs(marketValue / multiplier);
      }

      positions.push({
        ticker: symbol,
        symbol: symbol,
        quantity: multiplier,
        currentPrice: currentPrice,
        marketValue: Math.abs(marketValue),
        source: 'IB',
      });
    }
  });

  console.log('[portfolio] CSV parsed:', positions.length, 'positions');
  return positions;
}

function parseNAVCSV(csvContent) {
  const parsed = Papa.parse(csvContent, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    const cashBalance = parseFloat(lastRow[1] || '0');
    return cashBalance;
  }

  return 0;
}

async function parseExternalHoldingsFromExcel(buffer) {
  try {
    const rows = await XLSX(buffer);
    const positions = [];

    console.log('[portfolio] External holdings rows:', rows.length);

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];

      if (!row[0] || row[0].toString().trim() === '') continue;

      const codeCell = row[0].toString();

      let ticker = '';
      const tickerMatch = codeCell.match(/\(([^:]+):([^)]+)\)/);
      if (tickerMatch) {
        ticker = tickerMatch[2];
      } else {
        ticker = codeCell;
      }

      const sharesValue = row[1];
      const quantity = typeof sharesValue === 'number'
        ? sharesValue
        : parseFloat(sharesValue?.toString().replace(/,/g, '') || '0');

      const valueCell = row[3];
      const marketValue = typeof valueCell === 'number'
        ? valueCell
        : parseFloat(valueCell?.toString().replace(/[$,]/g, '') || '0');

      if (ticker && quantity > 0 && marketValue > 0) {
        const currentPrice = marketValue / quantity;

        positions.push({
          ticker,
          symbol: ticker,
          quantity,
          currentPrice,
          marketValue,
          source: 'External',
        });
      }
    }

    console.log('[portfolio] External holdings parsed:', positions.length, 'positions');
    return positions;
  } catch (error) {
    console.error('[portfolio] Error parsing external holdings:', error.message);
    return [];
  }
}

function parseExternalHoldingsFromBody(htmlContent) {
  try {
    const textContent = htmlContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<\/th>/gi, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const positions = [];

    console.log('[portfolio] Parsing email body, lines found:', lines.length);

    for (const line of lines) {
      const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);

      if (parts.length < 3) continue;

      let ticker = parts[0];
      const tickerMatch = ticker.match(/\(([^:]+):([^)]+)\)/);
      if (tickerMatch) {
        ticker = tickerMatch[2];
      }

      if (/^(stock|ticker|symbol|company|name)$/i.test(ticker)) continue;

      const sharesStr = parts[1];
      const quantity = parseFloat(sharesStr.replace(/,/g, '') || '0');

      let marketValue = 0;
      if (parts.length >= 4) {
        const valueStr = parts[3];
        marketValue = parseFloat(valueStr.replace(/[$,]/g, '') || '0');
      } else if (parts.length >= 3) {
        const valueStr = parts[2];
        marketValue = parseFloat(valueStr.replace(/[$,]/g, '') || '0');
      }

      if (ticker && quantity > 0 && marketValue > 0 && !isNaN(quantity) && !isNaN(marketValue)) {
        const currentPrice = marketValue / quantity;

        positions.push({
          ticker,
          symbol: ticker,
          quantity,
          currentPrice,
          marketValue,
          source: 'External',
        });
      }
    }

    console.log('[portfolio] External holdings from body parsed:', positions.length, 'positions');
    return positions;
  } catch (error) {
    console.error('[portfolio] Error parsing external holdings from body:', error.message);
    return [];
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

    // Find Excel file with "NAV Portfolio" in the name
    const navPortfolioEntry = zipEntries.find(entry => {
      const name = entry.entryName.toLowerCase();
      return (name.includes('nav portfolio') || name.includes('nav_portfolio')) &&
             (name.endsWith('.xlsx') || name.endsWith('.xls'));
    });

    if (!navPortfolioEntry) {
      console.error('[portfolio] No NAV Portfolio Excel file found in ZIP');
      return null;
    }

    console.log('[portfolio] Found NAV Portfolio file:', navPortfolioEntry.entryName);
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
      return [];
    }

    console.log('[portfolio] Found sheet:', portfolioValuationSheet);

    const worksheet = workbook.Sheets[portfolioValuationSheet];
    const data = XLSXFull.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('[portfolio] Total rows in sheet:', data.length);
    console.log('[portfolio] First 10 rows:', data.slice(0, 10));

    const positions = [];

    // Start from row 7 (index 6), extract ticker (column A) and quantity (column E, index 4)
    for (let i = 6; i < data.length; i++) {
      const row = data[i];

      // Column A - Security Description (contains ticker)
      const securityDescription = row[0];
      if (!securityDescription || securityDescription.toString().trim() === '') continue;

      // Skip rows that are subtotals or totals
      const descStr = securityDescription.toString().toUpperCase();
      if (descStr.includes('SUB TOTAL') || descStr.includes('GRAND TOTAL')) {
        console.log('[portfolio] Stopping at row', i + 1, '- found total row');
        break;
      }

      // Column B - Currency
      const currency = row[1] || 'AUD';

      // Column C - Ticker
      const ticker = row[2];
      if (!ticker || ticker.toString().trim() === '') continue;

      // Column E - Position (quantity) - index 4
      const positionValue = row[4];
      const quantity = typeof positionValue === 'number'
        ? positionValue
        : parseFloat(positionValue?.toString().replace(/,/g, '') || '0');

      if (quantity <= 0) continue;

      positions.push({
        ticker: ticker.toString().trim(),
        securityDescription: securityDescription.toString().trim(),
        currency: currency.toString().trim(),
        quantity: quantity,
        source: 'NAV'
      });

      console.log(`[portfolio] Row ${i + 1}: ${ticker} - ${quantity} shares (${currency})`);
    }

    console.log('[portfolio] NAV Portfolio parsed:', positions.length, 'positions');
    return positions;
  } catch (error) {
    console.error('[portfolio] Error parsing NAV Portfolio Excel:', error.message);
    return [];
  }
}

async function fetchLivePrice(ticker, currency) {
  try {
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

    console.log(`[portfolio] Fetching price for ${ticker} (${yahooTicker}) in ${currency}`);

    const quote = await YahooFinance.quote(yahooTicker);

    if (!quote || !quote.regularMarketPrice) {
      console.error(`[portfolio] No price found for ${yahooTicker}`);
      return null;
    }

    return {
      ticker: ticker,
      yahooTicker: yahooTicker,
      price: quote.regularMarketPrice,
      currency: quote.currency || currency,
      name: quote.shortName || quote.longName || ticker,
    };
  } catch (error) {
    console.error(`[portfolio] Error fetching price for ${ticker}:`, error.message);
    return null;
  }
}

async function fetchAUDConversionRate(fromCurrency) {
  try {
    if (fromCurrency === 'AUD') return 1.0;

    // Fetch forex rate from Yahoo Finance
    const forexPair = `${fromCurrency}AUD=X`;
    console.log(`[portfolio] Fetching forex rate: ${forexPair}`);

    const quote = await YahooFinance.quote(forexPair);

    if (!quote || !quote.regularMarketPrice) {
      console.error(`[portfolio] No forex rate found for ${forexPair}`);
      return 1.0; // Default to 1.0 if rate not found
    }

    console.log(`[portfolio] ${fromCurrency} to AUD rate: ${quote.regularMarketPrice}`);
    return quote.regularMarketPrice;
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
    console.log('[portfolio] Fetching NAV Portfolio from Data folder');
    console.log('[portfolio] Looking for emails from:', NAV_PORTFOLIO_EMAIL);
    console.log('[portfolio] With subject containing:', NAV_PORTFOLIO_SUBJECT);

    const emails = await getEmailsFromFolder(DATA_FOLDER, NAV_PORTFOLIO_EMAIL, NAV_PORTFOLIO_SUBJECT);

    if (!emails || emails.length === 0) {
      console.log('[portfolio] No Daily Reports email found in Data folder');
      logUpdate('NAVPortfolio.xlsx', 'error', 'No email found in Data folder');
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

    // Parse Excel to get tickers and quantities
    const navPositions = await parseNAVPortfolioExcel(excelBuffer);

    if (!navPositions || navPositions.length === 0) {
      console.log('[portfolio] No positions found in NAV Portfolio');
      logUpdate('NAVPortfolio.xlsx', 'error', 'No positions found in Excel');
      return null;
    }

    console.log(`[portfolio] Found ${navPositions.length} positions in NAV Portfolio`);

    // Fetch live prices for each position
    console.log('[portfolio] Fetching live prices...');
    for (const position of navPositions) {
      const priceData = await fetchLivePrice(position.ticker, position.currency);

      if (!priceData) {
        console.warn(`[portfolio] Skipping ${position.ticker} - no price data`);
        continue;
      }

      // Calculate market value in native currency
      const marketValueNative = position.quantity * priceData.price;

      // Get AUD conversion rate
      const audRate = await fetchAUDConversionRate(priceData.currency);
      const marketValueAUD = marketValueNative * audRate;

      positions.push({
        ticker: position.ticker,
        symbol: priceData.yahooTicker,
        securityDescription: position.securityDescription,
        quantity: position.quantity,
        currentPrice: priceData.price,
        currency: priceData.currency,
        marketValue: marketValueNative,
        marketValueAUD: marketValueAUD,
        audConversionRate: audRate,
        source: 'NAV',
      });

      console.log(`[portfolio] ${position.ticker}: ${position.quantity} @ ${priceData.price} ${priceData.currency} = ${marketValueNative.toFixed(2)} (${marketValueAUD.toFixed(2)} AUD)`);
    }

    // Sort by market value in AUD descending
    positions.sort((a, b) => b.marketValueAUD - a.marketValueAUD);

    const totalMarketValueAUD = positions.reduce((sum, pos) => sum + pos.marketValueAUD, 0);
    const fum = totalMarketValueAUD + cashBalance;

    const summary = {
      totalValue: totalMarketValueAUD,
      cashBalance,
      totalPositions: positions.length,
      fum,
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
