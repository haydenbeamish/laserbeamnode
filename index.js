

let express = require("express");
let readXlsxFile = require("read-excel-file/node");
let { StatsDetails } = require("./stats");
let {FundsDetails} = require("./funds.js");
let {TextDetails} = require("./Text.js");
let {Exposure} = require('./exposure.js');
let {Performance} = require('./performance.js')
let {Holdings} = require('./holdings.js')
let {GetPosts} = require('./getPost.js')

const cors = require("cors");
const fetch = require("node-fetch");



let app = express();
let data;
app.set("json escape", false);
app.use(cors());

app.get("/", (req, res) => {
  res.send("hi , first node js project !!");
});


app.get("/posts", async (req, res) => {

  try {
    const response = await fetch("https://api.beehiiv.com/v2/publications/pub_ca643944-2ed9-48dc-8eff-711fc225e133/posts", {
      headers: {
        Authorization: "Bearer Uc0kKMmsqoEX0mlip2PR0N3RTWM07NBvkYRas3cFKMRF4UXe6uCbnre39fhRNJ1j",
      },
    });

    if (!response.ok) {
      const text = await response.text(); 
      // console.log("Beehiiv response:", text);
      return res.status(response.status).json({ message: "Beehiiv API error", details: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/stats", StatsDetails);
app.get("/funds", FundsDetails);
app.get("/text",TextDetails)
app.get('/exposure',Exposure )
app.get('/performance',Performance)
app.get('/holdings',Holdings )
app.get('/selectedpost/:id',GetPosts)


app.listen(5003, () => {
  console.log("Connected");
});
