let readXlsxFile = require("read-excel-file/node");

const Performance = async (req, res) => {
  try {
    const r1 = await readXlsxFile("./LaserBeamExcel.xlsx", { sheet: "Performance" });

    const headers = r1[0];
    const table=[];
    const lineChart=[];
    
    const dateUpdated = r1[1] && r1[1][6] ? r1[1][6] : null;

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
    
    const disclaimer = "Past performance is not a reliable indicator of future performance. Hedge Partners Pty Ltd ACN 685 627 954, trading as Laser Beam Capital is a Corporate Authorised Representative (CAR No. 1314946) of Non Correlated Advisors Pty Ltd ACN 158 314 982 (AFSL No. 430126). Authorised to provide general advice to wholesale investors only.";

    res.json({table, lineChart, disclaimer, dateUpdated})
  
  } catch (err) {
    res.status(500).send("internal server error")

  }
};

module.exports = { Performance };
