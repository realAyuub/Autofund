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
| `api/recommend.js` | Henter én bilanbefaling fra Claude. |
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
| `ANTHROPIC_API_KEY` | Ja | API-nøgle til Claude. |
| `CLAUDE_MODEL` | Nej | Standard er `claude-opus-5`. `claude-sonnet-5` er billigere. |
| `CLAUDE_EFFORT` | Nej | Standard `high`. `medium` eller `low` er hurtigere og billigere. |
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

Bilbasen er spærret fra byggemiljøet, så URL-formerne er udledt af rigtige
Bilbasen-sider som søgemaskiner har indekseret. Titlen på en Bilbasen-side
indeholder antallet af biler, og det viser hvilke former der giver resultater:

| Form | Belæg |
| --- | --- |
| Sti alene, `/brugt/bil/skoda/octavia` | Virker — "Skoda Octavia - 24 brugte til salg" |
| Sti med fritekst, `/brugt/bil/skoda/octavia/ps-vrs` | Virker — "vrs \| Skoda Octavia" |
| Flad form med filtre, `/brugt/bil?free=aut&fuel=1&priceto=75000` | Virker — "aut \| Benzin - 2071 brugte" |
| Sti **plus** parametre | Intet belæg |

Appen byggede tidligere den sidste form. Derfor:

- **Hovedknappen bruger kun stien.** Den kan ikke ramme nul på grund af et
  filter der er sat forkert, og modelnavn plus variant er nok til at lande på
  de rigtige biler.
- **Den snævre søgning bruger den flade form** og er foldet væk bag et link,
  fordi den kan give nul hvis prisskønnet er ved siden af.

Prisspændet er som standard ±15 %, fordi det ligger om et *estimat*.

## Fire forslag ad gangen

Forslag 1 hentes først og vises med det samme. De tre øvrige hentes derefter
parallelt, hver med sin vinkel (alternativ, prisfornuftigt, overraskende).

Et kald der bliver afvist prøves automatisk igen to gange med stigende
ventetid. Lykkes det stadig ikke — eller kommer den samme bil igen som et af
de andre kort — bliver pladsen stående med en forklaring og en
prøv-igen-knap. Et forslag må aldrig bare forsvinde uden besked.

Svaret fra Claude kommer som struktureret JSON efter et skema, så der ikke er
nogen tekst at parse og intet at gætte på.

## Ting der bør efterprøves med et klik

- **Brændstofkoderne.** `fuel=1` (benzin) og `fuel=2` (diesel) er bekræftet
  mod rigtige Bilbasen-URL'er. El, hybrid og plugin-hybrid er ikke. De står
  i `BB_FUEL`.
- **FDM-linket.** Søge-URL'en i `FDM_SEARCH` er ikke verificeret, fordi
  fdm.dk afviser automatiseret adgang.
- **Wikipedia-billederne.** Koden og begge fallback-veje er testet, men
  Wikipedias faktiske svar er ikke, af samme grund.
