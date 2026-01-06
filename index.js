const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const { Pool, neonConfig } = require("@neondatabase/serverless");
const ws = require("ws");
const marketDataService = require("./marketDataService");

neonConfig.webSocketConstructor = ws;

const app = express();
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://www.laserbeamcapital.com',
      'https://laserbeamcapital.com',
      'http://localhost:5000',
      'http://127.0.0.1:5000'
    ];
    if (!origin || allowedOrigins.includes(origin) || /\.replit\.dev$/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const tokens = new Set();

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!tokens.has(token)) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
  next();
}

app.get("/", (req, res) => {
  res.send("Laser Beam Capital API");
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateToken();
    tokens.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.get("/api/admin/data", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM site_data ORDER BY id DESC LIMIT 1");
    if (result.rows.length === 0) {
      return res.json({ success: true, data: {} });
    }
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        performance: row.performance,
        stats: row.stats,
        funds: row.funds,
        holdings: row.holdings,
        exposure: row.exposure,
        text: row.text,
        dateUpdated: row.date_updated
      }
    });
  } catch (err) {
    console.error("Error loading data:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

app.post("/api/admin/data", authMiddleware, async (req, res) => {
  try {
    const { performance, stats, funds, holdings, exposure, text } = req.body;
    const now = new Date();
    
    await pool.query("DELETE FROM site_data");
    
    await pool.query(
      `INSERT INTO site_data (performance, stats, funds, holdings, exposure, text, date_updated, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        JSON.stringify(performance),
        JSON.stringify(stats),
        JSON.stringify(funds),
        JSON.stringify(holdings),
        JSON.stringify(exposure),
        JSON.stringify(text || null),
        now
      ]
    );
    
    res.json({ success: true, dateUpdated: now });
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

const DISCLAIMER = "Past performance is not a reliable indicator of future performance. Hedge Partners Pty Ltd ACN 685 627 954, trading as Laser Beam Capital is a Corporate Authorised Representative (CAR No. 1314946) of Non Correlated Advisors Pty Ltd ACN 158 314 982 (AFSL No. 430126). Authorised to provide general advice to wholesale investors only.";

function calculatePerformanceMetrics(monthlyData) {
  if (!monthlyData || monthlyData.length < 2) {
    return {
      mtd: 0, qtd: 0, fy26: 0, annualised: 0, oneYear: 0,
      bestMonth: 0, worstMonth: 0, msciBest: 0, msciWorst: 0,
      upside: 0, downside: 0, beta: 0,
      chart: []
    };
  }
  
  const sorted = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month));
  const lbfReturns = [];
  const mgwdReturns = [];
  const chart = [];
  
  let inceptionCompound = 1;
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    
    const lbfReturn = prev.nav > 0 ? ((curr.nav / prev.nav) - 1) : 0;
    const mgwdReturn = prev.mgwd > 0 ? ((curr.mgwd / prev.mgwd) - 1) : 0;
    
    lbfReturns.push(lbfReturn * 100);
    mgwdReturns.push(mgwdReturn * 100);
    
    inceptionCompound *= (1 + lbfReturn);
    chart.push({
      month: curr.month,
      value: Math.round((inceptionCompound - 1) * 100 * 10) / 10
    });
  }
  
  const mtd = lbfReturns.length > 0 ? lbfReturns[lbfReturns.length - 1] : 0;
  
  const qMonths = Math.min(3, lbfReturns.length);
  let qCompound = 1;
  for (let i = lbfReturns.length - qMonths; i < lbfReturns.length; i++) {
    qCompound *= (1 + lbfReturns[i] / 100);
  }
  const qtd = (qCompound - 1) * 100;
  
  const fy26Data = sorted.filter(d => d.month >= '2025-07');
  let fy26Compound = 1;
  for (let i = 0; i < fy26Data.length; i++) {
    const currIdx = sorted.indexOf(fy26Data[i]);
    if (currIdx > 0) {
      const r = (sorted[currIdx].nav / sorted[currIdx - 1].nav) - 1;
      fy26Compound *= (1 + r);
    }
  }
  const fy26 = (fy26Compound - 1) * 100;
  
  let oneYear = 0;
  if (lbfReturns.length >= 12) {
    let yr1Compound = 1;
    const last12Returns = lbfReturns.slice(-12);
    for (const r of last12Returns) {
      yr1Compound *= (1 + r / 100);
    }
    oneYear = (yr1Compound - 1) * 100;
  }
  
  const monthsElapsed = sorted.length - 1;
  const annualised = monthsElapsed > 0 ? (Math.pow(inceptionCompound, 12 / monthsElapsed) - 1) * 100 : 0;
  
  const bestMonth = lbfReturns.length > 0 ? Math.max(...lbfReturns) : 0;
  const worstMonth = lbfReturns.length > 0 ? Math.min(...lbfReturns) : 0;
  const msciBest = mgwdReturns.length > 0 ? Math.max(...mgwdReturns) : 0;
  const msciWorst = mgwdReturns.length > 0 ? Math.min(...mgwdReturns) : 0;
  
  const positiveMgwd = mgwdReturns.map((m, i) => ({ m, l: lbfReturns[i] })).filter(x => x.m > 0);
  const negativeMgwd = mgwdReturns.map((m, i) => ({ m, l: lbfReturns[i] })).filter(x => x.m < 0);
  
  let upside = 0;
  if (positiveMgwd.length > 0) {
    const avgLbfUp = positiveMgwd.reduce((s, x) => s + x.l, 0) / positiveMgwd.length;
    const avgMgwdUp = positiveMgwd.reduce((s, x) => s + x.m, 0) / positiveMgwd.length;
    upside = (avgLbfUp / avgMgwdUp) * 100;
  }
  
  let downside = 0;
  if (negativeMgwd.length > 0) {
    const avgLbfDown = negativeMgwd.reduce((s, x) => s + x.l, 0) / negativeMgwd.length;
    const avgMgwdDown = negativeMgwd.reduce((s, x) => s + x.m, 0) / negativeMgwd.length;
    downside = (avgLbfDown / avgMgwdDown) * 100;
  }
  
  let beta = 0;
  if (lbfReturns.length >= 2 && mgwdReturns.length >= 2) {
    const n = lbfReturns.length;
    const sumX = mgwdReturns.reduce((a, b) => a + b, 0);
    const sumY = lbfReturns.reduce((a, b) => a + b, 0);
    const sumXY = mgwdReturns.reduce((s, x, i) => s + x * lbfReturns[i], 0);
    const sumX2 = mgwdReturns.reduce((s, x) => s + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom !== 0) {
      beta = (n * sumXY - sumX * sumY) / denom;
    }
  }
  
  return {
    mtd: Math.round(mtd * 10) / 10,
    qtd: Math.round(qtd * 10) / 10,
    fy26: Math.round(fy26 * 10) / 10,
    annualised: Math.round(annualised * 10) / 10,
    oneYear: Math.round(oneYear * 10) / 10,
    bestMonth: Math.round(bestMonth * 10) / 10,
    worstMonth: Math.round(worstMonth * 10) / 10,
    msciBest: Math.round(msciBest * 10) / 10,
    msciWorst: Math.round(msciWorst * 10) / 10,
    upside: Math.round(upside),
    downside: Math.round(downside),
    beta: Math.round(beta * 10) / 10,
    chart
  };
}

app.get("/api/performance", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM site_data ORDER BY id DESC LIMIT 1");
    
    if (result.rows.length === 0) {
      return res.json({
        table: [],
        lineChart: [],
        stats: [],
        funds: [],
        holdings: [],
        exposure: { netExposure: [], sectorExposure: [], marketCapExposure: [] },
        text: [],
        disclaimer: DISCLAIMER,
        dateUpdated: null
      });
    }
    
    const row = result.rows[0];
    const perf = row.performance || {};
    const statsData = row.stats || {};
    const funds = row.funds || {};
    const holdings = row.holdings || [];
    const exposure = row.exposure || {};
    const textData = row.text || [];
    
    const metrics = calculatePerformanceMetrics(perf.monthlyData);
    
    const table = [
      { label: "MTD", value: metrics.mtd },
      { label: "QTD", value: metrics.qtd },
      { label: "FY26", value: metrics.fy26 },
      { label: "Annualised", value: metrics.annualised }
    ];
    
    const lineChart = metrics.chart.map(item => ({
      Month: item.month ? new Date(item.month + "-01").toISOString() : null,
      CumulativeReturn: item.value || 0
    }));
    
    const statsArray = [
      { key: "Best Month", value: metrics.bestMonth },
      { key: "Worst Month", value: metrics.worstMonth },
      { key: "MSCI AW Best", value: metrics.msciBest },
      { key: "MSCI AW Worst", value: metrics.msciWorst },
      { key: "Upside Capture", value: metrics.upside },
      { key: "Downside Capture", value: metrics.downside },
      { key: "Avg. Net Exposure", value: statsData.avgNet || 0 },
      { key: "Avg. Cash Balance", value: statsData.avgCash || 0 },
      { key: "Beta", value: metrics.beta }
    ];
    
    const fundsArray = [
      { key: "Universe", value: funds.universe || "" },
      { key: "Holdings", value: funds.holdings || "" },
      { key: "Target", value: funds.target || "" },
      { key: "Min Investment", value: funds.minInvestment || "" },
      { key: "Mgmt. Fee", value: funds.mgmtFee || 0 },
      { key: "Perf. Fee", value: funds.perfFee || 0 },
      { key: "APIR", value: funds.apir || "" },
      { key: "Vehicle", value: funds.vehicle || "" },
      { key: "PM", value: funds.pm || "" }
    ];
    
    const holdingsArray = holdings.map((h, i) => ({
      TopHoldingsTable: h.name,
      Weight: h.weight,
      Rank: i + 1
    }));
    
    const netExposure = [
      { key: "Gross long", value: exposure.grossLong || 0 },
      { key: "Gross short", value: exposure.grossShort || 0 },
      { key: "Net", value: exposure.net || 0 }
    ];
    
    const sectorExposure = (exposure.sectors || []).map(s => ({
      name: s.name,
      value: s.value
    }));
    
    const marketCapExposure = (exposure.marketCap || []).map(m => ({
      name: m.name,
      value: m.value,
      labels: `${m.name} (${m.value}%)`
    }));
    
    res.json({
      table,
      lineChart,
      stats: statsArray,
      funds: fundsArray,
      holdings: holdingsArray,
      exposure: { netExposure, sectorExposure, marketCapExposure },
      text: textData,
      disclaimer: DISCLAIMER,
      dateUpdated: row.date_updated
    });
  } catch (err) {
    console.error("Error fetching performance:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/posts", async (req, res) => {
  try {
    const expandParams = ["free_web_content"].map((e) => `expand[]=${e}`).join("&");
    const baseUrl = `https://api.beehiiv.com/v2/publications/pub_ca643944-2ed9-48dc-8eff-711fc225e133/posts?${expandParams}&audience=all&status=confirmed&limit=50&page=1&order_by=publish_date&direction=desc`;
    
    const [webResponse, bothResponse] = await Promise.all([
      fetch(`${baseUrl}&platform=web`, {
        headers: { Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}` }
      }),
      fetch(`${baseUrl}&platform=both`, {
        headers: { Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}` }
      })
    ]);

    if (!webResponse.ok || !bothResponse.ok) {
      return res.status(500).json({ message: "Beehiiv API error" });
    }

    const webData = await webResponse.json();
    const bothData = await bothResponse.json();
    
    const allPosts = [...(webData.data || []), ...(bothData.data || [])];
    allPosts.sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date));
    
    res.json({ data: allPosts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/selectedpost/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const expandParams = ["free_web_content"].map((e) => `expand[]=${e}`).join("&");
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/pub_ca643944-2ed9-48dc-8eff-711fc225e133/posts/${id}?${expandParams}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
        },
      }
    );
    const body = await response.json();
    res.json(body);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/markets", async (req, res) => {
  try {
    const data = await marketDataService.getMarketData();
    res.json(data);
  } catch (err) {
    console.error("[/api/markets] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
