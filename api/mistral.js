// api/mistral.js
const fetch = globalThis.fetch || require('node-fetch');

const SYSTEM_ONE = `Du er Danmarks bedste uafhængige bilrådgiver...`; // keep your full prompt here

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
};  } catch (err) {
    return res.status(500).json({ error: "Serverfejl", message: err.message });
  }
}    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
