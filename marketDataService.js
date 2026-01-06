const YahooFinance = require('yahoo-finance2').default;
const pLimit = require('p-limit').default;

const yahooFinance = new YahooFinance();
const fs = require('fs');
const path = require('path');

const TICKER_MAP_PATH = path.join(__dirname, 'ticker_map.json');
const CACHE_DURATION_MS = 20 * 60 * 1000;
const CONCURRENT_REQUESTS = 5;
const TRADING_DAYS = { d1: 1, m1: 21, q1: 63, y1: 252 };
const MA_WINDOWS = [10, 20, 100, 200];

const CATEGORY_ORDER = {
  'Global Markets': 1,
  'ASX Indices': 2,
  'ASX Sectors': 3,
  'Commodities': 4,
  'Forex': 5,
  'Bonds': 6,
  'USA Sectors': 7,
  'Equal Weight Sectors': 8,
  'Thematics': 9
};

let cache = {
  markets: [],
  updatedAt: null,
  fetchedAt: null
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
    const pxVs100d = calculateMADistance(closes, 100);
    const pxVs200d = calculateMADistance(closes, 200);
    
    return {
      ticker: ticker.ticker,
      name: ticker.name,
      category: ticker.category,
      lastPrice: round(lastPrice, 2),
      chg1d: round(chg1d, 1),
      chg1m: round(chg1m, 1),
      chg1q: round(chg1q, 1),
      chg1y: round(chg1y, 1),
      pxVs10d: round(pxVs10d, 1),
      pxVs20d: round(pxVs20d, 1),
      pxVs100d: round(pxVs100d, 1),
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

async function refreshCache() {
  if (refreshPromise) {
    return refreshPromise;
  }
  
  refreshPromise = (async () => {
    try {
      const markets = await fetchAllMarketData();
      cache = {
        markets,
        updatedAt: new Date().toISOString(),
        fetchedAt: Date.now()
      };
      return cache;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

function isCacheValid() {
  if (!cache.fetchedAt) return false;
  return (Date.now() - cache.fetchedAt) < CACHE_DURATION_MS;
}

async function getMarketData() {
  return {
    markets: cache.markets,
    updatedAt: cache.updatedAt
  };
}

function triggerBackgroundRefresh() {
  if (!isCacheValid() && !refreshPromise) {
    refreshCache().catch(err => {
      console.error('[markets] Background refresh failed:', err.message);
    });
  }
}

const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

async function runScheduledRefresh() {
  console.log('[markets] Running scheduled refresh...');
  try {
    await refreshCache();
    console.log('[markets] Scheduled refresh completed');
  } catch (err) {
    console.error('[markets] Scheduled refresh failed:', err.message);
  }
}

runScheduledRefresh();
setInterval(runScheduledRefresh, REFRESH_INTERVAL_MS);
console.log('[markets] Scheduled to refresh every 20 minutes');

module.exports = {
  getMarketData,
  triggerBackgroundRefresh,
  refreshCache
};
