const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const { Pool, neonConfig } = require("@neondatabase/serverless");
const ws = require("ws");

neonConfig.webSocketConstructor = ws;

const app = express();
app.use(cors());
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
        disclaimer: DISCLAIMER,
        dateUpdated: null
      });
    }
    
    const row = result.rows[0];
    const perf = row.performance || {};
    const stats = row.stats || {};
    const funds = row.funds || {};
    const holdings = row.holdings || [];
    const exposure = row.exposure || {};
    
    const table = [
      { label: "MTD", value: perf.mtd || 0 },
      { label: "QTD", value: perf.qtd || 0 },
      { label: "FY26", value: perf.fy26 || 0 },
      { label: "Annualised", value: perf.annualised || 0 }
    ];
    
    const lineChart = (perf.chart || []).map(item => ({
      Month: item.month ? new Date(item.month + "-01").toISOString() : null,
      CumulativeReturn: item.value || 0
    }));
    
    const statsArray = [
      { key: "Best Month", value: stats.bestMonth || 0 },
      { key: "Worst Month", value: stats.worstMonth || 0 },
      { key: "MSCI AW Best", value: stats.msciBest || 0 },
      { key: "MSCI AW Worst", value: stats.msciWorst || 0 },
      { key: "Upside Capture", value: stats.upside || 0 },
      { key: "Downside Capture", value: stats.downside || 0 },
      { key: "Avg. Net Exposure", value: stats.avgNet || 0 },
      { key: "Avg. Cash Balance", value: stats.avgCash || 0 },
      { key: "Beta", value: stats.beta || 0 }
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
    const url = `https://api.beehiiv.com/v2/publications/pub_ca643944-2ed9-48dc-8eff-711fc225e133/posts?${expandParams}&audience=all&platform=all&status=confirmed&limit=50&page=1&order_by=publish_date&direction=desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ message: "Beehiiv API error", details: text });
    }

    const data = await response.json();
    res.json(data);
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

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
