// api/recommend.js — henter én bilanbefaling fra Claude.
//
// Afløser den tidligere api/mistral.js. To ting er anderledes:
//
//   1. Svaret kommer som struktureret JSON (output_config.format), så vi ikke
//      længere skal lede efter den første tuborgklamme i en tekststreng og håbe
//      på det bedste. Modellen kan ikke svare i et forkert format.
//   2. Systemprompten caches. Den er ens for alle fire kald i en søgning, så
//      kald 2-4 betaler kun en brøkdel for den del af inputtet.
//
// Miljøvariabler:
//   ANTHROPIC_API_KEY   påkrævet
//   CLAUDE_MODEL        valgfri, standard claude-opus-5
//   CLAUDE_EFFORT       valgfri, standard high (low | medium | high | xhigh | max)
const Anthropic = require("@anthropic-ai/sdk");

const MODEL  = process.env.CLAUDE_MODEL  || "claude-opus-5";
const EFFORT = process.env.CLAUDE_EFFORT || "high";

const SYSTEM = `Du er Danmarks bedste uafhængige bilrådgiver. Du kender det danske brugtbilmarked, danske priser, afgifter og hvad der reelt står til salg på Bilbasen.

KILDER OG VÆGTNING — vigtigst først:
1. FDM (fdm.dk): FDM's biltests, medlemsundersøgelser, værkstedsundersøgelser og fejlstatistik. FDM vægtes HØJEST, fordi vurderingerne er lavet ud fra danske forhold, danske priser og danske bilejeres behov. Gengiv FDM's konklusion i "fdm_verdict" — konkret og nøgternt, ikke reklamesprog.
2. Euro NCAP for sikkerhed.
3. ADAC Pannenstatistik og TÜV-rapporten for pålidelighed.
Kender du ikke FDM's konkrete dom om netop denne model, så skriv hvad FDM generelt fremhæver ved modelserien. Opfind ALDRIG citater, karakterer eller testscorer.

HÅRDE KRAV: Brugerens krav om mærke, variant, effekt, drivmiddel, karosseri og budget er ufravigelige. Overskrid ALDRIG budgettet. Beder brugeren om en sportsvariant (vRS, RS, GTI, ST, N, AMG, M, Cupra o.l.), så anbefal netop sådan en version — ikke standardmodellen.

PRÆCISION — det vigtigste af det hele:
- Bilen SKAL faktisk have været solgt i Danmark i den angivne periode, og der skal realistisk set være brugte eksemplarer til salg herhjemme nu. Foreslå ikke grå-importerede sjældenheder.
- "variant" skal være den præcise danske salgsbetegnelse med motor, f.eks. "2.0 TSI 245 DSG vRS" — ikke "sporty version".
- "price_used_dkk" skal være en realistisk dansk markedspris for et velholdt eksemplar med normal km-stand i den angivne periode. Det er det tal hele søgningen bygger på, så et skøn der rammer ved siden af gør resultatet ubrugeligt.
- "year_from"/"year_to" skal være den generation der matcher prisen.
- "bilbasen_search_term" er det korte ord man søger på hos en forhandler for at ramme varianten (f.eks. "vRS", "GTI"). Lad feltet stå tomt hvis modellen ikke har en særlig variantbetegnelse.
- "bilbasen_model_slug" skal være modelnavnet som ét ord i små bogstaver uden mærket, f.eks. "octavia", "golf", "3-serie". Kan modellen ikke skrives som ét ord, så lad feltet stå tomt.

SPROG: Alt indhold skrives på dansk, i et roligt og konkret sprog uden fagudtryk. Skriv til en person der ikke interesserer sig for biler.

colors_dk: 4-8 lakfarver modellen faktisk blev solgt i hos danske forhandlere i perioden. Brug producentens EGNE farvenavne ("Race Blue", "Corrida Red"), ikke generiske ord som "blå". "hex" skal være den farve lakken reelt ser ud som. Kender du ikke de officielle navne, så returner en tom liste frem for at finde på dem.

wikipedia_title: titlen på modellens artikel på ENGELSK Wikipedia, så vi kan finde et billede. Brug det internationale modelnavn — "BMW 1 Series", ikke "BMW 1-serie"; "Mercedes-Benz C-Class", ikke "Mercedes C-Klasse".

short_why: præcis 3 punkter, hver på højst 8 ord.
resale: realistiske danske gensalgspriser i kroner, år for år.`;

/* Skemaet tvinger svaret på plads. Modellen kan ikke returnere andet end dette.
   BEMÆRK: strukturerede svar understøtter kun en delmængde af JSON Schema.
   minItems/maxItems, minimum/maximum og pattern giver 400 og må IKKE stå her —
   antal og format skrives i "description" og i systemprompten i stedet, og
   frontenden håndterer alligevel afvigelser. */
