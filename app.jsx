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

const BODY_TYPES = ["Hatchback","Sedan","Stationcar","SUV","MPV","Cabriolet","Pickup","Coupe"];
const FUEL_TYPES = ["Benzin","Diesel","El","Hybrid","Plugin-hybrid"];
const REGIONS = ["Hele Danmark","Sjælland","Fyn","Jylland","København og omegn","Aarhus","Odense"];
const PRIORITIES = ["Lavt brændstofforbrug","God gensalgsværdi","Pålidelig motor","Lave serviceomkostninger","Sikkerhed","Komfort","Stort bagagerum","Teknologi & skærme","Ladetid","Plads til familien","Lav forsikring","Firehjulstræk","Sporty køreoplevelse","Høj motoreffekt"];
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
const BB_BODY = {Hatchback:"Hatchback",Sedan:"Sedan",Stationcar:"Stationcar",Cabriolet:"Cabriolet",Pickup:"Pickup",MPV:"MPV",Coupe:"Coupe",SUV:"SUV"};
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
const THEMES = {
  light: {
    id:"light",
    bg:"#faf9f5", surface:"#ffffff", panel:"#f4f2ec", raised:"#ffffff",
    border:"#e9e5da", border2:"#d8d2c4",
    text:"#211f1b", muted:"#655f54", dim:"#8c8578",
    accent:"#b4552f", accentSoft:"#f7ece6", accentBorder:"#e3c0ae", onAccent:"#ffffff",
    good:"#3f6b48", bad:"#a33c2e", info:"#4a6572",
    shadow:"0 1px 2px rgba(45,38,28,.04), 0 10px 30px rgba(45,38,28,.05)",
    shadowLift:"0 2px 6px rgba(180,85,47,.08), 0 16px 44px rgba(180,85,47,.10)",
  },
  dark: {
    id:"dark",
    bg:"#181713", surface:"#211f1a", panel:"#282621", raised:"#2e2b25",
    border:"#33302a", border2:"#454138",
    text:"#f1ede3", muted:"#a8a094", dim:"#867e71",
    accent:"#e08a63", accentSoft:"#3a2a22", accentBorder:"#6b4a37", onAccent:"#1a1815",
    good:"#7fb389", bad:"#e08878", info:"#8fb0bd",
    shadow:"0 10px 32px rgba(0,0,0,.4)",
    shadowLift:"0 16px 48px rgba(224,138,99,.16)",
  },
};
const ThemeCtx = createContext(THEMES.light);
const useC = () => useContext(ThemeCtx);

const DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";

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
    `Særlige behov: ${f.extras||"ingen"}`,
  ];
  const hard = [];
  if ((f.brands||[]).length) hard.push(`Bilen SKAL være af et af disse mærker: ${f.brands.join(" eller ")}.`);
  if (f.variantWish) hard.push(`Brugeren har eksplicit bedt om varianten "${f.variantWish}" — anbefal en model der findes i netop den variant, og skriv den præcise variantbetegnelse i "variant" og "bilbasen_search_term".`);
  if (f.minHp) hard.push(`Motoren SKAL yde mindst ${f.minHp} hk.`);
  if (f.character==="Sporty / performance") hard.push(`Brugeren vil have en SPORTSLIG bil (f.eks. vRS, RS, GTI, ST, N, AMG, M-pakke, Cupra) — ikke en almindelig familiebil.`);
  if ((f.fuels||[]).length) hard.push(`Drivmiddel skal være: ${f.fuels.join(" eller ")}.`);
  if ((f.bodies||[]).length) hard.push(`Karosseri skal være: ${f.bodies.join(" eller ")}.`);
  if ((f.excludeBrands||[]).length) hard.push(`Må ALDRIG være: ${f.excludeBrands.join(", ")}.`);

  const rankTxt = rank===2
    ? `Dette er FORSLAG 2 (alternativet). Det SKAL være et markant anderledes valg end forslag 1 — vælg et andet mærke OG enten anden karosseriform eller andet drivmiddel. Forklar i "differs_from_primary" med én sætning hvad der konkret adskiller den fra ${avoidCar||"forslag 1"}.`
    : `Dette er FORSLAG 1 — det bedste samlede match.`;

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
/* Bilbasen-parametre bekræftet mod rigtige URL'er: pricefrom/priceto,
   yearfrom/yearto, mileageto, fuel (tal), cartypes (navn), hpfrom, free.
   includeleasing og includewithoutvehicleregistrationtax slås FRA, fordi
   leasingannoncer viser månedsydelser og afgiftsfrie biler viser priser uden
   registreringsafgift — begge dele ødelægger en søgning på prisinterval. */
