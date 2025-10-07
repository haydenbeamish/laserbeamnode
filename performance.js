let readXlsxFile = require("read-excel-file/node");

const Performance = async (req, res) => {
  try {
    const r1 = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Performance" });

    const headers = r1[0];
    const table=[];
    const lineChart=[];

    for(let i=1;i<r1.length ;i++)
    {
      let row= r1[i];
      if(row[0]!=null && row[1] !=null)
      {
        lineChart.push({ [headers[0]]:row[0],[headers[1]] :Math.round(row[1]*100)})
      }
      if(row[3]!=null && row[4]!=null)
      {
         table.push({ [headers[3]]:row[3],[headers[4]] :Math.round(row[4]*100)})
      }
    }
res.json({table,lineChart})
  
  } catch (err) {
    res.status(500).send("internal server error")

  }
};

module.exports = { Performance };
