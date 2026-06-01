import { useState, useRef, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────
const BRANDS = ["Audi","BMW","Citroën","Dacia","Fiat","Ford","Honda","Hyundai","Kia","Mazda","Mercedes-Benz","Mini","Nissan","Opel","Peugeot","Renault","Seat","Skoda","Tesla","Toyota","Volkswagen","Volvo","Polestar","Cupra","MG"];
const BODY_TYPES = ["Hatchback","Sedan","Stationcar","SUV","MPV","Cabriolet","Pickup","Coupe"];
const FUEL_TYPES = ["Benzin","Diesel","El","Hybrid","Plugin-hybrid"];
const REGIONS = ["Hele Danmark","Sjælland","Fyn","Jylland","København og omegn","Aarhus","Odense"];
const PRIORITIES = ["Lavt brændstofforbrug","God gensalgsværdi","Pålidelig motor","Lave serviceomkostninger","Sikkerhed","Komfort","Stor bagagerum","Teknologi & skærme","Ladetid","Plads til familien","Lav forsikring","Firehjulstræk"];
const STEPS = [
  { id:"family", label:"Familie", icon:"👨‍👩‍👧" },
  { id:"economy", label:"Økonomi", icon:"💰" },
  { id:"usage", label:"Brug", icon:"🛣️" },
  { id:"type", label:"Biltype", icon:"🚗" },
  { id:"prefs", label:"Ønsker", icon:"⭐" },
  { id:"results", label:"Resultater", icon:"✨" },
];

// Bilbasen fuel codes
const BB_FUEL = { Benzin:"1", Diesel:"2", Hybrid:"3", "Plugin-hybrid":"4", El:"5" };
// Bilbasen body codes
const BB_BODY = { Hatchback:"1", Sedan:"2", Stationcar:"4", Cabriolet:"5", Pickup:"7", MPV:"8", Coupe:"9", SUV:"16" };
// Brand slugs for Bilbasen
const BB_BRAND_SLUG = {
  "Audi":"audi","BMW":"bmw","Citroën":"citroen","Dacia":"dacia","Fiat":"fiat",
  "Ford":"ford","Honda":"honda","Hyundai":"hyundai","Kia":"kia","Mazda":"mazda",
  "Mercedes-Benz":"mercedes-benz","Mini":"mini","Nissan":"nissan","Opel":"opel",
  "Peugeot":"peugeot","Renault":"renault","Seat":"seat","Skoda":"skoda",
  "Tesla":"tesla","Toyota":"toyota","Volkswagen":"volkswagen","Volvo":"volvo",
  "Polestar":"polestar","Cupra":"cupra","MG":"mg"
};

const fmtDKK = n => new Intl.NumberFormat("da-DK").format(Math.round(n)) + " kr.";
const C = {
  bg:"#07090f", surface:"#0d1117", border:"#161b22", border2:"#21262d",
  gold:"#e3b96a", goldDim:"#e3b96a18", goldBorder:"#e3b96a44",
  text:"#e6edf3", muted:"#8b949e", dim:"#30363d",
  green:"#3fb950", red:"#f85149", teal:"#58a6ff",
};

// ─── Bilbasen URL builder (hardcoded, precise) ────────────────
function buildBilbasenUrl(form, car) {
  const p = new URLSearchParams();
  // Price from form
  if (form.budget) p.set("PriceTo", form.budget);
  // Year from form or car
  const yearFrom = form.yearMin || (car?.year_range ? car.year_range.split("-")[0] : "");
  if (yearFrom) p.set("YearFrom", yearFrom);
  // KM from form
  if (form.kmMax) p.set("MileageTo", form.kmMax);
  // Fuel from form selection or car
  const fuelTypes = form.fuels?.length ? form.fuels : (car?.fuel_type ? [car.fuel_type] : []);
  fuelTypes.forEach(f => { if (BB_FUEL[f]) p.append("fuel", BB_FUEL[f]); });
  // Body from form
  (form.bodies || []).forEach(b => { if (BB_BODY[b]) p.append("BodyType", BB_BODY[b]); });
  return `https://www.bilbasen.dk/brugt/bil?${p.toString()}`;
}

function buildBilbasenModelUrl(form, car) {
  const brandSlug = car.bilbasen_brand_slug || BB_BRAND_SLUG[car.brand] || car.brand.toLowerCase().replace(/\s+/g,"-").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/å/g,"aa");
  const modelSlug = car.bilbasen_model_slug || car.model.toLowerCase().replace(/\s+/g,"-");
  const p = new URLSearchParams();
  if (form.budget) p.set("PriceTo", form.budget);
  const yearFrom = form.yearMin || (car.year_range ? car.year_range.split("-")[0] : "");
  if (yearFrom) p.set("YearFrom", yearFrom);
  if (form.kmMax) p.set("MileageTo", form.kmMax);
  const fuelTypes = form.fuels?.length ? form.fuels : (car.fuel_type ? [car.fuel_type] : []);
  fuelTypes.forEach(f => { if (BB_FUEL[f]) p.append("fuel", BB_FUEL[f]); });
  return `https://www.bilbasen.dk/brugt/bil/${brandSlug}/${modelSlug}?${p.toString()}`;
}

