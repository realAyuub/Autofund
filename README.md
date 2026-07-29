# Autofund

Uafhængig bilrådgivning. Brugeren svarer på fem korte spørgsmål om hverdag,
familie og økonomi, og får to konkrete bilforslag med begrundelse, ejerøkonomi,
FDM-vurdering og færdige søgninger på Bilbasen.

## Filerne

| Fil | Hvad det er |
| --- | --- |
| `index.html` | HTML-skallen: fonte, farver, favicon. Rører sjældent. |
| `app.jsx` | **Kildekoden.** Al funktionalitet og design ligger her. |
| `app.js` | Den byggede fil, som browseren henter. Skal ikke redigeres i hånden. |
| `api/mistral.js` | Henter bilanbefalingen fra Mistral. |
| `api/lead.js` | Modtager forespørgsler fra "Vil du have et menneske med på råd?". |

## Sådan bygger du efter en ændring

Retter du i `app.jsx`, skal `app.js` bygges igen, ellers sker der ingenting på
siden. Kør denne ene kommando i mappen — der skal ikke installeres noget først:

```
npx esbuild app.jsx --bundle --minify --format=iife --target=es2018 \
  --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=app.js
```

React er bygget ind i `app.js`, så siden henter én fil i stedet for at hente
React og en JSX-oversætter og oversætte koden i browseren hver gang nogen
besøger siden. Det er forskellen på cirka 3 MB og cirka 65 KB.

## Indstillinger du kan rette uden at kunne kode

Alt det følgende står øverst i `app.jsx`. Husk at bygge bagefter.

| Navn | Betydning |
| --- | --- |
| `CONTACT_EMAIL` | Hvor kontaktformularer og forespørgsler sendes hen. |
| `COMPANY_NAME` | Navnet i toppen, i footeren og i e-mails. |
| `SERVICES` | Priserne. Bruges både på prissiden og i forespørgselsflowet. |
| `IMAGIN_CUSTOMER` | Kundenøgle til bilbilleder, se nedenfor. |
| `BB_FUEL`, `BB_BODY`, `SLUG_OVERRIDES` | Hvordan Bilbasen-links bygges. |

## Miljøvariabler

Sættes i Vercel under Settings → Environment Variables.

| Variabel | Krævet | Betydning |
| --- | --- | --- |
| `MISTRAL_API_KEY` | Ja | API-nøgle til Mistral. |
| `MISTRAL_MODEL` | Nej | Standard er `mistral-large-latest`. Sæt til `mistral-small-latest` for at spare. |
| `RESEND_API_KEY` | Nej | Sender forespørgsler som e-mail. |
| `LEAD_TO_EMAIL` | Nej | Modtageradressen. |
| `LEAD_FROM_EMAIL` | Nej | Afsender på et domæne verificeret hos Resend. |

Er de tre Resend-variabler ikke sat, åbner forespørgselsflowet i stedet
brugerens egen mailapp med det hele skrevet ind. Flowet virker altså også
uden dem.

## Bilbilleder

Bilkortene viser et billede med **samme vinkel, samme lys og samme baggrund**
for alle biler, så de to forslag kan sammenlignes. Billederne kommer fra
IMAGIN.studio, som kræver en kundenøgle til hvert kald — indsæt den i
`IMAGIN_CUSTOMER`.

Uden nøgle, og hvis et billede ikke kan hentes, vises en silhuet i stedet.
Der er tre former, så en stationcar ikke tegnes som en SUV.

## Ting der bør efterprøves med et klik

- **Brændstofkoderne til Bilbasen.** `fuel=2` (diesel) er bekræftet mod en
  rigtig Bilbasen-URL. Koderne for el, hybrid og plugin-hybrid er ikke, og
  står i `BB_FUEL`.
- **FDM-linket.** Søge-URL'en i `FDM_SEARCH` er ikke verificeret, fordi
  fdm.dk afviser automatiseret adgang.
