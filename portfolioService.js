const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
require('isomorphic-fetch');
const Papa = require('papaparse');
const XLSX = require('read-excel-file/node');
const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const LOG_FILE = path.join(DATA_DIR, 'update-log.json');

const IB_EMAIL = process.env.IB_EMAIL_ADDRESS || 'donotreply@interactivebrokers.com';
const USER_EMAIL = process.env.USER_EMAIL || 'hayden@laserbeamcapital.com';
const EXTERNAL_HOLDINGS_EMAIL = process.env.EXTERNAL_HOLDINGS_EMAIL || 'hayden@laserbeamcapital.com';
const EXTERNAL_HOLDINGS_SUBJECT = 'External Holdings';

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

async function getLatestEmailWithSubject(senderEmail, subject) {
  const emails = await getEmailsFromSender(senderEmail, subject);

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
        };
      }
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

  let ibPositions = [];
  let cashBalance = 0;
  let externalPositions = [];

  try {
    console.log('[portfolio] Fetching Portfolio email from:', IB_EMAIL);
    const portfolioEmail = await getLatestEmailWithAttachment(IB_EMAIL, '.Portfolio.');

    if (portfolioEmail) {
      const { attachment } = portfolioEmail;
      console.log('[portfolio] Found Portfolio attachment:', attachment.name);
      const csvContent = Buffer.from(attachment.contentBytes, 'base64').toString('utf-8');

      ibPositions = parsePortfolioCSV(csvContent);
      logUpdate('Portfolio.csv', 'success', `Fetched ${ibPositions.length} positions from IB Portfolio`);
    } else {
      console.log('[portfolio] No Portfolio email found');
      logUpdate('Portfolio.csv', 'error', 'No email found with Portfolio attachment');
    }
  } catch (error) {
    console.error('[portfolio] Error fetching portfolio email:', error.message);
    logUpdate('Portfolio.csv', 'error', `Failed to fetch: ${error.message}`);
  }

  try {
    console.log('[portfolio] Fetching NAV email from:', IB_EMAIL);
    const navEmail = await getLatestEmailWithAttachment(IB_EMAIL, '.NAV.');

    if (navEmail) {
      const { attachment } = navEmail;
      console.log('[portfolio] Found NAV attachment:', attachment.name);
      const csvContent = Buffer.from(attachment.contentBytes, 'base64').toString('utf-8');

      cashBalance = parseNAVCSV(csvContent);
      console.log('[portfolio] Cash balance:', cashBalance);
      logUpdate('NAV.csv', 'success', `Fetched cash balance: $${cashBalance.toLocaleString()}`);
    } else {
      console.log('[portfolio] No NAV email found');
    }
  } catch (error) {
    console.error('[portfolio] Error fetching NAV email:', error.message);
    logUpdate('NAV.csv', 'error', `Failed to fetch: ${error.message}`);
  }

  try {
    console.log('[portfolio] Fetching External Holdings email from:', EXTERNAL_HOLDINGS_EMAIL);
    const externalEmail = await getLatestEmailWithSubject(EXTERNAL_HOLDINGS_EMAIL, EXTERNAL_HOLDINGS_SUBJECT);

    if (externalEmail) {
      const { attachment } = externalEmail;
      console.log('[portfolio] Found External Holdings attachment:', attachment.name);
      const buffer = Buffer.from(attachment.contentBytes, 'base64');

      externalPositions = await parseExternalHoldingsFromExcel(buffer);
      logUpdate('ExternalHoldings.xlsx', 'success', `Fetched ${externalPositions.length} external positions`);
    } else {
      console.log('[portfolio] No External Holdings email found');
    }
  } catch (error) {
    console.error('[portfolio] Error fetching external holdings email:', error.message);
    logUpdate('ExternalHoldings.xlsx', 'error', `Failed to fetch: ${error.message}`);
  }

  const allPositions = [...ibPositions, ...externalPositions].sort((a, b) => b.marketValue - a.marketValue);

  const totalMarketValue = allPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
  const fum = totalMarketValue + cashBalance;

  const summary = {
    totalValue: totalMarketValue,
    cashBalance,
    totalPositions: allPositions.length,
    fum,
  };

  const portfolioUpdateTime = getLatestUpdateTime('Portfolio.csv');
  const navUpdateTime = getLatestUpdateTime('NAV.csv');

  return {
    positions: allPositions,
    summary,
    lastUpdate: {
      portfolio: portfolioUpdateTime,
      nav: navUpdateTime,
    },
  };
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