// ─── API — parallel fetch of 2 cars ──────────────────────────
const SYSTEM_ONE = `Du er Danmarks bedste uafhængige bilrådgiver.

Returner KUN ét JSON-objekt for ÉN bilanbefaling. Ingen tekst før/efter, ingen backticks.

{
  "brand": "Toyota",
  "model": "RAV4",
  "variant": "2.5 Hybrid Active",
  "year_range": "2020-2023",
  "short_why": ["Præcis 3 korte punkter", "Maks 8 ord per punkt", "Direkte og konkrete"],
  "long_why": "2-3 sætninger der uddyber valget specifikt for denne familie.",
  "price_new_dkk": 450000,
  "price_used_dkk": 310000,
  "fuel_type": "Hybrid",
  "fuel_cost_monthly": 850,
  "resale": {"y1":285000,"y2":265000,"y3":248000,"y4":232000,"y5":218000,"y6":205000,"y7":193000,"y8":182000},
  "pros": ["Meget lavt brændstofforbrug","Exceptionel pålidelig","God familieplads"],
  "cons": ["Ikke billigst i klassen","Lidt kedelig at køre"],
  "safety_rating": 5,
  "reliability": "Meget høj",
  "bilbasen_brand_slug": "toyota",
  "bilbasen_model_slug": "rav4"
}

short_why: præcis 3 strings i array.
Resale: realistiske danske markedspriser — price_used_dkk > y1 > y2 > ... > y8.
Svar KUN med JSON.`;

function buildProfile(f, rank, exclude) {
  return `Familie: ${f.adults} voksne, ${f.children} børn${f.childAges ? ` (${f.childAges})` : ""}
Budget: ${f.budgetType==="kontant" ? fmtDKK(f.budget)+" kontant" : fmtDKK(f.monthly)+"/md"}
Daglig km: ${f.dailyKm}, Kørsel: ${f.driveType||"blandet"}
Drivmiddel: ${(f.fuels||[]).join(", ")||"ingen pref"}
Karosseri: ${(f.bodies||[]).join(", ")||"ingen pref"}
Foretrukne mærker: ${(f.brands||[]).join(", ")||"ingen pref"}
Uønskede mærker: ${[...(f.excludeBrands||[]), ...(exclude||[])].join(", ")||"ingen"}
År fra: ${f.yearMin||"ingen"}, Max km-stand: ${f.kmMax||"ingen"}
Prioriteter: ${(f.priorities||[]).join(", ")||"ingen"}
Særligt: ${f.extras||"ingen"}
${rank===2 ? "Giv et ALTERNATIVT forslag — en anden biltype eller segment end det mest oplagte." : "Giv det BEDSTE matchende forslag."}
Undgå disse modeller: ${(exclude||[]).join(", ")||"ingen"}`;
}

async function fetchOneCar(profile) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:SYSTEM_ONE, messages:[{role:"user",content:profile}] })
  });
  if (!res.ok) throw new Error("API fejl " + res.status);
  const data = await res.json();
  const text = data.content?.map(b=>b.type==="text"?b.text:"").join("")||"";
  const s=text.indexOf("{"), e=text.lastIndexOf("}");
  if(s===-1||e===-1) throw new Error("Intet JSON");
  const parsed = JSON.parse(text.slice(s,e+1));
  if(!parsed.brand) throw new Error("Mangler brand");
  return parsed;
}

