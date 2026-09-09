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
| `check-schema.js` | Kontrollerer at svar-skemaet er gyldigt. Kør efter ændringer i skemaet. |
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
3. **Tegning** — en silhuet per karosseritype. De samme tegninger bruges som
   ikoner, når man vælger karosseri, så man ikke skal vide hvad en MPV er.

Tegningerne er bygget på ét fælles gitter i `CAR_SHAPES`: vejbanen ligger på
y=77 for alle, og hjulcentrum på y=77−r, så bilerne står på samme linje. Hver
bil er tegnet i sin rigtige indbyrdes størrelse — en mikrobil fylder mindre i
rammen end en pickup — så størrelsesrækkefølgen kan ses.

Det der adskiller typerne er tre tal: dørtærsklens højde (frihøjden), taghøjden
og vinduernes underkant. En stationcar er lav og lang med et stort
vinduesareal; en SUV er høj med store hjul og et dybt karosseri.

Hjulkassen centreres om **hjulet**, ikke om dørtærsklen. Gør man det modsatte,
bliver ringen tykkere foroven end i siderne, og buen ser ud som en bule.

## Karosserikategorier

Kategorierne følger **Bilbasens egne**, så filteret rammer det de faktisk
sorterer efter: Mikro, Hatchback, Coupe, Cabriolet, Sedan, Crossover (CUV),
Stationcar, SUV, Minibus (MPV), Pickup. DBA bruger de samme betegnelser, men
andre URL-koder (`body_type=4` er Stationcar hos dem), så koderne kan ikke
genbruges på tværs.

Listen står ét sted, i `BODY_TYPES` i `app.jsx`, og `check-schema.js`
kontrollerer at `body_type`-enum'et i API-skemaet er identisk. Ellers kan
modellen returnere en type som tegningerne ikke kender.

**Billedet kontrolleres.** Vi kan ikke se hvad der er på et foto, men vi kan
se hvilken artikel det kommer fra. Et foto godtages kun hvis artiklens titel
indeholder både mærket og modellen — ellers vises tegningen frem for et
billede af en anden bil. Findes der en artikel om netop varianten, foretrækkes
den, fordi en GTI ser markant anderledes ud end en almindelig Golf. Artiklens
navn står i hjørnet af billedet, så man selv kan se hvad man kigger på.

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

## Udstyrsvariant

Bilkortet fortæller hvilken udstyrslinje man skal lede efter, og hvorfor —
knyttet til brugerens egne svar. Man vælger ikke udstyr fra et katalog når man
køber brugt, så feltet er skrevet som en indkøbsseddel: hvad man skal insistere
på i annoncen, og hvad man ikke skal betale ekstra for. Ligger i `trim_advice`.

## To forslag ad gangen

Forslag 1 hentes først og vises med det samme. Alternativet hentes derefter og
skal være et andet mærke og enten anden karosseriform eller andet drivmiddel.

Et kald der bliver afvist prøves automatisk igen to gange med stigende
ventetid. Lykkes det stadig ikke — eller kommer den samme bil igen som et af
de andre kort — bliver pladsen stående med en forklaring og en
prøv-igen-knap. Et forslag må aldrig bare forsvinde uden besked.

Svaret fra Claude kommer som struktureret JSON efter et skema, så der ikke er
nogen tekst at parse og intet at gætte på.

**Skemaet må kun bruge en delmængde af JSON Schema.** `minItems`, `maxItems`,
`minimum`, `maximum` og `pattern` er almindeligt JSON Schema, men strukturerede
svar afviser dem med 400 — og så holder hele siden op med at vise bilforslag.
Antal og format skrives i `description` i stedet. Kør `node check-schema.js`
efter ændringer i skemaet; den fanger det.

## Ting der bør efterprøves med et klik

- **Brændstofkoderne.** `fuel=1` (benzin) og `fuel=2` (diesel) er bekræftet
  mod rigtige Bilbasen-URL'er. El, hybrid og plugin-hybrid er ikke. De står
  i `BB_FUEL`.
- **FDM-linket.** Søge-URL'en i `FDM_SEARCH` er ikke verificeret, fordi
  fdm.dk afviser automatiseret adgang.
- **Wikipedia-billederne.** Koden og begge fallback-veje er testet, men
  Wikipedias faktiske svar er ikke, af samme grund.
- **`cartypes`-værdierne til Bilbasen.** Kun værdier vi har belæg for står i
  `BB_BODY`. Mikro og Crossover (CUV) er udeladt, fordi deres filterværdi ikke
  er bekræftet — vælger man dem, udelades karosserifilteret fra den brede
  søgning i stedet for at sende et gæt. Kan værdierne bekræftes, tilføjes de.
