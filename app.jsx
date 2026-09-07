import React, { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";

/* ═════════════════════════════════════════════════════════════
   KONFIGURATION — ret disse værdier ét sted
   ═════════════════════════════════════════════════════════════ */
const CONTACT_EMAIL = "Bilfinder@support.dk";   // modtager af kontakt + forespørgsler
const COMPANY_NAME  = "Autofund";
const BILBASEN_BASE = "https://www.bilbasen.dk/brugt/bil";
const FDM_SEARCH    = q => `https://www.fdm.dk/soeg?query=${encodeURIComponent(q)}`;

/* Bilbilleder. IMAGIN.studio leverer studierenderinger, hvor ALLE biler er
   vist fra samme vinkel, i samme lys og på samme baggrund — derfor ser de to
   forslag ens ud i stedet for "en forfra og en bagfra". De kræver en
   kundenøgle til hvert kald (opret på imaginstudio.com). Er feltet tomt,
   viser vi i stedet en ensartet silhuet — aldrig et skævt foto. */
const IMAGIN_CUSTOMER = "";      // ← indsæt din kundenøgle her
const CAR_IMAGE_ANGLE = "01";    // samme vinkel for alle biler. 01 = skrå forfra

/* ── Priser. Ændres her, så både prissiden og forespørgselsflowet følger med ── */
const SERVICES = [
  { id:"gratis", icon:"✉", title:"Spørg os om noget", price:"Gratis", priceNote:"", eta:"1–2 hverdage",
    desc:"Er du i tvivl om et af forslagene, eller er der noget du gerne vil vende? Skriv til os, så svarer et menneske." },
  { id:"annoncer", icon:"◎", title:"Vi finder annoncerne", price:"119 kr.", priceNote:"op til 2 bilannoncer", eta:"inden for 24 timer",
    desc:"Vi gennemgår markedet og sender dig op til to konkrete biler til salg, der passer til det du har søgt — med vores vurdering af hver enkelt.", tag:"Mest valgt" },
  { id:"samtale", icon:"☎", title:"Bilrådgivning på telefon", price:"149 kr.", priceNote:"30 minutters samtale", eta:"vi ringer inden for 2 hverdage",
    desc:"En halv time hvor vi taler tingene igennem i ro og mag. Du kan spørge om alt — også det du synes er indlysende." },
];

/* ── Mærker: hele det danske marked, søgbart ── */
const BRANDS = ["Abarth","Aiways","Alfa Romeo","Alpine","Aston Martin","Audi","Bentley","BMW","BYD","Cadillac","Chevrolet","Chrysler","Citroën","Cupra","Dacia","Daihatsu","Dodge","DS Automobiles","Ferrari","Fiat","Ford","Genesis","GWM","Honda","Hongqi","Hyundai","Isuzu","Jaecoo","Jaguar","Jeep","Kia","Lada","Lamborghini","Lancia","Land Rover","Leapmotor","Lexus","Lotus","Maserati","Maxus","Mazda","McLaren","Mercedes-Benz","MG","Mini","Mitsubishi","NIO","Nissan","Omoda","Opel","Peugeot","Polestar","Porsche","Renault","Rolls-Royce","Rover","Saab","Seat","Seres","Skoda","Skywell","Smart","SsangYong","Subaru","Suzuki","Tesla","Toyota","VinFast","Volkswagen","Volvo","Xpeng","Zeekr"];

const FUEL_TYPES = ["Benzin","Diesel","El","Hybrid","Plugin-hybrid"];
const REGIONS = ["Hele Danmark","Sjælland","Fyn","Jylland","København og omegn","Aarhus","Odense"];
const PRIORITY_GROUPS = [
  ["Økonomi",          ["Lavt brændstofforbrug","Lave serviceomkostninger","God gensalgsværdi","Lav forsikring"]],
  ["Tryghed",          ["Sikkerhed","Pålidelig motor","Firehjulstræk"]],
  ["Plads og komfort", ["Plads til familien","Stort bagagerum","Komfort"]],
  ["Køreoplevelse",    ["Sporty køreoplevelse","Høj motoreffekt"]],
  ["El og teknologi",  ["Ladetid","Teknologi & skærme"]],
];
const PRIORITIES = PRIORITY_GROUPS.flatMap(([,items])=>items);
const CHARACTERS = ["Familiebil","Praktisk & økonomisk","Komfort & luksus","Sporty / performance","Offroad / 4x4"];

const STEPS = [
  {id:"family", label:"Familie",    title:"Fortæl om familien",  sub:"Hvem skal bruge bilen til hverdag?"},
  {id:"economy",label:"Økonomi",    title:"Økonomi",             sub:"Hvad føles rigtigt at bruge?"},
  {id:"usage",  label:"Brug",       title:"Daglig brug",         sub:"Hvor langt kører I, og hvor?"},
  {id:"type",   label:"Biltype",    title:"Biltype og mærke",    sub:"Har I noget bestemt i tankerne?"},
  {id:"prefs",  label:"Ønsker",     title:"Hvad er vigtigst?",   sub:"Vælg det der betyder mest for jer."},
  {id:"results",label:"Forslag",    title:"Jeres forslag",       sub:""},
];

/* Bilbasen-koder, verificeret mod rigtige Bilbasen-URL'er:
   karosseri er navne (cartypes=MPV), brændstof er tal (fuel=2 = diesel). */
const BB_FUEL = {Benzin:"1",Diesel:"2",Hybrid:"3","Plugin-hybrid":"4",El:"5"};
/* Værdier til Bilbasens cartypes-filter. Kun værdier vi har belæg for.
   "Mikro" og "Crossover (CUV)" står bevidst IKKE her: vi kender ikke Bilbasens
   filterværdi for dem, og et gæt ville kunne give nul resultater. Vælger man
   dem, udelades karosserifilteret blot fra den brede søgning — resten af
   filtrene virker uændret, og hovedknappen bruger alligevel ikke cartypes. */
const BB_BODY = {"Hatchback":"Hatchback","Coupe":"Coupe","Cabriolet":"Cabriolet",
  "Sedan":"Sedan","Stationcar":"Stationcar","SUV":"SUV",
  "Minibus (MPV)":"MPV","Pickup":"Pickup"};
/* Bilbasen bruger korte navne i mærke-stien (/brugt/bil/vw, ikke /volkswagen)
   med bindestreg i mærker (/alfa-romeo/giulia) og underscore i modeller (/renault/megane_iv) */
const SLUG_OVERRIDES = {"Volkswagen":"vw","Mercedes-Benz":"mercedes","DS Automobiles":"ds","Land Rover":"land-rover","Alfa Romeo":"alfa-romeo","Aston Martin":"aston-martin","Rolls-Royce":"rolls-royce","VinFast":"vinfast","MG":"mg","BMW":"bmw","BYD":"byd","GWM":"gwm","NIO":"nio","DS":"ds"};

const slugify = (s, sep="_") => (s||"").toString().trim().toLowerCase()
  .replace(/æ/g,"ae").replace(/ø/g,"oe").replace(/å/g,"aa")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g,sep)
  .replace(sep==="_"?/^_+|_+$/g:/^-+|-+$/g,"");
const brandSlug = b => SLUG_OVERRIDES[b] || slugify(b,"-");

const fmtDKK = n => (n===null||n===undefined||isNaN(n)) ? "–" : new Intl.NumberFormat("da-DK").format(Math.round(n)) + " kr.";
const num = v => { const n = parseInt(String(v).replace(/\D/g,""),10); return isNaN(n)?null:n; };

/* ═════════════════════════════════════════════════════════════
   TEMA — varm, rolig palet. Lyst er standard, mørkt kan vælges.
   ═════════════════════════════════════════════════════════════ */
/* Paletten er hentet fra et brugtbilssted med cognacfarvet chesterfield,
   persiske tæpper og plastikstole i baggården: varm pergament, brændt orange,
   læderbrun og en støvet petroleumsgrøn. Hjemligt frem for storbyskarpt. */
const THEMES = {
  light: {
    id:"light",
    bg:"#f7f1e4", surface:"#fffdf7", panel:"#efe6d3", raised:"#fffdf7",
    border:"#e2d7c0", border2:"#cdbfa3",
    text:"#2b2018", muted:"#6b5b48", dim:"#95836c",
    accent:"#bd5522", accentSoft:"#f7e6d8", accentBorder:"#e0b591", onAccent:"#fffdf7",
    leather:"#8a5a33",
    good:"#4a6b4a", bad:"#a33c2e", info:"#4d6b70",
    shadow:"0 1px 2px rgba(66,48,30,.05), 0 10px 28px rgba(66,48,30,.06)",
    shadowLift:"0 2px 6px rgba(189,85,34,.10), 0 16px 44px rgba(189,85,34,.13)",
  },
  dark: {
    id:"dark",
    bg:"#1d1611", surface:"#271e17", panel:"#31261d", raised:"#3a2d22",
    border:"#3d3025", border2:"#54432f",
    text:"#f2e7d6", muted:"#b3a189", dim:"#8f7c64",
    accent:"#e07a42", accentSoft:"#3b291d", accentBorder:"#7a5330", onAccent:"#1d1611",
    leather:"#c08a55",
    good:"#8bb07f", bad:"#e08878", info:"#8fb0b5",
    shadow:"0 10px 32px rgba(0,0,0,.45)",
    shadowLift:"0 16px 48px rgba(224,122,66,.18)",
  },
};
const ThemeCtx = createContext(THEMES.light);
const useC = () => useContext(ThemeCtx);

const DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const SHELL = 1140;   // ydre bredde — giver plads til to bilkort ved siden af hinanden

/* ═════════════════════════════════════════════════════════════
   PROFIL TIL AI
   ═════════════════════════════════════════════════════════════ */
function buildProfile(f, rank, exclude, avoidCar) {
  const budget = f.budgetType==="kontant"
    ? `${fmtDKK(num(f.budget))} kontant (MAKS — foreslå ikke dyrere)`
    : `${fmtDKK(num(f.monthly))}/md (MAKS)`;
  const lines = [
    `Familie: ${f.adults} voksne, ${f.children} børn${f.childAges?` (aldre: ${f.childAges})`:""}`,
    `Region: ${f.region||"hele Danmark"}`,
    `Budget: ${budget}`,
    `Daglig km: ${f.dailyKm||"ukendt"} — kørsel: ${f.driveType||"blandet"}`,
    `Drivmiddel: ${(f.fuels||[]).join(", ")||"ingen præference"}`,
    `Karosseri: ${(f.bodies||[]).join(", ")||"ingen præference"}`,
    `Bilens karakter: ${f.character||"ingen præference"}`,
    `Foretrukne mærker: ${(f.brands||[]).join(", ")||"ingen præference"}`,
    `Uønskede mærker: ${[...(f.excludeBrands||[])].join(", ")||"ingen"}`,
    `Årgang fra: ${f.yearMin||"ingen krav"} — maks km: ${f.kmMax||"ingen krav"}`,
    `Ønsket minimum effekt: ${f.minHp?f.minHp+" hk":"ingen krav"}`,
    `Ønsket udstyrs-/motorvariant: ${f.variantWish||"ingen"}`,
    `Gearkasse: ${f.transmission||"ligemeget"} — anhængertræk: ${f.towbar||"ikke oplyst"}`,
    `Prioriteter: ${(f.priorities||[]).join(", ")||"ingen"}`,
  ];
  const hard = [];
  if ((f.brands||[]).length) hard.push(`Bilen SKAL være af et af disse mærker: ${f.brands.join(" eller ")}.`);
  if (f.variantWish) hard.push(`Brugeren har eksplicit bedt om varianten "${f.variantWish}" — anbefal en model der findes i netop den variant, og skriv den præcise variantbetegnelse i "variant" og "bilbasen_search_term".`);
  if (f.minHp) hard.push(`Motoren SKAL yde mindst ${f.minHp} hk.`);
  if (f.character==="Sporty / performance") hard.push(`Brugeren vil have en SPORTSLIG bil (f.eks. vRS, RS, GTI, ST, N, AMG, M-pakke, Cupra) — ikke en almindelig familiebil.`);
  if ((f.fuels||[]).length) hard.push(`Drivmiddel skal være: ${f.fuels.join(" eller ")}.`);
  if ((f.bodies||[]).length) hard.push(`Karosseri skal være: ${f.bodies.join(" eller ")}.`);
  if ((f.excludeBrands||[]).length) hard.push(`Må ALDRIG være: ${f.excludeBrands.join(", ")}.`);

  // Hvert forslag får sin egen vinkel, så de fire bud ikke ender som variationer
  // over samme bil. Vinklerne er formuleret som krav, ikke som ønsker.
  const ANGLES = {
    2: 'Dette er FORSLAG 2. Vælg et ANDET MÆRKE end forslag 1, og enten en anden karosseriform eller et andet drivmiddel.',
  };
  const rankTxt = rank===1
    ? `Dette er FORSLAG 1 — det bedste samlede match.`
    : `${ANGLES[rank]||`Dette er FORSLAG ${rank}, og det skal være markant anderledes end de foregående.`} Forklar i "differs_from_primary" med én sætning hvad der konkret adskiller den fra ${avoidCar||"de øvrige forslag"}.`;

  return [
    lines.join("\n"),
    hard.length ? `\nHÅRDE KRAV (må ikke brydes):\n- ${hard.join("\n- ")}` : "",
    `\n${rankTxt}`,
    `Foreslå ALDRIG disse biler: ${(exclude||[]).join("; ")||"ingen"}`,
  ].join("\n");
}

/* ═════════════════════════════════════════════════════════════
   BILBASEN-LINKS
   ═════════════════════════════════════════════════════════════ */
