let readXlsxFile = require("read-excel-file/node");

const Exposure = async (req, res) => {
  try {
    const rows = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Exposure" });

    let netExposure = [];
    let sectorExposure = [];
    let marketCapExposure = [];
console.log("rows",rows);
let headers=rows[0]
  
    for (let i = 1; i < rows.length; i++) {
      let row = rows[i];

    
      if (row[0] && row[1] !== null) {
        const key1= headers[0];
        const key2= headers[1];
         netExposure.push({ [key1]: row[0] ,[key2] : Math.round(row[1]*100)});
        
      }

      if (row[3] && row[4] !== null) {
        const key3=headers[3];
        const key4= headers[4];
        sectorExposure.push({ [key3]:row[3], [key4]: Math.round(row[4]*100) });
      }

 
      if (row[6] && (row[7] !== null || row[8] !== null)) {
        const key6= headers[6];
        const key7= headers[7];
        const key8= headers[8];
        
        marketCapExposure.push({
          [key6]:row[6],[key7]: Math.round(row[7]*100),[key8]: row[8] 
        });
      }
    }
console.log(marketCapExposure);


res.json({ netExposure, sectorExposure, marketCapExposure });

  } catch (err) {
    res.status(500).send("internal server error")
  
  }
};

module.exports = { Exposure };
