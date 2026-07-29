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

Billedet på bilkortet hentes i tre trin, og falder lydløst videre til næste
trin hvis et led ikke svarer:

1. **IMAGIN.studio** — studierenderinger hvor alle biler vises fra samme
   vinkel i samme lys. Kræver en kundenøgle i `IMAGIN_CUSTOMER`.
2. **Wikipedia** — hovedbilledet fra bilens artikel, fundet med Wikipedias
   søgning frem for et præcist titelopslag. Danske modelnavne rammer sjældent
   en artikeltitel: "BMW 1-serie" hedder "BMW 1 Series" på engelsk. AI'en
   leverer desuden et `wikipedia_title` som første gæt. Gratis, ingen nøgle.
3. **Tegning** — en silhuet i tre karosseriformer, så en stationcar ikke
   tegnes som en SUV.

## Bilbasen-søgninger

Søgningen bygges i den rækkefølge, der snævrer mest ind først:

1. **mærke og model** som sti — `/brugt/bil/vw/golf`
2. **årgang** — `yearfrom` / `yearto`
3. **prisklasse** — `pricefrom` / `priceto`
4. **brændstof og km** — `fuel` / `mileageto`
5. **fritekst til sidst** — `free`, kun til varianter som `vRS`

Sti og parametre virker sammen. Fritekst bruges bevidst ikke til mærke og
model — det er stiens opgave, og dobbeltbinding er den hurtigste vej til nul
resultater.

Prisspændet er som standard ±15 %, fordi det ligger om et *estimat*. Er
estimatet nogle procent ved siden af, og båndet smalt, giver søgningen nul
biler. Brugeren kan selv stramme til ±5 % på kortet.

## Ting der bør efterprøves med et klik

- **Brændstofkoderne.** `fuel=1` (benzin) og `fuel=2` (diesel) er bekræftet
  mod rigtige Bilbasen-URL'er. El, hybrid og plugin-hybrid er ikke. De står
  i `BB_FUEL`.
- **FDM-linket.** Søge-URL'en i `FDM_SEARCH` er ikke verificeret, fordi
  fdm.dk afviser automatiseret adgang.
- **Wikipedia-billederne.** Koden og begge fallback-veje er testet, men
  Wikipedias faktiske svar er ikke, af samme grund.