// ─── Design atoms ─────────────────────────────────────────────
function Chip({label,active,onClick}) {
  return <button onClick={onClick} style={{
    padding:"7px 14px", borderRadius:6, border:`1px solid ${active?C.gold:C.border2}`,
    background:active?C.goldDim:"transparent", color:active?C.gold:C.muted,
    fontSize:13, fontFamily:"'DM Sans',sans-serif", cursor:"pointer",
    transition:"all .15s", fontWeight:active?600:400, whiteSpace:"nowrap"
  }}>{label}</button>;
}
function MultiChips({options,value=[],onChange}) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
    {options.map(o=><Chip key={o} label={o} active={value.includes(o)}
      onClick={()=>onChange(value.includes(o)?value.filter(v=>v!==o):[...value,o])}/>)}
  </div>;
}
function SingleChips({options,value,onChange}) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
    {options.map(o=><Chip key={o} label={o} active={value===o} onClick={()=>onChange(value===o?"":o)}/>)}
  </div>;
}
function MultiDropdown({value=[],onChange,options,placeholder}) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);
  const toggle=o=>onChange(value.includes(o)?value.filter(v=>v!==o):[...value,o]);
  const label = value.length>0 ? (value.length<=3?value.join(", "):`${value.length} valgt`) : placeholder;
  return <div ref={ref} style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{
      width:"100%",background:C.surface,border:`1px solid ${open?C.goldBorder:C.border2}`,
      borderRadius:8,padding:"10px 14px",color:value.length?C.text:C.dim,
      fontSize:14,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",
      display:"flex",justifyContent:"space-between",alignItems:"center"
    }}>
      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
      <span style={{color:C.muted,fontSize:10,marginLeft:8,flexShrink:0,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
    </button>
    {open&&<div style={{
      position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:200,
      background:"#161b22",border:`1px solid ${C.border2}`,borderRadius:8,
      boxShadow:"0 8px 32px #00000099",maxHeight:240,overflowY:"auto"
    }}>
      {options.map(o=><div key={o} onClick={()=>toggle(o)} style={{
        padding:"9px 14px",color:value.includes(o)?C.gold:C.text,fontSize:13,cursor:"pointer",
        background:value.includes(o)?C.goldDim:"transparent",display:"flex",alignItems:"center",gap:10
      }}
        onMouseEnter={e=>{if(!value.includes(o))e.currentTarget.style.background=C.border}}
        onMouseLeave={e=>{if(!value.includes(o))e.currentTarget.style.background="transparent"}}>
        <span style={{width:15,height:15,borderRadius:3,border:`1px solid ${value.includes(o)?C.gold:C.border2}`,
          background:value.includes(o)?C.gold:"transparent",display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:9,color:"#000",flexShrink:0}}>{value.includes(o)?"✓":""}</span>
        {o}
      </div>)}
    </div>}
  </div>;
}
function SingleDropdown({value,onChange,options,placeholder}) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);
  return <div ref={ref} style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{
      width:"100%",background:C.surface,border:`1px solid ${open?C.goldBorder:C.border2}`,
      borderRadius:8,padding:"10px 14px",color:value?C.text:C.dim,
      fontSize:14,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",
      display:"flex",justifyContent:"space-between",alignItems:"center"
    }}>
      <span>{value||placeholder}</span>
      <span style={{color:C.muted,fontSize:10,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
    </button>
    {open&&<div style={{
      position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:200,
      background:"#161b22",border:`1px solid ${C.border2}`,borderRadius:8,
      boxShadow:"0 8px 32px #00000099",maxHeight:220,overflowY:"auto"
    }}>
      <div onClick={()=>{onChange("");setOpen(false);}} style={{padding:"9px 14px",color:C.dim,fontSize:13,cursor:"pointer"}}
        onMouseEnter={e=>e.currentTarget.style.background=C.border}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>Ingen præference</div>
      {options.map(o=><div key={o} onClick={()=>{onChange(o);setOpen(false);}} style={{
        padding:"9px 14px",color:value===o?C.gold:C.text,fontSize:13,cursor:"pointer",
        background:value===o?C.goldDim:"transparent"
      }}
        onMouseEnter={e=>{if(value!==o)e.currentTarget.style.background=C.border}}
        onMouseLeave={e=>{if(value!==o)e.currentTarget.style.background="transparent"}}>{o}</div>)}
    </div>}
  </div>;
}
function NumInput({value,onChange,placeholder,suffix}) {
  return <div style={{position:"relative"}}>
    <input type="number" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{
      width:"100%",background:C.surface,border:`1px solid ${C.border2}`,borderRadius:8,
      padding:`10px ${suffix?"52px":"14px"} 10px 14px`,color:C.text,fontSize:14,
      fontFamily:"'DM Sans',sans-serif",outline:"none"
    }} onFocus={e=>e.target.style.borderColor=C.goldBorder} onBlur={e=>e.target.style.borderColor=C.border2}/>
    {suffix&&<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:12,pointerEvents:"none"}}>{suffix}</span>}
  </div>;
}
function TxtInput({value,onChange,placeholder}) {
  return <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{
    width:"100%",background:C.surface,border:`1px solid ${C.border2}`,borderRadius:8,
    padding:"10px 14px",color:C.text,fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none"
  }} onFocus={e=>e.target.style.borderColor=C.goldBorder} onBlur={e=>e.target.style.borderColor=C.border2}/>;
}
function Field({label,hint,children}) {
  return <div style={{marginBottom:22}}>
    <div style={{marginBottom:9}}>
      <span style={{color:C.text,fontSize:13,fontWeight:600}}>{label}</span>
      {hint&&<span style={{color:C.dim,fontSize:12,marginLeft:8}}>{hint}</span>}
    </div>
    {children}
  </div>;
}