function baseParams(form, car, priceLo, priceHi) {
  const p = new URLSearchParams();
  if (priceLo) p.set("pricefrom", priceLo);
  if (priceHi) p.set("priceto", priceHi);
  const [yf,yt] = yearBand(car||{}, form);
  if (yf) p.set("yearfrom", yf);
  if (yt) p.set("yearto", yt);
  if (num(form.kmMax)) p.set("mileageto", num(form.kmMax));
  if (num(form.minHp)) p.set("hpfrom", num(form.minHp));
  p.set("includeleasing", "false");
  p.set("includewithoutvehicleregistrationtax", "false");
  return p;
}
/* Er modelnavnet ét ord, kan det stå i stien (/skoda/octavia).
   Er det flere ord, er sti-formen usikker — så ryger modellen i fritekst. */
function modelPathAndText(car) {
  const raw = car.bilbasen_model_slug || slugify(car.model);
  const oneWord = raw && !raw.includes("_");
  return { path: oneWord ? raw : "", text: oneWord ? "" : (car.model||"") };
}
function buildBilbasenModelUrl(form, car, pct=5) {
  const bs = car.bilbasen_brand_slug || brandSlug(car.brand);
  const { path: ms, text: modelText } = modelPathAndText(car);
  const [lo,hi] = priceBand(car, form, pct);
  const p = baseParams(form, car, lo, hi);
  const fuels = (form.fuels||[]).length ? form.fuels : (car.fuel_type?[car.fuel_type]:[]);
  fuels.forEach(f=>{ if(BB_FUEL[f]) p.append("fuel", BB_FUEL[f]); });
  // Brugerens variantønske må kun bruges hvis bilen faktisk fås i den variant —
  // ellers ender et "vRS"-ønske som fritekst på en Tesla og giver nul resultater.
  const wish = form.variantWish && String(car.variant||"").toLowerCase().includes(form.variantWish.toLowerCase())
    ? form.variantWish : "";
  const term = [modelText, car.bilbasen_search_term || wish].filter(Boolean).join(" ").trim();
  if (term) p.set("free", term);
  return `${BILBASEN_BASE}/${bs}${ms?`/${ms}`:""}?${p.toString()}`;
}
function buildBilbasenBroadUrl(form, car) {
  const budget = num(form.budget) || (num(car&&car.price_used_dkk) ? Math.round(num(car.price_used_dkk)*1.1) : null);
  const p = baseParams(form, car, null, budget);
  const fuels = (form.fuels||[]).length ? form.fuels : (car&&car.fuel_type?[car.fuel_type]:[]);
  fuels.forEach(f=>{ if(BB_FUEL[f]) p.append("fuel", BB_FUEL[f]); });
  const bodies = (form.bodies||[]).length ? form.bodies : (car&&car.body_type?[car.body_type]:[]);
  bodies.forEach(b=>{ if(BB_BODY[b]) p.append("cartypes", BB_BODY[b]); });
  return `${BILBASEN_BASE}?${p.toString()}`;
}

async function fetchOneCar(profile) {
  const res = await fetch("/api/mistral", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) throw new Error("API fejl " + res.status);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Intet JSON");
  const parsed = JSON.parse(text.slice(s, e+1));
  if (!parsed.brand) throw new Error("Mangler brand");
  return parsed;
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
function Field({label,hint,children,help}) {
  const C = useC();
  return <div style={{marginBottom:28}}>
    <div style={{marginBottom:10}}>
      <span style={{color:C.text,fontSize:16.5,fontWeight:600}}>{label}</span>
      {hint && <span style={{color:C.muted,fontSize:14.5,marginLeft:10}}>{hint}</span>}
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
function Rule() { const C=useC(); return <hr style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"clamp(48px,8vw,84px) 0"}}/>; }

