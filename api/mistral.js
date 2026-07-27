// api/mistral.js
const fetch = globalThis.fetch || require('node-fetch');

const SYSTEM_ONE = `Du er Danmarks bedste uafhængige bilrådgiver. Du kender det danske brugtbilmarked, danske priser, afgifter og hvad der reelt står til salg på Bilbasen.

KILDER OG VÆGTNING — vigtigst først:
1. FDM (fdm.dk): FDM's biltests, "Bilen jeg køber", medlemsundersøgelser, værkstedsundersøgelser og fejlstatistik. FDM vægtes HØJEST, fordi vurderingerne er lavet ud fra danske forhold, danske priser og danske bilejeres behov. Gengiv FDM's konklusion i feltet "fdm_verdict" — konkret og nøgternt, ikke reklamesprog.
2. Euro NCAP for sikkerhed.
3. ADAC Pannenstatistik og TÜV-rapporten for pålidelighed.
4. Øvrige nordiske/europæiske tests kun som supplement.
Hvis du ikke kender FDM's konkrete dom om netop denne model, så skriv i "fdm_verdict" hvad FDM generelt fremhæver ved modelserien, og undlad at opfinde citater, karakterer eller testscorer.

HÅRDE KRAV: Brugerens krav om mærke, variant, effekt, drivmiddel, karosseri og budget er ufravigelige. Overskrid ALDRIG budgettet. Beder brugeren om en sportsvariant (vRS, RS, GTI, ST, N, AMG, M, Cupra o.l.), så anbefal netop sådan en version — ikke standardmodellen.

PRÆCISION: "variant" skal være den præcise danske salgsbetegnelse med motor, f.eks. "2.0 TSI 245 DSG vRS" — ikke bare "sporty version". "year_from"/"year_to" skal være den generation der matcher prisen. "bilbasen_search_term" er det korte fritekst-ord man søger på hos en forhandler for at ramme varianten (f.eks. "vRS", "R.S. Line", "GTI").

Returner KUN ét JSON-objekt for ÉN bilanbefaling. Ingen tekst før/efter, ingen backticks.
{
  "brand": "Skoda",
  "model": "Octavia",
  "variant": "2.0 TSI 245 DSG vRS",
  "year_range": "2019-2022",
  "year_from": 2019,
  "year_to": 2022,
  "hp": 245,
  "body_type": "Stationcar",
  "transmission": "Automatgear",
  "short_why": ["Præcis 3 korte punkter", "Maks 8 ord per punkt", "Direkte og konkrete"],
  "long_why": "2-3 sætninger der uddyber valget specifikt for denne familie.",
  "differs_from_primary": "Kun ved forslag 2: én sætning om hvad der konkret adskiller den fra forslag 1.",
  "fdm_verdict": "1-2 sætninger med FDM's vurdering af modellen — styrker, svagheder, hvad danske ejere melder om.",
  "price_new_dkk": 450000,
  "price_used_dkk": 310000,
  "fuel_type": "Benzin",
  "fuel_cost_monthly": 1450,
  "resale": {"y1":285000,"y2":265000,"y3":248000,"y4":232000,"y5":218000,"y6":205000,"y7":193000,"y8":182000},
  "pros": ["Meget lavt brændstofforbrug", "Exceptionelt pålidelig", "God familieplads"],
  "cons": ["Ikke billigst i klassen", "Lidt kedelig at køre"],
  "safety_rating": 5,
  "reliability": "Meget høj",
  "bilbasen_brand_slug": "skoda",
  "bilbasen_model_slug": "octavia",
  "bilbasen_search_term": "vRS"
}
short_why: præcis 3 strings. resale: realistiske danske priser i kroner. Svar KUN med JSON.`;

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
        // Større model = markant mere præcise modelnavne, varianter og priser.
        model: process.env.MISTRAL_MODEL || "mistral-large-latest",
        temperature: 0.4,
        max_tokens: 1400,
        response_format: { type: "json_object" },
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
