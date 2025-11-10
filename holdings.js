let readXlsxFile = require("read-excel-file/node");

const Holdings = async (req, res) => {
  try {
    const r1 = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Holdings" });

    const headers = r1[0];

    const r2 = r1.slice(1).map((i) => {
      const obj = {};

      headers.forEach((h1, j) => {
        if (h1 === "Weight" && i[j] !== null) {
          obj[h1] = Math.round(i[j] * 100);
        } else {
          obj[h1] = i[j];
        }
      });
      return obj;
    });

    res.json(r2);
  } catch (err) {
    res.status(500).send("internal server error")

  }
};

module.exports = { Holdings  };