function priceBand(car, form, pct) {
  const p = num(car.price_used_dkk);
  if (!p) return [null,null];
  let lo = Math.round(p*(1-pct/100));
  let hi = Math.round(p*(1+pct/100));
  const budget = num(form.budget);
  if (budget) hi = Math.min(hi, budget);            // aldrig over brugerens budget
  lo = Math.max(0, Math.min(lo, hi));
  return [Math.round(lo/1000)*1000, Math.round(hi/1000)*1000];
}
function yearBand(car, form) {
  const r = String(car.year_range||"");
  const m = r.match(/(\d{4})\D+(\d{4})/);
  let from = num(car.year_from) || (m?parseInt(m[1],10):num(r.slice(0,4)));
  let to   = num(car.year_to)   || (m?parseInt(m[2],10):null);
  const userMin = num(form.yearMin);
  if (userMin) from = Math.max(from||userMin, userMin);
  return [from, to];
}
/* HVAD VI VED OM BILBASENS URL'ER
   Deres domæne er spærret fra byggemiljøet, så alt herunder er udledt af
   rigtige Bilbasen-sider som søgemaskiner har indekseret. Titlen på en
   Bilbasen-side indeholder antallet af biler, og det er derfor muligt at se
   hvilke former der giver resultater:

     Sti alene — VIRKER, med tal i titlen:
       /brugt/bil/skoda/octavia        "Skoda Octavia - 24 brugte til salg"
       /brugt/bil/vw/ps-golf           "golf | VW - 613 brugte til salg"
       /brugt/bil/skoda/octavia/ps-vrs "vrs | Skoda Octavia - se brugte til salg"

     Flad form med parametre — VIRKER, med tal i titlen:
       /brugt/bil?free=aut&fuel=1&priceto=75000   "aut | Benzin - 2071 brugte"

     Sti PLUS parametre — INTET belæg for at det virker.
   Det sidste var præcis det appen byggede, og det er den mest sandsynlige
   grund til at søgningerne ikke gav biler. Vi bruger derfor kun de to former
   vi har set virke: stien til hovedknappen, den flade form til den snævre. */

/* Fritekst i sti-form: små bogstaver med underscore, som Bilbasen selv gør
   (ps-skoda_octavia_rs, ps-vrs, ps-vw_golf_benzin). */
// Punktummer fjernes frem for at blive til skilletegn: "R.S. Trophy" skal
// blive til rs_trophy, ikke r_s_trophy.
const psTerm = t => slugify(String(t).replace(/\./g, ""), "_");

/* Mærke og model som sti. Er modelnavnet flere ord, er sti-formen usikker,
   og så nøjes vi med mærket og lader modellen gå i fritekst. */
function modelPath(car) {
  const bs = car.bilbasen_brand_slug || brandSlug(car.brand);
  const raw = car.bilbasen_model_slug || slugify(car.model);
  const oneWord = raw && !raw.includes("_");
  return { path: oneWord ? `${bs}/${raw}` : bs, modelInPath: !!oneWord };
}
/* Brugerens variantønske må kun bruges hvis bilen faktisk fås i den variant —
   ellers ender et "vRS"-ønske som fritekst på en Tesla og giver nul resultater. */
function variantTerm(form, car) {
  const wish = form.variantWish && String(car.variant||"").toLowerCase().includes(form.variantWish.toLowerCase())
    ? form.variantWish : "";
  return car.bilbasen_search_term || wish || "";
}

/* HOVEDKNAPPEN — kun sti, ingen parametre. Denne form er set give rigtige
   biler, og den kan ikke ramme nul på grund af et filter der er sat forkert.
   Variant og flerordsmodel hænges på som ps-fritekst, hvilket også er set virke. */
function buildBilbasenModelUrl(form, car) {
  const { path, modelInPath } = modelPath(car);
  const extra = [modelInPath ? "" : car.model, variantTerm(form, car)]
    .filter(Boolean).join(" ").trim();
  return extra ? `${BILBASEN_BASE}/${path}/ps-${psTerm(extra)}` : `${BILBASEN_BASE}/${path}`;
}

/* DEN SNÆVRE SØGNING — flad form med filtre, som vi har set give resultater.
   Årgang og prisklasse med, så man kan komme tættere på, hvis modelsiden
   giver for mange biler. */
function buildBilbasenFilteredUrl(form, car, pct=15) {
  const p = new URLSearchParams();
  p.set("free", [car.brand, car.model, variantTerm(form, car)].filter(Boolean).join(" ").trim());
  const [yf,yt] = yearBand(car, form);
  if (yf) p.set("yearfrom", yf);
  if (yt) p.set("yearto", yt);
  const [lo,hi] = priceBand(car, form, pct);
  if (lo) p.set("pricefrom", lo);
  if (hi) p.set("priceto", hi);
  if (num(form.kmMax)) p.set("mileageto", num(form.kmMax));
  const fuels = (form.fuels||[]).length ? form.fuels : (car.fuel_type?[car.fuel_type]:[]);
  fuels.forEach(f=>{ if(BB_FUEL[f]) p.append("fuel", BB_FUEL[f]); });
  p.set("includeleasing", "false");
  return `${BILBASEN_BASE}?${p.toString()}`;
}

/* Bredere: samme klasse og budget, uden at binde sig til modellen */
function buildBilbasenBroadUrl(form, car) {
  const p = new URLSearchParams();
  const budget = num(form.budget) || (num(car&&car.price_used_dkk) ? Math.round(num(car.price_used_dkk)*1.15) : null);
  if (budget) p.set("priceto", budget);
  const [yf] = yearBand(car||{}, form);
  if (yf) p.set("yearfrom", yf);
  if (num(form.kmMax)) p.set("mileageto", num(form.kmMax));
  const fuels = (form.fuels||[]).length ? form.fuels : (car&&car.fuel_type?[car.fuel_type]:[]);
  fuels.forEach(f=>{ if(BB_FUEL[f]) p.append("fuel", BB_FUEL[f]); });
  const bodies = (form.bodies||[]).length ? form.bodies : (car&&car.body_type?[car.body_type]:[]);
  bodies.forEach(b=>{ if(BB_BODY[b]) p.append("cartypes", BB_BODY[b]); });
  p.set("includeleasing", "false");
  return `${BILBASEN_BASE}?${p.toString()}`;
}

const sleep = ms => new Promise(r=>setTimeout(r,ms));

/* Serveren svarer med struktureret JSON, så der er ikke længere noget at
   parse ud af en tekststreng. Til gengæld kan et kald blive afvist midlertidigt
   — for mange kald på én gang eller et hikke hos modellen — og det er værd at
   prøve igen, før vi giver op og efterlader et tomt felt på skærmen. */
async function fetchOneCar(profile, tries=3) {
  let lastErr;
  for (let attempt=0; attempt<tries; attempt++) {
    if (attempt) await sleep(700 * Math.pow(2, attempt-1));   // 700 ms, 1,4 s
    try {
      const res = await fetch("/api/recommend", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) {
        // Serveren forklarer hvad der gik galt — den forklaring skal helt op
        // på skærmen, så en manglende API-nøgle ikke ligner et tilfældigt hikke.
        let hint = "";
        try { hint = (await res.json()).hint || ""; } catch (e) {}
        const err = new Error(hint || ("Serverfejl " + res.status));
        err.hint = hint;
        err.permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
        lastErr = err;
        if (err.permanent) break;                 // nytter ikke at gentage
        continue;                                  // 429 og 5xx: prøv igen
      }
      const data = await res.json();
      if (!data.car || !data.car.brand) throw new Error("Ufuldstændigt svar fra serveren");
      return data.car;
    } catch (e) {
      lastErr = e;
      if (e.permanent) break;
    }
  }
  throw lastErr || new Error("Ukendt fejl");
}
const carKey = c => c ? `${(c.brand||"").toLowerCase()} ${(c.model||"").toLowerCase()}`.trim() : "";

/* ═════════════════════════════════════════════════════════════
   UI-BYGGEKLODSER
   ═════════════════════════════════════════════════════════════ */
function Chip({label,active,onClick}) {
  const C = useC();
  return <button onClick={onClick} aria-pressed={active} style={{
    padding:"11px 19px", minHeight:46, borderRadius:999,
    border:`1.5px solid ${active?C.accent:C.border2}`,
    background:active?C.accentSoft:C.surface, color:active?C.accent:C.text,
    fontSize:15.5, cursor:"pointer", fontWeight:active?600:450, whiteSpace:"nowrap",
    transition:"background .15s, border-color .15s"}}>{label}</button>;
}
function MultiChips({options,value=[],onChange}) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:9}}>{options.map(o=>
    <Chip key={o} label={o} active={value.includes(o)} onClick={()=>onChange(value.includes(o)?value.filter(v=>v!==o):[...value,o])}/>)}</div>;
}
function SingleChips({options,value,onChange}) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:9}}>{options.map(o=>
    <Chip key={o} label={o} active={value===o} onClick={()=>onChange(value===o?"":o)}/>)}</div>;
}

/* Søgbar multi-dropdown: skriv for at finde, eller vælg på listen */
function SearchableMultiSelect({value=[],onChange,options,placeholder,allowCustom=true}) {
  const C = useC();
  const [open,setOpen] = useState(false);
  const [q,setQ] = useState("");
  const ref = useRef(null), inputRef = useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setQ("");}};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  useEffect(()=>{ if(open&&inputRef.current) inputRef.current.focus(); },[open]);
  const norm = s => s.toLowerCase().replace(/ø/g,"o").replace(/æ/g,"ae").replace(/å/g,"a").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const matches = useMemo(()=>{ const n=norm(q.trim()); return n ? options.filter(o=>norm(o).includes(n)) : options; },[q,options]);
  const exact = options.some(o=>norm(o)===norm(q.trim()));
  const toggle = o => onChange(value.includes(o)?value.filter(v=>v!==o):[...value,o]);
  const addCustom = () => { const t=q.trim(); if(t&&!value.includes(t)){onChange([...value,t]);} setQ(""); };

  return <div ref={ref} style={{position:"relative"}}>
    {value.length>0 && <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:9}}>
      {value.map(v=><span key={v} style={{display:"inline-flex",alignItems:"center",gap:7,background:C.accentSoft,border:`1px solid ${C.accentBorder}`,color:C.accent,borderRadius:999,padding:"6px 8px 6px 15px",fontSize:14.5,fontWeight:600}}>
        {v}<button onClick={()=>toggle(v)} aria-label={`Fjern ${v}`} style={{border:"none",background:"transparent",color:C.accent,cursor:"pointer",fontSize:17,lineHeight:1,padding:"0 4px"}}>×</button>
      </span>)}
    </div>}
    <div onClick={()=>setOpen(true)} style={{display:"flex",alignItems:"center",gap:9,background:C.surface,border:`1.5px solid ${open?C.accent:C.border2}`,borderRadius:12,padding:"4px 14px",minHeight:54,cursor:"text"}}>
      <span aria-hidden="true" style={{color:C.dim,fontSize:15}}>⌕</span>
      <input ref={inputRef} type="text" value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}}
        onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); if(matches.length===1) toggle(matches[0]); else if(allowCustom&&!exact&&!matches.length) addCustom(); } if(e.key==="Escape") setOpen(false); }}
        placeholder={placeholder} aria-label={placeholder}
        style={{flex:1,border:"none",outline:"none",background:"transparent",color:C.text,fontSize:16,padding:"13px 0",fontFamily:"inherit"}}/>
      <span style={{color:C.dim,fontSize:12}}>{open?"▲":"▼"}</span>
    </div>
    {open && <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:300,background:C.surface,border:`1px solid ${C.border2}`,borderRadius:12,boxShadow:C.shadow,maxHeight:300,overflowY:"auto"}}>
      {matches.length===0 && !allowCustom && <div style={{padding:"15px 17px",color:C.muted,fontSize:15}}>Ingen match</div>}
      {/* Kun tilbyd fritekst når intet mærke matcher — ellers forvirrer det valget */}
      {allowCustom && q.trim() && !exact && matches.length===0 && <div onClick={addCustom} style={{padding:"14px 17px",color:C.accent,fontSize:15,fontWeight:700,cursor:"pointer"}}>+ Tilføj “{q.trim()}” alligevel</div>}
      {matches.map(o=><div key={o} onClick={()=>toggle(o)} role="option" aria-selected={value.includes(o)}
        style={{padding:"12px 17px",color:value.includes(o)?C.accent:C.text,fontSize:16,cursor:"pointer",background:value.includes(o)?C.accentSoft:"transparent",display:"flex",alignItems:"center",gap:12}}
        onMouseEnter={e=>{if(!value.includes(o))e.currentTarget.style.background=C.panel}}
        onMouseLeave={e=>{if(!value.includes(o))e.currentTarget.style.background="transparent"}}>
        <span style={{width:20,height:20,borderRadius:6,border:`1.5px solid ${value.includes(o)?C.accent:C.border2}`,background:value.includes(o)?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:C.onAccent,flexShrink:0}}>{value.includes(o)?"✓":""}</span>
        {o}
      </div>)}
    </div>}
  </div>;
}

function SingleDropdown({value,onChange,options,placeholder}) {
  const C = useC();
  const [open,setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  return <div ref={ref} style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{width:"100%",minHeight:54,background:C.surface,border:`1.5px solid ${open?C.accent:C.border2}`,borderRadius:12,padding:"13px 17px",color:value?C.text:C.dim,fontSize:16,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"inherit"}}>
      <span>{value||placeholder}</span><span style={{color:C.dim,fontSize:12}}>▼</span>
    </button>
    {open && <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:300,background:C.surface,border:`1px solid ${C.border2}`,borderRadius:12,boxShadow:C.shadow,maxHeight:280,overflowY:"auto"}}>
      <div onClick={()=>{onChange("");setOpen(false);}} style={{padding:"12px 17px",color:C.muted,fontSize:16,cursor:"pointer"}}>Ingen præference</div>
      {options.map(o=><div key={o} onClick={()=>{onChange(o);setOpen(false);}}
        style={{padding:"12px 17px",color:value===o?C.accent:C.text,fontSize:16,cursor:"pointer",background:value===o?C.accentSoft:"transparent"}}
        onMouseEnter={e=>{if(value!==o)e.currentTarget.style.background=C.panel}}
        onMouseLeave={e=>{if(value!==o)e.currentTarget.style.background="transparent"}}>{o}</div>)}
    </div>}
  </div>;
}

