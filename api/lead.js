// api/lead.js — modtager forespørgsler fra "Har du brug for mere hjælp?"
//
// Uden konfiguration logger endpointet blot forespørgslen og svarer
// { delivered: false }. Frontenden falder så tilbage til en færdigudfyldt
// mailto-knap, så brugeren aldrig ender i en blindgyde.
//
// Sæt disse env-variabler for rigtig e-mailafsendelse (Resend):
//   RESEND_API_KEY   API-nøgle fra resend.com
//   LEAD_TO_EMAIL    din modtageradresse
//   LEAD_FROM_EMAIL  afsender på et domæne du har verificeret hos Resend
const fetch = globalThis.fetch || require('node-fetch');

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
    payload = payload || {};

    const { queue, service, price, contact = {}, summary } = payload;
    if (!queue || !summary) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Mangler 'queue' eller 'summary'" }));
    }

    // Altid logget, så forespørgslen kan findes igen i server-loggen.
    console.log("LEAD", JSON.stringify({ queue, service, price, name: contact.name, email: contact.email, phone: contact.phone }));

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.LEAD_TO_EMAIL;
    const from = process.env.LEAD_FROM_EMAIL;
    if (!apiKey || !to || !from) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ delivered: false, queue, reason: "EMAIL_NOT_CONFIGURED" }));
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: contact.email || undefined,
        subject: `[${queue}] ${service || "Forespørgsel"} — ${contact.name || "ukendt"}`,
        text: summary,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      console.error("Resend responded non-OK:", resp.status, detail);
      res.statusCode = 200;
      return res.end(JSON.stringify({ delivered: false, queue, reason: "EMAIL_SEND_FAILED" }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ delivered: true, queue }));
  } catch (err) {
    console.error("Unhandled error in api/lead:", err);
    res.statusCode = 200;
    return res.end(JSON.stringify({ delivered: false, reason: "SERVER_EXCEPTION" }));
  }
};
