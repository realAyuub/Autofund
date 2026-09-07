#!/usr/bin/env node
// Kontrollerer at CAR_SCHEMA i api/recommend.js kun bruger de dele af JSON
// Schema som Claudes strukturerede svar understøtter.
//
// Baggrund: skemaet indeholdt engang minItems, maximum og pattern. Det er
// almindeligt JSON Schema, men strukturerede svar afviser det med 400, og
// hele siden holdt op med at vise bilforslag. Kør denne efter ændringer i
// skemaet:  node check-schema.js
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "api/recommend.js"), "utf8");
const m = src.match(/const CAR_SCHEMA = (\{[\s\S]*?\n\};)/);
if (!m) { console.error("Fandt ikke CAR_SCHEMA i api/recommend.js"); process.exit(1); }
const schema = eval("(" + m[1].replace(/;$/, "") + ")");

const IKKE_UNDERSTOETTET = [
  "minItems","maxItems","uniqueItems",          // komplekse array-begrænsninger
  "minimum","maximum","exclusiveMinimum","exclusiveMaximum","multipleOf",
  "minLength","maxLength","pattern","patternProperties",
];

const fejl = [];
(function walk(node, sti) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${sti}[${i}]`));
  for (const k of Object.keys(node)) {
    if (IKKE_UNDERSTOETTET.includes(k)) fejl.push(`${sti}.${k}`);
    if (k === "type" && node[k] === "object" && node.additionalProperties !== false)
      fejl.push(`${sti}: additionalProperties skal være false`);
    if (k === "properties") {
      const mangler = Object.keys(node.properties).filter(p => !(node.required || []).includes(p));
      if (mangler.length) fejl.push(`${sti}: mangler i required → ${mangler.join(", ")}`);
    }
    walk(node[k], `${sti}.${k}`);
  }
})(schema, "schema");

// Karosserilisten i appen og enum'et i skemaet skal være ens, ellers kan
// modellen returnere en type som tegningerne ikke kender.
const appSrc = fs.readFileSync(path.join(__dirname, "app.jsx"), "utf8");
const m2 = appSrc.match(/const BODY_TYPES = \[([^\]]*)\]/);
if (m2) {
  const appTypes = JSON.parse("[" + m2[1] + "]");
  const enumTypes = schema.properties.body_type.enum || [];
  const kunApp = appTypes.filter(t => !enumTypes.includes(t));
  const kunApi = enumTypes.filter(t => !appTypes.includes(t));
  if (kunApp.length || kunApi.length) {
    fejl.push(`body_type er ude af trit med app.jsx — kun i appen: [${kunApp}] · kun i skemaet: [${kunApi}]`);
  }
}

console.log(`Felter: ${Object.keys(schema.properties).length} · required: ${schema.required.length} · karosserityper: ${(schema.properties.body_type.enum||[]).length}`);
if (fejl.length) {
  console.error("\nSkemaet vil give 400 fra API'et:");
  fejl.forEach(f => console.error("  ✗", f));
  process.exit(1);
}
console.log("✓ Skemaet bruger kun understøttede nøgleord");
