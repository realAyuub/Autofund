// api/mistral.js
const fetch = globalThis.fetch || require('node-fetch');
const SYSTEM_ONE = `Du er Danmarks bedste uafhængige bilrådgiver. Du kender alle bilmodeller i Danmark.
Returner KUN ét JSON-objekt for ÉN bilanbefaling. Ingen tekst før/efter, ingen backticks.
{
  "brand": "Toyota","model": "RAV4","variant": "2.5 Hybrid Active","year_range": "2020-2023",
  "short_why": ["Præcis 3 korte punkter","Maks 8 ord per punkt","Direkte og konkrete"],
  "long_why": "2-3 sætninger der uddyber valget specifikt for denne familie.",
  "price_new_dkk": 450000,"price_used_dkk": 310000,"fuel_type": "Hybrid","fuel_cost_monthly": 850,
  "resale": {"y1":285000,"y2":265000,"y3":248000,"y4":232000,"y5":218000,"y6":205000,"y7":193000,"y8":182000},
  "pros": ["Meget lavt brændstofforbrug","Exceptionel pålidelig","God familieplads"],
  "cons": ["Ikke billigst i klassen","Lidt kedelig at køre"],
  "safety_rating": 5,"reliability": "Meget høj",
  "bilbasen_brand_slug": "toyota","bilbasen_model_slug": "rav4"
}
short_why: præcis 3 strings. Resale: realistiske danske priser. Svar KUN med JSON.`;

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "METODE_MÅ_VÆRE_POST" }));
    }
    let body = "";
    req.on && (await new Promise((resolve, reject) => {
      try {
        if (!req.on) return resolve();
        req.on("data", chunk => { body += chunk; });
        req.on("end", resolve);
        req.on("error", reject);
      } catch (e) { resolve(); }
    }));
    let parsedBody;
    try { parsedBody = body ? JSON.parse(body) : req.body; } catch (e) { parsedBody = req.body; }
    const profile = (parsedBody && parsedBody.profile) || (req.body && req.body.profile);
    if (!profile) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Mangler 'profile' i body" }));
    }
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      console.error("MISSING_ENV: MISTRAL_API_KEY is not set");
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "MISSING_ENV", message: "MISTRAL_API_KEY is not set on server" }));
    }
    const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          { role: "system", content: SYSTEM_ONE },
          { role: "user", content: profile },
        ],
      }),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    if (!resp.ok) {
      console.error("Mistral responded non-OK:", resp.status, text);
      res.statusCode = resp.status || 500;
      return res.end(JSON.stringify({ error: "MISTRAL_ERROR", status: resp.status, body: data }));
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(data));
  } catch (err) {
    console.error("Unhandled error in api/mistral:", err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "SERVER_EXCEPTION", message: err.message, stack: err.stack }));
  }
};
