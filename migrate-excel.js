const readXlsxFile = require("read-excel-file/node");
const { Pool, neonConfig } = require("@neondatabase/serverless");
const ws = require("ws");

neonConfig.webSocketConstructor = ws;

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Reading Excel data...");

    const perfRows = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Performance" });
    const statsRows = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Stats" });
    const fundsRows = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "TheFund" });
    const holdingsRows = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Holdings" });
    const exposureRows = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Exposure" });
    const textRows = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Text" });

    const performance = { chart: [] };
    let dateUpdated = null;
    
    for (let i = 1; i < perfRows.length; i++) {
      const row = perfRows[i];
      if (row[0] && row[1] !== null) {
        const monthDate = new Date(row[0]);
        const monthStr = monthDate.toISOString().substring(0, 7);
        performance.chart.push({ month: monthStr, value: Math.round(row[1] * 100) });
      }
      if (row[3] && row[4] !== null) {
        const label = row[3].toString().toLowerCase().replace(/\./g, '').replace(/ /g, '');
        if (label.includes('mtd')) performance.mtd = Math.round(row[4] * 100);
        else if (label.includes('qtd')) performance.qtd = Math.round(row[4] * 100);
        else if (label.includes('fy26') || label.includes('fy')) performance.fy26 = Math.round(row[4] * 100);
        else if (label.includes('annualised') || label.includes('annual')) performance.annualised = Math.round(row[4] * 100);
      }
      if (row[6]) dateUpdated = row[6];
    }

    const stats = {};
    for (let i = 1; i < statsRows.length; i++) {
      const row = statsRows[i];
      if (row[0] && row[1] !== null) {
        const key = row[0].toString().toLowerCase().replace(/\./g, '').replace(/ /g, '');
        const value = Math.round(row[1] * 100);
        if (key.includes('bestmonth')) stats.bestMonth = value;
        else if (key.includes('worstmonth')) stats.worstMonth = value;
        else if (key.includes('mscibest') || key.includes('msciawall') && key.includes('best')) stats.msciBest = value;
        else if (key.includes('msciworst') || key.includes('msciawall') && key.includes('worst')) stats.msciWorst = value;
        else if (key.includes('upside')) stats.upside = value;
        else if (key.includes('downside')) stats.downside = value;
        else if (key.includes('avgnet')) stats.avgNet = value;
        else if (key.includes('avgcash')) stats.avgCash = value;
        else if (key.includes('beta')) stats.beta = value;
      }
    }

    const funds = {};
    for (let i = 1; i < fundsRows.length; i++) {
      const row = fundsRows[i];
      if (row[0]) {
        const key = row[0].toString().toLowerCase().replace(/\./g, '').replace(/ /g, '');
        const value = row[1];
        if (key.includes('universe')) funds.universe = value;
        else if (key.includes('holdings')) funds.holdings = value;
        else if (key.includes('target')) funds.target = value;
        else if (key.includes('mininvestment') || key.includes('min')) funds.minInvestment = value;
        else if (key.includes('mgmtfee') || key.includes('mgmt')) funds.mgmtFee = typeof value === 'number' ? Math.round(value * 100) : value;
        else if (key.includes('perffee') || key.includes('perf')) funds.perfFee = typeof value === 'number' ? Math.round(value * 100) : value;
        else if (key.includes('apir')) funds.apir = value;
        else if (key.includes('vehicle')) funds.vehicle = value;
        else if (key.includes('pm')) funds.pm = value;
      }
    }

    const holdings = [];
    for (let i = 1; i < holdingsRows.length; i++) {
      const row = holdingsRows[i];
      if (row[0] && row[1] !== null) {
        holdings.push({ name: row[0], weight: Math.round(row[1] * 100) });
      }
    }

    const exposure = { sectors: [], marketCap: [] };
    for (let i = 1; i < exposureRows.length; i++) {
      const row = exposureRows[i];
      if (row[0] && row[1] !== null) {
        const key = row[0].toString().toLowerCase();
        if (key.includes('grosslong') || key.includes('gross long')) exposure.grossLong = Math.round(row[1] * 100);
        else if (key.includes('grossshort') || key.includes('gross short')) exposure.grossShort = Math.round(row[1] * 100);
        else if (key === 'net' || key.includes('net exposure')) exposure.net = Math.round(row[1] * 100);
      }
      if (row[3] && row[4] !== null) {
        exposure.sectors.push({ name: row[3], value: Math.round(row[4] * 100) });
      }
      if (row[6] && row[7] !== null) {
        exposure.marketCap.push({ name: row[6], value: Math.round(row[7] * 100) });
      }
    }

    const text = [];
    for (let i = 1; i < textRows.length; i++) {
      const row = textRows[i];
      if (row[0] && row[1]) {
        text.push({ key: row[0], text: row[1] });
      }
    }

    console.log("Migrating to database...");
    console.log("Performance:", performance);
    console.log("Stats:", stats);
    console.log("Funds:", funds);
    console.log("Holdings:", holdings);
    console.log("Exposure:", exposure);
    console.log("Text:", text);

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
        JSON.stringify(text),
        dateUpdated || new Date()
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
