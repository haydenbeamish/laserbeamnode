let readXlsxFile = require("read-excel-file/node");

const TextDetails = async (req, res) => {
  try {
    const r1 = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Text" });

    const headers = r1[0];

    const r2 = r1.slice(1).map((i) => {
      const obj = {};

      headers.forEach((h1, j) => {
        obj[h1] = i[j];
      });
      return obj;
    });

    res.json(r2);
  } catch (err) {
    res.status(500).send("internal server error")
  }
};

module.exports = { TextDetails };
