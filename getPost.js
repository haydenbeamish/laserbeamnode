const fetch = require('node-fetch');

const GetPosts=async(req,res)=>{
const id=req.params.id;
    try{
const response = await fetch(`https://api.beehiiv.com/v2/publications/pub_ca643944-2ed9-48dc-8eff-711fc225e133/posts/${id}`, {
  method: "GET",
  headers: {
    "Authorization": "Bearer Uc0kKMmsqoEX0mlip2PR0N3RTWM07NBvkYRas3cFKMRF4UXe6uCbnre39fhRNJ1j"
  },
});

const body = await response.json();
res.json(body)
console.log("res",body);
    }catch(err)
    {
res.status(500).json({message:"Server error"})
    }
}


module.exports={GetPosts}
