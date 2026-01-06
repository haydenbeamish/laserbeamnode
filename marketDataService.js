const YahooFinance = require('yahoo-finance2').default;
const pLimit = require('p-limit').default;
const OpenAI = require('openai');

const yahooFinance = new YahooFinance();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const fs = require('fs');
const path = require('path');

const TICKER_MAP_PATH = path.join(__dirname, 'ticker_map.json');
const CACHE_DURATION_MS = 20 * 60 * 1000;
const CONCURRENT_REQUESTS = 5;
const TRADING_DAYS = { d1: 1, m1: 21, q1: 63, y1: 252 };
const MA_WINDOWS = [10, 20, 100, 200];

const CATEGORY_ORDER = {
  'Global Markets': 1,
  'Commodities': 2,
  'Forex': 3,
  'USA Sectors': 4,
  'ASX Sectors': 5,
  'USA Equal Weight Sectors': 6,
  'USA Thematics': 7
};

let cache = {
  markets: [],
  updatedAt: null,
  fetchedAt: null,
  aiSummary: null
};

let refreshPromise = null;

function loadTickerMap() {
  const raw = fs.readFileSync(TICKER_MAP_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const tickers = [];
  
  for (const [code, rec] of Object.entries(data)) {
    if (!rec.source || (!rec.source.startsWith('stocks.') && !rec.source.startsWith('crypto.'))) {
      continue;
    }
    if (!rec.symbol) continue;
    
    tickers.push({
      ticker: code,
      symbol: rec.symbol,
      name: rec.co || code,
      category: rec.cat || 'Other'
    });
  }
  
  return tickers;
}

async function fetchTickerData(ticker) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 400);
    
    const result = await yahooFinance.chart(ticker.symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });
    
    if (!result || !result.quotes || result.quotes.length < 10) {
      console.log(`[skip] ${ticker.ticker} (${ticker.symbol}) - insufficient data`);
      return null;
    }
    
    const quotes = result.quotes.filter(q => q.close != null);
    if (quotes.length < 10) {
      console.log(`[skip] ${ticker.ticker} - not enough valid quotes`);
      return null;
    }
    
    const closes = quotes.map(q => q.close);
    const lastPrice = closes[closes.length - 1];
    
    const chg1d = calculateChange(closes, TRADING_DAYS.d1);
    const chg1m = calculateChange(closes, TRADING_DAYS.m1);
    const chg1q = calculateChange(closes, TRADING_DAYS.q1);
    const chg1y = calculateChange(closes, TRADING_DAYS.y1);
    
    const pxVs10d = calculateMADistance(closes, 10);
    const pxVs20d = calculateMADistance(closes, 20);
    const pxVs200d = calculateMADistance(closes, 200);
    
    return {
      ticker: ticker.ticker,
      name: ticker.name,
      category: ticker.category,
      lastPrice: round(lastPrice, 2),
      chgDay: round(chg1d, 1),
      chgMonth: round(chg1m, 1),
      chgQtr: round(chg1q, 1),
      chgYear: round(chg1y, 1),
      pxVs10d: round(pxVs10d, 1),
      pxVs20d: round(pxVs20d, 1),
      pxVs200d: round(pxVs200d, 1)
    };
  } catch (error) {
    console.log(`[error] ${ticker.ticker} (${ticker.symbol}): ${error.message}`);
    return null;
  }
}

