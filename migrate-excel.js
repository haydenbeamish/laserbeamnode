const readXlsxFile = require("read-excel-file/node");
const { Pool, neonConfig } = require("@neondatabase/serverless");
const ws = require("ws");

neonConfig.webSocketConstructor = ws;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Migrating data to new format...");

    const monthlyData = [
      { month: '2025-06', nav: 1.00, mgwd: 425.45 },
      { month: '2025-07', nav: 1.03, mgwd: 438.94 },
      { month: '2025-08', nav: 1.05, mgwd: 442.46 },
      { month: '2025-09', nav: 1.09, mgwd: 452.79 },
      { month: '2025-10', nav: 1.12, mgwd: 468.65 },
      { month: '2025-11', nav: 1.12, mgwd: 467.77 },
      { month: '2025-12', nav: 1.12, mgwd: 465.07 }
    ];
    
    const performance = {
      monthlyData: monthlyData
    };
    
    const stats = {
      avgNet: 18,
      avgCash: 72
    };
    
    const funds = {
      universe: 'Global',
      holdings: '5-20',
      target: '>10% net p.a.',
      minInvestment: '$100k',
      mgmtFee: 1,
      perfFee: 20,
      apir: 'NCC5451AU',
      vehicle: 'Wholesale Unit Trust',
      pm: 'Hayden Beamish'
    };
    
    const holdings = [
      { name: 'Reddit', weight: 5 },
      { name: 'South32', weight: 4 },
      { name: 'Unity Software', weight: 4 }
    ];
    
    const exposure = {
      sectors: [
        { name: 'CASH', value: 62 },
        { name: 'TECHNOLOGY', value: 14 },
        { name: 'MATERIALS', value: 11 },
        { name: 'FINANCIALS', value: 8 },
        { name: 'OTHER', value: 5 }
      ],
      marketCap: [
        { name: '>$10b', value: 84 },
        { name: '$1b-$10b', value: 11 },
        { name: '$500m-$1b', value: 0 },
        { name: '$300m-$500m', value: 0 },
        { name: '<$300m', value: 5 }
      ],
      grossLong: 52,
      grossShort: -2,
      net: 50
    };
    
    const text = [
      {
        key: 'Strategy',
        text: 'We run a concentrated, long biased portfolio of 5 to 20 positions, with flexibility to short mainly for hedging and risk management. We focus on quality businesses, sizing positions by conviction and risk reward, cutting losers quickly and letting winners compound. Ideas are sourced through deep fundamental research enhanced by proprietary AI analytics to uncover catalysts, growth themes and market dislocations. The Portfolio Manager is invested alongside clients.'
      },
      {
        key: 'Hedging',
        text: 'Hedging is part of our core process, not a trade. We aim to protect capital, smooth the return path and keep dry powder so we can play offence when others are forced to sell. We flex net exposure using index futures and options such as put spreads, collars and opportunistic call overwrites to neutralise market risk at low carry, add selective single name shorts where fundamentals are deteriorating or positioning is crowded, and hold cash when the opportunity set is thin.'
      },
      {
        key: 'AI Analyst',
        text: 'It ingests earnings calls, company filings, price and volume, options flow and credible web signals each day, then ranks what changed and why it matters. Language models flag guidance shifts, management tone, competitive pressure and anomalies that are easy to miss at speed, while pattern detection surfaces repeatable set ups and builds live watchlists with entry and exit levels, catalysts and risks. The output is concise one page briefs and scenario tests that support quicker and better sizing decisions. It augments our work, it does not decide, and every idea still passes a fundamental review before capital is risked.'
      },
      {
        key: 'Risk Management',
        text: 'We are return focused and drawdown aware. Risk is set before entry: every trade has defined downside, a stop loss, and a position size based on conviction, liquidity and risk reward within name and sector limits. Gross and net exposure sit inside bands, with hedges and shorts used to neutralise unintended risks. Liquidity comes first, supported by event playbooks and ongoing stress tests across rates, currency, factors and commodities; portfolio drawdown triggers force action. Independent trustee, administration and audit provide oversight with daily reconciliation, and the Portfolio Manager invests alongside clients.'
      }
    ];
    
    console.log("Monthly Data:", monthlyData);
    console.log("Stats:", stats);
    console.log("Funds:", funds);
    console.log("Holdings:", holdings);
    console.log("Exposure:", exposure);
    console.log("Text sections:", text.length);

    await pool.query("DELETE FROM site_data");
    
    const now = new Date();
    await pool.query(
      `INSERT INTO site_data (performance, stats, funds, holdings, exposure, text, date_updated, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        JSON.stringify(performance),
        JSON.stringify(stats),
        JSON.stringify(funds),
        JSON.stringify(holdings),
        JSON.stringify(exposure),
        JSON.stringify(text),
        now
      ]
    );

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