function NumInput({value,onChange,placeholder,suffix,label}) {
  const C = useC();
  return <div style={{position:"relative"}}>
    <input type="number" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={label||placeholder}
      style={{width:"100%",minHeight:54,background:C.surface,border:`1.5px solid ${C.border2}`,borderRadius:12,padding:`13px ${suffix?"80px":"17px"} 13px 17px`,color:C.text,fontSize:16,outline:"none",fontFamily:"inherit"}}
      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border2}/>
    {suffix && <span style={{position:"absolute",right:15,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:14,pointerEvents:"none"}}>{suffix}</span>}
  </div>;
}
function TxtInput({value,onChange,placeholder,label,type="text"}) {
  const C = useC();
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={label||placeholder}
    style={{width:"100%",minHeight:54,background:C.surface,border:`1.5px solid ${C.border2}`,borderRadius:12,padding:"13px 17px",color:C.text,fontSize:16,outline:"none",fontFamily:"inherit"}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border2}/>;
}
function TextArea({value,onChange,placeholder,rows=4}) {
  const C = useC();
  return <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder}
    style={{width:"100%",background:C.surface,border:`1.5px solid ${C.border2}`,borderRadius:12,padding:"13px 17px",color:C.text,fontSize:16,outline:"none",resize:"vertical",fontFamily:"inherit",lineHeight:1.6}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border2}/>;
}
function Field({label,hint,children,help,required}) {
  const C = useC();
  return <div style={{marginBottom:22}}>
    <div style={{marginBottom:9,display:"flex",alignItems:"baseline",gap:9,flexWrap:"wrap"}}>
      <span style={{color:C.text,fontSize:16.5,fontWeight:600}}>{label}</span>
      {required
        ? <span style={{color:C.accent,fontSize:12.5,fontWeight:700,letterSpacing:".04em"}}>SKAL UDFYLDES</span>
        : <span style={{color:C.dim,fontSize:13.5}}>valgfrit</span>}
      {hint && <span style={{color:C.muted,fontSize:14.5}}>{hint}</span>}
    </div>
    {help && <p style={{color:C.muted,fontSize:15,marginBottom:12,lineHeight:1.6,maxWidth:"62ch"}}>{help}</p>}
    {children}
  </div>;
}
function Btn({children,onClick,kind="primary",size="md",full,disabled,as,href,style:extra,...rest}) {
  const C = useC();
  const pads = {sm:"10px 18px", md:"14px 28px", lg:"17px 34px"};
  const fs = {sm:14.5, md:16, lg:17.5};
  const base = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:10,minHeight:size==="sm"?44:54,
    padding:pads[size],borderRadius:999,fontSize:fs[size],fontWeight:600,cursor:disabled?"default":"pointer",
    border:"1.5px solid transparent",width:full?"100%":"auto",textAlign:"center",fontFamily:"inherit",
    transition:"transform .12s, box-shadow .15s, background .15s"};
  const kinds = {
    primary:{background:disabled?C.border:C.accent,color:disabled?C.dim:C.onAccent,boxShadow:disabled?"none":C.shadow},
    ghost:{background:C.surface,color:C.text,borderColor:C.border2},
    quiet:{background:"transparent",color:C.muted,borderColor:"transparent"},
  };
  const style = {...base,...kinds[kind],...extra};
  if (as==="a") return <a href={href} style={style} {...rest}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} style={style} {...rest}>{children}</button>;
}
function H({children,size=1,style:extra}) {
  const C = useC();
  const sizes = {1:"clamp(34px, 6vw, 52px)", 2:"clamp(26px, 4vw, 34px)", 3:"clamp(20px, 3vw, 24px)"};
  const Tag = size===1?"h1":size===2?"h2":"h3";
  return <Tag style={{fontFamily:DISPLAY,fontSize:sizes[size],fontWeight:size===1?500:550,color:C.text,
    lineHeight:size===1?1.08:1.2,letterSpacing:"-0.015em",...extra}}>{children}</Tag>;
}
/* Bort med rudemotiv, lånt fra kanten af et persisk tæppe. Den fylder den
   vandrette luft mellem sektionerne ud, uden at støje. */
function Ornament({tight}) {
  const C = useC();
  const id = useRef("orn"+Math.random().toString(36).slice(2,7)).current;
  return <div aria-hidden="true" style={{display:"flex",alignItems:"center",gap:16,
    margin:tight?"clamp(28px,5vw,44px) 0":"clamp(48px,8vw,84px) 0"}}>
    <span style={{flex:1,height:1,background:C.border}}/>
    <svg width="86" height="14" viewBox="0 0 86 14" style={{flexShrink:0,opacity:.75}}>
      <defs><g id={id}><path d="M7 1 L13 7 L7 13 L1 7 Z" fill="none" stroke={C.accent} strokeWidth="1.1"/></g></defs>
      <use href={`#${id}`} x="0"/><use href={`#${id}`} x="18"/>
      <circle cx="43" cy="7" r="3" fill={C.accent}/>
      <use href={`#${id}`} x="54"/><use href={`#${id}`} x="72"/>
    </svg>
    <span style={{flex:1,height:1,background:C.border}}/>
  </div>;
}
function Rule() { return <Ornament/>; }

/* Smal, centreret spalte. Før stod teksten i venstre side med et stort
   tomrum til højre — nu fordeles luften ligeligt om indholdet. */
function Column({width="66ch",children,style}) {
  return <div style={{maxWidth:width,marginLeft:"auto",marginRight:"auto",width:"100%",...style}}>{children}</div>;
}

/* ═════════════════════════════════════════════════════════════
   STEP-BJÆLKE — altid synlig, centreret, klikbar tilbage
   ═════════════════════════════════════════════════════════════ */