/* ═════════════════════════════════════════════════════════════
   STEP-BJÆLKE — altid synlig, centreret, klikbar tilbage
   ═════════════════════════════════════════════════════════════ */
function Stepper({step,maxReached,onGo}) {
  const C = useC();
  return <nav aria-label="Trin i søgningen" style={{position:"sticky",top:0,zIndex:120,background:C.surface,borderBottom:`1px solid ${C.border}`}}>
    <div style={{maxWidth:900,margin:"0 auto",padding:"14px 14px 12px"}}>
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
/* Silhuetter, så en stationcar ikke tegnes som en SUV. */
const SILHOUETTES = {
  low: {
    body: "M10,74 L10,58 Q10,52 18,50 L50,44 L70,26 Q75,21 86,21 L128,21 Q139,21 146,27 L166,48 L182,52 Q190,54 190,61 L190,74 Z",
    glass:"M58,45 L76,29 Q78,27 84,27 L98,27 L98,45 Z M104,27 L126,27 Q132,27 136,31 L149,45 L104,45 Z",
    wheels:[[50,74],[152,74]],
  },
  tall: {
    body: "M10,74 L10,52 Q10,46 18,44 L46,38 L62,17 Q67,12 78,12 L136,12 Q147,12 153,19 L170,42 L182,46 Q190,48 190,55 L190,74 Z",
    glass:"M54,39 L68,20 Q70,18 76,18 L98,18 L98,39 Z M104,18 L134,18 Q140,18 144,23 L155,39 L104,39 Z",
    wheels:[[52,74],[150,74]],
  },
  pickup: {
    body: "M10,74 L10,56 Q10,50 18,48 L42,44 L58,22 Q63,17 74,17 L110,17 Q118,17 122,24 L134,48 L190,48 Q196,48 196,54 L196,74 Z",
    glass:"M52,45 L64,25 Q66,23 72,23 L88,23 L88,45 Z M94,23 L108,23 Q113,23 116,28 L124,45 L94,45 Z",
    wheels:[[50,74],[158,74]],
  },
};
const bodyShape = b => ["SUV","MPV"].includes(b) ? "tall" : b==="Pickup" ? "pickup" : "low";

function CarSilhouette({body,paint,glass,wheel,style}) {
  const shape = SILHOUETTES[bodyShape(body)];
  return <svg viewBox="0 0 206 92" role="img" aria-label={`Illustration af ${body||"bil"}`} style={style}>
    <path d={shape.body} fill={paint}/>
    <path d={shape.glass} fill={glass} opacity=".55"/>
    {shape.wheels.map(([cx,cy],i)=><g key={i}>
      <circle cx={cx} cy={cy} r="13" fill={wheel} opacity=".88"/>
      <circle cx={cx} cy={cy} r="5.5" fill={glass}/>
    </g>)}
  </svg>;
}

function CarPhoto({car,tint}) {
  const C = useC();
  const url = carImageUrl(car);
  const [failed,setFailed] = useState(false);
  const box = {height:200,background:C.panel,borderRadius:14,border:`1px solid ${C.border}`,
    display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",marginBottom:18,position:"relative"};

  if (url && !failed) return <div style={box}>
    <img src={url} alt={`${car.brand} ${car.model}`} loading="lazy" onError={()=>setFailed(true)}
      style={{width:"100%",height:"100%",objectFit:"contain",padding:12}}/>
  </div>;

  return <div style={box}>
    <CarSilhouette body={car.body_type} paint={tint||C.accent} glass={C.panel} wheel={C.text}
      style={{width:"88%",height:"88%"}}/>
    <span style={{position:"absolute",bottom:9,right:14,color:C.dim,fontSize:12.5,fontWeight:500}}>{car.body_type||""}</span>
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

function CompareBox({a,b}) {
  const C = useC();
  if(!a||!b) return null;
  const rows = [
    ["Bil", `${a.brand} ${a.model}`, `${b.brand} ${b.model}`],
    ["Variant", a.variant||"–", b.variant||"–"],
    ["Pris brugt", fmtDKK(num(a.price_used_dkk)), fmtDKK(num(b.price_used_dkk))],
    ["Drivmiddel", a.fuel_type||"–", b.fuel_type||"–"],
    ["Karosseri", a.body_type||"–", b.body_type||"–"],
    ["Effekt", a.hp?`${a.hp} hk`:"–", b.hp?`${b.hp} hk`:"–"],
    ["Brændstof/md.", fmtDKK(num(a.fuel_cost_monthly)), fmtDKK(num(b.fuel_cost_monthly))],
    ["Værdi efter 8 år", fmtDKK(num(a.resale?.y8)), fmtDKK(num(b.resale?.y8))],
  ];
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"22px",marginTop:16}}>
    <H size={3} style={{marginBottom:6}}>Forskellen på de to</H>
    {b.differs_from_primary && <p style={{color:C.muted,fontSize:16,lineHeight:1.65,marginBottom:14,maxWidth:"62ch"}}>{b.differs_from_primary}</p>}
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:15.5,minWidth:420}}>
        <thead><tr>
          <th style={{textAlign:"left",padding:"8px 10px"}}></th>
          <th style={{textAlign:"left",padding:"8px 10px",color:C.accent,fontSize:13.5,fontWeight:700}}>Bedste match</th>
          <th style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontSize:13.5,fontWeight:700}}>Alternativ</th>
        </tr></thead>
        <tbody>
          {rows.map(([l,x,y],i)=>{
            const same = String(x)===String(y);
            return <tr key={l} style={{background:i%2?C.panel:"transparent"}}>
              <td style={{padding:"10px",color:C.muted,fontWeight:500,whiteSpace:"nowrap"}}>{l}</td>
              <td style={{padding:"10px",color:same?C.muted:C.text,fontWeight:same?400:650}}>{x}</td>
              <td style={{padding:"10px",color:same?C.muted:C.text,fontWeight:same?400:650}}>{y}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}

function CarCard({car,form,onReject,isAlt,loading}) {
  const C = useC();
  const [expanded,setExpanded]=useState(false);
  const [pct,setPct]=useState(5);
  const [color,setColor]=useState(null);
  if(loading) return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,padding:"48px 24px",textAlign:"center"}}>
    <div style={{display:"inline-block",width:26,height:26,border:`2.5px solid ${C.accentSoft}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    <div style={{color:C.muted,fontSize:15.5,marginTop:15}}>Finder {isAlt?"et alternativ":"det bedste match"}…</div>
  </div>;
  if(!car) return null;
  const price = num(car.price_used_dkk);
  const y8 = num(car.resale?.y8);
  const loss8 = (price!==null&&y8!==null) ? price-y8 : null;
  const [lo,hi] = priceBand(car, form, pct);
  const pros = Array.isArray(car.pros)?car.pros:[], cons = Array.isArray(car.cons)?car.cons:[];

  return <article style={{background:C.surface,border:`1px solid ${isAlt?C.border:C.accentBorder}`,borderRadius:18,overflow:"hidden",position:"relative",boxShadow:isAlt?C.shadow:C.shadowLift,animation:"fadeUp .35s ease"}}>
    <div style={{background:isAlt?C.panel:C.accentSoft,padding:"12px 18px",borderBottom:`1px solid ${isAlt?C.border:C.accentBorder}`,display:"flex",alignItems:"center",gap:11,flexWrap:"wrap"}}>
      <span style={{color:isAlt?C.muted:C.accent,fontSize:13,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase"}}>{isAlt?"Alternativ":"Bedste match"}</span>
      <span title="Forslaget er sammensat af vores AI ud fra dine svar" style={{background:C.surface,border:`1px solid ${C.border2}`,color:C.muted,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,letterSpacing:".07em"}}>AI-ANALYSE</span>
      {onReject && <button onClick={onReject} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,borderRadius:999,padding:"7px 14px",fontSize:13.5,fontWeight:500,cursor:"pointer",minHeight:38,fontFamily:"inherit"}}>Vis et andet</button>}
    </div>

    <div style={{padding:"22px 20px 0"}}>
      <CarPhoto car={car} tint={color?color.hex:null}/>
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
        <div style={{color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:".09em",fontWeight:700,marginBottom:9}}>Søg på Bilbasen med præcis dette</div>
        <div style={{color:C.text,fontSize:15.5,lineHeight:1.75,marginBottom:12}}>
          {car.brand} {car.model}{car.variant?` ${car.variant}`:""} · årgang {(yearBand(car,form)[0]||"?")}{yearBand(car,form)[1]?`–${yearBand(car,form)[1]}`:""} · {(lo&&hi)?`${fmtDKK(lo)} – ${fmtDKK(hi)}`:"pris efter budget"}
          {num(form.kmMax)?` · maks ${new Intl.NumberFormat("da-DK").format(num(form.kmMax))} km`:""}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:14}}>
          <span style={{color:C.muted,fontSize:14.5}}>Prisspænd:</span>
          {[1,5,10,20].map(p=><button key={p} onClick={()=>setPct(p)} style={{padding:"7px 14px",minHeight:40,borderRadius:999,border:`1.5px solid ${pct===p?C.accent:C.border2}`,background:pct===p?C.accentSoft:C.surface,color:pct===p?C.accent:C.muted,fontSize:14,fontWeight:pct===p?700:500,cursor:"pointer",fontFamily:"inherit"}}>±{p}%</button>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Btn as="a" href={buildBilbasenModelUrl(form,car,pct)} target="_blank" rel="noopener noreferrer" full>
            Se præcis denne bil på Bilbasen →
          </Btn>
          <Btn as="a" href={buildBilbasenBroadUrl(form,car)} target="_blank" rel="noopener noreferrer" kind="ghost" size="sm" full>
            Se lignende {car.fuel_type||""}-biler i samme klasse →
          </Btn>
        </div>
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
    `Særlige behov: ${f.extras||"–"}`,
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
    summarizeCar(cards[0],"Bedste match"),
    summarizeCar(cards[1],"Alternativ"),
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

function Results({cards,loadingA,loadingB,form,onReject,onRefresh,summary,onPickService}) {
  const C = useC();
  return <div style={{animation:"fadeUp .4s ease"}}>
    {summary && <div style={{background:C.accentSoft,border:`1px solid ${C.accentBorder}`,borderRadius:16,padding:"18px 20px",marginBottom:24}}>
      <div style={{color:C.muted,fontSize:12,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",marginBottom:7}}>Din profil</div>
      <p style={{color:C.text,fontSize:16.5,lineHeight:1.65}}>{summary}</p>
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <CarCard car={cards[0]} form={form} isAlt={false} loading={loadingA} onReject={!loadingA?()=>onReject(0):null}/>
      <CarCard car={cards[1]} form={form} isAlt={true}  loading={loadingB} onReject={!loadingB?()=>onReject(1):null}/>
    </div>
    {!loadingA && !loadingB && <CompareBox a={cards[0]} b={cards[1]}/>}
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
    ["Få to forslag","Ét der passer bedst, og ét der bevidst er anderledes. Til hver bil forklarer vi hvorfor, hvad den koster at eje, og hvad FDM siger om den."],
    ["Se dem til salg","Vi bygger søgningen på Bilbasen for dig — rigtigt mærke, rigtig årgang, rigtigt prisleje. Du skal bare klikke."],
  ];
  return <div style={{animation:"fadeUp .4s ease"}}>
    <section style={{padding:"clamp(40px,7vw,84px) 0 clamp(30px,5vw,54px)",maxWidth:"70ch"}}>
      <p style={{color:C.accent,fontSize:15,fontWeight:600,letterSpacing:".04em",marginBottom:20}}>Uafhængig bilrådgivning · Danmark</p>
      <H size={1} style={{marginBottom:24}}>Den rigtige bil.<br/>Uden at være bilnørd.</H>
      <p style={{color:C.muted,fontSize:"clamp(17px,2.2vw,20px)",lineHeight:1.65,marginBottom:34,maxWidth:"54ch"}}>
        Vi spørger om din hverdag — ikke om hestekræfter og motorkoder — og finder to biler,
        der passer til den. Du får at vide hvorfor, hvad de koster at eje, og hvor de er til salg.
      </p>
      <div style={{display:"flex",gap:13,flexWrap:"wrap",alignItems:"center"}}>
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
      <H size={2} style={{marginBottom:12}}>Sådan foregår det</H>
      <p style={{color:C.muted,fontSize:17,lineHeight:1.7,marginBottom:40,maxWidth:"56ch"}}>
        Tre trin. Du kan altid gå tilbage og rette undervejs.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
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
      </div>
    </section>

    <Rule/>

    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:"clamp(24px,4vw,44px)"}}>
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
  return <article style={{animation:"fadeUp .3s ease",maxWidth:"66ch"}}>
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
    <div style={{maxWidth:"58ch",paddingTop:"clamp(20px,4vw,40px)"}}>
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
        <p style={{color:C.muted,fontSize:16,lineHeight:1.7}}>Bilforslag, begrundelser, ejerøkonomi, farver og søgninger på Bilbasen. Så mange gange du vil.</p>
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
  return <div style={{animation:"fadeUp .3s ease",maxWidth:"58ch",paddingTop:"clamp(20px,4vw,40px)"}}>
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
  const [form,setForm] = useState({adults:"2",children:"0",childAges:"",region:"",budgetType:"kontant",budget:"",monthly:"",yearMin:"",kmMax:"",minHp:"",dailyKm:"",driveType:"",extras:"",character:"",variantWish:"",bodies:[],fuels:[],brands:[],excludeBrands:[],priorities:[],transmission:"",towbar:""});
  const [showResults,setShowResults] = useState(false);
  const [summary,setSummary] = useState("");
  const [cards,setCards] = useState([null,null]);
  const [loadingA,setLoadingA] = useState(false);
  const [loadingB,setLoadingB] = useState(false);
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

  /* Sekventiel søgning, så alternativet kender forslag 1 og ikke gentager det */
  async function runSearch(excl) {
    setShowResults(true); setMaxReached(5);
    setCards([null,null]); setLoadingA(true); setLoadingB(true); setError("");
    top();
    let first = null;
    try {
      first = await fetchOneCar(buildProfile(form,1,excl[0]));
      setCards(c=>[first,c[1]]);
      setSummary(`Ud fra jeres svar er ${first.brand} ${first.model} det bedste match — herunder ser I også et bevidst anderledes alternativ.`);
    } catch(e) { setError("Vi kunne ikke hente en anbefaling lige nu. Prøv igen om et øjeblik."); }
    setLoadingA(false);

    const firstName = first ? `${first.brand} ${first.model}` : "";
    try {
      const avoid = [...excl[1], ...excl[0], firstName].filter(Boolean);
      let second = await fetchOneCar(buildProfile(form,2,avoid,firstName));
      if (first && carKey(second)===carKey(first)) {          // samme bil — prøv én gang til
        second = await fetchOneCar(buildProfile(form,2,[...avoid,`${second.brand} ${second.model}`],firstName));
      }
      if (first && carKey(second)===carKey(first)) {
        setCards(c=>[c[0],null]);
        setError("Vi kunne ikke finde et reelt anderledes alternativ til din profil — prøv at udvide budget, mærker eller karosseri.");
      } else {
        setCards(c=>[c[0],second]);
      }
    } catch(e) { setError(prev => prev || "Vi kunne ikke hente det alternative forslag. Prøv igen om et øjeblik."); }
    setLoadingB(false);
  }

  async function handleReject(idx) {
    const rejected = cards[idx] ? `${cards[idx].brand} ${cards[idx].model}` : "";
    const other = cards[idx===0?1:0];
    const newExcl = excluded.map((e,i)=>i===idx?[...e,rejected]:e);
    setExcluded(newExcl); setError("");
    if(idx===0){setLoadingA(true);setCards(c=>[null,c[1]]);} else {setLoadingB(true);setCards(c=>[c[0],null]);}
    try {
      const avoid = [...newExcl[idx], other?`${other.brand} ${other.model}`:""].filter(Boolean);
      let car = await fetchOneCar(buildProfile(form, idx===0?1:2, avoid, other?`${other.brand} ${other.model}`:""));
      if (other && carKey(car)===carKey(other)) {
        car = await fetchOneCar(buildProfile(form, idx===0?1:2, [...avoid,`${car.brand} ${car.model}`], `${other.brand} ${other.model}`));
      }
      if(idx===0) setCards(c=>[car,c[1]]); else setCards(c=>[c[0],car]);
    } catch { setError("Vi kunne ikke hente et nyt forslag. Prøv igen om et øjeblik."); }
    if(idx===0) setLoadingA(false); else setLoadingB(false);
  }

  const stepIdx = showResults ? 5 : step;
  const S = STEPS[stepIdx];
  const navBtn = (active) => ({background:"transparent",border:"none",color:active?C.accent:C.muted,fontSize:15.5,
    fontWeight:active?600:500,cursor:"pointer",padding:"10px 13px",minHeight:44,fontFamily:"inherit"});

  return (
    <ThemeCtx.Provider value={C}>
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,zoom:big?1.15:1,display:"flex",flexDirection:"column"}}>
      <header style={{borderBottom:`1px solid ${C.border}`,background:C.bg,position:"relative",zIndex:130}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"14px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
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

      <main style={{maxWidth:900,margin:"0 auto",padding:"0 18px 90px",width:"100%",flex:1}}>
        {page==="landing" && <Landing onStart={startFinder} go={go}/>}
        {page==="about"   && <AboutPage onStart={startFinder} go={go}/>}
        {page==="pricing" && <PricingPage onStart={startFinder} onPick={s=>setLead(s)}/>}
        {page==="contact" && <ContactPage/>}

        {page==="finder" && !showResults && <>
          <div style={{margin:"32px 0 26px"}}>
            <p style={{color:C.accent,fontSize:14.5,fontWeight:600,letterSpacing:".04em",marginBottom:10}}>Trin {step+1} af 5</p>
            <H size={2} style={{marginBottom:8}}>{S.title}</H>
            <p style={{color:C.muted,fontSize:17.5}}>{S.sub}</p>
          </div>

          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"28px 24px 6px",animation:"fadeUp .3s ease"}}>
            {step===0 && <>
              <Field label="Antal voksne"><SingleChips options={["1","2","3","4+"]} value={form.adults} onChange={set("adults")}/></Field>
              <Field label="Antal børn"><SingleChips options={["0","1","2","3","4+"]} value={form.children} onChange={set("children")}/></Field>
              {form.children!=="0"&&form.children!=="" && <Field label="Børnenes aldre" hint="valgfrit"><TxtInput value={form.childAges} onChange={set("childAges")} placeholder="F.eks. 3, 7, 12"/></Field>}
              <Field label="Hvor i landet bor I?"><SingleDropdown value={form.region} onChange={set("region")} options={REGIONS} placeholder="Vælg område"/></Field>
            </>}

            {step===1 && <>
              <Field label="Betalingsform"><SingleChips options={["kontant","månedlig"]} value={form.budgetType} onChange={set("budgetType")}/></Field>
              {form.budgetType==="månedlig"
                ? <Field label="Månedlig ydelse"><NumInput value={form.monthly} onChange={set("monthly")} placeholder="F.eks. 4500" suffix="kr./md."/></Field>
                : <Field label="Kontantbudget"><NumInput value={form.budget} onChange={set("budget")} placeholder="F.eks. 350000" suffix="kr."/></Field>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:18}}>
                <Field label="Tidligste årsmodel" hint="valgfrit"><NumInput value={form.yearMin} onChange={set("yearMin")} placeholder="F.eks. 2018"/></Field>
                <Field label="Maks km-stand" hint="valgfrit"><NumInput value={form.kmMax} onChange={set("kmMax")} placeholder="F.eks. 100000" suffix="km"/></Field>
              </div>
            </>}

            {step===2 && <>
              <Field label="Hvor mange km kører I om dagen?"><NumInput value={form.dailyKm} onChange={set("dailyKm")} placeholder="F.eks. 40" suffix="km/dag"/></Field>
              <Field label="Hvor kører I mest?"><SingleChips options={["Primært by","Blandet","Primært motorvej"]} value={form.driveType} onChange={set("driveType")}/></Field>
              <Field label="Særlige behov" hint="valgfrit"><TxtInput value={form.extras} onChange={set("extras")} placeholder="Anhænger, barnevogn, hunde…"/></Field>
            </>}

            {step===3 && <>
              <Field label="Karosseri" hint="vælg gerne flere"><MultiChips options={BODY_TYPES} value={form.bodies} onChange={set("bodies")}/></Field>
              <Field label="Drivmiddel" hint="vælg gerne flere"><MultiChips options={FUEL_TYPES} value={form.fuels} onChange={set("fuels")}/></Field>
              <Field label="Mærker I gerne vil have" hint="skriv eller vælg" help="Skriv de første bogstaver, så finder vi mærket — alle mærker på det danske marked er med.">
                <SearchableMultiSelect value={form.brands} onChange={set("brands")} options={BRANDS} placeholder="Skriv f.eks. “sko” for Skoda…"/>
              </Field>
              <Field label="Mærker I helst vil undgå" hint="valgfrit">
                <SearchableMultiSelect value={form.excludeBrands} onChange={set("excludeBrands")} options={BRANDS} placeholder="Skriv et mærke…"/>
              </Field>
            </>}

            {step===4 && <>
              <Field label="Hvad betyder mest?" hint="vælg gerne flere"><MultiChips options={PRIORITIES} value={form.priorities} onChange={set("priorities")}/></Field>
              <Field label="Bilens karakter" hint="valgfrit" help="Vælg “Sporty / performance”, hvis I leder efter sportsversioner som vRS, RS, GTI, ST, N eller AMG.">
                <SingleChips options={CHARACTERS} value={form.character} onChange={set("character")}/>
              </Field>
              <Field label="Bestemt motor eller udstyrsvariant?" hint="valgfrit" help="Kender I betegnelsen, så skriv den — f.eks. “vRS”, “R.S. Line”, “GTI”, “AMG Line” eller “2.0 TDI 190”.">
                <TxtInput value={form.variantWish} onChange={set("variantWish")} placeholder="F.eks. vRS, RS, GTI, AMG…"/>
              </Field>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:18}}>
                <Field label="Mindste motoreffekt" hint="valgfrit"><NumInput value={form.minHp} onChange={set("minHp")} placeholder="F.eks. 230" suffix="hk"/></Field>
                <Field label="Gearkasse" hint="valgfrit"><SingleChips options={["Automatgear","Manuel","Ligemeget"]} value={form.transmission} onChange={set("transmission")}/></Field>
              </div>
              <Field label="Anhængertræk?" hint="valgfrit"><SingleChips options={["Ja, vigtigt","Rart at have","Nej tak"]} value={form.towbar} onChange={set("towbar")}/></Field>
            </>}
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:28,gap:13,flexWrap:"wrap"}}>
            {step>0 ? <Btn kind="ghost" onClick={()=>goStep(step-1)}>← Tilbage</Btn> : <span/>}
            {step<4
              ? <Btn onClick={next} disabled={!canNext(step)} size="lg">Næste →</Btn>
              : <Btn onClick={()=>runSearch([[],[]])} size="lg">Find vores bil</Btn>}
          </div>
          {!canNext(step) && <p style={{color:C.muted,fontSize:15,textAlign:"right",marginTop:11}}>Udfyld felterne ovenfor for at komme videre.</p>}
        </>}

        {page==="finder" && showResults && <div style={{paddingTop:30}}><Results
          cards={cards} loadingA={loadingA} loadingB={loadingB}
          form={form} summary={summary} onReject={handleReject}
          onPickService={s=>setLead(s)}
          onRefresh={()=>{setShowResults(false);setCards([null,null]);setSummary("");setExcluded([[],[]]);setStep(4);top();}}
        /></div>}

        {error && <p role="alert" style={{color:C.bad,fontSize:16,textAlign:"center",marginTop:20,background:C.surface,border:`1px solid ${C.accentBorder}`,borderRadius:14,padding:"14px 18px"}}>{error}</p>}
      </main>

      <footer style={{borderTop:`1px solid ${C.border}`,padding:"30px 18px 44px"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",gap:18,flexWrap:"wrap",alignItems:"center"}}>
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