const CAR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "brand","model","variant","year_range","year_from","year_to","hp","body_type",
    "transmission","short_why","long_why","differs_from_primary","fdm_verdict",
    "price_new_dkk","price_used_dkk","fuel_type","fuel_cost_monthly","resale",
    "pros","cons","safety_rating","reliability","colors_dk",
    "bilbasen_brand_slug","bilbasen_model_slug","bilbasen_search_term",
    "imagin_make","imagin_model_family","wikipedia_title",
  ],
  properties: {
    brand: { type: "string" },
    model: { type: "string" },
    variant: { type: "string" },
    year_range: { type: "string", description: "f.eks. 2019-2022" },
    year_from: { type: "integer" },
    year_to: { type: "integer" },
    hp: { type: "integer" },
    body_type: { type: "string", enum: ["Hatchback","Sedan","Stationcar","SUV","MPV","Cabriolet","Pickup","Coupe"] },
    transmission: { type: "string" },
    short_why: { type: "array", items: { type: "string" }, description: "Præcis 3 punkter, hver på højst 8 ord" },
    long_why: { type: "string" },
    differs_from_primary: { type: "string", description: "Tom streng for forslag 1" },
    fdm_verdict: { type: "string" },
    price_new_dkk: { type: "integer" },
    price_used_dkk: { type: "integer" },
    fuel_type: { type: "string", enum: ["Benzin","Diesel","El","Hybrid","Plugin-hybrid"] },
    fuel_cost_monthly: { type: "integer" },
    resale: {
      type: "object", additionalProperties: false,
      required: ["y1","y2","y3","y4","y5","y6","y7","y8"],
      properties: Object.fromEntries(["y1","y2","y3","y4","y5","y6","y7","y8"].map(k=>[k,{type:"integer"}])),
    },
    pros: { type: "array", items: { type: "string" }, description: "2-4 fordele" },
    cons: { type: "array", items: { type: "string" }, description: "2-4 ulemper" },
    safety_rating: { type: "integer", description: "Euro NCAP-stjerner, 1-5" },
    reliability: { type: "string" },
    colors_dk: {
      type: "array", description: "4-8 lakfarver, eller tom liste hvis de officielle navne er ukendte",
      items: {
        type: "object", additionalProperties: false,
        required: ["name","hex","metallic"],
        properties: {
          name: { type: "string" },
          hex: { type: "string", description: "Farvekode i formatet #rrggbb" },
          metallic: { type: "boolean" },
        },
      },
    },
    bilbasen_brand_slug: { type: "string" },
    bilbasen_model_slug: { type: "string" },
    bilbasen_search_term: { type: "string" },
    imagin_make: { type: "string" },
    imagin_model_family: { type: "string" },
    wikipedia_title: { type: "string" },
  },
};

function readBody(req) {
  return new Promise(resolve => {
    if (!req.on) return resolve(null);
    let raw = "";
    req.on("data", c => { raw += c; });
    req.on("end", () => resolve(raw));
    req.on("error", () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "METODE_MÅ_VÆRE_POST" }));
    }
    const raw = await readBody(req);
    let payload;
    try { payload = raw ? JSON.parse(raw) : req.body; } catch (e) { payload = req.body; }
    const profile = payload && payload.profile;
    if (!profile) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Mangler 'profile' i body" }));
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("MISSING_ENV: ANTHROPIC_API_KEY er ikke sat");
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "MISSING_ENV", hint: "API-nøglen mangler på serveren. Sæt ANTHROPIC_API_KEY i Vercel og deploy igen." }));
    }

    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      // Tænkning er slået til som standard på Opus 5, og de tokens tæller med i
      // det SAMME budget som svaret. Et lavt loft betyder derfor ikke "et kort
      // svar" — det betyder at JSON'en bliver klippet over midt i, og så er
      // hele svaret ubrugeligt. Skemaet her er stort, så der skal være luft.
      max_tokens: 16000,
      // Systemprompten er ens for alle fire kald i en søgning — cachet er den
      // næsten gratis fra kald nummer to.
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: {
        effort: EFFORT,
        format: { type: "json_schema", schema: CAR_SCHEMA },
      },
      messages: [{ role: "user", content: profile }],
    });

    if (message.stop_reason === "refusal") {
      console.error("REFUSAL", message.stop_details);
      res.statusCode = 422;
      return res.end(JSON.stringify({ error: "REFUSAL", hint: "Modellen afviste forespørgslen." }));
    }
    // Ramte vi loftet, er JSON'en klippet over. Sig det tydeligt frem for at
    // lade det ligne en tilfældig parsefejl.
    if (message.stop_reason === "max_tokens") {
      console.error("MAX_TOKENS — svaret blev klippet over. Hæv max_tokens.");
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: "MAX_TOKENS", hint: "Svaret blev for langt og blev klippet over." }));
    }

    const text = (message.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");
    let car;
    try { car = JSON.parse(text); }
    catch (e) {
      console.error("Kunne ikke parse svaret som JSON:", text.slice(0, 400));
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: "BAD_JSON", hint: "Svaret kunne ikke læses." }));
    }
    if (!car || !car.brand) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: "MANGLER_BRAND", hint: "Svaret manglede felter." }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ car, usage: message.usage }));
  } catch (err) {
    // Typede fejlklasser frem for at gætte ud fra fejlteksten
    if (err instanceof Anthropic.RateLimitError) {
      console.error("Rate limit:", err.message);
      res.statusCode = 429;
      return res.end(JSON.stringify({ error: "RATE_LIMIT", hint: "For mange kald på kort tid." }));
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Ugyldig API-nøgle");
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "BAD_KEY", hint: "API-nøglen blev afvist. Tjek nøglen og at der er saldo på kontoen." }));
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API-fejl", err.status, err.message);
      res.statusCode = err.status >= 500 ? 502 : 400;
      // Tag API'ets egen forklaring med. Uden den er et 400 umuligt at
      // diagnosticere udefra, og det kostede os en runde.
      const detail = String(err.message || "").slice(0, 300);
      return res.end(JSON.stringify({ error: "CLAUDE_ERROR", status: err.status,
        hint: `Claude svarede med fejl ${err.status}. ${detail}` }));
    }
    console.error("Uventet fejl i api/recommend:", err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "SERVER_EXCEPTION", hint: "Uventet fejl på serveren." }));
  }
};