function calculateChange(closes, days) {
  if (closes.length <= days) return null;
  const current = closes[closes.length - 1];
  const previous = closes[closes.length - 1 - days];
  if (!previous || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function calculateMADistance(closes, window) {
  if (closes.length < window) return null;
  const current = closes[closes.length - 1];
  const slice = closes.slice(-window);
  const ma = slice.reduce((a, b) => a + b, 0) / slice.length;
  if (!ma || ma === 0) return null;
  return ((current / ma) - 1) * 100;
}

function round(value, decimals) {
  if (value == null || isNaN(value)) return null;
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

async function fetchAllMarketData() {
  console.log('[markets] Starting data refresh...');
  const startTime = Date.now();
  
  const tickers = loadTickerMap();
  console.log(`[markets] Loaded ${tickers.length} tickers`);
  
  const limit = pLimit(CONCURRENT_REQUESTS);
  const promises = tickers.map(ticker => 
    limit(() => fetchTickerData(ticker))
  );
  
  const results = await Promise.all(promises);
  const validResults = results.filter(r => r !== null);
  
  validResults.sort((a, b) => {
    const catOrderA = CATEGORY_ORDER[a.category] || 99;
    const catOrderB = CATEGORY_ORDER[b.category] || 99;
    if (catOrderA !== catOrderB) return catOrderA - catOrderB;
    return (b.chg1d || 0) - (a.chg1d || 0);
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[markets] Fetched ${validResults.length}/${tickers.length} tickers in ${elapsed}s`);
  
  return validResults;
}

async function generateAISummary(markets) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[markets] No OpenAI API key, skipping AI summary');
    return null;
  }
  
  try {
    const globalMarkets = markets.filter(m => m.category === 'Global Markets');
    const usaSectors = markets.filter(m => m.category === 'USA Sectors');
    const asxSectors = markets.filter(m => m.category === 'ASX Sectors');
    const equalWeight = markets.filter(m => m.category === 'USA Equal Weight Sectors');
    const thematics = markets.filter(m => m.category === 'USA Thematics');
    const commodities = markets.filter(m => m.category === 'Commodities');
    
    const formatTickers = (arr) => arr.map(t => `${t.name}: ${t.chgDay > 0 ? '+' : ''}${t.chgDay}% (1D), ${t.chgMonth > 0 ? '+' : ''}${t.chgMonth}% (1M)`).join('\n');
    
    const prompt = `You are a professional market analyst. Provide a concise 3-4 sentence summary of today's market movements based on this data. Focus on:
1. Global index changes and any notable outliers
2. Trend reversals or significant momentum shifts
3. Key sector and thematic themes

GLOBAL MARKETS:
${formatTickers(globalMarkets)}

USA SECTORS:
${formatTickers(usaSectors.slice(0, 10))}

ASX SECTORS:
${formatTickers(asxSectors)}

USA EQUAL WEIGHT SECTORS:
${formatTickers(equalWeight)}

USA THEMATICS (Top movers):
${formatTickers(thematics.slice(0, 10))}

COMMODITIES:
${formatTickers(commodities)}

Write in a professional, factual tone. No bullet points. Maximum 4 sentences.`;

    console.log('[markets] Generating AI summary...');
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2-chat-latest',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 250
    });
    
    const summary = response.choices[0]?.message?.content?.trim() || null;
    console.log('[markets] AI summary generated');
    return summary;
  } catch (error) {
    console.error('[markets] AI summary failed:', error.message);
    return null;
  }
}

async function refreshMarketData() {
  if (refreshPromise) {
    return refreshPromise;
  }
  
  refreshPromise = (async () => {
    try {
      const markets = await fetchAllMarketData();
      cache = {
        markets,
        updatedAt: new Date().toISOString(),
        fetchedAt: Date.now(),
        aiSummary: cache.aiSummary
      };
      return cache;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

async function refreshAISummary() {
  try {
    console.log('[markets] Refreshing AI summary...');
    const aiSummary = await generateAISummary(cache.markets);
    if (aiSummary) {
      cache.aiSummary = aiSummary;
      console.log('[markets] AI summary updated');
    }
  } catch (err) {
    console.error('[markets] AI summary refresh failed:', err.message);
  }
}

function isCacheValid() {
  if (!cache.fetchedAt) return false;
  return (Date.now() - cache.fetchedAt) < CACHE_DURATION_MS;
}

async function getMarketData() {
  return {
    markets: cache.markets,
    updatedAt: cache.updatedAt,
    aiSummary: cache.aiSummary
  };
}

function triggerBackgroundRefresh() {
  if (!isCacheValid() && !refreshPromise) {
    refreshMarketData().catch(err => {
      console.error('[markets] Background refresh failed:', err.message);
    });
  }
}

// Market data refreshes every 20 minutes
const MARKET_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

async function runMarketRefresh() {
  console.log('[markets] Running market data refresh...');
  try {
    await refreshMarketData();
    console.log('[markets] Market data refresh completed');
  } catch (err) {
    console.error('[markets] Market data refresh failed:', err.message);
  }
}

// Check if US is in Daylight Saving Time (March-November)
function isUSDST(date) {
  const year = date.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 7));
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7, 6));
  return date >= marchSecondSunday && date < novFirstSunday;
}

// Check if Australia is in Daylight Saving Time (October-April)
function isAustraliaDST(date) {
  const year = date.getUTCFullYear();
  const octFirstSunday = new Date(Date.UTC(year, 9, 1 + (7 - new Date(Date.UTC(year, 9, 1)).getUTCDay()) % 7, 16));
  const aprFirstSunday = new Date(Date.UTC(year, 3, 1 + (7 - new Date(Date.UTC(year, 3, 1)).getUTCDay()) % 7, 16));
  return date >= octFirstSunday || date < aprFirstSunday;
}

// Get next AI summary refresh time (after US or AU market close)
function getNextAISummaryTime() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  
  // US market close: 20:00 UTC (DST) or 21:00 UTC (standard) - add 15 min buffer
  const usCloseHour = isUSDST(now) ? 20 : 21;
  const usClose = new Date(today.getTime() + usCloseHour * 60 * 60 * 1000 + 15 * 60 * 1000);
  
  // AU market close: 06:10 UTC (standard) or 05:10 UTC (DST) - add 15 min buffer
  const auCloseHour = isAustraliaDST(now) ? 5 : 6;
  const auClose = new Date(today.getTime() + auCloseHour * 60 * 60 * 1000 + 25 * 60 * 1000);
  
  // Find next upcoming time
  const times = [usClose, auClose, 
    new Date(usClose.getTime() + 24 * 60 * 60 * 1000),
    new Date(auClose.getTime() + 24 * 60 * 60 * 1000)
  ].filter(t => t > now).sort((a, b) => a - b);
  
  return times[0];
}

function scheduleNextAISummary() {
  const nextTime = getNextAISummaryTime();
  const delay = nextTime.getTime() - Date.now();
  const market = nextTime.getUTCHours() < 12 ? 'ASX' : 'NYSE';
  
  console.log(`[markets] Next AI summary scheduled for ${nextTime.toISOString()} (after ${market} close)`);
  
  setTimeout(async () => {
    await refreshAISummary();
    scheduleNextAISummary();
  }, delay);
}

// Initial startup
async function initialize() {
  console.log('[markets] Initializing...');
  await runMarketRefresh();
  await refreshAISummary();
  scheduleNextAISummary();
}

initialize();
setInterval(runMarketRefresh, MARKET_REFRESH_INTERVAL_MS);
console.log('[markets] Market data scheduled to refresh every 20 minutes');
console.log('[markets] AI summary scheduled after US and AU market closes');

module.exports = {
  getMarketData,
  triggerBackgroundRefresh,
  refreshMarketData
};
