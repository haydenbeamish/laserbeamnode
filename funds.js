let readXlsxFile = require("read-excel-file/node");

const FundsDetails = async (req, res) => {
  try {
    const r1 = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "TheFund" });

    const headers = r1[0];

    const r2 = r1.slice(1).map((i) => {
      const obj = {};

      headers.forEach((h1, j) => {
        obj[h1] = i[j];
      });
      
      if ((obj.key === "Mgmt. Fee" || obj.key === "Perf. Fee") && obj.value !== null) {
        obj.value = Math.round(obj.value * 100);
      }
      
      return obj;
    });

    res.json(r2);
  } catch (err) {
    res.status(500).send("internal server error")

  }
};

module.exports = { FundsDetails };