function Stepper({step,maxReached,onGo}) {
  const C = useC();
  return <nav aria-label="Trin i søgningen" style={{position:"sticky",top:0,zIndex:120,background:C.surface,borderBottom:`1px solid ${C.border}`}}>
    <div style={{maxWidth:SHELL,margin:"0 auto",padding:"14px 14px 12px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
        {STEPS.map((s,i)=>{
          const done = i<step, current = i===step, clickable = i<=maxReached && i!==step;
          return <div key={s.id} style={{display:"flex",alignItems:"flex-start",flex:i<STEPS.length-1?1:"none",minWidth:0}}>
            <button onClick={()=>clickable&&onGo(i)} disabled={!clickable} aria-current={current?"step":undefined}
              title={clickable?`Gå tilbage til “${s.label}”`:s.label}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,background:"transparent",border:"none",
                cursor:clickable?"pointer":"default",padding:"2px 4px",minWidth:56,fontFamily:"inherit"}}>
              <span style={{width:40,height:40,borderRadius:"50%",flexShrink:0,
                background:done?C.accent:current?C.accentSoft:"transparent",
                border:`1.5px solid ${done||current?C.accent:C.border2}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:15,fontWeight:600,color:done?C.onAccent:current?C.accent:C.dim,
                boxShadow:current?`0 0 0 5px ${C.accentSoft}`:"none"}}>{done?"✓":i+1}</span>
              <span style={{fontSize:13,fontWeight:current?700:500,color:current?C.accent:done?C.muted:C.dim,whiteSpace:"nowrap"}}>{s.label}</span>
            </button>
            {i<STEPS.length-1 && <div aria-hidden="true" style={{flex:1,height:1.5,borderRadius:2,margin:"20px 5px 0",background:done?C.accent:C.border,minWidth:8}}/>}
          </div>;
        })}
      </div>
      {step>0 && <div style={{textAlign:"center",marginTop:8}}>
        <button onClick={()=>onGo(step-1)} style={{background:"transparent",border:"none",color:C.accent,fontSize:15,fontWeight:600,cursor:"pointer",padding:"6px 12px",minHeight:40,fontFamily:"inherit"}}>
          ← Tilbage til “{STEPS[step-1].label}”
        </button>
      </div>}
    </div>
  </nav>;
}

/* ═════════════════════════════════════════════════════════════
   BILBILLEDE OG FARVER
   ═════════════════════════════════════════════════════════════ */
function carImageUrl(car) {
  if (!IMAGIN_CUSTOMER) return null;
  const p = new URLSearchParams({
    customer: IMAGIN_CUSTOMER,
    make: car.imagin_make || slugify(car.brand,"-"),
    modelFamily: car.imagin_model_family || slugify(car.model,"-"),
    angle: CAR_IMAGE_ANGLE, fileType: "png", width: "640",
  });
  const yf = num(car.year_from) || num(String(car.year_range||"").slice(0,4));
  if (yf) p.set("modelYear", yf);
  return `https://cdn.imagin.studio/getimage?${p.toString()}`;
}
/* Én silhuet per karosseritype, tegnet på ét fælles gitter så bilerne kan
   sammenlignes: vejbane y=77 for alle, hjulcentrum y=77-r, så hjulene rører
   vejen. Hver bil er tegnet i sin RIGTIGE indbyrdes størrelse — en mikrobil
   fylder mindre i rammen end en pickup — så størrelsesrækkefølgen kan ses.
   Det der adskiller typerne er tre tal: dørtærsklens højde (frihøjde),
   taghøjden, og vinduernes underkant. En stationcar er lav og lang med et
   stort vinduesareal; en SUV er høj med store hjul og et dybt karosseri. */
const GROUND = 77;
const ARCH_GAP = 3;
/* Hjulkassen centreres om HJULET, ikke om dørtærsklen. Ellers bliver ringen
   tykkere foroven end i siderne, og buen ser ud som en bule. */
const archDx = (r, sill) => {
  const a = r + ARCH_GAP, dy = sill - (GROUND - r);
  return Math.sqrt(Math.max(a*a - dy*dy, 1));
};
const wheelArches = (fw,rw,r,sill,x0) => {
  const a = r + ARCH_GAP, dx = archDx(r, sill);
  return `L${(rw+dx).toFixed(1)},${sill} A${a},${a} 0 0 0 ${(rw-dx).toFixed(1)},${sill}`
       + ` L${(fw+dx).toFixed(1)},${sill} A${a},${a} 0 0 0 ${(fw-dx).toFixed(1)},${sill} L${x0},${sill} Z`;
};

/* Rækkefølge efter størrelse. Navnene følger Bilbasens egne kategorier. */
const BODY_TYPES = ["Mikro", "Hatchback", "Coupe", "Cabriolet", "Sedan", "Crossover (CUV)", "Stationcar", "SUV", "Minibus (MPV)", "Pickup"];

const CAR_SHAPES = {
  "Mikro":{fw:70,rw:132,r:12,sill:63,
    body:`M48,63 L48,52 Q48,48 53,47 L62,45 L74,30 Q77,28 82,28 L118,28 Q123,28 126,31 L136,45 Q142,47 145,51 L146,56 L146,63 L146.9,63 A15,15 0 0 0 117.1,63 L84.9,63 A15,15 0 0 0 55.1,63 L48,63 Z`,
    glass:"M68,43 L78,31 L96,31 L96,43 Z M102,31 L116,31 Q119,31 121,33 L128,43 L102,43 Z",
    trim:"M56,55 L142,56"},
  "Hatchback":{fw:56,rw:146,r:14,sill:62,
    body:`M26,62 L26,50 Q26,46 31,45 L48,42 L78,41 L92,26 Q95,24 100,24 L134,24 Q139,24 142,27 L158,43 Q164,45 166,49 L167,54 L167,62 L163.0,62 A17,17 0 0 0 129.0,62 L73.0,62 A17,17 0 0 0 39.0,62 L26,62 Z`,
    glass:"M82,39 L95,27 L112,27 L112,39 Z M118,27 L132,27 Q135,27 137,29 L146,39 L118,39 Z",
    trim:"M34,54 L162,55"},
  "Coupe":{fw:52,rw:152,r:14,sill:62,
    body:`M14,62 L14,52 Q14,48 19,47 L44,44 L80,43 L98,29 Q103,27 110,27 L126,27 Q132,27 136,30 L160,43 L180,46 Q186,47 186,52 L186,62 L169.0,62 A17,17 0 0 0 135.0,62 L69.0,62 A17,17 0 0 0 35.0,62 L14,62 Z`,
    glass:"M88,41 L101,30 Q103,29 107,29 L123,29 Q128,29 131,32 L142,41 Z",
    trim:"M22,55 L180,56"},
  "Cabriolet":{fw:52,rw:152,r:14,sill:62,
    body:`M14,62 L14,52 Q14,48 19,47 L44,44 L80,43 L90,31 Q92,29 96,29 L103,29 Q106,30 106,34 L106,46 L142,46 Q156,43 168,46 L180,50 Q186,52 186,56 L186,62 L169.0,62 A17,17 0 0 0 135.0,62 L69.0,62 A17,17 0 0 0 35.0,62 L14,62 Z`,
    glass:"M92,42 L97,32 Q98,31 100,31 L102,31 L102,42 Z",
    cabin:"M106,46 L106,40 L142,40 L142,46 Z",
    trim:"M22,56 L180,57"},
  "Sedan":{fw:50,rw:154,r:14,sill:62,
    body:`M8,62 L8,50 Q8,46 13,45 L36,42 L72,41 L90,26 Q93,24 98,24 L132,24 Q137,24 140,27 L152,41 L188,43 Q193,44 193,49 L193,62 L171.0,62 A17,17 0 0 0 137.0,62 L67.0,62 A17,17 0 0 0 33.0,62 L8,62 Z`,
    glass:"M78,39 L94,27 L111,27 L111,39 Z M117,27 L131,27 Q134,27 136,29 L143,39 L117,39 Z",
    trim:"M18,54 L186,55"},
  "Crossover (CUV)":{fw:56,rw:146,r:16,sill:57,
    body:`M28,57 L28,44 Q28,40 33,39 L50,36 L80,35 L94,20 Q97,18 102,18 L134,18 Q139,18 142,21 L156,37 Q162,39 164,43 L165,48 L165,57 L164.6,57 A19,19 0 0 0 127.4,57 L74.6,57 A19,19 0 0 0 37.4,57 L28,57 Z`,
    glass:"M84,33 L97,21 L113,21 L113,33 Z M119,21 L132,21 Q135,21 137,23 L145,33 L119,33 Z",
    trim:"M36,49 L160,50"},
  "Stationcar":{fw:48,rw:158,r:13,sill:63,
    body:`M6,63 L6,52 Q6,48 11,47 L34,44 L70,43 L86,25 Q89,23 94,23 L172,23 Q177,23 180,26 L188,43 L192,45 Q195,46 195,50 L195,63 L174.0,63 A16,16 0 0 0 142.0,63 L64.0,63 A16,16 0 0 0 32.0,63 L6,63 Z`,
    glass:"M76,41 L92,26 L110,26 L110,41 Z M116,26 L138,26 L138,41 L116,41 Z M144,26 L170,26 Q174,26 176,28 L184,41 L144,41 Z",
    trim:"M16,55 L188,56"},
  "SUV":{fw:54,rw:150,r:19,sill:56,
    body:`M14,56 L14,36 Q14,32 19,31 L36,28 L74,27 L88,10 Q91,8 96,8 L156,8 Q162,8 165,11 L174,27 L184,29 Q189,30 189,35 L189,56 L171.9,56 A22,22 0 0 0 128.1,56 L75.9,56 A22,22 0 0 0 32.1,56 L14,56 Z`,
    glass:"M80,25 L93,11 L112,11 L112,25 Z M118,11 L138,11 L138,25 L118,25 Z M144,11 L154,11 Q158,11 160,13 L168,25 L144,25 Z",
    trim:"M22,44 L182,45"},
  "Minibus (MPV)":{fw:48,rw:158,r:14,sill:62,
    body:`M6,62 L6,44 Q6,40 11,39 L20,35 L52,12 Q56,9 64,9 L170,9 Q177,9 180,13 L190,35 Q195,38 196,43 L196,62 L175.0,62 A17,17 0 0 0 141.0,62 L65.0,62 A17,17 0 0 0 31.0,62 L6,62 Z`,
    glass:"M40,33 L58,14 Q60,13 64,13 L96,13 L96,33 Z M102,13 L130,13 L130,33 L102,33 Z M136,13 L168,13 Q172,13 174,15 L184,33 L136,33 Z",
    trim:"M16,50 L190,51"},
  "Pickup":{fw:46,rw:160,r:15,sill:61,
    body:`M4,61 L4,49 Q4,45 9,44 L26,41 L58,40 L76,22 Q79,20 84,20 L116,20 Q121,20 124,23 L134,40 L134,42 L194,42 Q197,42 197,45 L197,61 L178.0,61 A18,18 0 0 0 142.0,61 L64.0,61 A18,18 0 0 0 28.0,61 L4,61 Z`,
    glass:"M64,38 L80,23 L101,23 L101,38 Z M107,23 L114,23 Q118,23 120,25 L127,38 L107,38 Z",
    trim:"M14,52 L132,53"},
};

function CarSilhouette({body,paint,glass,wheel,style}) {
  const sh = CAR_SHAPES[body] || CAR_SHAPES.Hatchback;
  const cy = GROUND - sh.r, a = sh.r + ARCH_GAP;
  return <svg viewBox="0 0 200 84" role="img" aria-label={`Tegning af ${body||"bil"}`} style={style}>
    {/* Hjulkassen bag hjulet, så mellemrummet ind til dækket læses som skygge */}
    {[sh.fw,sh.rw].map((cx,i)=><g key={"w"+i}>
      <circle cx={cx} cy={cy} r={a} fill={paint}/>
      <circle cx={cx} cy={cy} r={a} fill={wheel} opacity=".4"/>
    </g>)}
    <path d={sh.body} fill={paint}/>
    {sh.cabin && <path d={sh.cabin} fill={wheel} opacity=".4"/>}
    <path d={sh.glass} fill={glass} opacity=".75"/>
    <path d={sh.trim} stroke={wheel} strokeOpacity=".13" strokeWidth="2" fill="none"/>
    {[sh.fw,sh.rw].map((cx,i)=><g key={"h"+i}>
      <circle cx={cx} cy={cy} r={sh.r} fill={wheel}/>
      <circle cx={cx} cy={cy} r={sh.r*0.48} fill={glass}/>
      <circle cx={cx} cy={cy} r={sh.r*0.17} fill={wheel} opacity=".5"/>
    </g>)}
  </svg>;
}

/* Karosseri vælges på tegningen. Produktet er til folk der ikke kender
   forskel på en MPV og en stationcar — så vis det frem for at skrive det. */
function BodyTypePicker({value=[],onChange}) {
  const C = useC();
  return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
    {BODY_TYPES.map(b=>{
      const on = value.includes(b);
      return <button key={b} onClick={()=>onChange(on?value.filter(v=>v!==b):[...value,b])} aria-pressed={on}
        style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 8px 8px",
          borderRadius:12,cursor:"pointer",fontFamily:"inherit",
          border:`1.5px solid ${on?C.accent:C.border2}`,background:on?C.accentSoft:C.surface}}>
        <CarSilhouette body={b} paint={on?C.accent:C.muted} glass={on?C.accentSoft:C.panel} wheel={C.text}
          style={{width:"100%",maxWidth:96}}/>
        <span style={{fontSize:14,fontWeight:on?700:500,color:on?C.accent:C.text}}>{b}</span>
      </button>;
    })}
  </div>;
}

/* Vi kan ikke se HVAD der er på et foto, men vi kan kontrollere hvilken artikel
   det kommer fra. Et foto godtages kun hvis artiklens titel indeholder både
   mærket og modellen — ellers vises tegningen frem for et billede af en anden
   bil. Varianten prioriteres, fordi en GTI ser markant anderledes ud end en
   almindelig Golf, og "Volkswagen Golf GTI" har sin egen artikel. */
const wikiCache = new Map();

const normTitle = t => String(t||"").toLowerCase()
  .replace(/ø/g,"o").replace(/æ/g,"ae").replace(/å/g,"a")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g," ").trim();

// Wikipedia og danske forhandlere staver ikke mærkerne ens
const BRAND_ALIASES = {"volkswagen":["volkswagen","vw"],"mercedes-benz":["mercedes","benz"],
  "citroën":["citroen"],"ds automobiles":["ds","citroen"]};

function articleMatches(title, brand, model) {
  const t = normTitle(title);
  const brandOk = (BRAND_ALIASES[String(brand).toLowerCase()] || [brand])
    .some(b => t.includes(normTitle(b)));
  // Modellens første ord er nok: "1 Series" vs "1-serie", "Model 3" vs "Model 3"
  const modelWord = normTitle(model).split(" ")[0];
  return brandOk && modelWord.length > 0 && t.includes(modelWord);
}

async function fetchWikiImage(brand, model, hint, variant) {
  const key = `${brand}|${model}|${hint||""}|${variant||""}`;
  if (wikiCache.has(key)) return wikiCache.get(key);

  const ask = async (host, q) => {
    const u = `https://${host}/w/api.php?action=query&format=json&formatversion=2&origin=*`
      + `&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5&gsrnamespace=0`
      + `&prop=pageimages&piprop=thumbnail&pithumbsize=800`;
    const r = await fetch(u);
    if (!r.ok) return null;
    const d = await r.json();
    const pages = (d?.query?.pages || [])
      .filter(pg => pg.thumbnail?.source && articleMatches(pg.title, brand, model))
      .sort((a,b)=>(a.index||0)-(b.index||0));
    if (!pages.length) return null;
    const v = normTitle(variant);
    const exact = v ? pages.find(pg => normTitle(pg.title).includes(v)) : null;
    const pick = exact || pages[0];
    return { src: pick.thumbnail.source, title: pick.title, variantMatch: !!exact };
  };

  let out = null;
  try {
    // Mest specifikke søgning først, så en GTI ikke ender som en almindelig Golf
    const queries = [
      variant ? `${brand} ${model} ${variant}` : null,
      hint || null,
      `${brand} ${model}`,
    ].filter(Boolean);
    for (const q of queries) {
      out = (await ask("en.wikipedia.org", q)) || (await ask("da.wikipedia.org", q));
      if (out) break;
    }
  } catch (e) { out = null; }
  wikiCache.set(key, out);
  return out;
}

function CarPhoto({car,tint,variant}) {
  const C = useC();
  const studio = carImageUrl(car);
  const [src,setSrc] = useState(studio);
  const [caption,setCaption] = useState(studio ? "Illustrationsfoto" : "");
  const [isPhoto,setIsPhoto] = useState(!!studio);

  useEffect(()=>{
    if (studio) return;                       // studierendering vinder, når nøglen er sat
    let alive = true;
    fetchWikiImage(car.brand, car.model, car.wikipedia_title, variant).then(hit=>{
      if (alive && hit) {
        setSrc(hit.src); setIsPhoto(true);
        // Vis hvilken bil billedet faktisk viser, så man selv kan se om det er
        // den rigtige version — en GTI er ikke en almindelig Golf
        setCaption(hit.title);
      }
    });
    return ()=>{ alive = false; };
  },[car.brand, car.model, car.wikipedia_title, variant, studio]);

  const box = {height:210,background:C.panel,borderRadius:14,border:`1px solid ${C.border}`,
    display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",marginBottom:18,position:"relative"};
  const cap = {position:"absolute",bottom:8,right:12,color:C.dim,fontSize:11.5,fontWeight:500,
    background:C.panel,borderRadius:6,padding:"2px 7px",maxWidth:"84%",overflow:"hidden",
    textOverflow:"ellipsis",whiteSpace:"nowrap"};

  if (src && isPhoto) return <div style={box}>
    <img src={src} alt={`${car.brand} ${car.model}`} loading="lazy"
      onError={()=>{ setSrc(null); setIsPhoto(false); setCaption(""); }}
      style={{width:"100%",height:"100%",objectFit:"cover"}}/>
    <span style={cap} title={caption}>{caption}</span>
  </div>;

  return <div style={box}>
    <CarSilhouette body={car.body_type} paint={tint||C.accent} glass={C.panel} wheel={C.text}
      style={{width:"86%",height:"86%"}}/>
    <span style={cap}>{car.body_type||"Tegning"}</span>
  </div>;
}

/* Farver bilen blev solgt i herhjemme. Navnet vises ved hover, tastatur og tryk. */
const isHex = h => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(h||"").trim());
function ColorPalette({colors,selected,onSelect}) {
  const C = useC();
  const [hovered,setHovered] = useState(null);
  const list = (Array.isArray(colors)?colors:[]).filter(c=>c&&c.name&&isHex(c.hex));
  if (!list.length) return null;
  const shown = hovered || selected || null;
  return <div>
    <div style={{display:"flex",flexWrap:"wrap",gap:11,marginBottom:11}}>
      {list.map(c=>{
        const active = selected && selected.name===c.name;
        return <button key={c.name} title={c.name} aria-label={`Farve: ${c.name}`} aria-pressed={!!active}
          onMouseEnter={()=>setHovered(c)} onMouseLeave={()=>setHovered(null)}
          onFocus={()=>setHovered(c)} onBlur={()=>setHovered(null)}
          onClick={()=>onSelect(active?null:c)}
          style={{width:42,height:42,borderRadius:"50%",cursor:"pointer",padding:0,
            background:c.hex, border:`2.5px solid ${active?C.accent:C.border2}`,
            boxShadow:active?`0 0 0 4px ${C.accentSoft}`:"none",
            transform:active?"scale(1.08)":"none",transition:"transform .12s"}}/>;
      })}
    </div>
    {/* Fast højde, så kortet ikke hopper når navnet skifter */}
    <div style={{minHeight:24,display:"flex",alignItems:"center",gap:8}}>
      {shown
        ? <><span style={{color:C.text,fontSize:15.5,fontWeight:600}}>{shown.name}</span>
            {shown.metallic && <span style={{color:C.muted,fontSize:14}}>· metallak</span>}</>
        : <span style={{color:C.muted,fontSize:14.5}}>Peg på en farve for at se navnet</span>}
    </div>
  </div>;
}

/* ═════════════════════════════════════════════════════════════
   RESULTATVISNING
   ═════════════════════════════════════════════════════════════ */
function Sparkline({resale,price}) {
  const C = useC();
  const gid = useRef("sg"+Math.random().toString(36).slice(2,8)).current;
  const r = resale||{};
  const all=[price,r.y1,r.y2,r.y3,r.y4,r.y5,r.y6,r.y7,r.y8].map(v=>num(v)).filter(v=>v!==null);
  if(all.length<3) return null;
  const mn=Math.min(...all)*0.92,mx=Math.max(...all),rng=(mx-mn)||1,W=300,H=64;
  const x=i=>(i/(all.length-1))*W, y=v=>H-((v-mn)/rng)*H;
  const pts=all.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  return <svg width="100%" viewBox={`0 0 ${W} ${H+22}`} style={{overflow:"visible"}} role="img" aria-label="Forventet gensalgsværdi over 8 år">
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.22"/><stop offset="100%" stopColor={C.accent} stopOpacity="0"/></linearGradient></defs>
    <path d={`M ${pts.split(" ").join(" L ")} L ${W} ${H+8} L 0 ${H+8} Z`} fill={`url(#${gid})`}/>
    <polyline points={pts} fill="none" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    {all.map((v,i)=>i%2===0&&<g key={i}><circle cx={x(i)} cy={y(v)} r="3.2" fill={C.accent}/><text x={x(i)} y={H+18} textAnchor="middle" fill={C.muted} fontSize="11">{i===0?"Nu":`år ${i}`}</text></g>)}
  </svg>;
}

function Panel({title,children,tone}) {
  const C = useC();
  return <div style={{background:tone==="accent"?C.accentSoft:C.panel,border:`1px solid ${tone==="accent"?C.accentBorder:C.border}`,borderRadius:14,padding:"15px 17px",marginBottom:13}}>
    {title && <div style={{color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:".09em",fontWeight:700,marginBottom:11}}>{title}</div>}
    {children}
  </div>;
}

function DisclaimerBox() {
  const C = useC();
  const [open,setOpen]=useState(false);
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",marginTop:28}}>
    <button onClick={()=>setOpen(!open)} style={{width:"100%",background:"none",border:"none",padding:"17px 19px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",minHeight:58,fontFamily:"inherit"}}>
      <span style={{color:C.text,fontSize:15.5,fontWeight:600}}>Hvor kommer tallene og anmeldelserne fra?</span>
      <span style={{color:C.muted,fontSize:13,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
    </button>
    {open && <div style={{padding:"0 19px 19px",borderTop:`1px solid ${C.border}`}}>
      <div style={{color:C.muted,fontSize:15.5,lineHeight:1.8,paddingTop:15}}>
        <p style={{marginBottom:11,color:C.text,fontWeight:600}}>Estimater — ikke garantier</p>
        <p style={{marginBottom:11}}>Priser og gensalgsværdier er <strong style={{color:C.text}}>estimater</strong> baseret på historiske markedsdata, og bør ikke stå alene som grundlag for en økonomisk beslutning.</p>
        <p style={{marginBottom:11}}><strong style={{color:C.text}}>Anmeldelser og brugsvurderinger</strong> vægter <a href="https://www.fdm.dk" target="_blank" rel="noopener noreferrer" style={{color:C.accent,textDecoration:"underline"}}>FDM</a>’s tests og medlemsundersøgelser højest, fordi de er lavet ud fra danske forhold, danske priser og dansk afgiftsstruktur.</p>
        <p style={{marginBottom:11}}><strong style={{color:C.text}}>Sikkerhed</strong> bygger på Euro NCAP — se <a href="https://www.euroncap.com" target="_blank" rel="noopener noreferrer" style={{color:C.accent,textDecoration:"underline"}}>euroncap.com</a>.</p>
        <p><strong style={{color:C.text}}>Pålidelighed</strong> bygger på FDM’s fejlstatistik suppleret med ADAC Pannenstatistik og TÜV-rapporten.</p>
      </div>
    </div>}
  </div>;
}

const RANK_LABEL = ["Bedste match","Alternativ"];

function CompareBox({cars}) {
  const C = useC();
  if(!cars || cars.length<2) return null;
  const rows = [
    ["Bil", c=>`${c.brand} ${c.model}`],
    ["Variant", c=>c.variant||"–"],
    ["Pris brugt", c=>fmtDKK(num(c.price_used_dkk))],
    ["Drivmiddel", c=>c.fuel_type||"–"],
    ["Karosseri", c=>c.body_type||"–"],
    ["Effekt", c=>c.hp?`${c.hp} hk`:"–"],
    ["Brændstof/md.", c=>fmtDKK(num(c.fuel_cost_monthly))],
    ["Værdi efter 8 år", c=>fmtDKK(num(c.resale?.y8))],
  ];
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"22px",marginTop:16}}>
    <H size={3} style={{marginBottom:14}}>Forskellen på forslagene</H>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:15.5,minWidth:120+cars.length*150}}>
        <thead><tr>
          <th style={{textAlign:"left",padding:"8px 10px"}}></th>
          {cars.map((c,i)=><th key={i} style={{textAlign:"left",padding:"8px 10px",fontSize:13.5,fontWeight:700,
            color:i===0?C.accent:C.muted,whiteSpace:"nowrap"}}>{RANK_LABEL[i]||`Forslag ${i+1}`}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(([label,get],i)=>{
            const vals = cars.map(get);
            const allSame = vals.every(v=>String(v)===String(vals[0]));
            return <tr key={label} style={{background:i%2?C.panel:"transparent"}}>
              <td style={{padding:"10px",color:C.muted,fontWeight:500,whiteSpace:"nowrap"}}>{label}</td>
              {vals.map((v,j)=><td key={j} style={{padding:"10px",color:allSame?C.muted:C.text,fontWeight:allSame?400:650}}>{v}</td>)}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}

function CarCard({car,form,onReject,rank=0,loading}) {
  const C = useC();
  const [expanded,setExpanded]=useState(false);
  const [pct,setPct]=useState(15);
  const [narrow,setNarrow]=useState(false);
  const [color,setColor]=useState(null);
  const isAlt = rank>0;
  if(loading) return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,padding:"48px 24px",textAlign:"center"}}>
    <div style={{display:"inline-block",width:26,height:26,border:`2.5px solid ${C.accentSoft}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    <div style={{color:C.muted,fontSize:15.5,marginTop:15}}>Finder {(RANK_LABEL[rank]||"forslag").toLowerCase()}…</div>
  </div>;
  if(!car) return null;
  const price = num(car.price_used_dkk);
  const y8 = num(car.resale?.y8);
  const loss8 = (price!==null&&y8!==null) ? price-y8 : null;
  const [lo,hi] = priceBand(car, form, pct);
  const pros = Array.isArray(car.pros)?car.pros:[], cons = Array.isArray(car.cons)?car.cons:[];

  return <article style={{background:C.surface,border:`1px solid ${isAlt?C.border:C.accentBorder}`,borderRadius:18,overflow:"hidden",position:"relative",boxShadow:isAlt?C.shadow:C.shadowLift,animation:"fadeUp .35s ease"}}>
    <div style={{background:isAlt?C.panel:C.accentSoft,padding:"12px 18px",borderBottom:`1px solid ${isAlt?C.border:C.accentBorder}`,display:"flex",alignItems:"center",gap:11,flexWrap:"wrap"}}>
      <span style={{color:isAlt?C.muted:C.accent,fontSize:13,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase"}}>{RANK_LABEL[rank]||`Forslag ${rank+1}`}</span>
      <span title="Forslaget er sammensat af vores AI ud fra dine svar" style={{background:C.surface,border:`1px solid ${C.border2}`,color:C.muted,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,letterSpacing:".07em"}}>AI-ANALYSE</span>
      {onReject && <button onClick={onReject} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,borderRadius:999,padding:"7px 14px",fontSize:13.5,fontWeight:500,cursor:"pointer",minHeight:38,fontFamily:"inherit"}}>Vis et andet</button>}
    </div>

    <div style={{padding:"22px 20px 0"}}>
      <CarPhoto car={car} tint={color?color.hex:null} variant={variantTerm(form,car)}/>
      <div style={{marginBottom:18}}>
        <H size={2} style={{fontSize:"clamp(24px,3.4vw,30px)"}}>{car.brand} {car.model}</H>
        <div style={{color:C.muted,fontSize:15.5,marginTop:5}}>{[car.variant,car.year_range,car.hp?`${car.hp} hk`:null].filter(Boolean).join(" · ")}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:20,marginTop:16}}>
          <div><div style={{color:C.dim,fontSize:11.5,textTransform:"uppercase",letterSpacing:".08em",fontWeight:650}}>Brugt ca.</div><div style={{color:C.accent,fontSize:26,fontWeight:600,fontFamily:DISPLAY}}>{fmtDKK(price)}</div></div>
          <div><div style={{color:C.dim,fontSize:11.5,textTransform:"uppercase",letterSpacing:".08em",fontWeight:650}}>Nypris</div><div style={{color:C.muted,fontSize:17,fontWeight:600}}>{fmtDKK(num(car.price_new_dkk))}</div></div>
          <div><div style={{color:C.dim,fontSize:11.5,textTransform:"uppercase",letterSpacing:".08em",fontWeight:650}}>Brændstof/md.*</div><div style={{color:C.info,fontSize:17,fontWeight:600}}>{fmtDKK(num(car.fuel_cost_monthly))}</div></div>
        </div>
      </div>

      <Panel title="Hvorfor denne bil?">
        {(Array.isArray(car.short_why)?car.short_why:[car.short_why]).filter(Boolean).map((pt,i)=>(
          <div key={i} style={{display:"flex",gap:10,marginBottom:9,alignItems:"flex-start"}}>
            <span style={{color:C.accent,fontSize:14,marginTop:3,flexShrink:0}}>—</span>
            <span style={{color:C.text,fontSize:16,lineHeight:1.6}}>{pt}</span>
          </div>))}
        <button onClick={()=>setExpanded(!expanded)} style={{background:"none",border:"none",color:C.accent,fontSize:15,fontWeight:600,cursor:"pointer",marginTop:6,padding:"6px 0",minHeight:40,fontFamily:"inherit"}}>{expanded?"Skjul":"Læs mere"}</button>
        {expanded && <p style={{color:C.text,fontSize:16,lineHeight:1.75,marginTop:6,paddingTop:13,borderTop:`1px solid ${C.border}`}}>{car.long_why}</p>}
      </Panel>

      {Array.isArray(car.colors_dk) && car.colors_dk.length>0 && <Panel title="Farver solgt i Danmark">
        <ColorPalette colors={car.colors_dk} selected={color} onSelect={setColor}/>
      </Panel>}

      {car.fdm_verdict && <Panel title="FDM’s vurdering" tone="accent">
        <p style={{color:C.text,fontSize:16,lineHeight:1.7,marginBottom:11}}>{car.fdm_verdict}</p>
        <a href={FDM_SEARCH(`${car.brand} ${car.model} test`)} target="_blank" rel="noopener noreferrer"
           style={{color:C.accent,fontSize:15,fontWeight:600,textDecoration:"underline"}}>Læs FDM’s test af {car.brand} {car.model} →</a>
      </Panel>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:11,marginBottom:13}}>
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:15}}>
          <div style={{color:C.good,fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:9}}>Fordele</div>
          {pros.map((p,i)=><div key={i} style={{display:"flex",gap:9,marginBottom:7}}><span style={{color:C.good,fontSize:13}}>✓</span><span style={{color:C.text,fontSize:15.5,lineHeight:1.55}}>{p}</span></div>)}
        </div>
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:15}}>
          <div style={{color:C.bad,fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:9}}>Ulemper</div>
          {cons.map((c,i)=><div key={i} style={{display:"flex",gap:9,marginBottom:7}}><span style={{color:C.bad,fontSize:13}}>✗</span><span style={{color:C.text,fontSize:15.5,lineHeight:1.55}}>{c}</span></div>)}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:11,marginBottom:13}}>
        {[{l:"Sikkerhed",v:num(car.safety_rating)?"★".repeat(num(car.safety_rating)):"–"},
          {l:"Pålidelighed",v:car.reliability||"–"},
          {l:"Tab over 8 år*",v:loss8!==null?"−"+fmtDKK(loss8):"–",bad:true}].map(s=>
          <div key={s.l} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 15px"}}>
            <div style={{color:C.dim,fontSize:11.5,textTransform:"uppercase",letterSpacing:".08em",fontWeight:650,marginBottom:6}}>{s.l}</div>
            <div style={{color:s.bad?C.bad:C.text,fontSize:16,fontWeight:600}}>{s.v}</div>
          </div>)}
      </div>

      <Panel title="Gensalgsværdi — 8 år*">
        <Sparkline resale={car.resale} price={price}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
          <span style={{color:C.muted,fontSize:13.5}}>Nu: {fmtDKK(price)}</span>
          <span style={{color:C.muted,fontSize:13.5}}>År 8: {fmtDKK(y8)}</span>
        </div>
      </Panel>

      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:"15px 17px",marginBottom:13}}>
        <div style={{color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:".09em",fontWeight:700,marginBottom:9}}>Se den til salg</div>
        <div style={{color:C.text,fontSize:15.5,lineHeight:1.75,marginBottom:14}}>
          {car.brand} {car.model}{variantTerm(form,car)?` ${variantTerm(form,car)}`:""}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Btn as="a" href={buildBilbasenModelUrl(form,car)} target="_blank" rel="noopener noreferrer" full>
            Se alle til salg på Bilbasen →
          </Btn>
        </div>

        {/* Den snævre søgning er foldet væk. Den kan ramme nul, og så skal den
            ikke være det første man møder. */}
        <button onClick={()=>setNarrow(!narrow)}
          style={{background:"none",border:"none",color:C.accent,fontSize:15,fontWeight:600,cursor:"pointer",marginTop:12,padding:"8px 0",minHeight:40,fontFamily:"inherit"}}>
          {narrow?"Skjul":"Snævr ind på årgang og pris"}
        </button>
        {narrow && <div style={{marginTop:6,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{color:C.text,fontSize:15,lineHeight:1.7,marginBottom:12}}>
            Årgang {(yearBand(car,form)[0]||"?")}{yearBand(car,form)[1]?`–${yearBand(car,form)[1]}`:""}
            {(lo&&hi)?` · ${fmtDKK(lo)} – ${fmtDKK(hi)}`:""}
            {num(form.kmMax)?` · maks ${new Intl.NumberFormat("da-DK").format(num(form.kmMax))} km`:""}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:14}}>
            <span style={{color:C.muted,fontSize:14.5}}>Prisspænd:</span>
            {[5,10,15,25].map(p=><button key={p} onClick={()=>setPct(p)} style={{padding:"7px 14px",minHeight:40,borderRadius:999,border:`1.5px solid ${pct===p?C.accent:C.border2}`,background:pct===p?C.accentSoft:C.surface,color:pct===p?C.accent:C.muted,fontSize:14,fontWeight:pct===p?700:500,cursor:"pointer",fontFamily:"inherit"}}>±{p}%</button>)}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Btn as="a" href={buildBilbasenFilteredUrl(form,car,pct)} target="_blank" rel="noopener noreferrer" kind="ghost" size="sm" full>
              Søg med årgang og prisklasse →
            </Btn>
            <Btn as="a" href={buildBilbasenBroadUrl(form,car)} target="_blank" rel="noopener noreferrer" kind="quiet" size="sm" full>
              Lignende biler i samme klasse →
            </Btn>
          </div>
          <p style={{color:C.dim,fontSize:13,lineHeight:1.6,marginTop:12}}>
            Giver den ingen biler, er prisskønnet nok ved siden af — prøv et bredere prisspænd, eller brug knappen ovenfor.
          </p>
        </div>}
      </div>
      <p style={{color:C.dim,fontSize:13,textAlign:"center",paddingBottom:18}}>* Estimater — ikke garantier</p>
    </div>
  </article>;
}

/* ═════════════════════════════════════════════════════════════
   FORESPØRGSEL — kvittering, kønummer og svartid
   ═════════════════════════════════════════════════════════════ */
function summarizeForm(f) {
  return [
    `Familie: ${f.adults} voksne, ${f.children} børn${f.childAges?` (${f.childAges})`:""}`,
    `Region: ${f.region||"ikke oplyst"}`,
    `Budget: ${f.budgetType==="kontant"?fmtDKK(num(f.budget))+" kontant":fmtDKK(num(f.monthly))+" pr. måned"}`,
    `Årgang fra: ${f.yearMin||"–"} · Maks km: ${f.kmMax||"–"} · Min. effekt: ${f.minHp?f.minHp+" hk":"–"}`,
    `Daglig kørsel: ${f.dailyKm||"–"} km (${f.driveType||"blandet"})`,
    `Karosseri: ${(f.bodies||[]).join(", ")||"–"} · Drivmiddel: ${(f.fuels||[]).join(", ")||"–"}`,
    `Karakter: ${f.character||"–"} · Ønsket variant: ${f.variantWish||"–"}`,
    `Foretrukne mærker: ${(f.brands||[]).join(", ")||"–"} · Fravalgte: ${(f.excludeBrands||[]).join(", ")||"–"}`,
    `Gearkasse: ${f.transmission||"–"} · Anhængertræk: ${f.towbar||"–"}`,
    `Prioriteter: ${(f.priorities||[]).join(", ")||"–"}`,
  ].join("\n");
}
const summarizeCar = (c,label) => !c ? `${label}: ingen`
  : `${label}: ${c.brand} ${c.model} ${c.variant||""} (${c.year_range||"?"}) — ca. ${fmtDKK(num(c.price_used_dkk))}${c.hp?`, ${c.hp} hk`:""}`;

function buildLeadSummary({service,form,cards,excluded,contact,queue}) {
  return [
    `FORESPØRGSEL — ${COMPANY_NAME}`,
    `Kønummer: ${queue}`,
    `Ydelse: ${service.title} (${service.price}${service.priceNote?` — ${service.priceNote}`:""})`,
    `Oprettet: ${new Date().toLocaleString("da-DK")}`,
    ``, `── KONTAKT ──`,
    `Navn: ${contact.name||"–"}`,
    `E-mail: ${contact.email||"–"}`,
    `Telefon: ${contact.phone||"–"}`,
    `Besked: ${contact.message||"–"}`,
    ``, `── SØGEPROFIL ──`,
    summarizeForm(form),
    ``, `── ANBEFALINGER VIST ──`,
    ...cards.map((c,i)=>summarizeCar(c, RANK_LABEL[i]||`Forslag ${i+1}`)).filter(t=>!t.endsWith("ingen")),
    ``, `── FRAVALGT UNDERVEJS ──`,
    [...(excluded[0]||[]),...(excluded[1]||[])].join(", ")||"ingen",
  ].join("\n");
}

function LeadDialog({service,form,cards,excluded,onClose}) {
  const C = useC();
  const [contact,setContact] = useState({name:"",email:"",phone:"",message:""});
  const [sending,setSending] = useState(false);
  const [receipt,setReceipt] = useState(null);
  const [copied,setCopied] = useState(false);
  const set = k => v => setContact(c=>({...c,[k]:v}));
  const valid = contact.name.trim() && /\S+@\S+\.\S+/.test(contact.email);
  const needsPhone = service.id==="samtale";

  async function submit() {
    setSending(true);
    const queue = "AF-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + Math.floor(100+Math.random()*900);
    const summary = buildLeadSummary({service,form,cards,excluded,contact,queue});
    let delivered = false;
    try {
      const r = await fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({queue,service:service.title,price:service.price,contact,summary})});
      delivered = r.ok && (await r.json().catch(()=>({}))).delivered === true;
    } catch(e) { delivered = false; }
    setReceipt({queue,summary,delivered});
    setSending(false);
  }
  const mailto = receipt ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[${receipt.queue}] ${service.title}`)}&body=${encodeURIComponent(receipt.summary)}` : "#";

  return <div role="dialog" aria-modal="true" aria-label={service.title}
    style={{position:"fixed",inset:0,zIndex:500,background:"rgba(33,29,24,.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 14px",overflowY:"auto"}}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:C.surface,borderRadius:20,border:`1px solid ${C.border2}`,boxShadow:C.shadow,maxWidth:620,width:"100%",padding:"26px 24px 28px",marginTop:24}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:18}}>
        <div style={{flex:1}}>
          <H size={3}>{receipt?"Tak — vi er i gang":service.title}</H>
          <p style={{color:C.muted,fontSize:15.5,marginTop:5}}>{receipt?`Dit nummer er ${receipt.queue}`:`${service.price}${service.priceNote?` · ${service.priceNote}`:""} · Svar ${service.eta}`}</p>
        </div>
        <button onClick={onClose} aria-label="Luk" style={{background:"transparent",border:`1px solid ${C.border2}`,borderRadius:999,width:42,height:42,fontSize:18,color:C.muted,cursor:"pointer",flexShrink:0}}>×</button>
      </div>

      {!receipt && <>
        <p style={{color:C.text,fontSize:16.5,lineHeight:1.7,marginBottom:20}}>{service.desc}</p>
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",marginBottom:20}}>
          <div style={{color:C.muted,fontSize:15,lineHeight:1.65}}>
            Vi sender automatisk <strong style={{color:C.text}}>hele din søgning med</strong> — dine svar, de biler du har fået vist, og dem du har fravalgt. Du skal ikke skrive det hele igen.
          </div>
        </div>
        <Field label="Dit navn"><TxtInput value={contact.name} onChange={set("name")} placeholder="Fornavn og efternavn"/></Field>
        <Field label="Din e-mail" hint="vi svarer her"><TxtInput type="email" value={contact.email} onChange={set("email")} placeholder="navn@eksempel.dk"/></Field>
        <Field label="Telefon" hint={needsPhone?"så vi kan ringe":"valgfrit"}><TxtInput type="tel" value={contact.phone} onChange={set("phone")} placeholder="12 34 56 78"/></Field>
        <Field label="Besked" hint="valgfrit"><TextArea value={contact.message} onChange={set("message")} placeholder="Er der noget vi skal vide?"/></Field>
        <Btn onClick={submit} disabled={!valid||sending} full size="lg">{sending?"Sender…":service.price==="Gratis"?"Send besked":`Send bestilling — ${service.price}`}</Btn>
        {!valid && <p style={{color:C.muted,fontSize:14.5,textAlign:"center",marginTop:11}}>Udfyld navn og e-mail for at sende.</p>}
      </>}

      {receipt && <>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11,marginBottom:20}}>
          <div style={{background:C.accentSoft,border:`1px solid ${C.accentBorder}`,borderRadius:14,padding:"15px 17px"}}>
            <div style={{color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:6}}>Kønummer</div>
            <div style={{color:C.accent,fontSize:21,fontWeight:600,fontFamily:DISPLAY}}>{receipt.queue}</div>
          </div>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:"15px 17px"}}>
            <div style={{color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:6}}>Forventet svar</div>
            <div style={{color:C.text,fontSize:17,fontWeight:600}}>{service.eta}</div>
          </div>
        </div>

        {!receipt.delivered && <div style={{background:C.panel,border:`1.5px solid ${C.accentBorder}`,borderRadius:14,padding:"16px 18px",marginBottom:18}}>
          <p style={{color:C.text,fontSize:16.5,fontWeight:600,marginBottom:7}}>Sidste trin: send den afsted</p>
          <p style={{color:C.muted,fontSize:15.5,lineHeight:1.65,marginBottom:14}}>Tryk på knappen — din mailapp åbner med hele forespørgslen skrevet ind. Du skal kun trykke “Send”.</p>
          <Btn as="a" href={mailto} full>Åbn e-mail og send</Btn>
        </div>}
        {receipt.delivered && <p style={{color:C.good,fontSize:16.5,fontWeight:600,marginBottom:18}}>✓ Vi har modtaget din forespørgsel — du får en bekræftelse på {contact.email}.</p>}

        <div style={{color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:".09em",fontWeight:700,marginBottom:10}}>Sådan foregår det</div>
        <ol style={{color:C.text,fontSize:16.5,lineHeight:1.95,paddingLeft:22,marginBottom:20}}>
          <li>Vi læser din søgning igennem — du skal ikke gøre mere.</li>
          <li>Du hører fra os {service.eta}.</li>
          <li>Vi fortsætter dialogen, indtil du har fundet den rigtige bil.</li>
        </ol>

        <details style={{marginBottom:18}}>
          <summary style={{cursor:"pointer",color:C.accent,fontSize:15,fontWeight:600,padding:"8px 0"}}>Se hvad vi sender med</summary>
          <pre style={{whiteSpace:"pre-wrap",background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:15,color:C.muted,fontSize:13,lineHeight:1.6,marginTop:8,maxHeight:280,overflow:"auto"}}>{receipt.summary}</pre>
        </details>

        <div style={{display:"flex",gap:11,flexWrap:"wrap"}}>
          <Btn kind="ghost" onClick={()=>{navigator.clipboard?.writeText(receipt.summary);setCopied(true);setTimeout(()=>setCopied(false),2000);}}>{copied?"✓ Kopieret":"Kopiér oversigt"}</Btn>
          <Btn kind="quiet" onClick={onClose}>Luk</Btn>
        </div>
      </>}
    </div>
  </div>;
}

function ServiceCard({s,onPick,compact}) {
  const C = useC();
  return <div style={{background:C.surface,border:`1px solid ${s.tag?C.accentBorder:C.border}`,borderRadius:18,padding:"24px 24px 26px",
    display:"flex",flexDirection:"column",height:"100%",boxShadow:s.tag?C.shadowLift:"none"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,minHeight:26}}>
      <span aria-hidden="true" style={{color:C.accent,fontSize:19}}>{s.icon}</span>
      {s.tag && <span style={{marginLeft:"auto",background:C.accentSoft,border:`1px solid ${C.accentBorder}`,color:C.accent,fontSize:11.5,fontWeight:700,padding:"4px 11px",borderRadius:999,letterSpacing:".05em"}}>{s.tag}</span>}
    </div>
    <h3 style={{fontFamily:DISPLAY,fontSize:22,fontWeight:550,color:C.text,marginBottom:8,letterSpacing:"-.01em"}}>{s.title}</h3>
    <div style={{display:"flex",alignItems:"baseline",gap:9,marginBottom:12,flexWrap:"wrap"}}>
      <span style={{fontFamily:DISPLAY,fontSize:30,fontWeight:550,color:C.accent}}>{s.price}</span>
      {s.priceNote && <span style={{color:C.muted,fontSize:14.5}}>{s.priceNote}</span>}
    </div>
    <p style={{color:C.muted,fontSize:16,lineHeight:1.7,marginBottom:16,flex:1}}>{s.desc}</p>
    <div style={{color:C.dim,fontSize:14.5,marginBottom:18}}>Svar {s.eta}</div>
    <Btn kind={s.tag?"primary":"ghost"} onClick={()=>onPick(s)} full size={compact?"sm":"md"}>
      {s.price==="Gratis"?"Skriv til os":"Bestil"}
    </Btn>
  </div>;
}

function HelpSection({onPick}) {
  const C = useC();
  return <section style={{marginTop:48,borderTop:`1px solid ${C.border}`,paddingTop:38}}>
    <H size={2} style={{marginBottom:10}}>Vil du have et menneske med på råd?</H>
    <p style={{color:C.muted,fontSize:17,lineHeight:1.7,marginBottom:26,maxWidth:"58ch"}}>
      Selve søgningen er og bliver gratis. Skal vi grave et lag dybere, kan du vælge herunder — vi sender automatisk hele din søgning med.
    </p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(268px,1fr))",gap:16}}>
      {SERVICES.map(s=><ServiceCard key={s.id} s={s} onPick={onPick} compact/>)}
    </div>
  </section>;
}

/* Et forslag der ikke kunne hentes. Vises som et rigtigt kort med en
   forklaring, så pladsen ikke bare står tom. */
function FailedCard({rank,msg,onRetry}) {
  const C = useC();
  return <div style={{background:C.surface,border:`1px dashed ${C.border2}`,borderRadius:18,
    padding:"40px 24px",textAlign:"center"}}>
    <div style={{color:C.text,fontSize:17,fontWeight:600,marginBottom:8}}>
      {RANK_LABEL[rank]||`Forslag ${rank+1}`} kunne ikke hentes
    </div>
    <p style={{color:C.muted,fontSize:15.5,lineHeight:1.6,marginBottom:20,maxWidth:"36ch",marginLeft:"auto",marginRight:"auto"}}>
      {msg || "De øvrige forslag er ikke berørt."}
    </p>
    <Btn kind="ghost" size="sm" onClick={onRetry}>Prøv dette forslag igen</Btn>
  </div>;
}

function Results({cards,loading,failed,failMsg,onRetry,form,onReject,onRefresh,summary,onPickService}) {
  const C = useC();
  const busy = loading.some(Boolean);
  const shown = cards.filter(Boolean);
  return <div style={{animation:"fadeUp .4s ease"}}>
    {summary && <div style={{background:C.accentSoft,border:`1px solid ${C.accentBorder}`,borderRadius:16,padding:"18px 20px",marginBottom:24}}>
      <div style={{color:C.muted,fontSize:12,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",marginBottom:7}}>Din profil</div>
      <p style={{color:C.text,fontSize:16.5,lineHeight:1.65}}>{summary}</p>
    </div>}
    {/* To ad gangen på skærme der har plads, ellers under hinanden */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,420px),1fr))",gap:18,alignItems:"start"}}>
      {cards.map((car,i)=> failed[i] && !loading[i]
        ? <FailedCard key={i} rank={i} msg={failMsg[i]} onRetry={()=>onRetry(i)}/>
        : <CarCard key={i} car={car} form={form} rank={i} loading={loading[i]}
            onReject={!loading[i]&&car?()=>onReject(i):null}/>)}
    </div>
    {!busy && shown.length>1 && <CompareBox cars={shown}/>}
    <DisclaimerBox/>
    <HelpSection onPick={onPickService}/>
    <div style={{textAlign:"center",marginTop:34}}>
      <Btn kind="ghost" onClick={onRefresh}>← Ret min søgning</Btn>
    </div>
  </div>;
}

/* ═════════════════════════════════════════════════════════════
   FORSIDE
   ═════════════════════════════════════════════════════════════ */
function Landing({onStart,go}) {
  const C = useC();
  const steps = [
    ["Fortæl om hverdagen","Fem korte trin om familien, økonomien og hvordan bilen skal bruges. Ingen tekniske spørgsmål — vi spørger kun om det, du allerede kender svaret på."],
    ["Få fire bud","Ét der passer bedst, og tre der bevidst er anderledes — et alternativ, et prisfornuftigt og et overraskende. Til hver bil forklarer vi hvorfor."],
    ["Se dem til salg","Vi bygger søgningen på Bilbasen for dig — rigtigt mærke, rigtig årgang, rigtigt prisleje. Du skal bare klikke."],
  ];
  return <div style={{animation:"fadeUp .4s ease"}}>
    <section style={{padding:"clamp(40px,7vw,84px) 0 clamp(30px,5vw,54px)",maxWidth:"70ch",marginLeft:"auto",marginRight:"auto",textAlign:"center"}}>
      <p style={{color:C.accent,fontSize:15,fontWeight:600,letterSpacing:".04em",marginBottom:20}}>Uafhængig bilrådgivning · Danmark</p>
      <H size={1} style={{marginBottom:24}}>Den rigtige bil.<br/>Uden at være bilnørd.</H>
      <p style={{color:C.muted,fontSize:"clamp(17px,2.2vw,20px)",lineHeight:1.65,marginBottom:34,maxWidth:"54ch",marginLeft:"auto",marginRight:"auto"}}>
        Vi spørger om din hverdag — ikke om hestekræfter og motorkoder — og finder fire biler,
        der passer til den. Du får at vide hvorfor, hvad de koster at eje, og hvor de er til salg.
      </p>
      <div style={{display:"flex",gap:13,flexWrap:"wrap",alignItems:"center",justifyContent:"center"}}>
        <Btn size="lg" onClick={onStart}>Find min bil</Btn>
        <Btn size="lg" kind="quiet" onClick={()=>go("pricing")}>Se hvad det koster →</Btn>
      </div>
      <p style={{color:C.dim,fontSize:15,marginTop:24}}>Gratis · Ingen oprettelse · Tager omkring to minutter</p>
    </section>

    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:22,padding:"clamp(28px,4vw,44px)",
      display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"clamp(20px,4vw,40px)"}}>
      <CarSilhouette body="Stationcar" paint={C.accent} glass={C.panel} wheel={C.text} style={{width:"100%",maxWidth:520}}/>
    </div>

    <Rule/>

    <section>
      <div style={{textAlign:"center",marginBottom:40}}>
        <H size={2} style={{marginBottom:12}}>Sådan foregår det</H>
        <p style={{color:C.muted,fontSize:17,lineHeight:1.7,maxWidth:"56ch",marginLeft:"auto",marginRight:"auto"}}>
          Tre trin. Du kan altid gå tilbage og rette undervejs.
        </p>
      </div>
      <Column width="72ch" style={{display:"flex",flexDirection:"column",gap:2}}>
        {steps.map(([t,d],i)=>
          /* Fast bredde på tal-kolonnen, så overskrifterne flugter på tværs af rækkerne */
          <div key={t} style={{display:"grid",gridTemplateColumns:"clamp(44px,7vw,72px) 1fr",gap:"clamp(14px,3vw,32px)",
            alignItems:"start",padding:"28px 0",borderTop:i?`1px solid ${C.border}`:"none"}}>
            <span style={{fontFamily:DISPLAY,fontSize:"clamp(28px,4vw,42px)",fontWeight:400,color:C.accent,opacity:.55,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>
              {String(i+1).padStart(2,"0")}
            </span>
            <div>
              <h3 style={{fontFamily:DISPLAY,fontSize:"clamp(20px,2.6vw,25px)",fontWeight:550,color:C.text,marginBottom:9,letterSpacing:"-.01em"}}>{t}</h3>
              <p style={{color:C.muted,fontSize:16.5,lineHeight:1.75,maxWidth:"58ch"}}>{d}</p>
            </div>
          </div>)}
      </Column>
    </section>

    <Rule/>

    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:"clamp(24px,4vw,44px)",textAlign:"center"}}>
      {[["Vi sælger ikke biler","Ingen forhandleraftaler og ingen provision. Vi har intet at tjene på, hvilken bil du ender med."],
        ["Målt på danske forhold","Vi vægter FDM højest, fordi deres tests og medlemsundersøgelser er lavet ud fra danske priser, afgifter og veje."],
        ["Skrevet til mennesker","Ingen forkortelser, ingen fagsprog. Er der noget du ikke forstår, er det vores fejl — så skriv til os."]]
        .map(([t,d])=><div key={t}>
          <h3 style={{fontFamily:DISPLAY,fontSize:20,fontWeight:550,color:C.text,marginBottom:10}}>{t}</h3>
          <p style={{color:C.muted,fontSize:16,lineHeight:1.75}}>{d}</p>
        </div>)}
    </section>

    <Rule/>

    <section style={{textAlign:"center",paddingBottom:20}}>
      <H size={2} style={{marginBottom:16}}>Skal vi finde din?</H>
      <p style={{color:C.muted,fontSize:17.5,lineHeight:1.7,marginBottom:30,maxWidth:"44ch",marginLeft:"auto",marginRight:"auto"}}>
        Det koster ingenting at prøve, og du skal ikke oprette dig.
      </p>
      <Btn size="lg" onClick={onStart}>Find min bil</Btn>
    </section>
  </div>;
}

/* ═════════════════════════════════════════════════════════════
   OM OS
   ═════════════════════════════════════════════════════════════ */
function AboutPage({onStart,go}) {
  const C = useC();
  return <article style={{animation:"fadeUp .3s ease",maxWidth:"66ch",marginLeft:"auto",marginRight:"auto"}}>
    <p style={{color:C.accent,fontSize:15,fontWeight:600,letterSpacing:".04em",marginBottom:20,paddingTop:"clamp(20px,4vw,40px)"}}>Om os</p>
    <H size={1} style={{marginBottom:30,fontSize:"clamp(30px,5vw,44px)"}}>
      At købe bil burde ikke kræve, at man kan lide biler.
    </H>

    <div style={{fontSize:"clamp(17px,2vw,18.5px)",lineHeight:1.85,color:C.text}}>
      <p style={{marginBottom:24}}>
        De fleste af os køber bil nogle få gange i livet. Alligevel forventes det, at man kender
        forskel på motorvarianter og udstyrslinjer, kan gennemskue om en pris er rimelig, og
        gætter rigtigt om otte år, når bilen skal sælges igen.
      </p>
      <p style={{marginBottom:24}}>
        Det synes vi er en dårlig aftale. Især fordi de fleste hverken har lyst eller tid til at
        sætte sig ind i det — man vil bare have en bil, der passer til livet, og som ikke bliver
        en dyr overraskelse.
      </p>

      <blockquote style={{margin:"38px 0",paddingLeft:"clamp(20px,4vw,32px)",borderLeft:`2px solid ${C.accentBorder}`}}>
        <p style={{fontFamily:DISPLAY,fontSize:"clamp(21px,3vw,27px)",lineHeight:1.45,color:C.text,fontWeight:400,letterSpacing:"-.01em"}}>
          Vi spørger om din hverdag. Ikke om hestekræfter.
        </p>
      </blockquote>

      <p style={{marginBottom:24}}>
        Så det er dét, {COMPANY_NAME} gør. Du fortæller om familien, økonomien og hvordan bilen
        skal bruges. Vi finder to biler, der passer — og forklarer på almindeligt dansk, hvorfor
        netop de to. Hvad de koster at eje. Hvad de er værd om nogle år. Hvad FDM har fundet ud af,
        da de kørte dem.
      </p>
      <p style={{marginBottom:24}}>
        Vi sælger ikke biler. Vi får ikke provision fra forhandlere, og vi har ingen aftaler med
        nogen. Det betyder, at vi ikke har noget at tjene på, hvilken bil du ender med — kun på
        at du synes, rådet var pengene værd, hvis du vælger at spørge om mere.
      </p>
      <p style={{marginBottom:24}}>
        Når vi vurderer en bil, læner vi os mest op ad FDM. Ikke fordi udenlandske tests er
        dårlige, men fordi danske afgifter, danske priser og danske veje gør, at den samme bil kan
        være et fornuftigt køb i Tyskland og et tvivlsomt et herhjemme.
      </p>
      <p style={{marginBottom:24}}>
        Og bliver du i tvivl undervejs, er der altid et menneske at skrive til. Der findes ingen
        dumme spørgsmål, når det handler om at bruge mange penge på noget, man skal leve med
        hver dag i årevis.
      </p>
    </div>

    <div style={{display:"flex",gap:13,flexWrap:"wrap",marginTop:44,paddingTop:32,borderTop:`1px solid ${C.border}`}}>
      <Btn onClick={onStart}>Find min bil</Btn>
      <Btn kind="ghost" onClick={()=>go("contact")}>Skriv til os</Btn>
    </div>
  </article>;
}

/* ═════════════════════════════════════════════════════════════
   PRISER
   ═════════════════════════════════════════════════════════════ */
function PricingPage({onStart,onPick}) {
  const C = useC();
  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={{maxWidth:"62ch",marginLeft:"auto",marginRight:"auto",paddingTop:"clamp(20px,4vw,40px)"}}>
      <p style={{color:C.accent,fontSize:15,fontWeight:600,letterSpacing:".04em",marginBottom:20}}>Priser</p>
      <H size={1} style={{marginBottom:24,fontSize:"clamp(30px,5vw,44px)"}}>Selve søgningen er gratis.</H>
      <p style={{color:C.muted,fontSize:"clamp(17px,2vw,19px)",lineHeight:1.75,marginBottom:16}}>
        Du kan bruge {COMPANY_NAME} så meget du vil, uden at betale og uden at oprette dig.
        Du får to bilforslag, begrundelserne, ejerøkonomien og de færdige søgninger på Bilbasen.
      </p>
      <p style={{color:C.muted,fontSize:"clamp(17px,2vw,19px)",lineHeight:1.75,marginBottom:40}}>
        Vil du have et menneske til at gå skridtet videre, koster det herunder. Ikke abonnement,
        ikke binding — du betaler kun den ene gang, du bruger det.
      </p>
    </div>

    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:"26px 28px",marginBottom:22,
      display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:220}}>
        <h3 style={{fontFamily:DISPLAY,fontSize:23,fontWeight:550,color:C.text,marginBottom:7}}>Brug af siden</h3>
        <p style={{color:C.muted,fontSize:16,lineHeight:1.7}}>Fire bilforslag, begrundelser, ejerøkonomi, farver og søgninger på Bilbasen. Så mange gange du vil.</p>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontFamily:DISPLAY,fontSize:38,fontWeight:550,color:C.text,lineHeight:1}}>Gratis</div>
        <div style={{color:C.dim,fontSize:14.5,marginTop:6}}>altid</div>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:18,marginBottom:44}}>
      {SERVICES.filter(s=>s.price!=="Gratis").map(s=><ServiceCard key={s.id} s={s} onPick={onPick}/>)}
    </div>

    <div style={{maxWidth:"62ch"}}>
      <H size={3} style={{marginBottom:20}}>Godt at vide</H>
      {[["Du betaler først, når vi har svaret","Vi sender dig en opkrævning sammen med svaret. Er du ikke tilfreds, betaler du ikke."],
        ["Ingen binding","Der er ikke noget abonnement og ingen medlemskab. Du bruger det, når du har brug for det."],
        ["Vi tjener ikke på bilen","Vi får ikke provision fra forhandlere. Vores eneste indtægt er det, du betaler os direkte."]]
        .map(([t,d],i)=><div key={t} style={{padding:"20px 0",borderTop:`1px solid ${C.border}`}}>
          <div style={{color:C.text,fontSize:17,fontWeight:600,marginBottom:7}}>{t}</div>
          <p style={{color:C.muted,fontSize:16,lineHeight:1.7}}>{d}</p>
        </div>)}
    </div>

    <div style={{marginTop:44,paddingTop:32,borderTop:`1px solid ${C.border}`}}>
      <Btn size="lg" onClick={onStart}>Prøv det gratis</Btn>
    </div>
  </div>;
}

/* ═════════════════════════════════════════════════════════════
   KONTAKT
   ═════════════════════════════════════════════════════════════ */
function ContactPage() {
  const C = useC();
  const [f,setF] = useState({name:"",email:"",subject:"",message:""});
  const set = k => v => setF(x=>({...x,[k]:v}));
  const valid = f.name.trim() && /\S+@\S+\.\S+/.test(f.email) && f.message.trim();
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(f.subject||`Henvendelse fra ${f.name||"besøgende"}`)}&body=${encodeURIComponent(`${f.message}\n\n— ${f.name}\n${f.email}`)}`;
  return <div style={{animation:"fadeUp .3s ease",maxWidth:"60ch",marginLeft:"auto",marginRight:"auto",paddingTop:"clamp(20px,4vw,40px)"}}>
    <p style={{color:C.accent,fontSize:15,fontWeight:600,letterSpacing:".04em",marginBottom:20}}>Kontakt</p>
    <H size={1} style={{marginBottom:22,fontSize:"clamp(30px,5vw,44px)"}}>Skriv til os</H>
    <p style={{color:C.muted,fontSize:17.5,lineHeight:1.75,marginBottom:34}}>
      Der er ingen dumme spørgsmål. Vi svarer normalt inden for et par hverdage — eller du kan
      maile direkte til <a href={`mailto:${CONTACT_EMAIL}`} style={{color:C.accent,fontWeight:600,textDecoration:"underline"}}>{CONTACT_EMAIL}</a>.
    </p>
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"26px 24px"}}>
      <Field label="Dit navn"><TxtInput value={f.name} onChange={set("name")} placeholder="Fornavn og efternavn"/></Field>
      <Field label="Din e-mail"><TxtInput type="email" value={f.email} onChange={set("email")} placeholder="navn@eksempel.dk"/></Field>
      <Field label="Emne" hint="valgfrit"><TxtInput value={f.subject} onChange={set("subject")} placeholder="Hvad drejer det sig om?"/></Field>
      <Field label="Besked"><TextArea value={f.message} onChange={set("message")} rows={6} placeholder="Skriv løs…"/></Field>
      <Btn as="a" href={valid?mailto:undefined} full size="lg" onClick={e=>{if(!valid)e.preventDefault();}} style={{opacity:valid?1:.5}}>
        Åbn e-mail og send
      </Btn>
      <p style={{color:C.muted,fontSize:14.5,textAlign:"center",marginTop:13,lineHeight:1.6}}>
        Knappen åbner din egen mailapp med beskeden skrevet ind — du skal kun trykke “Send”.
      </p>
    </div>
  </div>;
}