// ─── Disclaimer / info box ────────────────────────────────────
function DisclaimerBox() {
  const [open,setOpen]=useState(false);
  return <div style={{background:C.surface,border:`1px solid ${C.border2}`,borderRadius:10,overflow:"hidden",marginTop:24}}>
    <button onClick={()=>setOpen(!open)} style={{
      width:"100%",background:"none",border:"none",padding:"12px 16px",
      display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"
    }}>
      <span style={{color:C.muted,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
        <span style={{color:C.gold}}>ℹ</span> Hvordan beregnes tallene her?
      </span>
      <span style={{color:C.dim,fontSize:10,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
    </button>
    {open&&<div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.border}`}}>
      <div style={{color:C.muted,fontSize:12,lineHeight:1.8}}>
        <p style={{marginBottom:10,color:C.text,fontWeight:600}}>Estimater — ikke garantier</p>
        <p style={{marginBottom:8}}>Alle priser, gensalgsværdier og driftsomkostninger på denne side er <strong style={{color:C.gold}}>estimater</strong> baseret på historiske markedsdata for det danske brugtbilsmarked. De afspejler ikke den faktiske pris på en specifik bil og bør ikke bruges som grundlag for finansielle beslutninger.</p>
        <p style={{marginBottom:8}}><strong style={{color:C.gold}}>Gensalgsværdi</strong> er beregnet ud fra den historiske gennemsnitlige afskrivningskurve for den pågældende bilmodel og -klasse i Danmark. Faktisk gensalgsværdi afhænger af km-stand, vedligehold, farve, udstyr og markedsforhold på salgstidspunktet.</p>
        <p style={{marginBottom:8}}><strong style={{color:C.gold}}>Brændstofomkostning</strong> er beregnet ud fra gennemsnitspriser på brændstof/el i Danmark og modelens typiske forbrug fra WLTP-testen. Faktisk forbrug varierer med kørestil, vejr og last.</p>
        <p style={{marginBottom:8}}><strong style={{color:C.gold}}>Sikkerhedsvurdering</strong> er baseret på Euro NCAP-testresultater for den pågældende model og generation. Se alle testresultater på <a href="https://www.euroncap.com" target="_blank" rel="noopener noreferrer" style={{color:C.teal}}>euroncap.com</a>.</p>
        <p><strong style={{color:C.gold}}>Pålidelighed</strong> er baseret på aggregerede data fra ADAC Pannenstatistik, TÜV-rapporter og danske brugerundersøgelser. Nyere modeller har kortere datagrundlag.</p>
      </div>
    </div>}
  </div>;
}

// ─── Sparkline ────────────────────────────────────────────────
function Sparkline({resale,price}) {
  const all=[price,resale.y1,resale.y2,resale.y3,resale.y4,resale.y5,resale.y6,resale.y7,resale.y8];
  const mn=Math.min(...all)*0.92, mx=Math.max(...all);
  const rng=mx-mn; const W=300,H=56;
  const x=i=>(i/(all.length-1))*W;
  const y=v=>H-((v-mn)/rng)*H;
  const pts=all.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  const area=`M ${pts.split(" ").join(" L ")} L ${W} ${H+8} L 0 ${H+8} Z`;
  return <svg width="100%" viewBox={`0 0 ${W} ${H+20}`} style={{overflow:"visible"}}>
    <defs>
      <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={C.gold} stopOpacity="0.25"/>
        <stop offset="100%" stopColor={C.gold} stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path d={area} fill="url(#sg2)"/>
    <polyline points={pts} fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    {all.map((v,i)=>i%2===0&&<g key={i}>
      <circle cx={x(i)} cy={y(v)} r="3" fill={C.gold}/>
      <text x={x(i)} y={H+16} textAnchor="middle" fill={C.muted} fontSize="9">
        {i===0?"Nu":`år ${i}`}
      </text>
    </g>)}
  </svg>;
}

// ─── Services section ─────────────────────────────────────────
function ServicesSection() {
  return <div style={{marginTop:36,borderTop:`1px solid ${C.border}`,paddingTop:28}}>
    <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:16}}>
      Har du brug for mere hjælp?
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
      {[
        { icon:"🎯", title:"Personlig rådgivning", price:"499 kr.", desc:"En bilekspert gennemgår dine behov og finder de 5 bedste konkrete annoncer til dig. Spar timer på selv at søge.", tag:"Populær" },
        { icon:"🤝", title:"Forhandling på dine vegne", price:"999 kr.", desc:"Vi kontakter sælger og forhandler den bedste pris og vilkår for dig. Gennemsnitlig besparelse: 8.000–15.000 kr.", tag:"Mest værdi" },
        { icon:"✅", title:"Komplet pakke", price:"1.299 kr.", desc:"Rådgivning + forhandling + gennemgang af synsrapport og servicehistorik. Fra søgning til underskrevet kontrakt.", tag:null },
      ].map(s=><div key={s.title} style={{
        background:C.surface,border:`1px solid ${C.border2}`,borderRadius:10,
        padding:"14px 16px",display:"flex",gap:14,alignItems:"flex-start"
      }}>
        <span style={{fontSize:20,flexShrink:0}}>{s.icon}</span>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{color:C.text,fontSize:14,fontWeight:700}}>{s.title}</span>
            {s.tag&&<span style={{background:C.goldDim,border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20}}>{s.tag}</span>}
          </div>
          <p style={{color:C.muted,fontSize:12,lineHeight:1.6,marginBottom:8}}>{s.desc}</p>
          <button style={{background:C.gold,color:"#000",border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            Bestil — {s.price}
          </button>
        </div>
      </div>)}
    </div>
  </div>;
}

// ─── Car Card ─────────────────────────────────────────────────
function CarCard({car,form,onReject,isAlt,loading}) {
  const [expanded,setExpanded]=useState(false);
  if(loading) return <div style={{background:C.surface,border:`1px solid ${C.border2}`,borderRadius:14,padding:"32px 24px",textAlign:"center"}}>
    <div style={{display:"inline-block",width:22,height:22,border:`2px solid ${C.gold}33`,borderTopColor:C.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    <div style={{color:C.muted,fontSize:13,marginTop:12}}>Finder {isAlt?"alternativt forslag":"bedste match"}...</div>
  </div>;
  if(!car) return null;

  const loss8=car.price_used_dkk-car.resale.y8;
  const modelUrl=buildBilbasenModelUrl(form,car);
  const allUrl=buildBilbasenUrl(form,car);

  return <div style={{
    background:C.surface,border:`1px solid ${isAlt?C.border2:C.goldBorder}`,
    borderRadius:14,overflow:"hidden",position:"relative",
    boxShadow:isAlt?"none":`0 0 40px ${C.goldDim}`,animation:"fadeUp .35s ease"
  }}>
    {/* Reject */}
    {onReject&&<button onClick={onReject} title="Få et andet forslag" style={{
      position:"absolute",top:12,right:12,zIndex:10,
      width:26,height:26,borderRadius:"50%",border:`1px solid ${C.border2}`,
      background:C.bg,color:C.muted,fontSize:13,cursor:"pointer",
      display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"
    }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}}
       onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.muted;}}>✕</button>}

    {/* Badge */}
    <div style={{background:isAlt?C.border:C.goldDim,padding:"5px 16px",borderBottom:`1px solid ${isAlt?C.border2:C.goldBorder}`}}>
      <span style={{color:isAlt?C.muted:C.gold,fontSize:10,fontWeight:700,letterSpacing:1}}>{isAlt?"ALTERNATIVT FORSLAG":"🏆 BEDSTE MATCH"}</span>
    </div>

    <div style={{padding:"18px 18px 0"}}>
      {/* Header */}
      <div style={{marginBottom:14}}>
        <div style={{fontFamily:"'Sora',sans-serif",fontSize:21,fontWeight:800,color:C.text,lineHeight:1.1}}>{car.brand} {car.model}</div>
        <div style={{color:C.muted,fontSize:13,marginTop:2}}>{car.variant} · {car.year_range}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:16,marginTop:10}}>
          <div><div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:.5}}>Brugt ca.</div>
            <div style={{color:C.gold,fontSize:19,fontWeight:800}}>{fmtDKK(car.price_used_dkk)}</div></div>
          <div><div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:.5}}>Ny pris</div>
            <div style={{color:C.muted,fontSize:14,fontWeight:600}}>{fmtDKK(car.price_new_dkk)}</div></div>
          <div><div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:.5}}>Brændstof/md.*</div>
            <div style={{color:C.teal,fontSize:14,fontWeight:600}}>{fmtDKK(car.fuel_cost_monthly)}</div></div>
        </div>
      </div>

      {/* Short why */}
      <div style={{background:C.bg,borderRadius:9,padding:"12px 14px",marginBottom:12}}>
        <div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Hvorfor denne bil?</div>
        {(Array.isArray(car.short_why)?car.short_why:[car.short_why]).map((pt,i)=>(
          <div key={i} style={{display:"flex",gap:7,marginBottom:i<2?6:0,alignItems:"flex-start"}}>
            <span style={{color:C.gold,fontSize:11,marginTop:2,flexShrink:0}}>→</span>
            <span style={{color:C.muted,fontSize:13,lineHeight:1.5}}>{pt}</span>
          </div>
        ))}
        <button onClick={()=>setExpanded(!expanded)} style={{
          background:"none",border:"none",color:C.gold,fontSize:11,cursor:"pointer",
          marginTop:8,padding:0,fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:4
        }}>{expanded?"▲ Skjul":"▼ Læs mere"}</button>
        {expanded&&<p style={{color:C.text,fontSize:13,lineHeight:1.7,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>{car.long_why}</p>}
      </div>

      {/* Pros/cons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{background:C.bg,borderRadius:9,padding:11}}>
          {car.pros.map((p,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:i<car.pros.length-1?5:0}}>
            <span style={{color:C.green,fontSize:10,marginTop:2}}>✓</span>
            <span style={{color:C.muted,fontSize:12}}>{p}</span>
          </div>)}
        </div>
        <div style={{background:C.bg,borderRadius:9,padding:11}}>
          {car.cons.map((c,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:i<car.cons.length-1?5:0}}>
            <span style={{color:C.red,fontSize:10,marginTop:2}}>✗</span>
            <span style={{color:C.muted,fontSize:12}}>{c}</span>
          </div>)}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
        {[
          {l:"Sikkerhed",v:"⭐".repeat(car.safety_rating)},
          {l:"Pålidelighed",v:car.reliability},
          {l:"Tab over 8 år*",v:"−"+fmtDKK(loss8),red:true},
        ].map(s=><div key={s.l} style={{background:C.bg,borderRadius:8,padding:"9px 11px"}}>
          <div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{s.l}</div>
          <div style={{color:s.red?C.red:C.muted,fontSize:12,fontWeight:600}}>{s.v}</div>
        </div>)}
      </div>

      {/* Resale chart */}
      <div style={{background:C.bg,borderRadius:9,padding:"12px 14px",marginBottom:12}}>
        <div style={{color:C.dim,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Gensalgsværdi — 8 år*</div>
        <Sparkline resale={car.resale} price={car.price_used_dkk}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{color:C.dim,fontSize:10}}>Nu: {fmtDKK(car.price_used_dkk)}</span>
          <span style={{color:C.dim,fontSize:10}}>År 8: {fmtDKK(car.resale.y8)}</span>
        </div>
      </div>

      {/* Bilbasen links — hardcoded filters */}
      <div style={{display:"flex",flexDirection:"column",gap:7,paddingBottom:18}}>
        <a href={modelUrl} target="_blank" rel="noopener noreferrer" style={{
          display:"flex",justifyContent:"space-between",alignItems:"center",
          background:C.gold,color:"#000",padding:"11px 15px",borderRadius:8,
          textDecoration:"none",fontWeight:700,fontSize:13
        }}>
          <span>🔍 Se {car.brand} {car.model} på Bilbasen</span><span>→</span>
        </a>
        <a href={allUrl} target="_blank" rel="noopener noreferrer" style={{
          display:"flex",justifyContent:"space-between",alignItems:"center",
          background:"transparent",border:`1px solid ${C.border2}`,
          color:C.muted,padding:"9px 15px",borderRadius:8,textDecoration:"none",fontSize:12
        }}>
          <span>Alle {car.fuel_type}-biler i dit budget på Bilbasen</span><span>→</span>
        </a>
      </div>
      <p style={{color:C.dim,fontSize:10,textAlign:"center",paddingBottom:14}}>* Estimater baseret på historiske markedsdata — ikke garantier</p>
    </div>
  </div>;
}

// ─── Results view ─────────────────────────────────────────────
function Results({cards,loadingA,loadingB,form,onReject,onRefresh,summary}) {
  return <div style={{animation:"fadeUp .4s ease"}}>
    {summary&&<div style={{background:C.goldDim,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"12px 16px",marginBottom:22}}>
      <div style={{color:C.gold,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>Din profil</div>
      <p style={{color:C.muted,fontSize:13,lineHeight:1.6}}>{summary}</p>
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <CarCard car={cards[0]} form={form} isAlt={false} loading={loadingA} onReject={!loadingA?()=>onReject(0):null}/>
      <CarCard car={cards[1]} form={form} isAlt={true}  loading={loadingB} onReject={!loadingB?()=>onReject(1):null}/>
    </div>
    <DisclaimerBox/>
    <ServicesSection/>
    <div style={{textAlign:"center",marginTop:28}}>
      <button onClick={onRefresh} style={{
        background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,
        padding:"9px 22px",borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"
      }}>← Ret søgning</button>
    </div>
  </div>;
}

// ─── Step bar ─────────────────────────────────────────────────
function StepBar({current}) {
  return <div style={{marginBottom:32}}>
    <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
      {STEPS.map((s,i)=><div key={s.id} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:"none"}}>
        <div style={{
          width:30,height:30,borderRadius:"50%",flexShrink:0,
          background:i<current?C.gold:"transparent",
          border:`2px solid ${i<current?C.gold:i===current?C.gold:C.border2}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:i<current?11:13,color:i<current?"#000":i===current?C.gold:C.dim,
          transition:"all .3s"
        }}>{i<current?"✓":s.icon}</div>
        {i<STEPS.length-1&&<div style={{flex:1,height:1,margin:"0 5px",background:i<current?C.gold:C.border,transition:"background .3s"}}/>}
      </div>)}
    </div>
    <div style={{display:"flex",justifyContent:"space-between"}}>
      {STEPS.map((s,i)=><div key={s.id} style={{
        color:i===current?C.gold:i<current?C.muted:C.dim,
        fontSize:10,fontWeight:i===current?700:400,textAlign:"center",flex:1
      }}>{s.label}</div>)}
    </div>
  </div>;
}

