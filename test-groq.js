const Groq = require("groq-sdk");
require("dotenv").config({ path: ".env.local" });

async function listModels() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const res = await groq.models.list();
    console.log(res.data.map(m => m.id).join("\n"));
  } catch(e) {
    console.error("Error:", e.message);
  }
}
listModels();