/* ═════════════════════════════════════════════════════════════
   APP
   ═════════════════════════════════════════════════════════════ */
const NAV = [["finder","Find bil"],["pricing","Priser"],["about","Om os"],["contact","Kontakt"]];

function App() {
  const [themeId,setThemeId] = useState(()=>localStorage.getItem("af_theme")||"light");
  const [big,setBig] = useState(()=>localStorage.getItem("af_big")==="1");
  const C = THEMES[themeId]||THEMES.light;
  useEffect(()=>{localStorage.setItem("af_theme",themeId);document.body.style.background=C.bg;document.body.style.color=C.text;
    document.documentElement.style.colorScheme=themeId;},[themeId,C]);
  useEffect(()=>{localStorage.setItem("af_big",big?"1":"0");},[big]);

  const [page,setPage] = useState("landing");   // landing | finder | pricing | about | contact
  const [step,setStep] = useState(0);
  const [maxReached,setMaxReached] = useState(0);
  const [form,setForm] = useState({adults:"2",children:"0",childAges:"",region:"",budgetType:"kontant",budget:"",monthly:"",yearMin:"",kmMax:"",minHp:"",dailyKm:"",driveType:"",character:"",variantWish:"",bodies:[],fuels:[],brands:[],excludeBrands:[],priorities:[],transmission:"",towbar:""});
  const [showResults,setShowResults] = useState(false);
  const [summary,setSummary] = useState("");
  const [cards,setCards] = useState([null,null]);
  const [loading,setLoading] = useState([false,false]);
  const [failed,setFailed] = useState([false,false]);
  const [failMsg,setFailMsg] = useState(["",""]);
  const [error,setError] = useState("");
  const [excluded,setExcluded] = useState([[],[]]);
  const [lead,setLead] = useState(null);
  const set = k => v => setForm(f=>({...f,[k]:v}));

  const top = () => window.scrollTo({top:0,behavior:"smooth"});
  const go = p => { setPage(p); top(); };
  const goStep = i => { setShowResults(false); setStep(i); setMaxReached(m=>Math.max(m,i)); top(); };
  const next = () => { const n=Math.min(step+1,4); setStep(n); setMaxReached(m=>Math.max(m,n)); top(); };
  const startFinder = () => { setPage("finder"); setShowResults(false); setStep(0); top(); };
  const goHome = () => { setPage("landing"); top(); };

  const canNext = s => {
    if(s===0) return form.adults!=="" && form.children!=="";
    if(s===1) return !!(form.budget||form.monthly);
    if(s===2) return !!form.dailyKm;
    return true;
  };

  /* Forslag 1 hentes først og vises med det samme; de tre øvrige hentes
     derefter parallelt, hver med sin vinkel. Et kort der fejler eller kommer
     tilbage som en dublet FORSVINDER IKKE — pladsen bliver stående med en
     forklaring og en prøv-igen-knap, så man ikke sidder med to kort og undrer
     sig over hvor de andre to blev af. */
  async function fetchSlot(rank, avoid, avoidCar) {
    let car = await fetchOneCar(buildProfile(form, rank, avoid, avoidCar));
    return car;
  }

  async function runSearch(excl) {
    setShowResults(true); setMaxReached(5);
    setCards([null,null]);
    setLoading([true,true]);
    setFailed([false,false]);
    setFailMsg(["",""]);
    setError("");
    top();

    let first = null;
    try {
      first = await fetchSlot(1, excl[0], "");
      setCards(c=>[first,c[1]]);
      setSummary(`Ud fra jeres svar er ${first.brand} ${first.model} det bedste match — herunder ser I et bevidst anderledes alternativ.`);
    } catch(e) {
      setFailed(f=>[true,f[1]]);
      setFailMsg(m=>[e.hint||e.message||"",m[1]]);
    }
    setLoading(l=>[false,l[1]]);

    const firstName = first ? `${first.brand} ${first.model}` : "";
    const taken = new Set([carKey(first)].filter(Boolean));

    await Promise.all([2].map(async rank => {
      const idx = rank-1;
      const avoid = [...excl[idx], ...excl[0], firstName].filter(Boolean);
      try {
        let car = await fetchSlot(rank, avoid, firstName);
        // Samme bil som et kort vi allerede viser? Bed om en anden, én gang.
        if (taken.has(carKey(car))) {
          car = await fetchSlot(rank, [...avoid, `${car.brand} ${car.model}`], firstName);
        }
        if (taken.has(carKey(car))) throw new Error("Kun dubletter");
        taken.add(carKey(car));
        setCards(c=>c.map((v,i)=>i===idx?car:v));
      } catch(e) {
        setFailed(f=>f.map((v,i)=>i===idx?true:v));
        setFailMsg(m=>m.map((v,i)=>i===idx?(e.hint||e.message||""):v));
      } finally {
        setLoading(l=>l.map((v,i)=>i===idx?false:v));
      }
    }));
  }

  /* Prøv ét enkelt felt igen — bruges af knappen på et kort der fejlede */
  async function retrySlot(idx) {
    const others = cards.filter((c,i)=>i!==idx && c).map(c=>`${c.brand} ${c.model}`);
    setFailed(f=>f.map((v,i)=>i===idx?false:v));
    setLoading(l=>l.map((v,i)=>i===idx?true:v));
    try {
      const avoid = [...excluded[idx], ...others].filter(Boolean);
      const car = await fetchSlot(idx+1, avoid, others[0]||"");
      setCards(c=>c.map((v,i)=>i===idx?car:v));
    } catch(e) {
      setFailed(f=>f.map((v,i)=>i===idx?true:v));
      setFailMsg(m=>m.map((v,i)=>i===idx?(e.hint||e.message||""):v));
    }
    setLoading(l=>l.map((v,i)=>i===idx?false:v));
  }

  async function handleReject(idx) {
    const rejected = cards[idx] ? `${cards[idx].brand} ${cards[idx].model}` : "";
    const others = cards.filter((c,i)=>i!==idx && c).map(c=>`${c.brand} ${c.model}`);
    const newExcl = excluded.map((e,i)=>i===idx?[...e,rejected]:e);
    setExcluded(newExcl); setError("");
    setLoading(l=>l.map((v,i)=>i===idx?true:v));
    setCards(c=>c.map((v,i)=>i===idx?null:v));
    try {
      const avoid = [...newExcl[idx], ...others].filter(Boolean);
      let car = await fetchOneCar(buildProfile(form, idx+1, avoid, others[0]||""));
      // Kom den samme bil igen som et af de øvrige kort, så prøv én gang til
      if (others.includes(`${car.brand} ${car.model}`)) {
        car = await fetchOneCar(buildProfile(form, idx+1, [...avoid,`${car.brand} ${car.model}`], others[0]||""));
      }
      setCards(c=>c.map((v,i)=>i===idx?car:v));
    } catch { setFailed(f=>f.map((v,i)=>i===idx?true:v)); }
    setLoading(l=>l.map((v,i)=>i===idx?false:v));
  }

  const stepIdx = showResults ? 5 : step;
  const S = STEPS[stepIdx];
  const navBtn = (active) => ({background:"transparent",border:"none",color:active?C.accent:C.muted,fontSize:15.5,
    fontWeight:active?600:500,cursor:"pointer",padding:"10px 13px",minHeight:44,fontFamily:"inherit"});

  return (
    <ThemeCtx.Provider value={C}>
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,zoom:big?1.15:1,display:"flex",flexDirection:"column"}}>
      <header style={{borderBottom:`1px solid ${C.border}`,background:C.bg,position:"relative",zIndex:130}}>
        <div style={{maxWidth:SHELL,margin:"0 auto",padding:"14px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <button onClick={goHome} title="Til forsiden" aria-label={`${COMPANY_NAME} — til forsiden`}
            style={{display:"flex",alignItems:"baseline",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"6px 4px",minHeight:46,fontFamily:"inherit"}}>
            <span style={{fontFamily:DISPLAY,fontSize:26,fontWeight:550,color:C.text,letterSpacing:"-.02em"}}>{COMPANY_NAME}</span>
            <span aria-hidden="true" style={{width:6,height:6,borderRadius:"50%",background:C.accent,display:"inline-block"}}/>
          </button>
          <nav style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:2,flexWrap:"wrap"}}>
            {NAV.map(([p,label])=>
              <button key={p} onClick={()=>p==="finder"?startFinder():go(p)} style={navBtn(page===p)}>{label}</button>)}
            <button onClick={()=>setBig(b=>!b)} title="Større tekst" aria-pressed={big}
              style={{background:big?C.accentSoft:"transparent",border:`1px solid ${big?C.accentBorder:C.border2}`,borderRadius:999,color:big?C.accent:C.muted,fontSize:14,fontWeight:700,cursor:"pointer",padding:"9px 13px",minHeight:44,marginLeft:6,fontFamily:"inherit"}}>A+</button>
            <button onClick={()=>setThemeId(t=>t==="light"?"dark":"light")} title={themeId==="light"?"Skift til mørkt":"Skift til lyst"}
              style={{background:"transparent",border:`1px solid ${C.border2}`,borderRadius:999,color:C.muted,fontSize:14,cursor:"pointer",padding:"9px 13px",minHeight:44,fontFamily:"inherit"}}>{themeId==="light"?"☾":"☀"}</button>
          </nav>
        </div>
      </header>

      {page==="finder" && <Stepper step={stepIdx} maxReached={Math.max(maxReached, showResults?5:maxReached)} onGo={goStep}/>}

      <main style={{maxWidth:showResults&&page==="finder"?SHELL:900,margin:"0 auto",padding:"0 18px 90px",width:"100%",flex:1,transition:"max-width .2s"}}>
        {page==="landing" && <Landing onStart={startFinder} go={go}/>}
        {page==="about"   && <AboutPage onStart={startFinder} go={go}/>}
        {page==="pricing" && <PricingPage onStart={startFinder} onPick={s=>setLead(s)}/>}
        {page==="contact" && <ContactPage/>}

        {page==="finder" && !showResults && <>
          <div style={{margin:"26px 0 20px"}}>
            <p style={{color:C.accent,fontSize:14.5,fontWeight:600,letterSpacing:".04em",marginBottom:10}}>Trin {step+1} af 5</p>
            <H size={2} style={{marginBottom:8}}>{S.title}</H>
            <p style={{color:C.muted,fontSize:17.5}}>{S.sub}</p>
          </div>

          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"24px 22px 4px",animation:"fadeUp .3s ease"}}>
            {step===0 && <>
              <Field label="Antal voksne" required><SingleChips options={["1","2","3","4+"]} value={form.adults} onChange={set("adults")}/></Field>
              <Field label="Antal børn" required><SingleChips options={["0","1","2","3","4+"]} value={form.children} onChange={set("children")}/></Field>
              {form.children!=="0"&&form.children!=="" && <Field label="Børnenes aldre"><TxtInput value={form.childAges} onChange={set("childAges")} placeholder="F.eks. 3, 7, 12"/></Field>}
              <Field label="Hvor i landet bor I?"><SingleDropdown value={form.region} onChange={set("region")} options={REGIONS} placeholder="Vælg område"/></Field>
            </>}

            {step===1 && <>
              <Field label="Betalingsform" required><SingleChips options={["kontant","månedlig"]} value={form.budgetType} onChange={set("budgetType")}/></Field>
              {form.budgetType==="månedlig"
                ? <Field label="Månedlig ydelse" required><NumInput value={form.monthly} onChange={set("monthly")} placeholder="F.eks. 4500" suffix="kr./md."/></Field>
                : <Field label="Kontantbudget" required><NumInput value={form.budget} onChange={set("budget")} placeholder="F.eks. 350000" suffix="kr."/></Field>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
                <Field label="Tidligste årsmodel"><NumInput value={form.yearMin} onChange={set("yearMin")} placeholder="F.eks. 2018"/></Field>
                <Field label="Maks km-stand"><NumInput value={form.kmMax} onChange={set("kmMax")} placeholder="F.eks. 100000" suffix="km"/></Field>
              </div>
            </>}

            {step===2 && <>
              <Field label="Hvor mange km kører I om dagen?" required><NumInput value={form.dailyKm} onChange={set("dailyKm")} placeholder="F.eks. 40" suffix="km/dag"/></Field>
              <Field label="Hvor kører I mest?"><SingleChips options={["Primært by","Blandet","Primært motorvej"]} value={form.driveType} onChange={set("driveType")}/></Field>
            </>}

            {step===3 && <>
              <Field label="Karosseri" hint="vælg gerne flere"><BodyTypePicker value={form.bodies} onChange={set("bodies")}/></Field>
              <Field label="Drivmiddel" hint="vælg gerne flere"><MultiChips options={FUEL_TYPES} value={form.fuels} onChange={set("fuels")}/></Field>
              <Field label="Mærker I gerne vil have" hint="skriv eller vælg">
                <SearchableMultiSelect value={form.brands} onChange={set("brands")} options={BRANDS} placeholder="Skriv f.eks. “sko” for Skoda…"/>
              </Field>
              <Field label="Mærker I helst vil undgå">
                <SearchableMultiSelect value={form.excludeBrands} onChange={set("excludeBrands")} options={BRANDS} placeholder="Skriv et mærke…"/>
              </Field>
            </>}

            {step===4 && <>
              <Field label="Hvad betyder mest?" hint="vælg gerne flere i hver gruppe">
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {PRIORITY_GROUPS.map(([gruppe,items])=>
                    <div key={gruppe}>
                      <div style={{color:C.muted,fontSize:12.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>{gruppe}</div>
                      <MultiChips options={items} value={form.priorities} onChange={set("priorities")}/>
                    </div>)}
                </div>
              </Field>
              <Field label="Bilens karakter" help="Vælg “Sporty / performance”, hvis I leder efter sportsversioner som vRS, RS, GTI, ST, N eller AMG.">
                <SingleChips options={CHARACTERS} value={form.character} onChange={set("character")}/>
              </Field>
              <Field label="Bestemt motor eller udstyrsvariant?" help="Kender I betegnelsen, så skriv den — f.eks. “vRS”, “R.S. Line”, “GTI”, “AMG Line” eller “2.0 TDI 190”.">
                <TxtInput value={form.variantWish} onChange={set("variantWish")} placeholder="F.eks. vRS, RS, GTI, AMG…"/>
              </Field>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
                <Field label="Mindste motoreffekt"><NumInput value={form.minHp} onChange={set("minHp")} placeholder="F.eks. 230" suffix="hk"/></Field>
                <Field label="Gearkasse"><SingleChips options={["Automatgear","Manuel","Ligemeget"]} value={form.transmission} onChange={set("transmission")}/></Field>
              </div>
              <Field label="Anhængertræk?"><SingleChips options={["Ja, vigtigt","Rart at have","Nej tak"]} value={form.towbar} onChange={set("towbar")}/></Field>
            </>}
          </div>

          <div style={{position:"sticky",bottom:0,zIndex:110,background:C.bg,
            borderTop:`1px solid ${C.border}`,marginTop:20,padding:"14px 0 16px",
            display:"flex",justifyContent:"space-between",alignItems:"center",gap:13,flexWrap:"wrap"}}>
            {step>0 ? <Btn kind="ghost" onClick={()=>goStep(step-1)}>← Tilbage</Btn> : <span/>}
            {step<4
              ? <Btn onClick={next} disabled={!canNext(step)} size="lg">Næste →</Btn>
              : <Btn onClick={()=>runSearch([[],[]])} size="lg">Find vores bil</Btn>}
          </div>
          {!canNext(step) && <p style={{color:C.muted,fontSize:15,textAlign:"right",marginTop:4}}>Udfyld felterne markeret “skal udfyldes”.</p>}
        </>}

        {page==="finder" && showResults && <div style={{paddingTop:30}}><Results
          cards={cards} loading={loading} failed={failed} failMsg={failMsg} onRetry={retrySlot}
          form={form} summary={summary} onReject={handleReject}
          onPickService={s=>setLead(s)}
          onRefresh={()=>{setShowResults(false);setCards([null,null]);setFailed([false,false]);setSummary("");setExcluded([[],[]]);setStep(4);top();}}
        /></div>}

        {error && <p role="alert" style={{color:C.bad,fontSize:16,textAlign:"center",marginTop:20,background:C.surface,border:`1px solid ${C.accentBorder}`,borderRadius:14,padding:"14px 18px"}}>{error}</p>}
      </main>

      <footer style={{borderTop:`1px solid ${C.border}`,padding:"30px 18px 44px"}}>
        <div style={{maxWidth:SHELL,margin:"0 auto",display:"flex",gap:18,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:C.muted,fontSize:15}}>© {new Date().getFullYear()} {COMPANY_NAME} — uafhængig bilrådgivning · Kun Danmark</span>
          <span style={{marginLeft:"auto",display:"flex",gap:2,flexWrap:"wrap"}}>
            <button onClick={goHome} style={navBtn(page==="landing")}>Forside</button>
            {NAV.map(([p,label])=><button key={p} onClick={()=>p==="finder"?startFinder():go(p)} style={navBtn(page===p)}>{label}</button>)}
          </span>
        </div>
      </footer>

      {lead && <LeadDialog service={lead} form={form} cards={cards} excluded={excluded} onClose={()=>setLead(null)}/>}
    </div>
    </ThemeCtx.Provider>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