// ─── Step content ─────────────────────────────────────────────
function StepFamily({form,set}) {
  return <div>
    <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:C.text,marginBottom:5}}>Fortæl om familien</h2>
    <p style={{color:C.muted,fontSize:13,marginBottom:26}}>Hvem skal bruge bilen?</p>
    <Field label="Antal voksne"><SingleChips options={["1","2","3","4+"]} value={form.adults} onChange={set("adults")}/></Field>
    <Field label="Antal børn"><SingleChips options={["0","1","2","3","4+"]} value={form.children} onChange={set("children")}/></Field>
    {form.children!=="0"&&form.children!==""&&<Field label="Børnenes aldre" hint="valgfrit"><TxtInput value={form.childAges||""} onChange={set("childAges")} placeholder="F.eks. 3, 7, 12"/></Field>}
    <Field label="Geografisk område"><SingleDropdown value={form.region} onChange={set("region")} options={REGIONS} placeholder="Vælg region"/></Field>
  </div>;
}
function StepEconomy({form,set}) {
  return <div>
    <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:C.text,marginBottom:5}}>Økonomi</h2>
    <p style={{color:C.muted,fontSize:13,marginBottom:26}}>Hvad er jeres budget?</p>
    <Field label="Betalingsform"><SingleChips options={["kontant","månedlig"]} value={form.budgetType} onChange={set("budgetType")}/></Field>
    {(!form.budgetType||form.budgetType==="kontant")
      ?<Field label="Kontantbudget"><NumInput value={form.budget} onChange={set("budget")} placeholder="F.eks. 350000" suffix="kr."/></Field>
      :<Field label="Månedlig ydelse"><NumInput value={form.monthly} onChange={set("monthly")} placeholder="F.eks. 4500" suffix="kr./md."/></Field>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Field label="Tidligste årsmodel" hint="valgfrit"><NumInput value={form.yearMin} onChange={set("yearMin")} placeholder="F.eks. 2018"/></Field>
      <Field label="Max km-stand" hint="valgfrit"><NumInput value={form.kmMax} onChange={set("kmMax")} placeholder="F.eks. 100000" suffix="km"/></Field>
    </div>
  </div>;
}
function StepUsage({form,set}) {
  return <div>
    <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:C.text,marginBottom:5}}>Daglig brug</h2>
    <p style={{color:C.muted,fontSize:13,marginBottom:26}}>Hvordan bruges bilen til hverdag?</p>
    <Field label="Daglig km-forbrug"><NumInput value={form.dailyKm} onChange={set("dailyKm")} placeholder="F.eks. 40" suffix="km/dag"/></Field>
    <Field label="Primær kørsel"><SingleChips options={["Primært by","Blandet","Primært motorvej"]} value={form.driveType} onChange={set("driveType")}/></Field>
    <Field label="Særlige behov" hint="valgfrit"><TxtInput value={form.extras||""} onChange={set("extras")} placeholder="Anhænger, barnevogn, hunde, meget bagage..."/></Field>
  </div>;
}
function StepType({form,set}) {
  return <div>
    <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:C.text,marginBottom:5}}>Biltype</h2>
    <p style={{color:C.muted,fontSize:13,marginBottom:26}}>Hvad forestiller I jer?</p>
    <Field label="Karosseri" hint="vælg gerne flere"><MultiChips options={BODY_TYPES} value={form.bodies||[]} onChange={set("bodies")}/></Field>
    <Field label="Drivmiddel" hint="vælg gerne flere"><MultiChips options={FUEL_TYPES} value={form.fuels||[]} onChange={set("fuels")}/></Field>
    <Field label="Foretrukne mærker" hint="vælg gerne flere"><MultiDropdown value={form.brands||[]} onChange={set("brands")} options={BRANDS} placeholder="Ingen præference"/></Field>
    <Field label="Uønskede mærker"><MultiDropdown value={form.excludeBrands||[]} onChange={set("excludeBrands")} options={BRANDS} placeholder="Ingen uønskede mærker"/></Field>
  </div>;
}
function StepPrefs({form,set}) {
  return <div>
    <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:C.text,marginBottom:5}}>Hvad er vigtigst?</h2>
    <p style={{color:C.muted,fontSize:13,marginBottom:26}}>Vælg hvad der betyder mest for jer.</p>
    <Field label="Prioriteter" hint="vælg gerne flere"><MultiChips options={PRIORITIES} value={form.priorities||[]} onChange={set("priorities")}/></Field>
    <Field label="Gearkasse" hint="valgfrit"><SingleChips options={["Automatgear","Manuel","Ligemeget"]} value={form.transmission} onChange={set("transmission")}/></Field>
    <Field label="Anhængerled?" hint="valgfrit"><SingleChips options={["Ja, vigtigt","Rart at have","Nej tak"]} value={form.towbar} onChange={set("towbar")}/></Field>
  </div>;
}

function canNext(step,form) {
  if(step===0) return form.adults&&form.children!==undefined&&form.children!=="";
  if(step===1) return form.budget||form.monthly;
  if(step===2) return form.dailyKm;
  return true;
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({
    adults:"2",children:"0",childAges:"",region:"",
    budgetType:"kontant",budget:"",monthly:"",yearMin:"",kmMax:"",
    dailyKm:"",driveType:"",extras:"",
    bodies:[],fuels:[],brands:[],excludeBrands:[],
    priorities:[],transmission:"",towbar:""
  });
  const [showResults,setShowResults]=useState(false);
  const [summary,setSummary]=useState("");
  const [cards,setCards]=useState([null,null]);
  const [loadingA,setLoadingA]=useState(false);
  const [loadingB,setLoadingB]=useState(false);
  const [error,setError]=useState("");
  const [excluded,setExcluded]=useState([[],[]]);

  const set=k=>v=>setForm(f=>({...f,[k]:v}));

  async function runSearch(excl) {
    setShowResults(true);
    setCards([null,null]);
    setLoadingA(true);
    setLoadingB(true);
    setError("");

    const profileA=buildProfile(form,1,excl[0]);
    const profileB=buildProfile(form,2,[...excl[1],...excl[0]]);

    // Fire both in parallel
    const [pA,pB]=await Promise.allSettled([
      fetchOneCar(profileA),
      fetchOneCar(profileB)
    ]);

    if(pA.status==="fulfilled") {
      setCards(c=>[pA.value,c[1]]);
      if(!summary) setSummary(`Baseret på jeres profil har vi fundet ${pA.value.brand} ${pA.value.model} som bedste match.`);
    } else setError("Kunne ikke hente anbefaling — prøv igen.");
    setLoadingA(false);

    if(pB.status==="fulfilled") setCards(c=>[c[0],pB.value]);
    setLoadingB(false);
  }

  async function handleSubmit() {
    await runSearch([[],[]]);
  }

  async function handleReject(idx) {
    const rejected=cards[idx]?`${cards[idx].brand} ${cards[idx].model}`:"";
    const newExcl=excluded.map((e,i)=>i===idx?[...e,rejected]:e);
    setExcluded(newExcl);
    if(idx===0) { setLoadingA(true); setCards(c=>[null,c[1]]); }
    else        { setLoadingB(true); setCards(c=>[c[0],null]); }
    try {
      const car=await fetchOneCar(buildProfile(form,idx===0?1:2,newExcl[idx]));
      if(idx===0) setCards(c=>[car,c[1]]);
      else        setCards(c=>[c[0],car]);
    } catch{ setError("Kunne ikke hente nyt forslag."); }
    if(idx===0) setLoadingA(false);
    else        setLoadingB(false);
  }

  const ok=canNext(step,form);

  return <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:${C.bg}}
      input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      ::placeholder{color:${C.border2}}
      ::-webkit-scrollbar{width:4px}
      ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:4px}
      @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"14px 24px",display:"flex",alignItems:"center",gap:9}}>
        <span style={{fontSize:17}}>🚗</span>
        <span style={{fontFamily:"'Sora',sans-serif",fontSize:17,fontWeight:800,color:C.text}}>BilFinder</span>
        <span style={{background:C.goldDim,border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,letterSpacing:1}}>AI</span>
        <span style={{marginLeft:"auto",color:C.dim,fontSize:11}}>Uafhængig rådgivning · Kun Danmark</span>
      </div>
      <div style={{maxWidth:600,margin:"0 auto",padding:"32px 18px 80px"}}>
        {!showResults&&<StepBar current={step}/>}

        {!showResults&&step===0&&<div style={{animation:"fadeUp .3s ease"}}><StepFamily form={form} set={set}/></div>}
        {!showResults&&step===1&&<div style={{animation:"fadeUp .3s ease"}}><StepEconomy form={form} set={set}/></div>}
        {!showResults&&step===2&&<div style={{animation:"fadeUp .3s ease"}}><StepUsage form={form} set={set}/></div>}
        {!showResults&&step===3&&<div style={{animation:"fadeUp .3s ease"}}><StepType form={form} set={set}/></div>}
        {!showResults&&step===4&&<div style={{animation:"fadeUp .3s ease"}}><StepPrefs form={form} set={set}/></div>}

        {showResults&&<Results
          cards={cards} loadingA={loadingA} loadingB={loadingB}
          form={form} summary={summary}
          onReject={handleReject}
          onRefresh={()=>{setShowResults(false);setCards([null,null]);setSummary("");setExcluded([[],[]]);setStep(4);}}
        />}

        {!showResults&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:32}}>
          {step>0
            ?<button onClick={()=>setStep(s=>s-1)} style={{background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,padding:"10px 20px",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"}}>← Tilbage</button>
            :<div/>}
          {step<4
            ?<button onClick={()=>setStep(s=>s+1)} disabled={!ok} style={{background:ok?C.gold:C.border,color:ok?"#000":C.dim,border:"none",padding:"11px 26px",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:ok?"pointer":"default",transition:"all .2s"}}>Næste →</button>
            :<button onClick={handleSubmit} style={{background:C.gold,color:"#000",border:"none",padding:"11px 26px",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>Find vores bil ✨</button>}
        </div>}
        {error&&<p style={{color:C.red,fontSize:12,textAlign:"center",marginTop:14}}>{error}</p>}
      </div>
    </div>
  </>;
}
