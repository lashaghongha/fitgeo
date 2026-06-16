import { useState, useContext, useRef, useEffect, createContext, useCallback } from "react";
import { Home, Utensils, Dumbbell, User, Plus, Droplets, Footprints, TrendingDown, BookOpen, MessageCircle, Calculator, Camera, Send, Play, Zap, ChevronRight, ChevronLeft, Target, Bell, Settings, X, BarChart3 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import * as api from "./api.js";

// ─── CONTEXT ───────────────────────────────────────────────────────────────
const Ctx = createContext(null);

// ─── CLEAN STATE FACTORY ──────────────────────────────────────────────────
// Calculates personalised goals from profile; used on register & logout.
function makeCleanState(profile) {
  const w   = parseFloat(profile?.weight) || 75;
  const h   = parseFloat(profile?.height) || 170;
  const age = parseInt(profile?.age)      || 25;
  const isFemale = profile?.gender === "female";

  // Mifflin-St Jeor BMR
  const bmr = 10 * w + 6.25 * h - 5 * age + (isFemale ? -161 : 5);
  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[profile?.activity] ?? 1.375;
  let tdee = bmr * mult;
  if (profile?.goal === "lose")  tdee -= 500;
  if (profile?.goal === "gain")  tdee += 300;
  const kcal    = Math.round(tdee);
  const protein = Math.round(w * 2);
  const fat     = Math.round(tdee * 0.25 / 9);
  const carbs   = Math.round((tdee - protein * 4 - fat * 9) / 4);
  const water   = Math.round(w * 0.035 * 10) / 10;
  const wGoal   = profile?.goal === "lose" ? Math.round((w - 10) * 10) / 10
                : profile?.goal === "gain" ? Math.round((w +  5) * 10) / 10
                : w;
  const name = profile?.name || "მეგობარო";

  return {
    calories: { current: 0, goal: kcal },
    protein:  { current: 0, goal: protein },
    carbs:    { current: 0, goal: carbs },
    fat:      { current: 0, goal: fat },
    water:    { current: 0, goal: water },
    steps:    { current: 0, goal: 10000 },
    weight:   { current: w, goal: wGoal, history: [w] },
    diary:    { breakfast: [], lunch: [], dinner: [], snacks: [] },
    measurements: { chest: 0, waist: 0, hips: 0, leftArm: 0, rightArm: 0, leftThigh: 0, rightThigh: 0 },
    chatHistory: [{ role: "ai", text: `გამარჯობა ${name}! მე ვარ შენი AI დიეტოლოგი. როგორ შემიძლია დაგეხმარო? 🌿` }],
    challenges: [
      { id: 1, emoji: "🔥", title: "30 Day Challenge",  desc: "30 დღე ვარჯიში",      progress: 0, total: 30,  joined: false },
      { id: 2, emoji: "👟", title: "10,000 Steps",      desc: "ყოველდღიური მიზანი",  progress: 0, total: 100, joined: false },
      { id: 3, emoji: "🍬", title: "No Sugar Week",     desc: "7 დღე შაქრის გარეშე", progress: 0, total: 7,   joined: false },
    ],
    achievements: [
      { id: 1, emoji: "⭐", title: "პირველი ნაბიჯი", desc: "პროფილი შეავსე",   earned: true  },
      { id: 2, emoji: "🏆", title: "-5 კგ",          desc: "5 კგ-ის დაკლება",  earned: false },
      { id: 3, emoji: "💧", title: "ჰიდრატაცია",     desc: "7 დღე 3ლ წყალი",  earned: false },
    ],
  };
}

// Bare fallback — used only before profile is known (edge case)
const INIT = makeCleanState(null);

// ─── STYLES ────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#0a0a0a;--bg2:#141414;--card:#1a1a1a;--el:#222;
  --acc:#4ade80;--acc-d:#16a34a;--acc-dim:rgba(74,222,128,.12);
  --t1:#f5f5f5;--t2:#a0a0a0;--tm:#555;
  --bdr:rgba(255,255,255,.07);--bdr-a:rgba(74,222,128,.3);
  --red:#f87171;--yel:#fbbf24;--blu:#60a5fa;--org:#fb923c;
  --r:16px;--rs:10px;--rl:24px;--font:'Outfit',sans-serif;
}
body{background:var(--bg);color:var(--t1);font-family:var(--font);-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px}
.app{display:flex;flex-direction:column;height:100vh;max-width:430px;margin:0 auto;background:var(--bg);position:relative;overflow:hidden}
.page{flex:1;overflow-y:auto;padding-bottom:90px}
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(20,20,20,.96);backdrop-filter:blur(20px);border-top:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-around;padding:8px 0 8px;z-index:100}
.ni{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px 14px;border-radius:var(--rs);background:none;border:none;color:var(--tm);transition:all .2s}
.ni.active{color:var(--acc)}
.ni span{font-size:10px;font-weight:500}
.fab{width:52px;height:52px;background:var(--acc);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;box-shadow:0 0 20px rgba(74,222,128,.4);transition:transform .2s;margin-top:-20px}
.fab:active{transform:scale(.92)}
.card{background:var(--card);border-radius:var(--r);border:1px solid var(--bdr);padding:16px}
.btn{width:100%;padding:15px;background:var(--acc);color:#0a0a0a;font-family:var(--font);font-size:15px;font-weight:700;border:none;border-radius:var(--r);cursor:pointer;transition:all .2s}
.btn:active{transform:scale(.98);opacity:.9}
.btn:disabled{opacity:.5}
.ghost{padding:9px 16px;background:var(--el);color:var(--t1);font-family:var(--font);font-size:13px;font-weight:500;border:1px solid var(--bdr);border-radius:var(--rs);cursor:pointer;transition:all .2s;white-space:nowrap}
.ghost.on{background:var(--acc-dim);border-color:var(--bdr-a);color:var(--acc)}
.inp{width:100%;background:var(--el);border:1px solid var(--bdr);border-radius:var(--rs);color:var(--t1);font-family:var(--font);font-size:15px;padding:13px 15px;outline:none;transition:border-color .2s}
.inp:focus{border-color:var(--bdr-a)}
.inp::placeholder{color:var(--tm)}
.tab-bar{display:flex;gap:4px;background:var(--el);border-radius:var(--rs);padding:4px}
.tab{flex:1;padding:8px;border-radius:8px;border:none;background:none;color:var(--t2);font-family:var(--font);font-size:12px;font-weight:500;cursor:pointer;transition:all .2s}
.tab.on{background:var(--card);color:var(--t1);font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.cbbl{max-width:78%;padding:11px 14px;border-radius:18px;font-size:14px;line-height:1.5}
.cbbl.user{background:var(--acc);color:#0a0a0a;font-weight:500;border-bottom-right-radius:4px;align-self:flex-end}
.cbbl.ai{background:var(--el);color:var(--t1);border-bottom-left-radius:4px;align-self:flex-start;border:1px solid var(--bdr)}
.toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:var(--el);border:1px solid var(--bdr-a);color:var(--acc);font-size:13px;font-weight:600;padding:9px 18px;border-radius:100px;z-index:300;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:none}
.opt{background:var(--el);border:1px solid var(--bdr);border-radius:var(--r);padding:16px;text-align:center;cursor:pointer;transition:all .2s;font-family:var(--font);color:var(--t1)}
.opt.sel{border-color:var(--acc);background:var(--acc-dim);color:var(--acc)}
.opt .em{font-size:28px;display:block;margin-bottom:8px}
.opt .lbl{font-size:13px;font-weight:600}
.loading-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:var(--bg);gap:16px}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes spin{to{transform:rotate(360deg)}}
.fu{animation:fadeUp .3s ease both}
.fu1{animation:fadeUp .3s .06s ease both}
.fu2{animation:fadeUp .3s .12s ease both}
.fu3{animation:fadeUp .3s .18s ease both}
.ld{animation:pulse 1.4s infinite}
.ld:nth-child(2){animation-delay:.2s}
.ld:nth-child(3){animation-delay:.4s}
.spin{width:18px;height:18px;border:2px solid var(--bdr);border-top-color:var(--acc);border-radius:50%;animation:spin .7s linear infinite}
.spin-lg{width:36px;height:36px;border:3px solid var(--bdr);border-top-color:var(--acc);border-radius:50%;animation:spin .7s linear infinite}
`;

// ─── UTILS ─────────────────────────────────────────────────────────────────
function Ring({ size = 110, stroke = 7, pct = 0, color = "var(--acc)", bg = "var(--el)", children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>{children}</div>
    </div>
  );
}

// ─── ONBOARDING ────────────────────────────────────────────────────────────
const GOALS = [{ id: "lose", emoji: "🔥", label: "წონის დაკლება" }, { id: "maintain", emoji: "⚖️", label: "შენარჩუნება" }, { id: "gain", emoji: "💪", label: "მასის მომატება" }, { id: "health", emoji: "❤️", label: "ჯანმრთელობა" }];
const ACTS = [{ id: "sedentary", emoji: "🛋️", label: "უმოძრაო" }, { id: "light", emoji: "🚶", label: "მსუბუქი" }, { id: "moderate", emoji: "🏃", label: "საშუალო" }, { id: "active", emoji: "⚡", label: "ძალიან აქტიური" }];

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────
function LoginModal({ onDone, onClose }) {
  const [name, setName]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const isAdmin = name.toLowerCase() === "admin";

  const handle = async () => {
    if (!name.trim()) return;
    if (isAdmin && !password) { setError("ადმინისთვის პაროლი სავალდებულოა"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(name.trim(), isAdmin ? password : undefined);
      onDone(res.profile ?? { name: name.trim() }, res.state);
    } catch (e) {
      setError(e.message || "მომხმარებელი ვერ მოიძებნა");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background: onClose ? "rgba(0,0,0,.7)" : "var(--bg)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"var(--card)", borderRadius:20, padding:28, width:"100%", maxWidth:380, border:"1px solid var(--bdr)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <div>
            <div style={{ fontSize:28, marginBottom:8 }}>🌿</div>
            <div style={{ fontSize:20, fontWeight:800 }}>FitGeo შესვლა</div>
            <div style={{ fontSize:12, color:"var(--t2)", marginTop:3 }}>შეიყვანე შენი სახელი</div>
          </div>
          {onClose && <button onClick={onClose} style={{ background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:10, width:34, height:34, cursor:"pointer", fontSize:16, color:"var(--t2)" }}>✕</button>}
        </div>

        <input
          className="inp"
          placeholder="სახელი"
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          onKeyDown={e => e.key === "Enter" && !isAdmin && handle()}
          autoFocus
          style={{ marginBottom:10 }}
        />

        {isAdmin && (
          <input
            className="inp"
            type="password"
            placeholder="🔐 ადმინის პაროლი"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && handle()}
            style={{ marginBottom:10 }}
          />
        )}

        {isAdmin && (
          <div style={{ background:"rgba(74,222,128,.08)", border:"1px solid rgba(74,222,128,.2)", borderRadius:10, padding:"8px 13px", fontSize:12, color:"var(--acc)", marginBottom:12 }}>
            🛡️ ადმინ ანგარიში — პაროლი საჭიროა
          </div>
        )}

        {error && (
          <div style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#ef4444", marginBottom:14 }}>
            ❌ {error}
          </div>
        )}

        <button className="btn" onClick={handle} disabled={!name.trim() || (isAdmin && !password) || loading}>
          {loading
            ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><div className="spin" />შედი...</span>
            : "შესვლა →"}
        </button>
      </div>
    </div>
  );
}

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [d, setD] = useState({ name: "", age: "", gender: "male", height: "", weight: "", goal: "", activity: "" });
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const steps = ["welcome", "basics", "goal", "activity", "done"];
  const cur = steps[step];
  const canNext = cur === "basics" ? d.name && d.age && d.height && d.weight : cur === "goal" ? d.goal : cur === "activity" ? d.activity : true;

  const handleDone = async () => {
    setLoading(true);
    try {
      const res = await api.register(d);
      onDone(res.profile ?? d, res.state);
    } catch {
      onDone(d, null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", padding:20, maxWidth:430, margin:"0 auto" }}>
      {showLogin && <LoginModal onDone={onDone} onClose={() => setShowLogin(false)} />}

      {step > 0 && step < steps.length - 1 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            {step > 1 && <button onClick={() => setStep(s => s-1)} style={{ background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:10, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--t1)" }}><ChevronLeft size={18} /></button>}
            <div>
              <h2 style={{ fontSize:22, fontWeight:800 }}>{["","ძირითადი ინფო","შენი მიზანი","აქტივობის დონე"][step]}</h2>
              <p style={{ fontSize:13, color:"var(--t2)", marginTop:2 }}>{["","შეავსე შენი მონაცემები","რისთვის ვარჯიშობ?","რამდენად აქტიური ხარ?"][step]}</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {[1,2,3].map(i => <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i < step ? "var(--acc)" : "var(--el)", transition:"background .3s" }} />)}
          </div>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        {cur === "welcome" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", gap:20 }}>
            <div style={{ fontSize:72 }}>🌿</div>
            <div>
              <h1 style={{ fontSize:34, fontWeight:900, lineHeight:1.1, marginBottom:10 }}>FitGeo<br /><span style={{ color:"var(--acc)" }}>ქართული</span><br />AI ტრენერი</h1>
              <p style={{ color:"var(--t2)", fontSize:14, lineHeight:1.6 }}>პირველი ქართული AI Nutrition Coach & Fitness Tracker</p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", fontSize:13, color:"var(--t2)" }}>
              {["🍽️ ქართული კერძების ანალიზი","🤖 AI დიეტოლოგი ჩატი","💪 პერსონალური ვარჯიში","📊 BMI / BMR / TDEE კალკულატორი"].map(f => (
                <div key={f} style={{ background:"var(--el)", borderRadius:10, padding:"10px 14px", textAlign:"left", border:"1px solid var(--bdr)" }}>{f}</div>
              ))}
            </div>
          </div>
        )}

        {cur === "basics" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <input className="inp" placeholder="სახელი" value={d.name} onChange={e => set("name", e.target.value)} />
            <input className="inp" type="number" placeholder="ასაკი" value={d.age} onChange={e => set("age", e.target.value)} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {["male","female"].map(g => <button key={g} className={`opt ${d.gender===g?"sel":""}`} onClick={() => set("gender",g)}><span className="em">{g==="male"?"👨":"👩"}</span><span className="lbl">{g==="male"?"მამრობითი":"მდედრობითი"}</span></button>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><label style={{ fontSize:12, color:"var(--t2)", marginBottom:5, display:"block" }}>სიმაღლე (სმ)</label><input className="inp" type="number" placeholder="175" value={d.height} onChange={e => set("height",e.target.value)} /></div>
              <div><label style={{ fontSize:12, color:"var(--t2)", marginBottom:5, display:"block" }}>წონა (კგ)</label><input className="inp" type="number" placeholder="75" value={d.weight} onChange={e => set("weight",e.target.value)} /></div>
            </div>
          </div>
        )}

        {cur === "goal" && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>{GOALS.map(g => <button key={g.id} className={`opt ${d.goal===g.id?"sel":""}`} onClick={() => set("goal",g.id)}><span className="em">{g.emoji}</span><span className="lbl">{g.label}</span></button>)}</div>}
        {cur === "activity" && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>{ACTS.map(a => <button key={a.id} className={`opt ${d.activity===a.id?"sel":""}`} onClick={() => set("activity",a.id)}><span className="em">{a.emoji}</span><span className="lbl">{a.label}</span></button>)}</div>}

        {cur === "done" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", gap:18 }}>
            <div style={{ fontSize:72 }}>🎉</div>
            <h2 style={{ fontSize:26, fontWeight:900 }}>გამარჯობა,<br /><span style={{ color:"var(--acc)" }}>{d.name||"მეგობარო"}!</span></h2>
            <div className="card" style={{ width:"100%", textAlign:"left" }}>
              {[["🎯 მიზანი",GOALS.find(g=>g.id===d.goal)?.label||"-"],["⚡ აქტივობა",ACTS.find(a=>a.id===d.activity)?.label||"-"]].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--bdr)" }}>
                  <span style={{ fontSize:14 }}>{k}</span><span style={{ fontSize:14, fontWeight:700, color:"var(--acc)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:10 }}>
        <button className="btn" onClick={step===steps.length-1 ? handleDone : () => setStep(s=>s+1)} disabled={!canNext||loading}>
          {loading ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><div className="spin" />შენახვა...</span>
            : step===steps.length-1 ? "დავიწყოთ! 🚀" : step===0 ? "რეგისტრაცია →" : "შემდეგი →"}
        </button>
        {step === 0 && (
          <button onClick={() => setShowLogin(true)}
            style={{ width:"100%", padding:"14px", borderRadius:14, border:"1px solid var(--bdr)", background:"var(--el)", color:"var(--t1)", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"var(--font)" }}>
            👋 უკვე მაქვს ანგარიში — შესვლა
          </button>
        )}
      </div>
    </div>
  );
}

// ─── HOME PAGE ─────────────────────────────────────────────────────────────
function HomePage({ profile }) {
  const { state } = useContext(Ctx);
  const { calories, protein, carbs, fat, water, steps, weight } = state;
  const calPct = Math.round((calories.current / calories.goal) * 100);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "დილა მშვიდობისა" : hour < 17 ? "შუადღე მშვიდობისა" : "საღამო მშვიდობისა";

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ padding: "16px 4px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13, color: "var(--t2)", fontWeight: 500 }}>{greet} 👋</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{profile?.name || "მომხმარებელი"}</h1>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 50, background: "linear-gradient(135deg,var(--acc-d),var(--acc))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{profile?.gender === "female" ? "👩" : "👨"}</div>
      </div>

      <div className="card fu" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 18 }}>
        <Ring size={96} stroke={7} pct={calPct}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{calories.current}</div><div style={{ fontSize: 9, color: "var(--t2)", marginTop: 1 }}>/ {calories.goal}</div><div style={{ fontSize: 9, color: "var(--acc)", fontWeight: 700 }}>kcal</div></div>
        </Ring>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          {[{ label: "ცილა", c: protein, col: "var(--blu)" }, { label: "ნახ-წყ", c: carbs, col: "var(--yel)" }, { label: "ცხიმი", c: fat, col: "var(--red)" }].map(m => (
            <div key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: "var(--t2)" }}>{m.label}</span>
                <span style={{ fontWeight: 600, color: m.col }}>{m.c.current}/{m.c.goal}g</span>
              </div>
              <div style={{ height: 4, background: "var(--el)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (m.c.current / m.c.goal) * 100)}%`, height: "100%", background: m.col, borderRadius: 2, transition: "width .5s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }} className="fu1">
        {[{ icon: <Droplets size={15} color="var(--blu)" />, label: "წყალი", val: `${water.current}ლ`, sub: `/ ${water.goal}ლ`, pct: (water.current / water.goal) * 100, col: "var(--blu)" },
          { icon: <Footprints size={15} color="var(--org)" />, label: "ნაბიჯები", val: steps.current.toLocaleString(), sub: `/ ${steps.goal.toLocaleString()}`, pct: (steps.current / steps.goal) * 100, col: "var(--org)" }].map(item => (
          <div key={item.label} className="card" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>{item.icon}<span style={{ fontSize: 11, color: "var(--t2)" }}>{item.label}</span></div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{item.val}</div>
            <div style={{ height: 3, background: "var(--el)", borderRadius: 2, overflow: "hidden" }}><div style={{ width: `${Math.min(100, item.pct)}%`, height: "100%", background: item.col, borderRadius: 2 }} /></div>
            <div style={{ fontSize: 11, color: "var(--t2)" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="card fu2" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div><div style={{ fontSize: 12, color: "var(--t2)" }}>მიმდინარე წონა</div><div style={{ fontSize: 26, fontWeight: 900, marginTop: 2 }}>{weight.current}<span style={{ fontSize: 13, color: "var(--t2)", fontWeight: 400 }}> კგ</span></div></div>
          <div style={{ textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 4 }}><TrendingDown size={13} color="var(--acc)" /><span style={{ color: "var(--acc)", fontSize: 13, fontWeight: 700 }}>-0.8 კგ</span></div><div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>ამ კვირაში</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
          {weight.history.map((w, i) => {
            const mn = Math.min(...weight.history), mx = Math.max(...weight.history);
            const h = 8 + (1 - (w - mn) / (mx - mn + 0.5)) * 28;
            return <div key={i} style={{ flex: 1, height: `${h}px`, background: i === weight.history.length - 1 ? "var(--acc)" : "var(--el)", borderRadius: "3px 3px 0 0" }} />;
          })}
        </div>
      </div>

      <div className="fu3">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>დღის კვება</h2>
        </div>
        <div className="card">
          {[{ meal: "საუზმე", items: state.diary?.breakfast || [], icon: "🌅" }, { meal: "სადილი", items: state.diary?.lunch || [], icon: "☀️" }, { meal: "ვახშამი", items: state.diary?.dinner || [], icon: "🌙" }, { meal: "სნექი", items: state.diary?.snacks || [], icon: "🍎" }].map(({ meal, items, icon }) => (
            <div key={meal} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{meal}</div><div style={{ fontSize: 11, color: "var(--t2)", marginTop: 1 }}>{items[0]?.name}</div></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{items.reduce((s, i) => s + i.kcal, 0)} kcal</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FOOD PAGE ─────────────────────────────────────────────────────────────
// ─── საკვების სრული ბაზა ───────────────────────────────────────────────────
const GEO_FOODS = [
  // 🏛️ ტრადიციული ქართული
  { cat:"🏛️ ტრადიციული", name:"ხინკალი (1 ც)",                 emoji:"🥟", kcal:85,  protein:6,   carbs:9,   fat:3   },
  { cat:"🏛️ ტრადიციული", name:"ხაჭაპური იმერული (1 ნ)",        emoji:"🧀", kcal:420, protein:14,  carbs:52,  fat:18  },
  { cat:"🏛️ ტრადიციული", name:"ხაჭაპური აჭარული (1 ნ)",        emoji:"🧀", kcal:680, protein:22,  carbs:58,  fat:36  },
  { cat:"🏛️ ტრადიციული", name:"ხაჭაპური მეგრული (1 ნ)",        emoji:"🧀", kcal:520, protein:18,  carbs:50,  fat:28  },
  { cat:"🏛️ ტრადიციული", name:"მწვადი (100გ)",                   emoji:"🥩", kcal:280, protein:28,  carbs:0,   fat:18  },
  { cat:"🏛️ ტრადიციული", name:"ლობიანი (1 ც)",                   emoji:"🫘", kcal:380, protein:12,  carbs:62,  fat:10  },
  { cat:"🏛️ ტრადიციული", name:"კუბდარი (1 ც)",                   emoji:"🥧", kcal:420, protein:16,  carbs:58,  fat:16  },
  { cat:"🏛️ ტრადიციული", name:"ჩვისტარი (1 ც)",                  emoji:"🫓", kcal:220, protein:7,   carbs:28,  fat:9   },
  { cat:"🏛️ ტრადიციული", name:"გომი (200გ)",                      emoji:"🍚", kcal:180, protein:3,   carbs:38,  fat:2   },
  { cat:"🏛️ ტრადიციული", name:"ხარჩო (250მლ)",                   emoji:"🍲", kcal:210, protein:14,  carbs:18,  fat:9   },
  { cat:"🏛️ ტრადიციული", name:"ჩიხირთმა (250მლ)",               emoji:"🍜", kcal:190, protein:16,  carbs:14,  fat:8   },
  { cat:"🏛️ ტრადიციული", name:"ოჯახური (150გ)",                  emoji:"🍳", kcal:320, protein:18,  carbs:5,   fat:26  },
  { cat:"🏛️ ტრადიციული", name:"ჩაქაფული (200გ)",                emoji:"🫕", kcal:240, protein:20,  carbs:8,   fat:14  },
  { cat:"🏛️ ტრადიციული", name:"ნიგვზიანი ბადრიჯანი (100გ)",    emoji:"🍆", kcal:180, protein:5,   carbs:8,   fat:14  },
  { cat:"🏛️ ტრადიციული", name:"ფხალი (100გ)",                    emoji:"🌿", kcal:100, protein:5,   carbs:9,   fat:5   },
  { cat:"🏛️ ტრადიციული", name:"ლობიო (200გ)",                    emoji:"🫘", kcal:260, protein:14,  carbs:40,  fat:5   },
  { cat:"🏛️ ტრადიციული", name:"ლობიო ქვაბში (200გ)",             emoji:"🫘", kcal:290, protein:15,  carbs:42,  fat:8   },
  { cat:"🏛️ ტრადიციული", name:"მხალი ოხრახუში (100გ)",           emoji:"🥬", kcal:95,  protein:5,   carbs:8,   fat:5   },
  { cat:"🏛️ ტრადიციული", name:"სოკოს ხარჩო (250მლ)",             emoji:"🍲", kcal:120, protein:5,   carbs:12,  fat:6   },
  { cat:"🏛️ ტრადიციული", name:"შაური (1 ც)",                     emoji:"🌯", kcal:480, protein:22,  carbs:55,  fat:18  },

  // 🥣 მარცვლეული & ფაფა
  { cat:"🥣 მარცვლეული", name:"შვრიის ფაფა წყლით (200გ)",       emoji:"🥣", kcal:132, protein:4.5, carbs:23,  fat:2.5 },
  { cat:"🥣 მარცვლეული", name:"შვრიის ფაფა რძით (200გ)",        emoji:"🥣", kcal:190, protein:7,   carbs:28,  fat:5   },
  { cat:"🥣 მარცვლეული", name:"გრეჩიხა მოხ. (100გ)",             emoji:"🌾", kcal:110, protein:4,   carbs:20,  fat:1   },
  { cat:"🥣 მარცვლეული", name:"ბრინჯი თეთრი მოხ. (100გ)",       emoji:"🍚", kcal:130, protein:2.7, carbs:28,  fat:0.3 },
  { cat:"🥣 მარცვლეული", name:"ბრინჯი ყავისფერი მოხ. (100გ)",  emoji:"🍚", kcal:112, protein:2.6, carbs:23,  fat:0.9 },
  { cat:"🥣 მარცვლეული", name:"ოატმილი მშრალი (50გ)",            emoji:"🥣", kcal:188, protein:6.5, carbs:32,  fat:3.5 },
  { cat:"🥣 მარცვლეული", name:"კინოა მოხ. (100გ)",               emoji:"🌾", kcal:120, protein:4.4, carbs:22,  fat:1.9 },
  { cat:"🥣 მარცვლეული", name:"სიმინდის ფაფა (200გ)",            emoji:"🌽", kcal:170, protein:4,   carbs:34,  fat:2   },
  { cat:"🥣 მარცვლეული", name:"ქერის ბურღული (100გ)",            emoji:"🌾", kcal:123, protein:2.3, carbs:28,  fat:0.4 },
  { cat:"🥣 მარცვლეული", name:"ფეტვი მოხ. (100გ)",               emoji:"🌾", kcal:119, protein:3.5, carbs:23,  fat:1   },
  { cat:"🥣 მარცვლეული", name:"კუსკუსი მოხ. (100გ)",             emoji:"🌾", kcal:112, protein:3.8, carbs:23,  fat:0.2 },
  { cat:"🥣 მარცვლეული", name:"ბულგური მოხ. (100გ)",             emoji:"🌾", kcal:83,  protein:3.1, carbs:19,  fat:0.2 },
  { cat:"🥣 მარცვლეული", name:"მუსლი (50გ)",                     emoji:"🥣", kcal:195, protein:5,   carbs:35,  fat:4   },
  { cat:"🥣 მარცვლეული", name:"სიმინდი მოხ. (100გ)",             emoji:"🌽", kcal:86,  protein:3.3, carbs:19,  fat:1.3 },

  // 🍝 მაკარონი & ფქვილეული
  { cat:"🍝 მაკარონი",   name:"სპაგეტი მოხ. (100გ)",             emoji:"🍝", kcal:131, protein:5,   carbs:25,  fat:1.1 },
  { cat:"🍝 მაკარონი",   name:"პენე მოხ. (100გ)",                emoji:"🍝", kcal:131, protein:5,   carbs:25,  fat:1.1 },
  { cat:"🍝 მაკარონი",   name:"მაკარონი მთლ. მარც. (100გ)",      emoji:"🍝", kcal:124, protein:5.3, carbs:23,  fat:1   },
  { cat:"🍝 მაკარონი",   name:"ლაზანია (150გ)",                   emoji:"🍝", kcal:200, protein:10,  carbs:28,  fat:5   },
  { cat:"🍝 მაკარონი",   name:"პიცა მარგარიტა (1 ნ, 100გ)",      emoji:"🍕", kcal:266, protein:11,  carbs:33,  fat:10  },
  { cat:"🍝 მაკარონი",   name:"პური — შავი (30გ)",               emoji:"🍞", kcal:80,  protein:3,   carbs:15,  fat:1   },
  { cat:"🍝 მაკარონი",   name:"პური — თეთრი (30გ)",              emoji:"🥖", kcal:85,  protein:3,   carbs:16,  fat:1   },
  { cat:"🍝 მაკარონი",   name:"შოთა (120გ)",                      emoji:"🥖", kcal:280, protein:9,   carbs:56,  fat:2   },
  { cat:"🍝 მაკარონი",   name:"მჭადი (80გ)",                      emoji:"🫓", kcal:168, protein:4,   carbs:34,  fat:2   },
  { cat:"🍝 მაკარონი",   name:"ლავაში (30გ)",                     emoji:"🫓", kcal:95,  protein:3,   carbs:18,  fat:1   },
  { cat:"🍝 მაკარონი",   name:"ბლინი (1 ც, 50გ)",                emoji:"🥞", kcal:110, protein:3.5, carbs:16,  fat:3.5 },

  // 🥩 ხორცი & ფრინველი
  { cat:"🥩 ხორცი",      name:"ქათმის მკერდი (100გ)",             emoji:"🍗", kcal:120, protein:23,  carbs:0,   fat:2.6 },
  { cat:"🥩 ხორცი",      name:"ქათმის ბარკალი (100გ)",            emoji:"🍗", kcal:209, protein:26,  carbs:0,   fat:11  },
  { cat:"🥩 ხორცი",      name:"გრილ ქათამი (100გ)",               emoji:"🍗", kcal:165, protein:31,  carbs:0,   fat:3.6 },
  { cat:"🥩 ხორცი",      name:"შემწვარი ქათამი (100გ)",           emoji:"🍗", kcal:239, protein:27,  carbs:0,   fat:14  },
  { cat:"🥩 ხორცი",      name:"საქონლის ფილე (100გ)",             emoji:"🥩", kcal:217, protein:26,  carbs:0,   fat:12  },
  { cat:"🥩 ხორცი",      name:"საქონლის დაფქული (100გ)",          emoji:"🥩", kcal:254, protein:26,  carbs:0,   fat:16  },
  { cat:"🥩 ხორცი",      name:"ღორის ფილე (100გ)",                emoji:"🥓", kcal:212, protein:27,  carbs:0,   fat:11  },
  { cat:"🥩 ხორცი",      name:"ღორის ბეკონი (30გ)",               emoji:"🥓", kcal:134, protein:9,   carbs:0.1, fat:10  },
  { cat:"🥩 ხორცი",      name:"ცხვრის ხორცი (100გ)",              emoji:"🐑", kcal:294, protein:25,  carbs:0,   fat:21  },
  { cat:"🥩 ხორცი",      name:"ძეხვი ქათმის (50გ)",               emoji:"🌭", kcal:125, protein:7,   carbs:2,   fat:10  },
  { cat:"🥩 ხორცი",      name:"ინდაური მკერდი (100გ)",            emoji:"🦃", kcal:104, protein:22,  carbs:0,   fat:1.6 },
  { cat:"🥩 ხორცი",      name:"ღვიძლი (100გ)",                    emoji:"🫀", kcal:135, protein:20,  carbs:4,   fat:4   },

  // 🐟 თევზი & ზღვის პროდ.
  { cat:"🐟 თევზი",      name:"ორაგული (100გ)",                   emoji:"🐟", kcal:208, protein:20,  carbs:0,   fat:13  },
  { cat:"🐟 თევზი",      name:"კალმახი (100გ)",                   emoji:"🐡", kcal:119, protein:21,  carbs:0,   fat:3.5 },
  { cat:"🐟 თევზი",      name:"ტუნა (100გ)",                      emoji:"🐟", kcal:130, protein:30,  carbs:0,   fat:1   },
  { cat:"🐟 თევზი",      name:"სკუმბრია (100გ)",                  emoji:"🐠", kcal:205, protein:19,  carbs:0,   fat:14  },
  { cat:"🐟 თევზი",      name:"კაპელინი (100გ)",                  emoji:"🐡", kcal:157, protein:13,  carbs:0,   fat:11  },
  { cat:"🐟 თევზი",      name:"კაპარჭინა (100გ)",                 emoji:"🐠", kcal:97,  protein:19,  carbs:0,   fat:2   },
  { cat:"🐟 თევზი",      name:"კრევეტი (100გ)",                   emoji:"🦐", kcal:99,  protein:24,  carbs:0,   fat:0.3 },
  { cat:"🐟 თევზი",      name:"კალმარი (100გ)",                   emoji:"🦑", kcal:92,  protein:16,  carbs:4,   fat:1.4 },
  { cat:"🐟 თევზი",      name:"ოხშივარი კონსერვი (100გ)",         emoji:"🐟", kcal:188, protein:23,  carbs:0,   fat:10  },

  // 🧀 რძის & კვერცხი
  { cat:"🧀 რძის",       name:"კვერცხი მთლიანი (1 ც)",           emoji:"🥚", kcal:78,  protein:6,   carbs:0.6, fat:5   },
  { cat:"🧀 რძის",       name:"კვერცხის თეთრი (1 ც)",            emoji:"🥚", kcal:17,  protein:3.6, carbs:0.2, fat:0   },
  { cat:"🧀 რძის",       name:"სულუგუნი (100გ)",                  emoji:"🧀", kcal:290, protein:20,  carbs:2,   fat:22  },
  { cat:"🧀 რძის",       name:"ნადუღი (100გ)",                    emoji:"🧀", kcal:160, protein:18,  carbs:2,   fat:9   },
  { cat:"🧀 რძის",       name:"ყველი — ბრი (30გ)",               emoji:"🧀", kcal:101, protein:6,   carbs:0.1, fat:8.4 },
  { cat:"🧀 რძის",       name:"ყველი — ედამი (30გ)",              emoji:"🧀", kcal:105, protein:7.5, carbs:0.4, fat:8   },
  { cat:"🧀 რძის",       name:"მატსონი (200მლ)",                  emoji:"🥛", kcal:140, protein:10,  carbs:10,  fat:6   },
  { cat:"🧀 რძის",       name:"კეფირი (200მლ)",                   emoji:"🥛", kcal:104, protein:7,   carbs:10,  fat:4   },
  { cat:"🧀 რძის",       name:"იოგურტი ბუნ. (150გ)",             emoji:"🥛", kcal:93,  protein:5.3, carbs:11,  fat:2.5 },
  { cat:"🧀 რძის",       name:"ხაჭო 5% (100გ)",                   emoji:"🥛", kcal:121, protein:14,  carbs:2.8, fat:5   },
  { cat:"🧀 რძის",       name:"ხაჭო 0% (100გ)",                   emoji:"🥛", kcal:71,  protein:12,  carbs:3,   fat:0.2 },
  { cat:"🧀 რძის",       name:"რძე 2.5% (200მლ)",                emoji:"🥛", kcal:104, protein:5.8, carbs:9.4, fat:5   },
  { cat:"🧀 რძის",       name:"ნაღები 10% (100მლ)",              emoji:"🥛", kcal:119, protein:2.8, carbs:4,   fat:10  },
  { cat:"🧀 რძის",       name:"კარაქი (10გ)",                     emoji:"🧈", kcal:72,  protein:0.1, carbs:0,   fat:8   },

  // 🫘 პარკოსნები
  { cat:"🫘 პარკოსნები", name:"წითელი ლობიო (100გ)",             emoji:"🫘", kcal:127, protein:8.7, carbs:23,  fat:0.5 },
  { cat:"🫘 პარკოსნები", name:"შავი ლობიო (100გ)",               emoji:"🫘", kcal:132, protein:8.9, carbs:24,  fat:0.5 },
  { cat:"🫘 პარკოსნები", name:"ოსპი (100გ)",                      emoji:"🫘", kcal:116, protein:9,   carbs:20,  fat:0.4 },
  { cat:"🫘 პარკოსნები", name:"ბარდა (100გ)",                     emoji:"🫛", kcal:81,  protein:5.4, carbs:15,  fat:0.4 },
  { cat:"🫘 პარკოსნები", name:"ავოკადო (100გ)",                   emoji:"🥑", kcal:160, protein:2,   carbs:9,   fat:15  },
  { cat:"🫘 პარკოსნები", name:"ჰუმუსი (50გ)",                     emoji:"🫘", kcal:117, protein:4,   carbs:10,  fat:7   },
  { cat:"🫘 პარკოსნები", name:"სოია (100გ)",                      emoji:"🫘", kcal:173, protein:17,  carbs:9,   fat:9   },
  { cat:"🫘 პარკოსნები", name:"ნუტი (100გ)",                      emoji:"🫘", kcal:164, protein:8.9, carbs:27,  fat:2.6 },

  // 🥗 ბოსტნეული
  { cat:"🥗 ბოსტნეული", name:"პომიდორი (100გ)",                  emoji:"🍅", kcal:18,  protein:0.9, carbs:3.9, fat:0.2 },
  { cat:"🥗 ბოსტნეული", name:"კიტრი (100გ)",                     emoji:"🥒", kcal:15,  protein:0.7, carbs:3.6, fat:0.1 },
  { cat:"🥗 ბოსტნეული", name:"ბოლოკი (100გ)",                    emoji:"🥕", kcal:41,  protein:0.9, carbs:10,  fat:0.2 },
  { cat:"🥗 ბოსტნეული", name:"კომბოსტო (100გ)",                  emoji:"🥬", kcal:25,  protein:1.3, carbs:6,   fat:0.1 },
  { cat:"🥗 ბოსტნეული", name:"ბადრიჯანი (100გ)",                 emoji:"🍆", kcal:25,  protein:1,   carbs:6,   fat:0.2 },
  { cat:"🥗 ბოსტნეული", name:"კარტოფილი მოხ. (100გ)",            emoji:"🥔", kcal:87,  protein:1.9, carbs:20,  fat:0.1 },
  { cat:"🥗 ბოსტნეული", name:"კარტოფილი გამომც. (100გ)",         emoji:"🥔", kcal:312, protein:3.5, carbs:41,  fat:15  },
  { cat:"🥗 ბოსტნეული", name:"ნიახური (100გ)",                   emoji:"🧅", kcal:40,  protein:1.1, carbs:9,   fat:0.1 },
  { cat:"🥗 ბოსტნეული", name:"ნიორი (10გ)",                      emoji:"🧄", kcal:15,  protein:0.6, carbs:3,   fat:0.1 },
  { cat:"🥗 ბოსტნეული", name:"ბროკოლი (100გ)",                   emoji:"🥦", kcal:34,  protein:2.8, carbs:7,   fat:0.4 },
  { cat:"🥗 ბოსტნეული", name:"ყვავილოვანი კომბ. (100გ)",         emoji:"🥦", kcal:25,  protein:1.9, carbs:5,   fat:0.3 },
  { cat:"🥗 ბოსტნეული", name:"სპანახი (100გ)",                   emoji:"🥬", kcal:23,  protein:2.9, carbs:3.6, fat:0.4 },
  { cat:"🥗 ბოსტნეული", name:"სალათის ფოთოლი (100გ)",           emoji:"🥬", kcal:15,  protein:1.4, carbs:2.9, fat:0.2 },
  { cat:"🥗 ბოსტნეული", name:"ჭარხალი (100გ)",                   emoji:"🫑", kcal:43,  protein:1.6, carbs:10,  fat:0.2 },
  { cat:"🥗 ბოსტნეული", name:"გოგრა (100გ)",                     emoji:"🎃", kcal:26,  protein:1,   carbs:7,   fat:0.1 },
  { cat:"🥗 ბოსტნეული", name:"ასპარაგი (100გ)",                  emoji:"🌱", kcal:20,  protein:2.2, carbs:3.9, fat:0.1 },
  { cat:"🥗 ბოსტნეული", name:"წიწაკა წითელი (100გ)",             emoji:"🫑", kcal:31,  protein:1,   carbs:6,   fat:0.3 },
  { cat:"🥗 ბოსტნეული", name:"სოკო (100გ)",                      emoji:"🍄", kcal:22,  protein:3.1, carbs:3.3, fat:0.3 },
  { cat:"🥗 ბოსტნეული", name:"სიმინდი (100გ)",                   emoji:"🌽", kcal:86,  protein:3.3, carbs:19,  fat:1.3 },
  { cat:"🥗 ბოსტნეული", name:"მწვანე ლობიო (100გ)",              emoji:"🫛", kcal:31,  protein:1.8, carbs:7,   fat:0.1 },

  // 🍎 ხილი
  { cat:"🍎 ხილი",       name:"ვაშლი (1 ც, 150გ)",               emoji:"🍎", kcal:78,  protein:0.4, carbs:21,  fat:0.2 },
  { cat:"🍎 ხილი",       name:"მსხალი (1 ც, 160გ)",              emoji:"🍐", kcal:88,  protein:0.5, carbs:23,  fat:0.2 },
  { cat:"🍎 ხილი",       name:"ბანანი (1 ც, 100გ)",              emoji:"🍌", kcal:89,  protein:1.1, carbs:23,  fat:0.3 },
  { cat:"🍎 ხილი",       name:"ფორთოხალი (1 ც, 130გ)",           emoji:"🍊", kcal:62,  protein:1.2, carbs:15,  fat:0.2 },
  { cat:"🍎 ხილი",       name:"ყურძენი (100გ)",                   emoji:"🍇", kcal:69,  protein:0.7, carbs:18,  fat:0.2 },
  { cat:"🍎 ხილი",       name:"ბალი (100გ)",                      emoji:"🍒", kcal:50,  protein:1,   carbs:12,  fat:0.3 },
  { cat:"🍎 ხილი",       name:"ატამი (130გ)",                     emoji:"🍑", kcal:52,  protein:1.2, carbs:13,  fat:0.2 },
  { cat:"🍎 ხილი",       name:"გარგარი (100გ)",                   emoji:"🍊", kcal:48,  protein:1.4, carbs:11,  fat:0.4 },
  { cat:"🍎 ხილი",       name:"მანდარინი (100გ)",                 emoji:"🍊", kcal:53,  protein:0.8, carbs:13,  fat:0.3 },
  { cat:"🍎 ხილი",       name:"ლიმონი (100გ)",                    emoji:"🍋", kcal:29,  protein:1.1, carbs:9,   fat:0.3 },
  { cat:"🍎 ხილი",       name:"მარწყვი (100გ)",                   emoji:"🍓", kcal:32,  protein:0.7, carbs:8,   fat:0.3 },
  { cat:"🍎 ხილი",       name:"მოცვი (100გ)",                     emoji:"🫐", kcal:57,  protein:0.7, carbs:14,  fat:0.3 },
  { cat:"🍎 ხილი",       name:"კივი (100გ)",                      emoji:"🥝", kcal:61,  protein:1.1, carbs:15,  fat:0.5 },
  { cat:"🍎 ხილი",       name:"ანანასი (100გ)",                   emoji:"🍍", kcal:50,  protein:0.5, carbs:13,  fat:0.1 },
  { cat:"🍎 ხილი",       name:"საზამთრო (100გ)",                  emoji:"🍉", kcal:30,  protein:0.6, carbs:8,   fat:0.2 },
  { cat:"🍎 ხილი",       name:"ნესვი (100გ)",                     emoji:"🍈", kcal:34,  protein:0.8, carbs:8,   fat:0.2 },
  { cat:"🍎 ხილი",       name:"ლეღვი (100გ)",                     emoji:"🍈", kcal:74,  protein:0.8, carbs:19,  fat:0.3 },
  { cat:"🍎 ხილი",       name:"ხურმა (100გ)",                     emoji:"🧡", kcal:70,  protein:0.6, carbs:19,  fat:0.2 },

  // 🌰 კაკალი & თესლი
  { cat:"🌰 კაკალი",     name:"ნიგოზი (30გ)",                    emoji:"🫘", kcal:196, protein:4.6, carbs:4,   fat:20  },
  { cat:"🌰 კაკალი",     name:"თხილი (30გ)",                     emoji:"🌰", kcal:188, protein:4.5, carbs:5,   fat:18  },
  { cat:"🌰 კაკალი",     name:"ნუში (30გ)",                       emoji:"🌰", kcal:174, protein:6.3, carbs:6,   fat:15  },
  { cat:"🌰 კაკალი",     name:"კეშიუ (30გ)",                     emoji:"🌰", kcal:157, protein:5.2, carbs:9,   fat:12  },
  { cat:"🌰 კაკალი",     name:"ფიჭვის კაკალი (30გ)",             emoji:"🌲", kcal:191, protein:3.9, carbs:4,   fat:19  },
  { cat:"🌰 კაკალი",     name:"მიწის თხილი (30გ)",               emoji:"🥜", kcal:170, protein:7.7, carbs:5,   fat:14  },
  { cat:"🌰 კაკალი",     name:"ჭარხლის თესლი (15გ)",             emoji:"🌱", kcal:83,  protein:2.9, carbs:1.1, fat:7   },
  { cat:"🌰 კაკალი",     name:"სელის თესლი (15გ)",               emoji:"🌱", kcal:80,  protein:2.7, carbs:4,   fat:6   },
  { cat:"🌰 კაკალი",     name:"ჩია (15გ)",                        emoji:"🌱", kcal:73,  protein:2.5, carbs:6,   fat:4.6 },

  // 🫚 ზეთი & ცხიმი
  { cat:"🫚 ზეთი",       name:"ზეთი — ზეთისხილი (10მლ)",        emoji:"🫚", kcal:90,  protein:0,   carbs:0,   fat:10  },
  { cat:"🫚 ზეთი",       name:"ზეთი — მზესუმზ. (10მლ)",         emoji:"🫚", kcal:90,  protein:0,   carbs:0,   fat:10  },
  { cat:"🫚 ზეთი",       name:"კარაქი (10გ)",                     emoji:"🧈", kcal:72,  protein:0.1, carbs:0,   fat:8   },
  { cat:"🫚 ზეთი",       name:"არაქისის კარაქი (30გ)",           emoji:"🥜", kcal:188, protein:7,   carbs:6,   fat:16  },
  { cat:"🫚 ზეთი",       name:"ნუშის კარაქი (30გ)",              emoji:"🌰", kcal:190, protein:6.7, carbs:7,   fat:17  },
  { cat:"🫚 ზეთი",       name:"ავოკადოს ზეთი (10მლ)",            emoji:"🥑", kcal:88,  protein:0,   carbs:0,   fat:10  },

  // 🍬 ტკბილეული
  { cat:"🍬 ტკბილეული", name:"ჩურჩხელა (100გ)",                  emoji:"🍇", kcal:380, protein:8,   carbs:78,  fat:6   },
  { cat:"🍬 ტკბილეული", name:"კაზინაკი (30გ)",                   emoji:"🍯", kcal:142, protein:3,   carbs:18,  fat:7   },
  { cat:"🍬 ტკბილეული", name:"გოზინაყი (30გ)",                   emoji:"🍬", kcal:155, protein:3.5, carbs:19,  fat:7.5 },
  { cat:"🍬 ტკბილეული", name:"თაფლი (20გ)",                      emoji:"🍯", kcal:61,  protein:0.1, carbs:17,  fat:0   },
  { cat:"🍬 ტკბილეული", name:"შოკოლადი შავი (30გ)",              emoji:"🍫", kcal:169, protein:2.3, carbs:13,  fat:12  },
  { cat:"🍬 ტკბილეული", name:"შოკოლადი რძის (30გ)",              emoji:"🍫", kcal:158, protein:2,   carbs:18,  fat:9   },
  { cat:"🍬 ტკბილეული", name:"ნამცხვარი (50გ)",                  emoji:"🍰", kcal:195, protein:3,   carbs:28,  fat:8   },
  { cat:"🍬 ტკბილეული", name:"ნაყინი (100გ)",                    emoji:"🍦", kcal:207, protein:3.5, carbs:24,  fat:11  },
  { cat:"🍬 ტკბილეული", name:"მარმელადი (20გ)",                  emoji:"🍬", kcal:53,  protein:0,   carbs:14,  fat:0   },

  // 🥤 სასმელი
  { cat:"🥤 სასმელი",   name:"ბორჯომი (250მლ)",                  emoji:"💧", kcal:0,   protein:0,   carbs:0,   fat:0   },
  { cat:"🥤 სასმელი",   name:"ყავა შავი (200მლ)",                emoji:"☕", kcal:5,   protein:0.3, carbs:0,   fat:0   },
  { cat:"🥤 სასმელი",   name:"ყავა ლათე (300მლ)",               emoji:"☕", kcal:190, protein:9,   carbs:18,  fat:8   },
  { cat:"🥤 სასმელი",   name:"ჩაი შავი (200მლ)",                emoji:"🍵", kcal:2,   protein:0,   carbs:0.5, fat:0   },
  { cat:"🥤 სასმელი",   name:"ჩაი მწვანე (200მლ)",              emoji:"🍵", kcal:1,   protein:0,   carbs:0.2, fat:0   },
  { cat:"🥤 სასმელი",   name:"ნარინჯის წვენი (200მლ)",          emoji:"🥤", kcal:94,  protein:1.5, carbs:21,  fat:0.5 },
  { cat:"🥤 სასმელი",   name:"ვაშლის წვენი (200მლ)",            emoji:"🥤", kcal:94,  protein:0.3, carbs:24,  fat:0.1 },
  { cat:"🥤 სასმელი",   name:"ლიმონათი (250მლ)",                emoji:"🥤", kcal:105, protein:0,   carbs:27,  fat:0   },
  { cat:"🥤 სასმელი",   name:"ლუდი (330მლ)",                    emoji:"🍺", kcal:143, protein:1,   carbs:13,  fat:0   },
  { cat:"🥤 სასმელი",   name:"ღვინო წითელი (150მლ)",            emoji:"🍷", kcal:125, protein:0.1, carbs:4,   fat:0   },
  { cat:"🥤 სასმელი",   name:"ღვინო თეთრი (150მლ)",             emoji:"🥂", kcal:121, protein:0.1, carbs:4,   fat:0   },
  { cat:"🥤 სასმელი",   name:"რძე 3.2% (200მლ)",               emoji:"🥛", kcal:124, protein:6.5, carbs:9.5, fat:6.4 },
  { cat:"🥤 სასმელი",   name:"პროტეინის შეიქი (300მლ)",         emoji:"💪", kcal:180, protein:30,  carbs:8,   fat:2   },
  { cat:"🥤 სასმელი",   name:"სმუზი ხილის (300მლ)",             emoji:"🥤", kcal:180, protein:3,   carbs:40,  fat:1   },
];

const FOOD_CATS = ["ყველა", ...new Set(GEO_FOODS.map(f => f.cat))];

function DiaryTab() {
  const { state } = useContext(Ctx);
  const { diary, calories } = state;
  const pct = Math.round((calories.current / calories.goal) * 100);
  return (
    <div style={{ padding: "0 16px" }}>
      <div className="card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 16 }}>
        <Ring size={68} stroke={6} pct={pct}><div style={{ fontSize: 13, fontWeight: 900 }}>{pct}%</div></Ring>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--t2)" }}>კალორიები</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{calories.current} <span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 400 }}>/ {calories.goal} kcal</span></div>
          <div style={{ height: 4, background: "var(--el)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "var(--acc)", borderRadius: 2 }} /></div>
        </div>
      </div>
      {[{ k: "breakfast", l: "საუზმე", i: "🌅" }, { k: "lunch", l: "სადილი", i: "☀️" }, { k: "dinner", l: "ვახშამი", i: "🌙" }, { k: "snacks", l: "სნექი", i: "🍎" }].map(({ k, l, i }) => {
        const items = diary[k] || [];
        return (
          <div key={k} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", marginBottom: 6, borderBottom: "1px solid var(--bdr)" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", textTransform: "uppercase", letterSpacing: .5 }}>{i} {l}</span>
              <span style={{ fontSize: 13, color: "var(--acc)", fontWeight: 700 }}>{items.reduce((s, x) => s + x.kcal, 0)} kcal</span>
            </div>
            {items.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--bdr)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--el)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{item.emoji}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div><div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>ც:{item.protein}g ნ:{item.carbs}g ც:{item.fat}g</div></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{item.kcal}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function WaterTab() {
  const { state, updateState, showToast } = useContext(Ctx);
  const { water } = state;
  const pct = Math.round((water.current / water.goal) * 100);
  const add = (ml) => { updateState(p => ({ water: { ...p.water, current: Math.min(p.water.goal + 1, +(p.water.current + ml / 1000).toFixed(2)) } })); showToast(`+${ml}მლ წყალი 💧`); };
  return (
    <div style={{ padding: "0 16px" }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0" }}>
          <Ring size={150} stroke={10} pct={pct} color="var(--blu)">
            <div style={{ textAlign: "center" }}><Droplets size={18} color="var(--blu)" /><div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1 }}>{water.current}</div><div style={{ fontSize: 13, color: "var(--t2)" }}>/ {water.goal} ლ</div><div style={{ fontSize: 11, color: "var(--blu)", fontWeight: 700, marginTop: 2 }}>{pct}%</div></div>
          </Ring>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[250, 500, 1000].map(a => (
            <button key={a} onClick={() => add(a)} style={{ background: "var(--el)", border: "1px solid var(--bdr)", color: "var(--t1)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, padding: "13px 8px", borderRadius: "var(--r)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Droplets size={16} color="var(--blu)" />{a < 1000 ? `+${a}მლ` : "+1ლ"}
            </button>
          ))}
        </div>
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>ბოლო 7 დღე</h2>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {[1.5, 2.0, 2.8, 3.0, 2.2, 1.8, water.current].map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ width: "100%", height: `${(v / 3) * 46}px`, background: i === 6 ? "var(--blu)" : "var(--el)", borderRadius: "3px 3px 0 0", minHeight: 4 }} />
              <span style={{ fontSize: 9, color: i === 6 ? "var(--blu)" : "var(--tm)" }}>{["ო","ს","ო","ხ","პ","შ","კ"][i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIChat() {
  const { state, updateState, profile } = useContext(Ctx);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [state.chatHistory, loading]);

  const systemPrompt = `შენ ხარ ქართული AI დიეტოლოგი FitGeo-ში.
მომხმარებლის მონაცემები: სახელი: ${profile?.name || "?"}, ასაკი: ${profile?.age || "?"},
სქესი: ${profile?.gender === "female" ? "ქალი" : "კაცი"},
სიმაღლე: ${profile?.height || "?"}სმ, მიმდინარე წონა: ${state.weight?.current || profile?.weight || "?"}კგ,
მიზანი: ${profile?.goal === "lose" ? "წონის დაკლება" : profile?.goal === "gain" ? "მასის მომატება" : profile?.goal === "maintain" ? "შენარჩუნება" : "ჯანმრთელობა"},
სამიზნე წონა: ${state.weight?.goal || "?"}კგ, აქტივობა: ${profile?.activity || "?"},
კალორიების მიზანი: ${state.calories?.goal || 2200} kcal, დღეს მიღებული: ${state.calories?.current || 0} kcal.
პასუხი ქართულად - მეგობრული, კონკრეტული. ქართული კერძების (ხინკალი, ხაჭაპური, მწვადი) კალორიები კარგად იცი.`;

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim(); setInput(""); setLoading(true);
    updateState(p => ({ chatHistory: [...p.chatHistory, { role: "user", text: msg }] }));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: systemPrompt,
          messages: [...state.chatHistory.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })), { role: "user", content: msg }]
        })
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "გთხოვ, სცადე თავიდან.";
      updateState(p => ({ chatHistory: [...p.chatHistory, { role: "ai", text: reply }] }));
    } catch { updateState(p => ({ chatHistory: [...p.chatHistory, { role: "ai", text: "კავშირის შეცდომა. სცადე კვლავ." }] })); }
    setLoading(false);
  };

  return (
    <div style={{ height: "calc(100vh - 200px)", display: "flex", flexDirection: "column", padding: "0 16px" }}>
      <div ref={ref} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
        {state.chatHistory.map((m, i) => <div key={i} className={`cbbl ${m.role}`}>{m.text}</div>)}
        {loading && <div className="cbbl ai" style={{ display: "flex", gap: 4, alignItems: "center" }}>{[0, 1, 2].map(i => <div key={i} className="ld" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--t2)" }} />)}</div>}
      </div>
      {state.chatHistory.length <= 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {["რა ვჭამო დღეს?", "ხინკალი კარგია?", "ჩემი TDEE?"].map(s => <button key={s} onClick={() => setInput(s)} style={{ background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: 20, padding: "6px 12px", fontSize: 12, color: "var(--t1)", cursor: "pointer", fontFamily: "var(--font)" }}>{s}</button>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
        <input className="inp" style={{ flex: 1 }} placeholder="შეკითხვა დიეტოლოგს..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
        <button onClick={send} style={{ width: 46, height: 46, background: "var(--acc)", borderRadius: 12, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send size={17} color="#0a0a0a" /></button>
      </div>
    </div>
  );
}

// ─── SHARED INPUTS HOOK ────────────────────────────────────────────────────
function useBaseInputs() {
  const { profile, state } = useContext(Ctx);
  // Use current tracked weight (from state) for calculators — more accurate than registration value
  const currentWeight = state?.weight?.current || parseFloat(profile?.weight) || 75;
  const [h, setH] = useState(String(profile?.height || "175"));
  const [w, setW] = useState(String(currentWeight));
  const [a, setA] = useState(String(profile?.age || "25"));
  const [g, setG] = useState(profile?.gender || "male");
  return { h, setH, w, setW, a, setA, g, setG };
}

function CalcField({ label, value, setter, placeholder, type = "number" }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 5, display: "block" }}>{label}</label>
      <input className="inp" type={type} placeholder={placeholder} value={value} onChange={e => setter(e.target.value)} />
    </div>
  );
}

function ResultCard({ emoji, label, value, sub, color = "var(--acc)" }) {
  return (
    <div className="card">
      <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 10, color: "var(--t2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── 1. BMI / BMR / TDEE ────────────────────────────────────────────────────
function CalcBMI() {
  const { h, setH, w, setW, a, setA, g, setG } = useBaseInputs();
  const [act, setAct] = useState("1.55");
  const hm = parseFloat(h) / 100, wn = parseFloat(w), an = parseFloat(a);
  const bmi  = hm && wn ? (wn / (hm * hm)).toFixed(1) : null;
  const bmr  = g === "male" ? (10*wn + 6.25*parseFloat(h) - 5*an + 5).toFixed(0) : (10*wn + 6.25*parseFloat(h) - 5*an - 161).toFixed(0);
  const tdee = (parseFloat(bmr) * parseFloat(act)).toFixed(0);
  const info = !bmi ? null : parseFloat(bmi)<18.5 ? {l:"ნაკლები წონა",c:"var(--blu)",p:10} : parseFloat(bmi)<25 ? {l:"ნორმა ✓",c:"var(--acc)",p:34} : parseFloat(bmi)<30 ? {l:"ჭარბი წონა",c:"var(--yel)",p:62} : {l:"სიმსუქნე",c:"var(--red)",p:84};
  const actOpts = [["1.2","უმოძრაო"],["1.375","მსუბუქი"],["1.55","საშუალო"],["1.725","აქტიური"],["1.9","ძალიან აქტ."]];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div className="card">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <CalcField label="სიმაღლე (სმ)" value={h} setter={setH} placeholder="175" />
          <CalcField label="წონა (კგ)"    value={w} setter={setW} placeholder="75"  />
          <CalcField label="ასაკი"        value={a} setter={setA} placeholder="25"  />
          <div><label style={{fontSize:11,color:"var(--t2)",marginBottom:5,display:"block"}}>სქესი</label>
            <select className="inp" value={g} onChange={e=>setG(e.target.value)} style={{cursor:"pointer"}}>
              <option value="male">მამრობითი</option><option value="female">მდედრობითი</option>
            </select></div>
        </div>
        <div><label style={{fontSize:11,color:"var(--t2)",marginBottom:6,display:"block"}}>აქტივობის დონე</label>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {actOpts.map(([v,l]) => <button key={v} onClick={()=>setAct(v)} className={`ghost${act===v?" on":""}`} style={{fontSize:11,padding:"6px 10px"}}>{l}</button>)}
          </div>
        </div>
      </div>
      {bmi && <>
        <div className="card">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{fontSize:11,color:"var(--t2)"}}>BMI</div><div style={{fontSize:34,fontWeight:900}}>{bmi}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:info.c}}>{info.l}</div><div style={{fontSize:11,color:"var(--t2)",marginTop:4}}>იდ. წონა: {(22*hm*hm).toFixed(1)} კგ</div></div>
          </div>
          <div style={{height:10,background:"linear-gradient(to right,var(--blu),var(--acc),var(--yel),var(--red))",borderRadius:5,position:"relative",marginBottom:6}}>
            <div style={{position:"absolute",top:-4,left:`${info.p}%`,width:18,height:18,background:"white",borderRadius:"50%",transform:"translateX(-50%)",boxShadow:"0 2px 8px rgba(0,0,0,.4)",border:"2px solid var(--bg)"}} />
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t2)"}}><span>18.5</span><span>25</span><span>30</span><span>40+</span></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <ResultCard emoji="🔥" label="BMR"     value={`${bmr} kcal`}               sub="ბაზ. მეტაბოლიზმი" />
          <ResultCard emoji="⚡" label="TDEE"    value={`${tdee} kcal`}              sub="დღ. კალ. მოთხ." />
          <ResultCard emoji="📉" label="გახდომა" value={`${+tdee-500} kcal`}         sub="-500 kcal/დღე" color="var(--red)" />
          <ResultCard emoji="📈" label="მასა"    value={`${+tdee+300} kcal`}         sub="+300 kcal/დღე" color="var(--blu)" />
        </div>
      </>}
    </div>
  );
}

// ── 2. სხეულის ცხიმი (Navy Method) ───────────────────────────────────────
function CalcBodyFat() {
  const { h, setH, w, setW, g, setG } = useBaseInputs();
  const [neck,  setNeck]  = useState("38");
  const [waist, setWaist] = useState("85");
  const [hip,   setHip]   = useState("95");

  const hn = parseFloat(h), wn = parseFloat(w);
  const nk = parseFloat(neck), ws = parseFloat(waist), hp = parseFloat(hip);

  let bf = null;
  if (hn && nk && ws) {
    if (g === "male" && ws > nk) {
      bf = (495 / (1.0324 - 0.19077 * Math.log10(ws - nk) + 0.15456 * Math.log10(hn)) - 450).toFixed(1);
    } else if (g === "female" && ws + hp > nk) {
      bf = (495 / (1.29579 - 0.35004 * Math.log10(ws + hp - nk) + 0.22100 * Math.log10(hn)) - 450).toFixed(1);
    }
  }
  const bfn   = bf ? parseFloat(bf) : null;
  const fatKg = bfn && wn ? (wn * bfn / 100).toFixed(1) : null;
  const lbm   = fatKg ? (wn - parseFloat(fatKg)).toFixed(1) : null;
  const bfInfo = !bfn ? null
    : g==="male"
      ? bfn<6?"ესსენციალური":bfn<14?"სპორტული ✓":bfn<18?"ფიტნეს ✓":bfn<25?"ნორმა":bfn<30?"ჭარბი":"სიმსუქნე"
      : bfn<14?"ესსენციალური":bfn<21?"სპორტული ✓":bfn<25?"ფიტნეს ✓":bfn<32?"ნორმა":bfn<38?"ჭარბი":"სიმსუქნე";
  const bfColor = !bfn?null:bfn<(g==="male"?6:14)?"var(--yel)":bfn<(g==="male"?25:32)?"var(--acc)":"var(--red)";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div className="card">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <CalcField label="სიმაღლე (სმ)" value={h}     setter={setH}     placeholder="175" />
          <CalcField label="წონა (კგ)"    value={w}     setter={setW}     placeholder="75"  />
          <CalcField label="კისერი (სმ)"  value={neck}  setter={setNeck}  placeholder="38"  />
          <CalcField label="წელი (სმ)"    value={waist} setter={setWaist} placeholder="85"  />
          {g==="female" && <CalcField label="ბარძაყი (სმ)" value={hip} setter={setHip} placeholder="95" />}
          <div><label style={{fontSize:11,color:"var(--t2)",marginBottom:5,display:"block"}}>სქესი</label>
            <select className="inp" value={g} onChange={e=>setG(e.target.value)} style={{cursor:"pointer"}}>
              <option value="male">მამრობითი</option><option value="female">მდედრობითი</option>
            </select></div>
        </div>
        <p style={{fontSize:11,color:"var(--tm)"}}>📐 Navy Method — ყელი, წელი{g==="female"?" და ბარძაყი":""} გაზომე</p>
      </div>
      {bf && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div className="card" style={{gridColumn:"1/-1"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div><div style={{fontSize:11,color:"var(--t2)"}}>სხეულის ცხიმი</div><div style={{fontSize:34,fontWeight:900}}>{bf}<span style={{fontSize:16}}>%</span></div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:bfColor}}>{bfInfo}</div><div style={{fontSize:11,color:"var(--t2)",marginTop:3}}>ცხიმი: {fatKg}კგ</div></div>
            </div>
            <div style={{height:8,background:"linear-gradient(to right,var(--blu),var(--acc),var(--yel),var(--red))",borderRadius:4,position:"relative"}}>
              <div style={{position:"absolute",top:-5,left:`${Math.min(95,bfn*2)}%`,width:16,height:16,background:"white",borderRadius:"50%",transform:"translateX(-50%)",boxShadow:"0 2px 6px rgba(0,0,0,.4)",border:"2px solid var(--bg)"}} />
            </div>
          </div>
          <ResultCard emoji="💪" label="მჭლე მასა"  value={`${lbm} კგ`}  sub="Lean Body Mass"  color="var(--acc)" />
          <ResultCard emoji="🫧" label="ცხიმის მასა" value={`${fatKg} კგ`} sub="Fat Mass"       color="var(--red)" />
        </div>
      )}
    </div>
  );
}

// ── 3. მაკრო კალკულატორი ─────────────────────────────────────────────────
function CalcMacros() {
  const { h, setH, w, setW, a, setA, g, setG } = useBaseInputs();
  const [act,  setAct]  = useState("1.55");
  const [goal, setGoal] = useState("lose");

  const wn = parseFloat(w), an = parseFloat(a), hn = parseFloat(h);
  const bmr  = g==="male" ? 10*wn+6.25*hn-5*an+5 : 10*wn+6.25*hn-5*an-161;
  const tdee = bmr * parseFloat(act);
  const cals = goal==="lose" ? tdee-500 : goal==="gain" ? tdee+300 : tdee;
  const prot = (wn * 2.0).toFixed(0);
  const fat  = (wn * 0.9).toFixed(0);
  const carb = ((cals - prot*4 - fat*9) / 4).toFixed(0);

  const actOpts = [["1.2","უმოძრაო"],["1.375","მსუბუქი"],["1.55","საშუალო"],["1.725","აქტიური"]];
  const goalOpts = [["lose","📉 გახდომა"],["maintain","⚖️ შენარჩუნება"],["gain","📈 მასა"]];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div className="card">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <CalcField label="სიმაღლე (სმ)" value={h} setter={setH} placeholder="175" />
          <CalcField label="წონა (კგ)"    value={w} setter={setW} placeholder="75"  />
          <CalcField label="ასაკი"        value={a} setter={setA} placeholder="25"  />
          <div><label style={{fontSize:11,color:"var(--t2)",marginBottom:5,display:"block"}}>სქესი</label>
            <select className="inp" value={g} onChange={e=>setG(e.target.value)} style={{cursor:"pointer"}}>
              <option value="male">მამრობითი</option><option value="female">მდედრობითი</option>
            </select></div>
        </div>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:"var(--t2)",marginBottom:6,display:"block"}}>აქტივობა</label>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {actOpts.map(([v,l])=><button key={v} onClick={()=>setAct(v)} className={`ghost${act===v?" on":""}`} style={{fontSize:11,padding:"6px 10px"}}>{l}</button>)}
          </div>
        </div>
        <div>
          <label style={{fontSize:11,color:"var(--t2)",marginBottom:6,display:"block"}}>მიზანი</label>
          <div style={{display:"flex",gap:5}}>
            {goalOpts.map(([v,l])=><button key={v} onClick={()=>setGoal(v)} className={`ghost${goal===v?" on":""}`} style={{fontSize:11,padding:"6px 10px",flex:1}}>{l}</button>)}
          </div>
        </div>
      </div>
      {wn>0 && hn>0 && (
        <>
          <div className="card">
            <div style={{fontSize:11,color:"var(--t2)",marginBottom:4}}>სულ კალორია / დღე</div>
            <div style={{fontSize:32,fontWeight:900,color:"var(--acc)"}}>{cals.toFixed(0)} <span style={{fontSize:14,fontWeight:400,color:"var(--t2)"}}>kcal</span></div>
            <div style={{height:4,background:"var(--el)",borderRadius:2,marginTop:8}}>
              <div style={{width:"100%",height:"100%",background:"linear-gradient(to right,var(--blu),var(--acc),var(--yel))",borderRadius:2}} />
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <ResultCard emoji="🥩" label="ცილა"   value={`${prot}გ`} sub={`${(prot*4).toFixed(0)} kcal`} color="var(--blu)" />
            <ResultCard emoji="🍞" label="ნახ-წყ" value={`${Math.max(0,carb)}გ`} sub={`${(Math.max(0,carb)*4).toFixed(0)} kcal`} color="var(--yel)" />
            <ResultCard emoji="🥑" label="ცხიმი"  value={`${fat}გ`} sub={`${(fat*9).toFixed(0)} kcal`} color="var(--red)" />
          </div>
          <div className="card">
            {[["🥩 ცილა",`${prot}გ/დღე`,"var(--blu)",(prot*4/cals*100).toFixed(0)],
              ["🍞 ნახ-წყ",`${Math.max(0,carb)}გ/დღე`,"var(--yel)",(Math.max(0,carb)*4/cals*100).toFixed(0)],
              ["🥑 ცხიმი",`${fat}გ/დღე`,"var(--red)",(fat*9/cals*100).toFixed(0)]].map(([l,v,c,p])=>(
              <div key={l} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{fontWeight:600}}>{l}</span><span style={{color:c,fontWeight:700}}>{v} ({p}%)</span>
                </div>
                <div style={{height:5,background:"var(--el)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${p}%`,height:"100%",background:c,borderRadius:3}} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 4. 1RM კალკულატორი ────────────────────────────────────────────────────
function Calc1RM() {
  const [weight, setWeight] = useState("80");
  const [reps,   setReps]   = useState("8");
  const wn = parseFloat(weight), rn = parseFloat(reps);
  const epley   = wn && rn ? (wn * (1 + rn/30)).toFixed(1)    : null;
  const brzycki = wn && rn && rn<37 ? (wn * 36/(37-rn)).toFixed(1) : null;
  const avg1rm  = epley && brzycki ? ((parseFloat(epley)+parseFloat(brzycki))/2).toFixed(1) : null;

  const pcts = avg1rm ? [100,95,90,85,80,75,70,65,60] : [];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div className="card">
        <p style={{fontSize:12,color:"var(--t2)",marginBottom:12}}>🏋️ ერთი გამეორების მაქსიმუმი (One Rep Max)</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <CalcField label="წონა (კგ)"    value={weight} setter={setWeight} placeholder="80" />
          <CalcField label="გამეორება"    value={reps}   setter={setReps}   placeholder="8"  />
        </div>
      </div>
      {avg1rm && (
        <>
          <div className="card" style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:"var(--t2)",marginBottom:4}}>შენი 1RM</div>
            <div style={{fontSize:48,fontWeight:900,color:"var(--acc)",lineHeight:1}}>{avg1rm}</div>
            <div style={{fontSize:14,color:"var(--t2)",marginTop:4}}>კგ</div>
          </div>
          <div className="card">
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>სამუშაო წონები (%)</div>
            {pcts.map(p=>(
              <div key={p} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--bdr)"}}>
                <span style={{fontSize:13,color:"var(--t2)",width:45}}>{p}%</span>
                <div style={{flex:1,height:4,background:"var(--el)",borderRadius:2,margin:"0 12px",overflow:"hidden"}}>
                  <div style={{width:`${p}%`,height:"100%",background:p>=90?"var(--red)":p>=75?"var(--yel)":"var(--acc)",borderRadius:2}} />
                </div>
                <span style={{fontSize:14,fontWeight:700,color:p>=90?"var(--red)":p>=75?"var(--yel)":"var(--acc)",width:55,textAlign:"right"}}>{(avg1rm*p/100).toFixed(1)} კგ</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 5. წელი/ბარძაყის თანაფარდობა (WHR) ──────────────────────────────────
function CalcWHR() {
  const { g, setG } = useBaseInputs();
  const [waist, setWaist] = useState("85");
  const [hip,   setHip]   = useState("95");
  const ws = parseFloat(waist), hp = parseFloat(hip);
  const whr = ws && hp ? (ws/hp).toFixed(2) : null;
  const whrN = whr ? parseFloat(whr) : null;
  const risk = !whrN ? null
    : g==="male"
      ? whrN<0.90 ? {l:"დაბალი რისკი ✓",c:"var(--acc)"} : whrN<0.95 ? {l:"საშუალო რისკი",c:"var(--yel)"} : {l:"მაღალი რისკი",c:"var(--red)"}
      : whrN<0.80 ? {l:"დაბალი რისკი ✓",c:"var(--acc)"} : whrN<0.85 ? {l:"საშუალო რისკი",c:"var(--yel)"} : {l:"მაღალი რისკი",c:"var(--red)"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div className="card">
        <p style={{fontSize:12,color:"var(--t2)",marginBottom:12}}>📏 Waist-to-Hip Ratio — გულ-სისხლძარღვთა რისკის შეფასება</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <CalcField label="წელი (სმ)"    value={waist} setter={setWaist} placeholder="85" />
          <CalcField label="ბარძაყი (სმ)" value={hip}   setter={setHip}   placeholder="95" />
          <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,color:"var(--t2)",marginBottom:5,display:"block"}}>სქესი</label>
            <select className="inp" value={g} onChange={e=>setG(e.target.value)} style={{cursor:"pointer"}}>
              <option value="male">მამრობითი</option><option value="female">მდედრობითი</option>
            </select></div>
        </div>
      </div>
      {whr && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div className="card" style={{gridColumn:"1/-1"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,color:"var(--t2)"}}>WHR</div><div style={{fontSize:40,fontWeight:900}}>{whr}</div></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,color:risk.c}}>{risk.l}</div>
                <div style={{fontSize:11,color:"var(--t2)",marginTop:4}}>ნორმა: {g==="male"?"<0.90":"<0.80"}</div>
              </div>
            </div>
          </div>
          <ResultCard emoji="📏" label="წელი"    value={`${waist} სმ`} sub="Waist circumference" color="var(--yel)" />
          <ResultCard emoji="🍑" label="ბარძაყი" value={`${hip} სმ`}  sub="Hip circumference"  color="var(--org)" />
        </div>
      )}
    </div>
  );
}

// ── 6. წყლის მოთხოვნა ─────────────────────────────────────────────────────
function CalcWater() {
  const { w, setW, a, setA } = useBaseInputs();
  const [act, setAct] = useState("moderate");
  const wn = parseFloat(w), an = parseFloat(a);
  const base  = wn ? wn * 0.033 : null;
  const extra = act==="active" ? 0.5 : act==="very" ? 1.0 : 0;
  const ageAdj = an>55 ? 0.2 : 0;
  const total = base ? (base + extra - ageAdj).toFixed(1) : null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div className="card">
        <p style={{fontSize:12,color:"var(--t2)",marginBottom:12}}>💧 დღიური წყლის მოთხოვნა</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <CalcField label="წონა (კგ)" value={w} setter={setW} placeholder="75" />
          <CalcField label="ასაკი"     value={a} setter={setA} placeholder="25" />
        </div>
        <div><label style={{fontSize:11,color:"var(--t2)",marginBottom:6,display:"block"}}>აქტივობა</label>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[["sedentary","🛋️ უმოძრაო"],["moderate","🚶 საშუალო"],["active","🏃 აქტიური"],["very","⚡ ძალიან"]].map(([v,l])=>(
              <button key={v} onClick={()=>setAct(v)} className={`ghost${act===v?" on":""}`} style={{fontSize:11,padding:"6px 10px"}}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {total && (
        <>
          <div className="card" style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:"var(--t2)",marginBottom:4}}>რეკომენდებული</div>
            <div style={{fontSize:52,fontWeight:900,color:"var(--blu)",lineHeight:1}}>{total}</div>
            <div style={{fontSize:16,color:"var(--t2)",marginTop:4}}>ლიტრი / დღე</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            <ResultCard emoji="🥤" label="ჭიქა"  value={`${Math.round(parseFloat(total)/0.25)}`} sub="250მლ ჭიქა" color="var(--blu)" />
            <ResultCard emoji="🍶" label="ბოთლი" value={`${(parseFloat(total)/0.5).toFixed(1)}`}  sub="500მლ ბოთლი" color="var(--acc)" />
            <ResultCard emoji="💧" label="ლიტრი" value={total}                                     sub="სულ ლიტრი" color="var(--org)" />
          </div>
        </>
      )}
    </div>
  );
}

// ── კალკულატორების ჰაბი ──────────────────────────────────────────────────
const CALC_TABS = [
  { id:"bmi",    emoji:"📊", label:"BMI/BMR"   },
  { id:"bf",     emoji:"🫧", label:"ცხიმი%"    },
  { id:"macros", emoji:"🥗", label:"მაკრო"     },
  { id:"orm",    emoji:"🏋️", label:"1RM"       },
  { id:"whr",    emoji:"📏", label:"WHR"       },
  { id:"water",  emoji:"💧", label:"წყალი"     },
];

function BMICalc() {
  const [ct, setCt] = useState("bmi");
  return (
    <div style={{padding:"0 16px"}}>
      {/* horizontal scroll tab bar */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:4}}>
        {CALC_TABS.map(t=>(
          <button key={t.id} onClick={()=>setCt(t.id)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 12px",borderRadius:12,border:`1px solid ${ct===t.id?"var(--bdr-a)":"var(--bdr)"}`,background:ct===t.id?"var(--acc-dim)":"var(--el)",cursor:"pointer",flexShrink:0,fontFamily:"var(--font)"}}>
            <span style={{fontSize:18}}>{t.emoji}</span>
            <span style={{fontSize:10,fontWeight:600,color:ct===t.id?"var(--acc)":"var(--t2)",whiteSpace:"nowrap"}}>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="fu">
        {ct==="bmi"    && <CalcBMI />}
        {ct==="bf"     && <CalcBodyFat />}
        {ct==="macros" && <CalcMacros />}
        {ct==="orm"    && <Calc1RM />}
        {ct==="whr"    && <CalcWHR />}
        {ct==="water"  && <CalcWater />}
      </div>
    </div>
  );
}

const FTABS = [{ id: "diary", l: "დღიური", I: BookOpen }, { id: "plan", l: "კვირა", I: Target }, { id: "water", l: "წყალი", I: Droplets }, { id: "ai", l: "AI", I: MessageCircle }, { id: "bmi", l: "კალკ.", I: Calculator }];

// ─── WEEKLY MEAL PLAN ──────────────────────────────────────────────────────
// Meal database: 15 breakfast + 15 lunch + 15 dinner = 45 meals total
// kcal values are for ~2000 kcal/day baseline — scaled at render time
const MEAL_DB = {
  // ── 35 breakfast options ───────────────────────────────────────────────────
  breakfast: [
    { id:"b1",  name:"შვრია ბანანით",                    emoji:"🥣", kcal:380, p:12, c:65, f:8,  time:5,  ing:["შვრია 80გ","ბანანი 1ც","რძე 200მლ","თაფლი 1 ჩ.კ."] },
    { id:"b2",  name:"კვ. ომლ. ისპ.-პომ.",              emoji:"🍳", kcal:310, p:22, c:8,  f:20, time:10, ing:["კვ. 3ც","ისპ. 100გ","პომ. 1ც","ზ. ზ. 1 ჩ.კ.","მარ."] },
    { id:"b3",  name:"ხაჭო კენკრით",                    emoji:"🍓", kcal:320, p:18, c:38, f:8,  time:5,  ing:["ხაჭო 200გ","მარწყვი 100გ","მოცვი 50გ","თაფლი 2 ჩ.კ."] },
    { id:"b4",  name:"გრეჩიხა რძით",                    emoji:"🫕", kcal:370, p:13, c:68, f:7,  time:15, ing:["გრეჩ. 80გ","რძე 150მლ","კარაქი 1 ჩ.კ.","მარილი"] },
    { id:"b5",  name:"ომლეტი ბოსტნეულით",               emoji:"🥚", kcal:360, p:24, c:12, f:22, time:10, ing:["კვ. 3ც","ბ. პილ. 1/2ც","პომ. 1ც","ყველი 30გ"] },
    { id:"b6",  name:"შვრია ნიგოზ-ვაშლით",             emoji:"🌰", kcal:440, p:14, c:58, f:18, time:5,  ing:["შვრია 80გ","ნიგოზი 30გ","ჩია 10გ","ვაშლი 1/2ც","თაფლი"] },
    { id:"b7",  name:"ავოკ. ტოსტი კვ.-ით",              emoji:"🥑", kcal:370, p:20, c:22, f:22, time:8,  ing:["პური 2 ნ.","ავოკ. 1/2ც","კვ. 2ც","ლიმ.","მარ."] },
    { id:"b8",  name:"კვ. ავოკადოთი",                   emoji:"🥑", kcal:460, p:20, c:18, f:32, time:10, ing:["კვ. 2ც","ავოკ. 1/2ც","პური 2 ნ.","ლიმ.","მარ."] },
    { id:"b9",  name:"პ. შ. ხილით",                     emoji:"💪", kcal:400, p:35, c:45, f:8,  time:3,  ing:["პ. შ. 1 სკ.","ბანანი 1ც","მოცვი 100გ","რძე 200მლ"] },
    { id:"b10", name:"მიუსლი ბ. იოგ.-ით",               emoji:"🥗", kcal:430, p:16, c:62, f:12, time:5,  ing:["მიუსლი 80გ","ბ. იოგ. 200გ","ნახ. ხილი 30გ","თაფლი"] },
    { id:"b11", name:"შვრ. ფ. კენ.-ხილ.",               emoji:"🫙", kcal:350, p:13, c:60, f:7,  time:8,  ing:["შვრია 80გ","მოცვი 80გ","ვაშლი 1/2ც","ბ. იოგ. 100გ","თაფლი"] },
    { id:"b12", name:"ბრინჯ. ფაფა ვაშლით",              emoji:"🍚", kcal:350, p:8,  c:70, f:5,  time:15, ing:["ბრინჯი 70გ","ვაშლი 1ც","გ. კენ. 50გ","დარ.","თაფლი"] },
    { id:"b13", name:"ტოსტი ყველ-პომ.-ით",              emoji:"🍞", kcal:390, p:16, c:42, f:16, time:7,  ing:["პური 2 ნ.","სულგ. 50გ","პომ. 1ც","მ. ბ. პ.","ბაზ."] },
    { id:"b14", name:"შვრია მანდარინით",                 emoji:"🍊", kcal:340, p:11, c:60, f:6,  time:5,  ing:["შვრია 70გ","მანდ. 2ც","ბ. იოგ. 100გ","ჩია 5გ","თაფლი"] },
    { id:"b15", name:"კვ. სოკო-ისპანახით",              emoji:"🍄", kcal:310, p:24, c:8,  f:20, time:12, ing:["კვ. 3ც","შამ. 100გ","ისპ. 50გ","ზ. ზ. 1 ჩ.კ.","ნიორი"] },
    { id:"b16", name:"შვრ. ფ. კენ.-ნუშ.",               emoji:"🍓", kcal:370, p:13, c:58, f:12, time:8,  ing:["შვრია 80გ","მოცვი 100გ","ნუში 20გ","ბ. იოგ. 100გ","თაფლი"] },
    { id:"b17", name:"ხაჭოიანი ტოსტი კიტრით",          emoji:"🥪", kcal:410, p:20, c:38, f:18, time:8,  ing:["პური 2 ნ.","ხაჭო 100გ","კიტრი 1ც","მარ.","ზ. ზ. 1 ჩ.კ."] },
    { id:"b18", name:"კვ. ისპ.-ყველით",                emoji:"🍳", kcal:330, p:26, c:6,  f:22, time:8,  ing:["კვ. 3ც","ისპ. 100გ","ყველი 30გ","ნიორი","ზ. ზ. 1 ჩ.კ."] },
    { id:"b19", name:"შვრია ქლ.-ინჟ. ჩირით",          emoji:"🍑", kcal:410, p:12, c:72, f:8,  time:5,  ing:["შვრია 80გ","ქლ. ჩირი 30გ","ინჟ. ჩირი 20გ","რძე 200მლ","ვანილი"] },
    { id:"b20", name:"ბანანის სმუზ. ბოული",            emoji:"🫙", kcal:380, p:14, c:68, f:6,  time:5,  ing:["ბანანი 2ც","ბ. იოგ. 150გ","გ. კენ. 50გ","მიუსლი 30გ","ჩია 5გ"] },
    { id:"b21", name:"ომლ. მწვ. ბ. პილ.",              emoji:"🫑", kcal:370, p:22, c:14, f:24, time:12, ing:["კვ. 3ც","მ. ბ. პ. 1ც","ნიახ.","ქინძ.","ყველი 40გ","ზ. ზ. 1 ჩ.კ."] },
    { id:"b22", name:"ტოსტი ნუშ.კარ.-ბანან.",          emoji:"🥜", kcal:430, p:14, c:48, f:20, time:5,  ing:["პური 2 ნ.","ნ. კარ. 2 ჩ.კ.","ბანანი 1ც","კენ."] },
    { id:"b23", name:"კვ. ომლ. ავოკ.-პომ.",            emoji:"🥚", kcal:370, p:24, c:10, f:26, time:10, ing:["კვ. 3ც","ავოკ. 1/4ც","პომ. 1ც","ისპ. 50გ","ზ. ზ. 1 ჩ.კ."] },
    { id:"b24", name:"კვინოა ვაშლ.-ნუშ.",              emoji:"🍲", kcal:360, p:16, c:58, f:8,  time:15, ing:["კვინოა 70გ","ვაშლი 1ც","ბ. იოგ. 100გ","ნუში 10გ","ვანილი"] },
    { id:"b25", name:"ბ. იოგ. კივ.-ავოკ.",             emoji:"🫙", kcal:290, p:20, c:28, f:10, time:5,  ing:["ბ. იოგ. 200გ","კივი 1ც","ავოკ. 1/2ც","ვანილი","კენ."] },
    { id:"b26", name:"ბრინჯი ვ. ფასოლ.",               emoji:"🍛", kcal:400, p:16, c:62, f:10, time:15, ing:["ბრინჯი 80გ","ვ. ფასოლ. 60გ","ზ. ზ. 1 ჩ.კ.","ნიახ.","მარ."] },
    { id:"b27", name:"კვ. ომლ. ბ.-ვაშლ.",             emoji:"🌿", kcal:350, p:20, c:38, f:12, time:10, ing:["კვ. 3ც","ბანანი 1/2ც","ვაშლი 1ც","მარ.","ნიახ.","ზ. ზ. 1 ჩ.კ."] },
    { id:"b28", name:"პროტ. შ. ვ.-ბ. იოგ.",           emoji:"🍌", kcal:370, p:32, c:42, f:6,  time:3,  ing:["პ. შ. 1 სკ.","ვაშლი 1ც","ბანანი 1ც","ბ. იოგ. 100გ","ვანილი"] },
    { id:"b29", name:"კვ. შამ.-ისპ.-სუნ.",             emoji:"🥚", kcal:310, p:24, c:8,  f:20, time:12, ing:["კვ. 3ც","შამ. 120გ","ისპ. 80გ","ნიახ.","ზ. ზ. 1 ჩ.კ.","სუნ."] },
    { id:"b30", name:"კვ.-ავოკ.-პ. ბოული",            emoji:"🧆", kcal:440, p:22, c:48, f:16, time:15, ing:["კვ. 2ც","პური 2 ნ.","ავოკ. 1/2ც","ლიმ.","ზ. ზ. 1 ჩ.კ.","მარ."] },
    { id:"b31", name:"ბ. იოგ. მოც.-ჩია-ნ.",           emoji:"🫐", kcal:320, p:16, c:48, f:6,  time:5,  ing:["ბ. იოგ. 200გ","მოცვი 80გ","ვანილი 1 ჩ.კ.","ჩია 5გ","ნუში 10გ"] },
    { id:"b32", name:"შვრია ბანან.-ნუშ.-ვან.",         emoji:"🍫", kcal:460, p:15, c:68, f:14, time:7,  ing:["შვრია 80გ","ბანანი 1ც","ნუში 20გ","ვანილი 1 ჩ.კ.","რძე 200მლ"] },
    { id:"b33", name:"ვ. ფ.-ბ. იოგ. სალ.",            emoji:"🥗", kcal:350, p:28, c:22, f:16, time:8,  ing:["ვ. ფ. 80გ","ბ. იოგ. 100გ","კიტრი","პომ. 1ც","ლიმ.","ზ. ზ."] },
    { id:"b34", name:"ც. ი.-ვაშლ.-კენ.-ნ.",           emoji:"🍓", kcal:330, p:18, c:44, f:8,  time:5,  ing:["ც. ი. 100გ","ვაშლი 1ც","კ. კენ. 50გ","ნუში 15გ","ვანილი"] },
    { id:"b35", name:"შვრია კივ.-ბანან.-ვან.",         emoji:"🥣", kcal:420, p:14, c:66, f:10, time:15, ing:["შვრია 80გ","კივი 1ც","ბანანი 1ც","რძე 200მლ","ვანილი 1 ჩ.კ."] },
  ],

  // ── 35 lunch options ───────────────────────────────────────────────────────
  lunch: [
    { id:"l1",  name:"გრილ ქ. ბრინჯ.-ბოსტ.",           emoji:"🍗", kcal:650, p:52, c:65, f:14, time:30, ing:["ქ. მკ. 180გ","ბრინჯი 80გ","ბ. ნარ. 100გ","ზ. ზ.","სუნ."] },
    { id:"l2",  name:"ლობ. ბ-ო.-ავ. სალ.",               emoji:"🫘", kcal:420, p:22, c:52, f:14, time:15, ing:["ლობიო 200გ","ბ-ო 100გ","ავოკ. 1/2ც","ლიმ.","ზ. ზ.","ქინძ."] },
    { id:"l3",  name:"ორაგ. კარტოფ.-ით",               emoji:"🐟", kcal:680, p:48, c:55, f:22, time:25, ing:["ორაგ. 180გ","კარტ. 200გ","ისპ. 50გ","ლიმ.","ზ. ზ."] },
    { id:"l4",  name:"ქათმის სუპი",                     emoji:"🍲", kcal:420, p:32, c:38, f:12, time:35, ing:["ქათ. 150გ","კარტ. 2ც","ნიორი 2 კბ.","სელ. 2ც","ქინძ.","პილ."] },
    { id:"l5",  name:"ქ. ბ-ო. კვინ. ბ.",                emoji:"🍗", kcal:580, p:50, c:58, f:14, time:25, ing:["ქათ. 180გ","ბ-ო 100გ","კვინოა 80გ","ნიორი","ზ. ზ.","სუნ."] },
    { id:"l6",  name:"გრილ ქ. კვინ.-ბ-ო.",             emoji:"🍗", kcal:560, p:50, c:52, f:12, time:30, ing:["ქათ. 180გ","კვინოა 80გ","ბ-ო 80გ","ლიმ.","ზ. ზ.","სუნ."] },
    { id:"l7",  name:"ჩახოხბილი",                       emoji:"🍛", kcal:620, p:44, c:28, f:32, time:40, ing:["ქათ. 250გ","პომ. 2ც","ნიორი 2 კბ.","ბ. პ. 1ც","ქინძ.","სუნ."] },
    { id:"l8",  name:"სტეიქი ახ. სალ.-ით",             emoji:"🥩", kcal:720, p:56, c:18, f:42, time:20, ing:["ბ. ხ. 200გ","ახ. სალ.","ზ. ზ.","ლიმ.","მარ."] },
    { id:"l9",  name:"ლობიო ბ-ო.-ყვ.-ით",              emoji:"🫘", kcal:420, p:24, c:58, f:10, time:25, ing:["ლობიო 200გ","ბ-ო 100გ","ყვ. 30გ","ნიახ.","ქინძ.","ზ. ზ."] },
    { id:"l10", name:"ტუნა-ბრინჯ. ბოული",               emoji:"🍱", kcal:600, p:42, c:68, f:12, time:15, ing:["ტუნა 120გ","ბრინჯი 90გ","ავოკ. 1/2ც","კ. ო.","კენ.","ლიმ."] },
    { id:"l11", name:"ქ. ნიგვ. სოუსით",                emoji:"🌰", kcal:650, p:46, c:24, f:38, time:35, ing:["ქათ. 200გ","ნიგოზი 60გ","ნიახ.","ნ. ყვ.","ქინძ.","სუნ."] },
    { id:"l12", name:"კვინოა ბოსტ. ბოული",              emoji:"🥦", kcal:490, p:20, c:72, f:14, time:25, ing:["კვინოა 90გ","ბ. პ. 1ც","ყვ. 1ც","ისპ. 50გ","ლიმ.","ზ. ზ."] },
    { id:"l13", name:"ინდ. ბოსტნეულ.-ით",              emoji:"🦃", kcal:520, p:46, c:32, f:16, time:30, ing:["ინდ. 180გ","ყვ. 1ც","ბ. პ. 1ც","პომ. 1ც","ზ. ზ."] },
    { id:"l14", name:"ქ. ბ-ო. ბოსტ. სუპი",            emoji:"🍜", kcal:440, p:36, c:38, f:10, time:30, ing:["ქათ. 150გ","ბ-ო 100გ","ნიახ. 1ც","კარტ. 2ც","სელ.","ქინძ."] },
    { id:"l15", name:"ტუნა კვ. სალ.",                   emoji:"🥗", kcal:480, p:38, c:22, f:24, time:10, ing:["ტუნა 120გ","კვ. 2ც","მ. ო.","პომ.","სელ. ფ.","ლიმ."] },
    { id:"l16", name:"ხარჩო",                            emoji:"🍲", kcal:580, p:32, c:42, f:28, time:45, ing:["ბ. ხ. 200გ","ბრინჯი 70გ","ნიგ. 50გ","ხ. მ.","ქინძ.","სუნ."] },
    { id:"l17", name:"შ. ქ. ბოსტნეულ.-ით",             emoji:"🍗", kcal:600, p:50, c:28, f:30, time:25, ing:["ქათ. 200გ","ბ. პ. 1ც","ყვ. 1ც","ნიახ. 1ც","ზ. ზ.","სუნ."] },
    { id:"l18", name:"ორაგ.-ბ-ო. კვინ. ბ.",            emoji:"🍱", kcal:580, p:46, c:40, f:20, time:25, ing:["ორაგ. 150გ","ბ-ო 100გ","კვინოა 70გ","ლიმ.","ზ. ზ.","სუნ."] },
    { id:"l19", name:"მწვადი ახ. სალ.-ით",              emoji:"🥩", kcal:680, p:58, c:16, f:38, time:30, ing:["ღ. ხ. 200გ","ახ. სალ.","ქინძ.","ბ. პ.","ლიმ."] },
    { id:"l20", name:"ლობ.-ბრ. ისპ. ბ.",                emoji:"🫙", kcal:530, p:26, c:76, f:12, time:20, ing:["ლობიო 150გ","ბრინჯი 80გ","ისპ. 100გ","ნიორი","ზ. ზ."] },
    { id:"l21", name:"სოია ლ.-ბრ.-ყვ. ბ.",             emoji:"🫘", kcal:510, p:28, c:68, f:12, time:25, ing:["სოია ლ. 150გ","ბრინჯი 70გ","ყვ. 40გ","ნიორი","ლიმ.","ზ. ზ."] },
    { id:"l22", name:"ლოქო-ბრ. ბ.",                    emoji:"🐟", kcal:570, p:44, c:55, f:16, time:20, ing:["ლოქო 160გ","ბრინჯი 80გ","ლიმ.","ნიორი","ზ. ო.","სუნ."] },
    { id:"l23", name:"კვინ.-ბ.ყვ. ბ.",                 emoji:"🥦", kcal:480, p:24, c:64, f:14, time:20, ing:["კვინოა 120გ","ბ. ყვ. 60გ","ისპ. 80გ","ლიმ.","ზ. ზ.","ბაზ."] },
    { id:"l24", name:"ქ.-ყვ.-კარტ. ბ.",                emoji:"🥙", kcal:590, p:44, c:38, f:22, time:25, ing:["ქათ. 150გ","ყვ. 50გ","კარტ. 1ც","ნიორი","ხახ.","ლიმ."] },
    { id:"l25", name:"ორ.-კარტ. სალ.",                  emoji:"🥗", kcal:540, p:36, c:48, f:18, time:20, ing:["ორაგ. 130გ","კარტ. 150გ","ისპ. 50გ","ლიმ.","ზ. ო.","სუნ."] },
    { id:"l26", name:"ინდ.-ბრ.-კარტ. ბ.",               emoji:"🦃", kcal:510, p:48, c:36, f:14, time:25, ing:["ინდ. 180გ","ბრინჯი 70გ","კარტ. 150გ","ლიმ.","ზ. ზ.","სუნ."] },
    { id:"l27", name:"სახ.ხ.-ბ.ი. ბ.",                  emoji:"🥩", kcal:660, p:52, c:42, f:28, time:35, ing:["სახ. ხ. 200გ","ბ. ყვ.","ბ. ც. 1ც","ნიორი","ქინძ.","სელ."] },
    { id:"l28", name:"ბრ.-ავ.-ისპ. ბ.",                 emoji:"🍱", kcal:500, p:22, c:60, f:18, time:15, ing:["ბრინჯი 90გ","ავოკ. 1/2ც","ისპ. 80გ","კ. ო.","ლიმ.","ზ. ზ."] },
    { id:"l29", name:"ქ.-ისპ.-ბრ. ბ.",                  emoji:"🍗", kcal:580, p:50, c:42, f:18, time:30, ing:["ქ. ბ. 180გ","ისპ. 100გ","ბრინჯი 70გ","ნიორი","ზ. ზ.","სუნ."] },
    { id:"l30", name:"შამ.-ბრ.-ყვ. ბ.",                 emoji:"🌿", kcal:560, p:24, c:80, f:14, time:30, ing:["შამ. 100გ","ბრინჯი 90გ","ბ. ყვ. 40გ","ნიორი","ლიმ.","ზ. ზ."] },
    { id:"l31", name:"ბ.სოია-კარტ. ბ.",                 emoji:"🥘", kcal:620, p:46, c:52, f:22, time:40, ing:["ბ. სოია 200გ","კარტ. 200გ","ნიორი","ქინძ.","ბ. ი.","სუნ."] },
    { id:"l32", name:"ქ.-ბ.ი.-ტომ. ბ.",                 emoji:"🍗", kcal:520, p:46, c:26, f:16, time:25, ing:["ქათ. 160გ","ბ. ი. 100გ","პომ. 2ც","ნიორი","ბ. ყვ. 30გ","ბაზ."] },
    { id:"l33", name:"ქ. ნ.კ.-ყვ. კ.",                  emoji:"🌿", kcal:600, p:44, c:30, f:32, time:35, ing:["ქათ. 180გ","ნ. კ. 40გ","ბ. ყვ. 40გ","ქინძ.","სუნ.","ა. ზ. ზ."] },
    { id:"l34", name:"ბრ.-ისპ.-ც.ლ. ბ.",               emoji:"🫘", kcal:540, p:28, c:72, f:14, time:25, ing:["ბრინჯი 70გ","ისპ. 100გ","ც. ლ. 60გ","ლიმ.","ნიორი","ზ. ზ."] },
    { id:"l35", name:"სოია ბ.-ბრ. ბ.",                  emoji:"🍲", kcal:500, p:30, c:56, f:16, time:30, ing:["სოია ბ. 150გ","ბრინჯი 80გ","ნიორი","ქინძ.","ბ. ი.","ზ. ზ."] },
  ],

  // ── 35 dinner options ──────────────────────────────────────────────────────
  dinner: [
    { id:"d1",  name:"ორაგ. გრ. ისპ.-ით",              emoji:"🐟", kcal:480, p:42, c:8,  f:28, time:20, ing:["ორაგ. 180გ","ისპ. 100გ","ნიორი","ლიმ.","ზ. ზ.","სუნ."] },
    { id:"d2",  name:"ქ. ბრ.-ბ-ო.-ით",                emoji:"🍗", kcal:560, p:48, c:55, f:12, time:25, ing:["ქათ. 180გ","ბრინჯი 80გ","ბ-ო 80გ","ზ. ზ.","სუნ."] },
    { id:"d3",  name:"ბოსტ. სუპი",                    emoji:"🥣", kcal:280, p:10, c:45, f:6,  time:25, ing:["კარტ. 2ც","ნიახ. 1ც","სელ. 2ც","ისპ. 80გ","ბ. ყვ.","ქინძ."] },
    { id:"d4",  name:"გრ. ინდ. ბოსტ.-ით",             emoji:"🦃", kcal:440, p:50, c:12, f:18, time:25, ing:["ინდ. 200გ","ბ. ა.","ბ. პ.","ლიმ.","ზ. ზ.","ნიახ."] },
    { id:"d5",  name:"ომლ. ბ.პ.-ი.ო.-ყვ.",            emoji:"🍳", kcal:340, p:28, c:10, f:22, time:10, ing:["კვ. 3ც","ბ. პ. 1/2ც","ი. ო.","ყვ. 30გ","ზ. ზ."] },
    { id:"d6",  name:"ტუნა სალათი",                   emoji:"🥗", kcal:380, p:34, c:18, f:18, time:10, ing:["ტუნა 120გ","სალ. ფ.","პომ. 1ც","კ. ო.","ლიმ.","ზ. ზ."] },
    { id:"d7",  name:"ჩახოხბ. (მსუბ.)",               emoji:"🍲", kcal:520, p:40, c:22, f:26, time:40, ing:["ქათ. 200გ","პომ. 2ც","ნიორი 2 კბ.","ბ. პ. 1ც","ქინძ.","სუნ."] },
    { id:"d8",  name:"ბ-ო.-ავ. კვინ. ბ.",              emoji:"🥙", kcal:490, p:22, c:58, f:18, time:20, ing:["კვინოა 80გ","ავოკ. 1/2ც","ი. ბ. 1/2ც","ბ-ო","ი. ო.","ლიმ."] },
    { id:"d9",  name:"ლოქო ახ. სალ.-ით",              emoji:"🐡", kcal:460, p:44, c:14, f:22, time:20, ing:["ლოქო 180გ","ახ. ი.","პომ. 1ც","კ. ო.","ლიმ.","ზ. ო."] },
    { id:"d10", name:"ისპ.-ლობ. ბ.",                  emoji:"🫘", kcal:380, p:22, c:52, f:8,  time:25, ing:["ლობ. 150გ","ისპ. 100გ","ნიორი 2 კბ.","ბ. ყვ. 1ც","ლიმ.","კარ."] },
    { id:"d11", name:"ქ. ისპ.-ნ.ყვ. სოუ.",            emoji:"🍗", kcal:510, p:52, c:18, f:22, time:20, ing:["ქათ. 200გ","ისპ. 150გ","ნ. 1ც","ნ. ყვ. 30გ","ბ. ყვ.","სუნ."] },
    { id:"d12", name:"კვინ.-ბ-ო.-კარტ. ბ.",            emoji:"🥦", kcal:420, p:18, c:62, f:10, time:20, ing:["კვინოა 80გ","ბ-ო 100გ","კარტ. 2ც","ნიორი 1ც","ლიმ.","ქინძ."] },
    { id:"d13", name:"სტეიქ. ბ.პ.-ნ. სალ.",           emoji:"🥩", kcal:600, p:54, c:18, f:32, time:20, ing:["ბ. ხ. 180გ","ბ. პ. 1ც","ნიახ.","ლიმ.","ზ. ო.","სუნ."] },
    { id:"d14", name:"ომლ. ავ.კ.-ყვ.-ი.ო.",           emoji:"🍳", kcal:360, p:30, c:8,  f:24, time:12, ing:["კვ. 3ც","ავ. კ. 50გ","ყვ. 30გ","ი. ო. 50გ","ქინძ."] },
    { id:"d15", name:"ბრ.-ტუნ.-ავ. სალ.",             emoji:"🥗", kcal:500, p:36, c:52, f:16, time:15, ing:["ბრინჯი 70გ","ტუნა 100გ","ავოკ. 1/2ც","კ. ო.","ლიმ.","ზ. ზ."] },
    { id:"d16", name:"ბ.ი.-ისპ. სალ.",                emoji:"🌿", kcal:320, p:14, c:42, f:10, time:10, ing:["ბ. ი. 100გ","ისპ. 100გ","პომ. 1ც","კ. ო.","ლიმ.","ზ. ო."] },
    { id:"d17", name:"ქ.-ბ.ი.-ნ. ბ.",                 emoji:"🍗", kcal:480, p:44, c:36, f:16, time:25, ing:["ქათ. 160გ","ბ. ი. 100გ","ნიორი 2 კბ.","ლიმ.","ზ. ო.","სუნ."] },
    { id:"d18", name:"ბ-ო.-ორ. ბ.",                   emoji:"🐟", kcal:440, p:40, c:20, f:20, time:20, ing:["ორაგ. 150გ","ბ-ო 100გ","ლიმ.","ნიორი","ზ. ო.","სუნ."] },
    { id:"d19", name:"ბ.ი.-ბრ.-ყვ. სალ.",             emoji:"🥗", kcal:350, p:16, c:46, f:12, time:10, ing:["ბ. ი. 100გ","ბრინჯი 70გ","ყვ. 30გ","ლიმ.","ზ. ო."] },
    { id:"d20", name:"კარტ.-ბ.ი.-ბრ. ბ.",             emoji:"🍲", kcal:390, p:28, c:42, f:12, time:30, ing:["კარტ. 1ც","ბ. ი. 100გ","ბრინჯი 80გ","ნიახ.","ქინძ.","ბ. ყვ."] },
    { id:"d21", name:"სტ.-ბ.პ. სალ.",                 emoji:"🥩", kcal:560, p:50, c:20, f:28, time:20, ing:["სტ. 160გ","ბ. პ. 1ც","ისპ.","ლიმ.","ზ. ო.","სუნ."] },
    { id:"d22", name:"ლობ.-ი.-ბ-ო. ბ.",               emoji:"🫘", kcal:400, p:24, c:52, f:10, time:25, ing:["ლობ. 150გ","ისპ. 80გ","ბ-ო 50გ","ნიორი","ბ. ყვ.","ლიმ."] },
    { id:"d23", name:"ორ.-სელ.-ბ.ი. ბ.",              emoji:"🐟", kcal:510, p:42, c:30, f:22, time:25, ing:["ორაგ. 150გ","სელ. 100გ","ბ. ი. 80გ","ლიმ.","ზ. ო.","სუნ."] },
    { id:"d24", name:"ქ.-ყვ.-ბ-ო. ბ.",                emoji:"🍗", kcal:530, p:46, c:40, f:18, time:25, ing:["ქათ. 170გ","ყვ. 50გ","ბ-ო 80გ","ნიორი","ლიმ.","ზ. ო."] },
    { id:"d25", name:"ბრ.-ი.ო.-ავ. ბ.",               emoji:"🥑", kcal:460, p:18, c:52, f:22, time:15, ing:["ბრინჯი 70გ","ი. ო. 150გ","ავოკ. 1/2ც","ლიმ.","ნუში 10გ","ზ. ზ."] },
    { id:"d26", name:"სტ.-ბ.ი.-კ.ო. სალ.",            emoji:"🫙", kcal:380, p:34, c:28, f:16, time:10, ing:["სტ. 120გ","ბ. ი. 80გ","კ. ო.","ლიმ.","ზ. ო.","სუნ."] },
    { id:"d27", name:"ბ.ი.-ი.-კარტ. სუპ.",            emoji:"🍲", kcal:340, p:14, c:52, f:8,  time:25, ing:["ბ. ი. 100გ","ისპ. 100გ","კარტ. 1ც","ნიახ. 1ც","ბ. ყვ.","ქინძ."] },
    { id:"d28", name:"ინდ.-ბრ.-ვ.ფ. ბ.",              emoji:"🦃", kcal:490, p:48, c:34, f:16, time:25, ing:["ინდ. 180გ","ბრინჯი 70გ","ვ. ფ. 50გ","ლიმ.","ზ. ზ.","სუნ."] },
    { id:"d29", name:"ბ-ო.-ყვ.-ი. სალ.",              emoji:"🥗", kcal:430, p:20, c:48, f:16, time:15, ing:["ბ-ო 70გ","ყვ. 40გ","ისპ. 80გ","ლიმ.","ნუში","ზ. ო."] },
    { id:"d30", name:"ქ.-კარტ.-ბ-ო. ბ.",              emoji:"🍗", kcal:520, p:46, c:42, f:16, time:30, ing:["ქათ. 160გ","კარტ. 150გ","ბ-ო 70გ","ნიორი","ლიმ.","სუნ."] },
    { id:"d31", name:"ო.ბ.-ი.-ყვ. სალ.",              emoji:"🌿", kcal:370, p:16, c:54, f:10, time:15, ing:["ო. ბ. 80გ","ისპ. 100გ","ყვ. 30გ","ნიორი","ლიმ.","ზ. ზ."] },
    { id:"d32", name:"ბ-ო.-ლობ.-ყვ. ბ.",              emoji:"🫘", kcal:410, p:22, c:54, f:12, time:20, ing:["ლობ. 120გ","ბ-ო 70გ","ყვ. 30გ","ისპ. 60გ","ლიმ.","ზ. ო."] },
    { id:"d33", name:"სტ.-ბ-ო.-ბ.ი. სალ.",            emoji:"🐟", kcal:470, p:40, c:32, f:18, time:20, ing:["სტ. 140გ","ბ-ო 70გ","ბ. ი. 80გ","ლიმ.","ნიახ.","ზ. ზ."] },
    { id:"d34", name:"ი.-ბ-ო.-ყვ. სალ.",              emoji:"🥦", kcal:350, p:14, c:52, f:10, time:15, ing:["ისპ. 100გ","ბ-ო 70გ","ყვ. 30გ","ნიორი","ლიმ.","ზ. ო."] },
    { id:"d35", name:"ქ.-ბ-ო.-ი. ბ.",                 emoji:"🍲", kcal:500, p:38, c:44, f:16, time:30, ing:["ქათ. 160გ","ბ-ო 70გ","ისპ. 90გ","ნიორი","ქინძ.","სუნ."] },
  ],

  // ── 35 drink options ───────────────────────────────────────────────────────
  drinks: [
    { id:"dr1",  name:"მწვ. ჩ. თაფ.-ლიმ.",             emoji:"🍵", kcal:25,  p:0,  c:6,  f:0,  time:3,  ing:["მწვ. ჩ. 1 ჩ.კ.","ც. წ. 250მლ","თაფლი 1 ჩ.კ.","ლიმ. 1 ნ."] },
    { id:"dr2",  name:"შავი ყავა",                     emoji:"☕", kcal:5,   p:0,  c:1,  f:0,  time:3,  ing:["ყ. 8გ","ც. წ. 200მლ"] },
    { id:"dr3",  name:"ლიმ. ლ. თაფ.-მ.ყ.",            emoji:"🍋", kcal:60,  p:0,  c:15, f:0,  time:5,  ing:["ლიმ. 1ც","ც. წ. 300მლ","თ. 1 ჩ.კ.","მ. ყ. 4 ფ."] },
    { id:"dr4",  name:"კეფირი",                        emoji:"🥛", kcal:100, p:8,  c:12, f:2,  time:1,  ing:["კეფ. 250მლ"] },
    { id:"dr5",  name:"პ. შ. ბან.-კაკ. სმ.",           emoji:"💪", kcal:200, p:32, c:22, f:3,  time:3,  ing:["პ. შ. 1 სკ.","ბანანი 1ც","რძე 200მლ"] },
    { id:"dr6",  name:"ბან.-ავ. ბ.იოგ. სმ.",           emoji:"🍌", kcal:180, p:6,  c:38, f:2,  time:5,  ing:["ბანანი 1ც","ავოკ. 1/2ც","ბ. იოგ. 100გ","ყ. ლ. 50მლ","ვან."] },
    { id:"dr7",  name:"ვაშ.-ლიმ. კ. სმ.",             emoji:"🍎", kcal:110, p:1,  c:28, f:0,  time:5,  ing:["ვაშლი 2ც","ი. ს. 1 ნ.","ლიმ. 1/4ც","გ. ა. ფ."] },
    { id:"dr8",  name:"ფ.ო.-ლიმ. კ. სმ.",             emoji:"🍊", kcal:105, p:2,  c:25, f:0,  time:5,  ing:["ფ. ო. 2ც","გ. ა.","ლიმ. 1/4ც","ვ. ო. ფ."] },
    { id:"dr9",  name:"მოც.-კივ.-ავ. სმ.",             emoji:"🌿", kcal:80,  p:3,  c:16, f:1,  time:5,  ing:["მოცვი 100გ","ბ-ო 1/2ც","ავოკ. 1/2ც","ლიმ.","ვან. 1 ჩ.კ."] },
    { id:"dr10", name:"ყ.ი.-ი.ს. სმ.",                emoji:"🍇", kcal:140, p:2,  c:34, f:0,  time:5,  ing:["ყ. ი. 150გ","ი. ს. 2 ნ.","ლიმ. 1/4ც"] },
    { id:"dr11", name:"კენ.კ.-ი.ს. სმ.",              emoji:"🫐", kcal:90,  p:3,  c:20, f:0,  time:5,  ing:["კენ. კ. 150გ","ი. ს. 1 ნ.","ყ. ი. 2 ნ.","ლიმ."] },
    { id:"dr12", name:"ი.ო.-ვ.ა. ბ.იოგ. სმ.",         emoji:"🥤", kcal:150, p:4,  c:32, f:1,  time:5,  ing:["ი. ო. 100გ","ვ. ა. 1ც","ბ. იოგ. 100გ","ვან."] },
    { id:"dr13", name:"მწვ. ჩ. ვ.ი. კ.",              emoji:"🍵", kcal:35,  p:0,  c:8,  f:0,  time:3,  ing:["მწვ. ჩ. 1 ჩ.კ.","ი. 1 ნ.","ც. წ. 250მლ","ვან."] },
    { id:"dr14", name:"ყავა ი.ც. ლ.",                 emoji:"☕", kcal:130, p:4,  c:18, f:5,  time:3,  ing:["ყ. 8გ","ი. ც. 100მლ","ქ. ც. 10გ","შ. 1 ჩ.კ."] },
    { id:"dr15", name:"ბან.-კ. ვ. სმ.",               emoji:"🍌", kcal:160, p:5,  c:36, f:1,  time:5,  ing:["ბანანი 1ც","რძე 200მლ","ვან. 1 ჩ.კ.","ც. 1 ჩ.კ."] },
    { id:"dr16", name:"ა.ი. კივ.-ვ. სმ.",             emoji:"💚", kcal:70,  p:2,  c:14, f:1,  time:5,  ing:["ა. ი. 1 ჩ.კ.","კივი 150გ","ვან.","ლიმ.","ი. ს."] },
    { id:"dr17", name:"ქ.-ვ.ო. ი. სმ.",               emoji:"🍋", kcal:15,  p:0,  c:4,  f:0,  time:3,  ing:["ქ. 1ც","ვ. ო. ი. 2 ნ.","ც. წ. 300მლ","ვან."] },
    { id:"dr18", name:"მარ.-ბ-ო. ბ.იოგ. სმ.",         emoji:"🍓", kcal:170, p:5,  c:36, f:2,  time:5,  ing:["მარ. 100გ","ბ-ო 1/2ც","ბ. იოგ. 100გ","ვან. 1 ჩ.კ.","ი."] },
    { id:"dr19", name:"ა.ი. ლიმ. ი.ს. სმ.",           emoji:"🌿", kcal:45,  p:1,  c:10, f:0,  time:5,  ing:["ა. ი. 1 ჩ.კ.","ლიმ. 1/4ც","ვ. ო.","ი. ს. 1ც","ც. წ. 250მლ"] },
    { id:"dr20", name:"ბ.ი.-ი.ს. სმ.",                emoji:"🍇", kcal:120, p:2,  c:28, f:0,  time:5,  ing:["ბ. ი. 150გ","ი. ს. 2 ნ.","ლიმ."] },
    { id:"dr21", name:"ა.რ. (ბ.) ვ.",                 emoji:"🥛", kcal:130, p:10, c:18, f:2,  time:1,  ing:["ა. 200მლ","ვან. 1 ჩ.კ."] },
    { id:"dr22", name:"ი.ო.-ვ.ო. ი. სმ.",             emoji:"🍋", kcal:110, p:1,  c:26, f:0,  time:3,  ing:["ი. ო. 1ც","ვ. ო. ი.","ც. წ. 250მლ","ვან."] },
    { id:"dr23", name:"კოქ. ი. (ც.)",                 emoji:"🥥", kcal:150, p:1,  c:18, f:8,  time:1,  ing:["კოქ. ი. 200მლ"] },
    { id:"dr24", name:"ბ.პ. ი.ო.-კ. სმ.",             emoji:"💪", kcal:220, p:28, c:24, f:3,  time:3,  ing:["ბ. პ. 1 სკ.","რძე 200მლ","ვან. 1 ჩ.კ.","ი. ო. 50გ"] },
    { id:"dr25", name:"ვ.ი. ი. კ.",                   emoji:"🍵", kcal:40,  p:0,  c:10, f:0,  time:3,  ing:["ვ. ი. 1 ჩ.კ.","ც. წ. 250მლ","ვან. 1 ჩ.კ.","ლიმ."] },
    { id:"dr26", name:"ა.ი.-ბ-ო. ი.ს. სმ.",           emoji:"🍹", kcal:95,  p:1,  c:22, f:0,  time:5,  ing:["ა. ი. 100მლ","ბ-ო 1/2ც","ი. ს. 1 ნ.","ვან."] },
    { id:"dr27", name:"ი.ო.ი. ი. კ.",                 emoji:"🍵", kcal:20,  p:0,  c:5,  f:0,  time:3,  ing:["ი. ო. ი. 1 ჩ.კ.","ც. წ. 250მლ","ლიმ.","ვან."] },
    { id:"dr28", name:"ბან.-მარ. კ. სმ.",              emoji:"🫙", kcal:190, p:5,  c:42, f:1,  time:5,  ing:["ბანანი 1ც","მარ. 80გ","რძე 150მლ","ვან. 1 ჩ.კ.","ჩია 3გ"] },
    { id:"dr29", name:"ყავა ი.ც. ლ. (მ.)",            emoji:"☕", kcal:55,  p:2,  c:8,  f:2,  time:3,  ing:["ყ. 8გ","ი. ც. 80მლ","ც. წ. 120მლ"] },
    { id:"dr30", name:"ბ.ი.-ი.ი. ვ. სმ.",             emoji:"🌿", kcal:75,  p:2,  c:16, f:1,  time:5,  ing:["ბ. ი. 100გ","ი. ი. 2 ნ.","ლიმ.","ც. წ. 200მლ","ვან."] },
    { id:"dr31", name:"ა.ი.-კეფ.-ბ-ო. სმ.",           emoji:"🥤", kcal:140, p:4,  c:28, f:2,  time:5,  ing:["ა. ი. 80გ","კეფ. 80მლ","ბ-ო 1/2ც","ვან. 1 ჩ.კ.","ლიმ."] },
    { id:"dr32", name:"ი.ი. ი. კ.",                   emoji:"🍵", kcal:30,  p:0,  c:7,  f:0,  time:3,  ing:["ი. ი. 1 ჩ.კ.","ც. წ. 250მლ","ვან. 1 ჩ.კ.","ლიმ."] },
    { id:"dr33", name:"ბ.პ.-ბან. კ. სმ.",             emoji:"💪", kcal:240, p:30, c:26, f:2,  time:3,  ing:["ბ. პ. 1 სკ.","ბანანი 1ც","რძე 200მლ","ო. ბ. 20გ"] },
    { id:"dr34", name:"ი.ი.-ი.ო. ვ. სმ.",             emoji:"🍋", kcal:50,  p:0,  c:12, f:0,  time:3,  ing:["ი. ი. 1 ჩ.კ.","ი. ო. ი.","ც. წ. 300მლ","ვან."] },
    { id:"dr35", name:"კივ.-ი. ავ. სმ.",              emoji:"🥝", kcal:110, p:2,  c:26, f:0,  time:5,  ing:["კივი 1ც","ი. 1ც","ავოკ. 1/2ც","ი. ს. 2 ნ.","ვან."] },
  ],
};

const DAYS_GEO  = ["ორშ","სამშ","ოთხშ","ხუთშ","პარ","შაბ","კვ"];
const DAYS_FULL = ["ორშაბათი","სამშაბათი","ოთხშაბათი","ხუთშაბათი","პარასკევი","შაბათი","კვირა"];

function WeeklyPlan() {
  const { state, updateState, showToast, profile } = useContext(Ctx);
  const [day,  setDay]  = useState(0);
  const [remoteMeals, setRemoteMeals] = useState(null); // null = loading, {} = loaded

  useEffect(() => {
    api.get("/api/meals")
      .then(data => setRemoteMeals(data))
      .catch(() => setRemoteMeals({})); // fallback to hardcoded
  }, []);
  const [open, setOpen] = useState(null); // expanded card key

  // selected meal ids per type: { breakfast: id|null, lunch: id|null, dinner: id|null, drink: id|null }
  const [sel, setSel] = useState({ breakfast: null, lunch: null, dinner: null, drink: null });

  const goalKcal = state.calories.goal || 2000;
  const goal     = profile?.goal || "maintain";

  // Targets: 25% breakfast, 35% lunch, 30% dinner, 10% drinks
  const targets = {
    breakfast: goalKcal * 0.25,
    lunch:     goalKcal * 0.35,
    dinner:    goalKcal * 0.30,
    drink:     goalKcal * 0.10,
  };

  // Pick 5 distinct meals for this day & type, sorted by proximity to target
  function pick5(type) {
    const key  = type === "drink" ? "drinks" : type;
    const db   = (remoteMeals && remoteMeals[key]?.length) ? remoteMeals[key] : MEAL_DB[key];
    const t    = targets[type];
    const sorted = [...db].sort((a, b) => Math.abs(a.kcal - t) - Math.abs(b.kcal - t));
    const n = sorted.length;
    const offset = (day * 5) % n;
    const result = [];
    for (let i = 0; i < 5; i++) result.push(sorted[(offset + i) % n]);
    return result;
  }

  const meals = {
    breakfast: pick5("breakfast"),
    lunch:     pick5("lunch"),
    dinner:    pick5("dinner"),
    drink:     pick5("drink"),
  };

  // When day changes, reset selections
  const changeDay = (d) => { setDay(d); setSel({ breakfast: null, lunch: null, dinner: null, drink: null }); setOpen(null); };

  // Selected meal objects
  const selMeals = {
    breakfast: meals.breakfast.find(m => m.id === sel.breakfast),
    lunch:     meals.lunch.find(m => m.id === sel.lunch),
    dinner:    meals.dinner.find(m => m.id === sel.dinner),
    drink:     meals.drink.find(m => m.id === sel.drink),
  };

  const allSelected = sel.breakfast && sel.lunch && sel.dinner && sel.drink;

  // Summary of selected meals
  const selKcal = Object.values(selMeals).reduce((s, m) => s + (m?.kcal || 0), 0);
  const selP    = Object.values(selMeals).reduce((s, m) => s + (m?.p    || 0), 0);

  const addAllToDiary = () => {
    if (!allSelected) return;
    const mealKeyMap = { breakfast:"breakfast", lunch:"lunch", dinner:"dinner", drink:"snacks" };
    updateState(p => {
      let next = { ...p };
      Object.entries(selMeals).forEach(([type, m]) => {
        if (!m) return;
        const key = mealKeyMap[type];
        const item = { id: Date.now() + Math.random(), name: m.name, emoji: m.emoji, kcal: m.kcal, protein: m.p, carbs: m.c, fat: m.f };
        next = {
          ...next,
          diary:    { ...next.diary,    [key]: [...(next.diary[key] || []), item] },
          calories: { ...next.calories, current: next.calories.current + m.kcal },
          protein:  { ...next.protein,  current: next.protein.current  + m.p    },
          carbs:    { ...next.carbs,    current: next.carbs.current    + m.c    },
          fat:      { ...next.fat,      current: next.fat.current      + m.f    },
        };
      });
      return next;
    });
    showToast("✅ კვების გეგმა დღიურში დაემატა!");
    setSel({ breakfast: null, lunch: null, dinner: null, drink: null });
  };

  const SECT = [
    { type:"breakfast", icon:"🌅", label:"საუზმე"   },
    { type:"lunch",     icon:"☀️",  label:"სადილი"   },
    { type:"dinner",    icon:"🌙",  label:"ვახშამი"  },
    { type:"drink",     icon:"🥤",  label:"სასმელი"  },
  ];

  const diffColor = (kcal, target) => {
    const d = Math.abs(kcal - target) / target;
    return d < 0.15 ? "var(--acc)" : d < 0.3 ? "var(--yel)" : "var(--org)";
  };

  if (remoteMeals === null) return (
    <div style={{ padding:"40px 16px", textAlign:"center", color:"var(--t2)" }}>
      <div className="spin-lg" style={{ margin:"0 auto 12px" }} />
      <div style={{ fontSize:13 }}>კვების გეგმა იტვირთება...</div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 24px" }}>

      {/* Header */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>🗓️ კვირის კვების გეგმა</div>
            <div style={{ fontSize:11, color:"var(--t2)", marginTop:3 }}>
              {goalKcal} კკ/დღე • {GOAL_LABELS[goal] || "შენარჩ."} • 5 ვარიანტი / კვება
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:20, fontWeight:900, color:"var(--acc)" }}>{goalKcal}</div>
            <div style={{ fontSize:10, color:"var(--t2)" }}>კკ მიზანი</div>
          </div>
        </div>
      </div>

      {/* Day selector */}
      <div style={{ display:"flex", gap:5, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
        {DAYS_GEO.map((d, i) => (
          <button key={i} onClick={() => changeDay(i)}
            style={{ flexShrink:0, padding:"7px 11px", borderRadius:10, border:`1px solid ${day===i ? "var(--acc)":"var(--bdr)"}`, background:day===i ? "var(--acc)":"var(--el)", color:day===i ? "#0a0a0a":"var(--t2)", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"var(--font)" }}>
            {d}
          </button>
        ))}
      </div>

      {/* Day title */}
      <div style={{ fontSize:17, fontWeight:800, marginBottom:12 }}>{DAYS_FULL[day]}</div>

      {/* Meal sections */}
      {SECT.map(({ type, icon, label }) => {
        const list   = meals[type];
        const target = targets[type];
        const selId  = sel[type];

        return (
          <div key={type} style={{ marginBottom:16 }}>
            {/* Section header */}
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
              <span style={{ fontSize:17 }}>{icon}</span>
              <span style={{ fontSize:14, fontWeight:700 }}>{label}</span>
              {selId
                ? <span style={{ marginLeft:"auto", fontSize:11, background:"var(--acc-dim)", color:"var(--acc)", border:"1px solid var(--bdr-a)", borderRadius:8, padding:"2px 8px", fontWeight:600 }}>✓ არჩეულია</span>
                : <span style={{ marginLeft:"auto", fontSize:11, color:"var(--t2)" }}>🎯 {Math.round(target)} კკ</span>
              }
            </div>

            {/* 5 option cards */}
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {list.map((meal, idx) => {
                const cardKey  = type + meal.id;
                const isOpen   = open === cardKey;
                const isSel    = selId === meal.id;
                const diff     = meal.kcal - target;
                const diffStr  = (diff > 0 ? "+" : "") + Math.round(diff);
                const dc       = diffColor(meal.kcal, target);

                return (
                  <div key={meal.id}
                    style={{ borderRadius:13, border:`2px solid ${isSel ? "var(--acc)" : "var(--bdr)"}`, background:isSel ? "rgba(74,222,128,.06)" : "var(--card)", transition:"all .18s", overflow:"hidden" }}>

                    {/* Row */}
                    <div style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 13px", cursor:"pointer" }}
                      onClick={() => setOpen(isOpen ? null : cardKey)}>

                      {/* Radio circle */}
                      <div onClick={e => { e.stopPropagation(); setSel(s => ({ ...s, [type]: isSel ? null : meal.id })); }}
                        style={{ width:20, height:20, borderRadius:"50%", border:`2px solid ${isSel ? "var(--acc)" : "var(--tm)"}`, background:isSel ? "var(--acc)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
                        {isSel && <div style={{ width:8, height:8, borderRadius:"50%", background:"#0a0a0a" }} />}
                      </div>

                      {/* Number badge */}
                      <div style={{ width:20, height:20, background:"var(--el)", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"var(--t2)", flexShrink:0 }}>
                        {idx+1}
                      </div>

                      <span style={{ fontSize:19, flexShrink:0 }}>{meal.emoji}</span>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{meal.name}</div>
                        <div style={{ fontSize:10, color:"var(--t2)", marginTop:1 }}>🕒 {meal.time}წთ</div>
                      </div>

                      <div style={{ textAlign:"right", flexShrink:0, marginRight:4 }}>
                        <div style={{ fontSize:14, fontWeight:900, color:dc }}>{meal.kcal}</div>
                        <div style={{ fontSize:9, color:dc }}>{diffStr}კკ</div>
                      </div>
                      <span style={{ fontSize:11, color:"var(--tm)" }}>{isOpen?"▲":"▼"}</span>
                    </div>

                    {/* Expanded */}
                    {isOpen && (
                      <div style={{ padding:"0 13px 13px", borderTop:"1px solid var(--bdr)" }}>
                        {/* Macros */}
                        <div style={{ display:"flex", gap:6, margin:"10px 0" }}>
                          {[["💪 ც.",meal.p],["🍞 ნ.",meal.c],["🥑 ც-მ",meal.f]].map(([l,v])=>(
                            <div key={l} style={{ flex:1, background:"var(--el)", borderRadius:8, padding:"6px 4px", textAlign:"center" }}>
                              <div style={{ fontSize:9, color:"var(--t2)" }}>{l}</div>
                              <div style={{ fontSize:12, fontWeight:700 }}>{v}გ</div>
                            </div>
                          ))}
                        </div>
                        {/* Ingredients */}
                        <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.7, marginBottom:10 }}>
                          <span style={{ color:"var(--t1)", fontWeight:600 }}>🥄 </span>{meal.ing.join(" • ")}
                        </div>
                        {/* Select button */}
                        <button onClick={() => { setSel(s => ({ ...s, [type]: isSel ? null : meal.id })); setOpen(null); }}
                          className="btn" style={{ padding:"9px", fontSize:13, background: isSel ? "var(--el)" : "var(--acc)", color: isSel ? "var(--t1)" : "#0a0a0a", border: isSel ? "1px solid var(--bdr)" : "none" }}>
                          {isSel ? "✓ არჩეულია — გაუქმება" : "✓ ამ ვარიანტის არჩევა"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary + add all button */}
      <div style={{ position:"sticky", bottom:80, zIndex:10 }}>
        <div className="card" style={{ border:`1px solid ${allSelected ? "var(--bdr-a)" : "var(--bdr)"}`, background:"var(--card)" }}>
          {allSelected ? (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>✅ შერჩეული კვება</div>
                  <div style={{ fontSize:11, color:"var(--t2)", marginTop:2 }}>💪 {selP}გ ცილა • 🔥 {selKcal} კკ</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:18, fontWeight:900, color: Math.abs(selKcal - goalKcal) < 200 ? "var(--acc)" : "var(--yel)" }}>{selKcal}</div>
                  <div style={{ fontSize:9, color:"var(--t2)" }}>/ {goalKcal} კკ</div>
                </div>
              </div>
              <button className="btn" onClick={addAllToDiary}>
                📋 დღიურში დამატება
              </button>
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"4px 0" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--t2)" }}>
                {["🌅","☀️","🌙","🥤"].map((e, i) => {
                  const types = ["breakfast","lunch","dinner","drink"];
                  return <span key={i} style={{ opacity: sel[types[i]] ? 1 : 0.3, marginRight:4 }}>{e}</span>;
                })}
              </div>
              <div style={{ fontSize:11, color:"var(--tm)", marginTop:4 }}>4 კვებიდან აირჩიე 1-1 ვარიანტი</div>
            </div>
          )}
        </div>
      </div>

      {/* Tip */}
      <div style={{ background:"var(--acc-dim)", border:"1px solid var(--bdr-a)", borderRadius:12, padding:"10px 14px", fontSize:12, color:"var(--acc)", lineHeight:1.6, marginTop:12 }}>
        💡 {goal==="lose" ? "დაბალი კკ ვარიანტები ოპტიმალურია. ნუ გამოტ. საუზმეს!" : goal==="gain" ? "მაღალ-კალ. ვარ. + ნახშირ. ვახშამი მნიშვნ.!" : "კალ.ბალ. — ±200კკ-ის ფარგ. იდეალურია."}
      </div>
    </div>
  );
}

function FoodPage() {
  const [t, setT] = useState("diary");
  return (
    <div>
      <div style={{ padding: "16px 16px 8px" }}>
        <h1 style={{ fontSize: 21, fontWeight: 800, marginBottom: 12 }}>კვება & ჯანმრთელობა</h1>
        <div className="tab-bar">{FTABS.map(tab => <button key={tab.id} className={`tab ${t === tab.id ? "on" : ""}`} onClick={() => setT(tab.id)}><tab.I size={12} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />{tab.l}</button>)}</div>
      </div>
      <div className="fu">
        {t === "diary" && <DiaryTab />}
        {t === "plan"  && <WeeklyPlan />}
        {t === "water" && <WaterTab />}
        {t === "ai"    && <AIChat />}
        {t === "bmi"   && <BMICalc />}
      </div>
    </div>
  );
}

// ─── WORKOUT PAGE ──────────────────────────────────────────────────────────
// Unsplash fitness photos (სტაბილური CDN ლინკები)
const IMGS = {
  upper:   "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80",
  lower:   "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&q=80",
  hiit:    "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=600&q=80",
  home:    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
};

const WKS = [
  { id: 1, emoji: "💪", title: "ზედა სხეული", duration: 45, kcal: 320, cat: "Gym",
    img: IMGS.upper,
    videoId: "gB9FvkMvNgE",
    exs: [
      { n: "Bench Press",    s: "4 × 12", videoId: "vcBig73ojpE", thumb: "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?w=120&q=70" },
      { n: "Push Ups",       s: "4 × 15", videoId: "IODxDxX7oi4", thumb: "https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=120&q=70" },
      { n: "Shoulder Press", s: "4 × 12", videoId: "qEwKCR5JCog", thumb: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=120&q=70" },
      { n: "Dumbbell Row",   s: "4 × 12", videoId: "roCP6wCXPqo", thumb: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=120&q=70" },
      { n: "Bicep Curls",    s: "3 × 15", videoId: "ykJmrZ5v0Oo", thumb: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=120&q=70" },
    ]},
  { id: 2, emoji: "🦵", title: "ქვედა სხეული", duration: 40, kcal: 300, cat: "Gym",
    img: IMGS.lower,
    videoId: "1Tq3QdYUuHs",
    exs: [
      { n: "Squats",    s: "4 × 10", videoId: "aclHkVaku9U", thumb: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=120&q=70" },
      { n: "Deadlift",  s: "3 × 8",  videoId: "op9kVnSso6Q", thumb: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=120&q=70" },
      { n: "Leg Press", s: "4 × 12", videoId: "IZxyjW7MPJQ", thumb: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=120&q=70" },
      { n: "Lunges",    s: "3 × 12", videoId: "QOVaHwm-Q6U", thumb: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=120&q=70" },
    ]},
  { id: 3, emoji: "🏃", title: "HIIT კარდიო", duration: 25, kcal: 250, cat: "Cardio",
    img: IMGS.hiit,
    videoId: "ml6cT4AZdqI",
    exs: [
      { n: "Jumping Jacks",     s: "3 × 45s", videoId: "c4DAnQ6DtF8", thumb: "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=120&q=70" },
      { n: "Burpees",           s: "3 × 10",  videoId: "dZgVxmf6jkA", thumb: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=120&q=70" },
      { n: "Mountain Climbers", s: "3 × 30s", videoId: "nmwgirgXLYM", thumb: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=120&q=70" },
      { n: "High Knees",        s: "3 × 30s", videoId: "OAJ_J3EZkdY", thumb: "https://images.unsplash.com/photo-1538805060514-97d9cc172144?w=120&q=70" },
    ]},
  { id: 4, emoji: "🏠", title: "სახლი - ჰანტელები", duration: 35, kcal: 200, cat: "Home",
    img: IMGS.home,
    videoId: "vc1E5CfRfos",
    exs: [
      { n: "DB Chest Press", s: "3 × 12", videoId: "VmB1G1K7v94", thumb: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=120&q=70" },
      { n: "DB Rows",        s: "3 × 12", videoId: "roCP6wCXPqo", thumb: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=120&q=70" },
      { n: "DB Shoulder",    s: "3 × 10", videoId: "qEwKCR5JCog", thumb: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=120&q=70" },
      { n: "DB Curls",       s: "3 × 15", videoId: "ykJmrZ5v0Oo", thumb: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=120&q=70" },
    ]},
];

// ─── GEORGIAN EXERCISE INSTRUCTIONS ───────────────────────────────────────
const GEO_STEPS = {
  // Bench Press
  "vcBig73ojpE": {
    geo: "🏋️ სკამზე ჩაწოლა — მკერდის პრესი",
    muscles: "🎯 მიზანი: მკერდი, ტრიცეპსი, მხარი",
    tips: "⚠️ ზურგი ოდნავ ამოზნექილი სკამზე",
    steps: [
      "1️⃣ გაიჭიმე სკამზე — ბეჭები ახლოს, ფეხები იატაკზე მყარად",
      "2️⃣ შტანგა დაჭირე ოდნავ მხრებზე განიერი ხელებით",
      "3️⃣ ჩამოიყვანე გულმკერდამდე — იდაყვები 45° კუთხეში",
      "4️⃣ ამოაბიძგე ზემოთ — ხელები სრულად გაშლის გარეშე",
      "5️⃣ ამოსუნთქე ზემოთ, ჩასუნთქე დაშვებისას",
    ]
  },
  // Push Ups
  "IODxDxX7oi4": {
    geo: "💪 ჩალიჩი — Push Up",
    muscles: "🎯 მიზანი: მკერდი, ტრიცეპსი, მუცელი",
    tips: "⚠️ სხეული სწორი ხაზი — ნი ქვემოთ ნუ ჩაიქნევა",
    steps: [
      "1️⃣ ჩამოჯექი პლანკის პოზიციაში — ხელები მხრის სიგანეზე",
      "2️⃣ მუცელი დაჭიმე, სხეული სრული სწორი ხაზი",
      "3️⃣ ჩამოიყვანე გულმკერდი იატაკამდე — 2 წამი",
      "4️⃣ ამოაბიძგე ზემოთ — ნი სწორი, სუნთქვა ამოიღე",
      "5️⃣ სრული გამეორება — 1 წამი ზემოთ, 2 წამი ქვემოთ",
    ]
  },
  // Shoulder Press
  "qEwKCR5JCog": {
    geo: "🏋️ მხრის პრესი — Shoulder Press",
    muscles: "🎯 მიზანი: მხარი (დელტა), ტრიცეპსი",
    tips: "⚠️ წელი ნუ მოხრი — ბირთვი დაჭიმული",
    steps: [
      "1️⃣ ჩამოჯექი სკამზე — ზურგი სწორი, ფეხები მყარად",
      "2️⃣ ჰანტელები მხრის სიმაღლეზე — მტევნები წინ",
      "3️⃣ ამოაბიძგე ვერტიკალურად ზემოთ — ხელები თითქმის სწორი",
      "4️⃣ ჩამოიყვანე ნელა მხრის სიმაღლამდე — 3 წამი",
      "5️⃣ თავი ნეიტრალური — ნიკაპი ოდნავ ქვემოთ",
    ]
  },
  // Dumbbell Row
  "roCP6wCXPqo": {
    geo: "🦾 ჰანტელის გახვევა — Dumbbell Row",
    muscles: "🎯 მიზანი: ზურგი (ფართო), ბიცეფსი",
    tips: "⚠️ ზურგი ბრტყელი — მომრგვალება იტრავმებს",
    steps: [
      "1️⃣ მარცხენა ფეხი და ხელი სკამზე — ზურგი ბრტყელი",
      "2️⃣ მარჯვენა ხელში ჰანტელი — ჭერი ქვემოთ",
      "3️⃣ ამოაბიძგე იდაყვი ზემოთ და უკან — ბეჭი შეკუმშე",
      "4️⃣ პიკზე 1 წამი გაჩერება — ბეჭი მყარად",
      "5️⃣ ნელა ჩამოიყვანე — 3 წამი, ხელი სრულად გაშლა",
    ]
  },
  // Bicep Curls
  "ykJmrZ5v0Oo": {
    geo: "💪 ბიცეფსის კრუხი — Bicep Curl",
    muscles: "🎯 მიზანი: ბიცეფსი, წინამხარი",
    tips: "⚠️ იდაყვი მყარი — ნუ ქაჩავ სხეულს",
    steps: [
      "1️⃣ სწორი დგომა — ჰანტელები ქვემოთ, მტევნები წინ",
      "2️⃣ იდაყვი მყარი — მხოლოდ წინამხარი მოძრაობს",
      "3️⃣ ამოაბიძგე ჰანტელი მხრამდე — 1 წამი",
      "4️⃣ პიკზე ბიცეფსი შეკუმშე — 1 წამი გაჩერება",
      "5️⃣ ნელა ჩამოიყვანე — 3 წამი, სრული გაშლა",
    ]
  },
  // Squats
  "aclHkVaku9U": {
    geo: "🦵 სკოკი — Squat",
    muscles: "🎯 მიზანი: ბარძაყი, კუნთი, მუხლი",
    tips: "⚠️ მუხლი ნუ გადასდის ტერფს — ზურგი სწორი",
    steps: [
      "1️⃣ ფეხები მხრის სიგანეზე — ნი ოდნავ გარეთ",
      "2️⃣ ხელები წინ ან გულზე — ბირთვი დაჭიმული",
      "3️⃣ ჩამოჯექი — ნი ოდნავ გარეთ, სხეული ოდნავ წინ",
      "4️⃣ ბარძაყი პარალელური იატაკს — ან ქვემოთ",
      "5️⃣ ამოდი ქუსლებზე ბიძგით — ამოსუნთქე ზემოთ",
    ]
  },
  // Deadlift
  "op9kVnSso6Q": {
    geo: "⚡ მიწიდან ასმა — Deadlift",
    muscles: "🎯 მიზანი: ზურგი, ბარძაყი, ნახევარი ბარძაყი, კუნთი",
    tips: "⚠️ ყველაზე მნიშვნელოვანი — ზურგი ნამდვილად სწორი",
    steps: [
      "1️⃣ შტანგა ბეჭების ქვეშ — ფეხები მხრის სიგანეზე",
      "2️⃣ ჩამოჯექი — ბარძაყი პარალელური, გული ზემოთ",
      "3️⃣ ზურგი ბრტყელი — ბეჭები ქვემოთ და უკან",
      "4️⃣ ამოდი ფეხებით ბიძგით — ჯერ ფეხები, შემდეგ ზურგი",
      "5️⃣ ზემოთ — ბარძაყი და ზურგი ერთად სწორდება",
    ]
  },
  // Leg Press
  "IZxyjW7MPJQ": {
    geo: "🦾 ფეხის პრესი — Leg Press",
    muscles: "🎯 მიზანი: ბარძაყი, კუნთი, ნახევარბარძაყი",
    tips: "⚠️ მუხლი სრულად ნუ გაშლი — მცირე მოხრა დარჩეს",
    steps: [
      "1️⃣ ჩამოჯექი — ზურგი სკამზე, ფეხები პლატფორმაზე",
      "2️⃣ ფეხები მხრის სიგანეზე — ნი ოდნავ გარეთ",
      "3️⃣ ჩამოიყვანე ფეხი — ბარძაყი გულმკერდამდე",
      "4️⃣ ამოაბიძგე ქუსლებით — 90% გაშლა, არა სრული",
      "5️⃣ ნელი ჩამოყვანა — 3 წამი, სრული კონტროლი",
    ]
  },
  // Lunges
  "QOVaHwm-Q6U": {
    geo: "🚶 ნაბიჯი — Lunge",
    muscles: "🎯 მიზანი: ბარძაყი, კუნთი, ბალანსი",
    tips: "⚠️ მუხლი ნუ ეხება იატაკს — ნი ნუ გადასდის ტერფს",
    steps: [
      "1️⃣ სწორი დგომა — ხელები ბარძაყზე ან ჰანტელები",
      "2️⃣ გადადგი ნაბიჯი წინ — მარჯვენა ფეხი ერთი მეტრი",
      "3️⃣ ჩამოჯექი — ორივე მუხლი 90° კუთხეში",
      "4️⃣ უკანა მუხლი 2-3 სმ იატაკიდან — ნი ვერტიკალური",
      "5️⃣ ამოდი — ბიძგი წინა ქუსლით, მეორე ფეხზე გადადი",
    ]
  },
  // Jumping Jacks
  "c4DAnQ6DtF8": {
    geo: "⭐ ვარსკვლავი — Jumping Jacks",
    muscles: "🎯 მიზანი: მთელი სხეული, კარდიო",
    tips: "⚠️ ნელი სიხშირე — სუნთქვა სწორი",
    steps: [
      "1️⃣ სწორი დგომა — ფეხები ახლოს, ხელები ქვემოთ",
      "2️⃣ მოხტი — ფეხები გაარი, ხელები ზემოთ აწიე",
      "3️⃣ ხელები თავზე გახლართე — ფეხები მხრის სიგანეზე",
      "4️⃣ მოხტი — ფეხები ახლოს, ხელები ქვემოთ",
      "5️⃣ რიტმი: 1 წამი 1 გამეორება — 45 წამი გაუჩერებლად",
    ]
  },
  // Burpees
  "dZgVxmf6jkA": {
    geo: "🔥 ბარპი — Burpee",
    muscles: "🎯 მიზანი: მთელი სხეული, კარდიო, ძალა",
    tips: "⚠️ ინტენსიური — ნი ახლოს ინახე სხეულთან",
    steps: [
      "1️⃣ სწორი დგომა — ფეხები მხრის სიგანეზე",
      "2️⃣ ჩამოჯექი — ხელები იატაკზე, ფეხები უკან ბიძგი",
      "3️⃣ ჩალიჩი — სხეული სწორი (ან მის გარეშე — დამწყები)",
      "4️⃣ ფეხები წინ — ხელები იატაკზე, სწრაფი ნაბიჯი",
      "5️⃣ მოხტი ზემოთ — ხელები ზემოთ, სრული გაშლა",
    ]
  },
  // Mountain Climbers
  "nmwgirgXLYM": {
    geo: "🧗 მთის მსვლელი — Mountain Climbers",
    muscles: "🎯 მიზანი: მუცელი, ბარძაყი, კარდიო",
    tips: "⚠️ ნი სწორი — ქვემოთ ნუ ჩაიქნევს",
    steps: [
      "1️⃣ პლანკის პოზიცია — ხელები მხრის ქვეშ, სხეული სწორი",
      "2️⃣ მარჯვენა ნი — გულმკერდისკენ სწრაფი გამოყვანა",
      "3️⃣ შეცვლა — მარცხენა ნი გამოიყვანე, მარჯვენა უკან",
      "4️⃣ სიჩქარე — 2 ნაბიჯი 1 წამში, სხეული ბრტყელი",
      "5️⃣ 30 წამი გაუჩერებლად — სუნთქვა ლომის ბიჭი",
    ]
  },
  // High Knees
  "OAJ_J3EZkdY": {
    geo: "🏃 მაღლა მუხლი — High Knees",
    muscles: "🎯 მიზანი: ბარძაყი, მუცელი, კარდიო",
    tips: "⚠️ ნი 90° ზემოთ — ხელები რიტმულად",
    steps: [
      "1️⃣ სწორი დგომა — ხელები მოხრილი, ლოდინის პოზა",
      "2️⃣ სირბილი ადგილზე — ნი მაქსიმალურად ზემოთ",
      "3️⃣ ნი 90° კუთხემდე — ბარძაყი პარალელური იატაკს",
      "4️⃣ ხელები წინ-უკან — ბეჭი განდევნა",
      "5️⃣ 30 წამი სწრაფი ტემპი — ან 45 წამი ზომიერი",
    ]
  },
  // DB Chest Press
  "VmB1G1K7v94": {
    geo: "🏠 ჰანტელის პრესი — DB Chest Press",
    muscles: "🎯 მიზანი: მკერდი, ტრიცეპსი, მხარი",
    tips: "⚠️ ჰანტელები სწორი ხაზით — ნუ ვარწუნდები",
    steps: [
      "1️⃣ გაიჭიმე სკამზე — ჰანტელები მხრის სიმაღლეზე",
      "2️⃣ ბეჭები ახლოს — ზურგი ოდნავ ამოზნექილი",
      "3️⃣ ამოაბიძგე — ჰანტელები ერთმანეთთან ახლოს ზემოთ",
      "4️⃣ ხელები 90% გაშლა — ბოლო ჩაკეტვა ნუ",
      "5️⃣ ნელა ჩამოიყვანე — 3 წამი, მკერდი გაჭიმე",
    ]
  },
};

// ─── VIDEO MODAL ───────────────────────────────────────────────────────────
function VideoModal({ videoId, title, onClose }) {
  const [err, setErr] = useState(false);
  const [showSteps, setShowSteps] = useState(true);
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " exercise tutorial")}`;
  const info = GEO_STEPS[videoId] || null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "16px 16px 32px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--card)", borderRadius: "var(--rl)", overflow: "hidden", border: "1px solid var(--bdr)", marginTop: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--bdr)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{info?.geo || title}</div>
            {info?.muscles && <div style={{ fontSize: 11, color: "var(--acc)", marginTop: 2 }}>{info.muscles}</div>}
          </div>
          <button onClick={onClose} style={{ background: "var(--el)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "var(--t1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={14} /></button>
        </div>

        {/* Video */}
        {!err ? (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            <iframe
              key={videoId}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&cc_load_policy=1&modestbranding=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              onError={() => setErr(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            />
          </div>
        ) : (
          /* Error fallback — show YouTube link only when iframe fails */
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📹</div>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16 }}>ვიდეო ვერ ჩაიტვირთა</p>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={ytUrl} target="_blank" rel="noreferrer"
                style={{ flex: 1, background: "#ff0000", color: "white", borderRadius: 10, padding: "10px 8px", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)" }}>
                ▶ YouTube-ზე გახსნა
              </a>
              <a href={searchUrl} target="_blank" rel="noreferrer"
                style={{ flex: 1, background: "var(--el)", color: "var(--t2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "10px 8px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)" }}>
                🔍 ძებნა
              </a>
            </div>
          </div>
        )}

        {/* Instructions toggle — only when video loaded */}
        {!err && info && (
          <div style={{ padding: "8px 16px", borderTop: "1px solid var(--bdr)" }}>
            <button onClick={() => setShowSteps(s => !s)}
              style={{ width: "100%", background: showSteps ? "var(--acc-dim)" : "var(--el)", color: showSteps ? "var(--acc)" : "var(--t2)", border: `1px solid ${showSteps ? "var(--bdr-a)" : "var(--bdr)"}`, borderRadius: 10, padding: "9px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}>
              📋 ქართული ინსტრუქცია {showSteps ? "▲" : "▼"}
            </button>
          </div>
        )}

        {/* Georgian Steps */}
        {info && showSteps && (
          <div style={{ padding: "14px 16px 18px" }}>
            {/* Warning tip */}
            <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#fbbf24" }}>
              {info.tips}
            </div>
            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {info.steps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, background: "var(--acc-dim)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--acc)" }}>{i + 1}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.55, paddingTop: 3 }}>
                    {step.replace(/^\d️⃣\s*/, "")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AIWorkout() {
  const [prompt, setPrompt] = useState(""); const [result, setResult] = useState(null); const [loading, setLoading] = useState(false);
  const gen = async () => {
    if (!prompt.trim() || loading) return; setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: "შენ ხარ ფიტნეს ტრენერი. ქართულად შექმენი ვარჯიშის გეგმა: სათაური, შემდეგ სავარჯიშოები (სახელი, სეტები, გამეორება). კონკრეტული იყავი.", messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      setResult(data.content?.find(b => b.type === "text")?.text || "ვერ შეიქმნა.");
    } catch { setResult("კავშირის შეცდომა."); }
    setLoading(false);
  };
  return (
    <div style={{ padding: "0 16px" }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, background: "var(--acc-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={17} color="var(--acc)" /></div>
          <div><div style={{ fontSize: 14, fontWeight: 700 }}>AI ვარჯიშის გენერატორი</div><div style={{ fontSize: 11, color: "var(--t2)" }}>აღწერე შენი სიტუაცია</div></div>
        </div>
        <textarea className="inp" style={{ resize: "none", minHeight: 72 }} placeholder={'მაგ: "სახლში ჰანტელები, 30 წუთი, ზედა სხეული"'} value={prompt} onChange={e => setPrompt(e.target.value)} />
        <button className="btn" style={{ marginTop: 10 }} onClick={gen} disabled={loading}>
          {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><div className="spin" /> გენერირება...</span> : <><Zap size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />გეგმის შექმნა</>}
        </button>
      </div>
      {result && <div className="card fu"><p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--t1)" }}>{result}</p></div>}
      {!result && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {["სახლში ჰანტელებით, 30 წთ", "სპორტდარბაზი — მკერდი", "კარდიო, დამწყები", "ყოველდღიური გაჭიმვა"].map(s => (
          <button key={s} onClick={() => setPrompt(s)} style={{ display: "block", width: "100%", textAlign: "left", background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "11px 13px", fontSize: 13, color: "var(--t1)", cursor: "pointer", fontFamily: "var(--font)" }}>💬 {s}</button>
        ))}
      </div>}
    </div>
  );
}

function WorkoutPage() {
  const { showToast } = useContext(Ctx);
  const [sel, setSel] = useState(null);
  const [cat, setCat] = useState("ყველა");
  const [aiMode, setAi] = useState(false);
  const [video, setVideo] = useState(null); // { videoId, title }

  if (sel) return (
    <div>
      {video && <VideoModal videoId={video.videoId} title={video.title} onClose={() => setVideo(null)} />}
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setSel(null)} style={{ width: 34, height: 34, background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--t1)" }}><ChevronLeft size={16} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>{sel.title}</h1>
      </div>
      <div style={{ padding: "0 16px" }}>
        {/* Workout preview image */}
        <div style={{ borderRadius: "var(--rl)", overflow: "hidden", marginBottom: 14, position: "relative" }}>
          <img
            src={sel.img}
            alt={sel.title}
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,.7))", borderRadius: "var(--rl)" }} />
          <button
            onClick={() => setVideo({ videoId: sel.videoId, title: sel.title })}
            style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 56, height: 56, background: "rgba(74,222,128,.9)", borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(74,222,128,.5)" }}>
            <Play size={22} color="#0a0a0a" fill="#0a0a0a" />
          </button>
          <div style={{ position: "absolute", bottom: 14, left: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{sel.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 2 }}>{sel.duration} წთ • {sel.kcal} kcal</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>სავარჯიშოები</div>
          {sel.exs.map((ex, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < sel.exs.length - 1 ? "1px solid var(--bdr)" : "none" }}>
              {/* Exercise thumbnail */}
              <div
                onClick={() => setVideo({ videoId: ex.videoId, title: ex.n })}
                style={{ width: 52, height: 38, borderRadius: 9, overflow: "hidden", position: "relative", cursor: "pointer", flexShrink: 0 }}>
                <img src={ex.thumb} alt={ex.n} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Play size={12} color="white" fill="white" />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.n}</div>
                <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{ex.s}</div>
              </div>
              <button
                onClick={() => setVideo({ videoId: ex.videoId, title: ex.n })}
                style={{ background: "var(--acc-dim)", border: "1px solid var(--bdr-a)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: "var(--acc)", fontSize: 11, fontWeight: 600, fontFamily: "var(--font)", display: "flex", alignItems: "center", gap: 4 }}>
                <Play size={10} fill="var(--acc)" />ვიდეო
              </button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={() => { showToast("ვარჯიში დაიწყო! 💪"); setSel(null); }}><Play size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />ვარჯიშის დაწყება</button>
      </div>
    </div>
  );
  const cats = ["ყველა", "Gym", "Home", "Cardio"];
  const filtered = WKS.filter(w => cat === "ყველა" || w.cat === cat);
  return (
    <div>
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h1 style={{ fontSize: 21, fontWeight: 800 }}>ვარჯიში</h1>
          <button onClick={() => setAi(!aiMode)} style={{ display: "flex", alignItems: "center", gap: 5, background: aiMode ? "var(--acc)" : "var(--el)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "7px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: aiMode ? "#0a0a0a" : "var(--t1)", fontFamily: "var(--font)" }}><Zap size={13} />AI</button>
        </div>
        {!aiMode && <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4 }}>{cats.map(c => <button key={c} className={`ghost ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div>}
      </div>
      <div className="fu">{aiMode ? <AIWorkout /> : filtered.map((w, i) => (
        <div key={w.id} onClick={() => setSel(w)} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: "var(--r)", overflow: "hidden", cursor: "pointer", margin: "0 16px 12px", animationDelay: `${i * .05}s` }}>
          <div style={{ height: 130, position: "relative", overflow: "hidden" }}>
            <img
              src={w.img}
              alt={w.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 30%,rgba(0,0,0,.7))" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-60%)", width: 40, height: 40, background: "rgba(74,222,128,.85)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={16} color="#0a0a0a" fill="#0a0a0a" />
            </div>
            <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "2px 7px", fontSize: 10, color: "white", fontWeight: 600 }}>{w.cat}</div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{w.emoji} {w.title}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 5 }}>{w.duration} წთ • {w.kcal} kcal • {w.exs.length} სავარჯიშო</div>
          </div>
        </div>
      ))}</div>
    </div>
  );
}

// ─── PROFILE PAGE ──────────────────────────────────────────────────────────
const GOAL_LABELS    = { lose: "წონის დაკლება", maintain: "შენარჩუნება", gain: "მასის მომატება", health: "ჯანმრთელობა" };
const ACTIVITY_LABELS = { sedentary: "უმოძრაო", light: "მსუბუქი", moderate: "საშუალო", active: "ძალიან აქტიური" };

function ProfilePage({ profile, onLogout, onAdmin, onProfileUpdate }) {
  const { state, updateState, showToast } = useContext(Ctx);
  const { weight, measurements, challenges, achievements } = state;
  const [tab, setTab] = useState("weight");
  const [newWeight, setNewWeight] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const openEdit = () => {
    setEditForm({
      age:      profile?.age      || "",
      gender:   profile?.gender   || "male",
      height:   profile?.height   || "",
      weight:   profile?.weight   || "",
      goal:     profile?.goal     || "maintain",
      activity: profile?.activity || "light",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      await onProfileUpdate(editForm);
      setEditOpen(false);
      showToast("✅ პროფილი განახლდა!");
    } catch {
      showToast("❌ შეცდომა, სცადე კვლავ");
    }
  };

  // ── Dynamic weight calculations ───────────────────────────────────────────
  // weight.current is the user's tracked current weight (set by buildFromProfile correctly).
  // Fall back to profile.weight if state weight is somehow 0.
  const profileW    = weight.current || parseFloat(profile?.weight) || 75;
  const cleanW      = makeCleanState(profile);
  const displayGoal = cleanW.weight.goal;
  const startW  = weight.history?.[0] ?? profileW;
  const totalDrop = startW - displayGoal;
  const dropped   = startW - profileW;
  const progPct   = totalDrop > 0 ? Math.min(100, Math.max(0, Math.round((dropped / totalDrop) * 100))) : 0;
  const diffKg    = (profileW - displayGoal).toFixed(1);
  const changeSinceStart = (profileW - startW).toFixed(1);

  const wData = (weight.history?.length ? weight.history : [weight.current]).map((v, i) => ({ d: i + 1, w: v }));

  const addWeightEntry = () => {
    const v = parseFloat(newWeight);
    if (!v || v < 20 || v > 300) return;
    updateState(p => ({ weight: { ...p.weight, current: v, history: [...(p.weight.history || []), v] } }));
    // Update profile.weight so refresh always shows correct weight (not INIT default 75)
    const newProfile = { ...profile, weight: String(v) };
    setProfile(newProfile);
    localStorage.setItem("fitgeo_profile", JSON.stringify(newProfile));
    api.updateProfile({ weight: String(v) }).catch(() => {});
    setNewWeight("");
    showToast("⚖️ წონა განახლდა!");
  };

  return (
    <div style={{ padding: "0 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 0 12px" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,var(--acc-d),var(--acc))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "2px solid var(--bdr-a)", flexShrink: 0 }}>{profile?.gender === "female" ? "👩" : "👨"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{profile?.name || "მომხმარებელი"}</div>
          <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{profile?.height ? `${profile.height}სმ • ${profileW}კგ` : ""}</div>
          <div style={{ display: "inline-block", background: "var(--acc-dim)", border: "1px solid var(--bdr-a)", borderRadius: 20, padding: "2px 9px", fontSize: 11, color: "var(--acc)", fontWeight: 600, marginTop: 5 }}>Premium 👑</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
          {onAdmin && (
            <button onClick={onAdmin} style={{ background:"rgba(74,222,128,.12)", border:"1px solid rgba(74,222,128,.3)", borderRadius:9, padding:"6px 12px", cursor:"pointer", color:"var(--acc)", fontSize:12, fontWeight:700, fontFamily:"var(--font)" }}>🛡️ ადმინი</button>
          )}
          <button onClick={onLogout} title="გასვლა" style={{ background: "none", border: "1px solid var(--bdr)", borderRadius: 9, padding: "6px 10px", cursor: "pointer", color: "var(--t2)", fontSize: 12, fontFamily: "var(--font)" }}>გასვლა</button>
        </div>
      </div>

      {/* Weight cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
        {[
          ["წონა",   `${profileW}კგ`,      undefined],
          ["მიზანი", `${displayGoal}კგ`,   undefined],
          ["დარჩა",  `${diffKg}კგ`,         parseFloat(diffKg) <= 0 ? "var(--acc)" : "var(--t1)"],
        ].map(([l, v, c]) => (
          <div key={l} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="tab-bar" style={{ marginBottom: 12 }}>
        {[["weight", "წონა"], ["body", "სხეული"], ["challenges", "გამოწვევები"]].map(([id, l]) => <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{l}</button>)}
      </div>

      {tab === "weight" && (
        <div className="fu">
          {/* Chart card */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--t2)" }}>მიმდინარე წონა</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{profileW}<span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 400 }}> კგ</span></div>
              </div>
              <div style={{ color: parseFloat(changeSinceStart) <= 0 ? "var(--acc)" : "var(--red)", fontWeight: 700, fontSize: 15 }}>
                {parseFloat(changeSinceStart) > 0 ? "+" : ""}{changeSinceStart} კგ
              </div>
            </div>
            {wData.length > 1
              ? <ResponsiveContainer width="100%" height={90}>
                  <LineChart data={wData}>
                    <Line type="monotone" dataKey="w" stroke="var(--acc)" strokeWidth={2.5} dot={false} />
                    <Tooltip contentStyle={{ background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: 8, fontSize: 12 }} labelFormatter={() => ""} formatter={v => [`${v} კგ`, ""]} />
                  </LineChart>
                </ResponsiveContainer>
              : <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tm)", fontSize: 12 }}>ისტორია გამოჩნდება მეტი ჩაწერის შემდეგ</div>
            }
          </div>

          {/* Progress card */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>პროგრესი</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{progPct}%</span>
            </div>
            <div style={{ height: 5, background: "var(--el)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${progPct}%`, height: "100%", background: "var(--acc)", borderRadius: 3, transition: "width .4s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--t2)", marginTop: 5 }}>
              <span>{startW} კგ</span>
              <span>{displayGoal} კგ</span>
            </div>
          </div>

          {/* Add weight */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚖️ წონის დამატება</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="inp" style={{ flex: 1 }} type="number" placeholder="მაგ: 90.5" value={newWeight} onChange={e => setNewWeight(e.target.value)} onKeyDown={e => e.key === "Enter" && addWeightEntry()} />
              <button className="ghost" onClick={addWeightEntry} style={{ background: "var(--acc)", color: "#0a0a0a", border: "none", fontWeight: 700 }}>+ კგ</button>
            </div>
          </div>

          {/* Profile info */}
          <div className="card">
            {[
              { I: User,      l: "პირადი ინფო", v: `${profile?.age || "-"} წ • ${profile?.gender === "female" ? "♀" : "♂"}`, c: "var(--blu)" },
              { I: Target,    l: "მიზანი",       v: GOAL_LABELS[profile?.goal] || profile?.goal || "-",                       c: "var(--acc)" },
              { I: Zap,       l: "აქტივობა",     v: ACTIVITY_LABELS[profile?.activity] || profile?.activity || "-",           c: "var(--yel)" },
              { I: BarChart3, l: "BMI",           v: profile?.height && weight?.current ? (weight.current / ((profile.height/100)**2)).toFixed(1) : "-", c: "var(--org)" },
            ].map(item => (
              <div key={item.l} onClick={openEdit} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--bdr)", cursor: "pointer" }}>
                <div style={{ width: 34, height: 34, background: `${item.c}20`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><item.I size={16} color={item.c} /></div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{item.l}</span>
                <span style={{ fontSize: 12, color: "var(--t2)" }}>{item.v}</span>
                <ChevronRight size={15} color="var(--tm)" />
              </div>
            ))}
            <button onClick={openEdit} style={{ width: "100%", marginTop: 10, background: "var(--acc-dim)", border: "1px solid var(--bdr-a)", borderRadius: 10, padding: "10px 0", color: "var(--acc)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "var(--font)" }}>✏️ პროფილის რედაქტირება</button>
          </div>

          {/* Profile edit modal */}
          {editOpen && editForm && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && setEditOpen(false)}>
              <div style={{ width: "100%", maxWidth: 430, background: "var(--bg2)", borderRadius: "22px 22px 0 0", border: "1px solid var(--bdr)", borderBottom: "none", padding: "20px 18px 32px", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>✏️ პროფილის რედაქტირება</span>
                  <button onClick={() => setEditOpen(false)} style={{ background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "var(--t1)", fontSize: 16 }}>✕</button>
                </div>
                {[
                  { label: "ასაკი", key: "age", type: "number", placeholder: "25" },
                  { label: "სიმაღლე (სმ)", key: "height", type: "number", placeholder: "170" },
                  { label: "საწყისი წონა (კგ)", key: "weight", type: "number", placeholder: "70" },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                    <input className="inp" type={type} placeholder={placeholder} value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 5, fontWeight: 600 }}>სქესი</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["male","♂ მამრობითი"],["female","♀ მდედრობითი"]].map(([v,l]) => (
                      <button key={v} onClick={() => setEditForm(f => ({ ...f, gender: v }))} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${editForm.gender === v ? "var(--acc)" : "var(--bdr)"}`, background: editForm.gender === v ? "var(--acc-dim)" : "var(--el)", color: editForm.gender === v ? "var(--acc)" : "var(--t1)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "var(--font)" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 5, fontWeight: 600 }}>მიზანი</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[["lose","⬇️ წონის დაკლება"],["maintain","✅ შენარჩუნება"],["gain","⬆️ მასის მომატება"]].map(([v,l]) => (
                      <button key={v} onClick={() => setEditForm(f => ({ ...f, goal: v }))} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${editForm.goal === v ? "var(--acc)" : "var(--bdr)"}`, background: editForm.goal === v ? "var(--acc-dim)" : "var(--el)", color: editForm.goal === v ? "var(--acc)" : "var(--t1)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "var(--font)", textAlign: "left" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 5, fontWeight: 600 }}>აქტივობის დონე</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[["sedentary","🪑 უმოძრაო"],["light","🚶 მსუბუქი"],["moderate","🏃 საშუალო"],["active","💪 ძალიან აქტიური"]].map(([v,l]) => (
                      <button key={v} onClick={() => setEditForm(f => ({ ...f, activity: v }))} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${editForm.activity === v ? "var(--acc)" : "var(--bdr)"}`, background: editForm.activity === v ? "var(--acc-dim)" : "var(--el)", color: editForm.activity === v ? "var(--acc)" : "var(--t1)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "var(--font)", textAlign: "left" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <button onClick={saveEdit} style={{ width: "100%", background: "var(--acc)", color: "#0a0a0a", border: "none", borderRadius: 12, padding: "14px 0", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "var(--font)" }}>შენახვა</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "body" && (
        <div className="fu">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["📏 წელი", measurements.waist, "სმ"], ["🫁 მკერდი", measurements.chest, "სმ"], ["🦵 ბარძაყი", measurements.leftThigh, "სმ"], ["💪 მკლავი", measurements.leftArm, "სმ"]].map(([l, v, u]) => (
              <div key={l} style={{ background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: "var(--rs)", padding: 14 }}>
                <div style={{ fontSize: 11, color: "var(--t2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 5 }}>{v}<span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 400 }}> {u}</span></div>
                <div style={{ fontSize: 11, color: "var(--acc)", marginTop: 4 }}>↓ -0.5 {u}</div>
              </div>
            ))}
          </div>
          <button className="btn" style={{ marginTop: 14 }}>+ გაზომვების დამატება</button>
        </div>
      )}

      {tab === "challenges" && (
        <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {challenges.map(c => (
            <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: "var(--r)", padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 28 }}>{c.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{c.desc}</div>
                <div style={{ height: 3, background: "var(--el)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}><div style={{ width: `${(c.progress / c.total) * 100}%`, height: "100%", background: "var(--acc)", borderRadius: 2 }} /></div>
                <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 3 }}>{c.progress}/{c.total}</div>
              </div>
              {!c.joined && <button onClick={() => { updateState(p => ({ challenges: p.challenges.map(ch => ch.id === c.id ? { ...ch, joined: true } : ch) })); showToast("გამოწვევაში ჩაირიცხე! 🔥"); }} style={{ background: "var(--acc)", color: "#0a0a0a", border: "none", borderRadius: 9, padding: "8px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)", flexShrink: 0 }}>შეერთება</button>}
            </div>
          ))}
          <div style={{ marginTop: 6 }}>{achievements.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: `1px solid ${a.earned ? "var(--bdr-a)" : "var(--bdr)"}`, borderRadius: "var(--r)", padding: 13, marginBottom: 8, opacity: a.earned ? 1 : 0.5 }}>
              <div style={{ width: 42, height: 42, background: a.earned ? "var(--acc-dim)" : "var(--el)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{a.emoji}</div>
              <div><div style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</div><div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>{a.desc}</div></div>
              {a.earned && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--acc)", fontWeight: 700 }}>✓</span>}
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}

// ─── ADD MODAL ─────────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { key: "breakfast", label: "🌅 საუზმე" },
  { key: "lunch",     label: "☀️ სადილი" },
  { key: "dinner",    label: "🌙 ვახშამი" },
  { key: "snacks",    label: "🍎 სნექი"   },
];

function AddModal({ onClose }) {
  const { updateState, showToast } = useContext(Ctx);
  const [mode, setMode] = useState(null);
  const [search, setSearch] = useState(""); const [added, setAdded] = useState([]);
  const [waterAmt, setWaterAmt] = useState("250"); const [wVal, setWVal] = useState("");
  const [scanDone, setScanDone] = useState(false); const [scanning, setScanning] = useState(false);
  const [foodCat, setFoodCat] = useState("ყველა");
  const [mealType, setMealType] = useState("snacks");

  const q = search.toLowerCase();
  const filtered = GEO_FOODS.filter(f => {
    const catMatch = foodCat === "ყველა" || f.cat === foodCat;
    const textMatch = !q || f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q);
    return catMatch && textMatch;
  });

  const mockScan = async () => {
    setScanning(true);
    await new Promise(r => setTimeout(r, 2000));
    setScanDone(true); setScanning(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: "var(--bg2)", borderRadius: "22px 22px 0 0", border: "1px solid var(--bdr)", borderBottom: "none", padding: "18px 18px 24px", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", animation: "fadeUp .25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800 }}>{mode ? ["", "საკვები", "წყალი", "წონა", "ფოტო AI"][["food","water","weight","scan"].indexOf(mode)+1] || mode : "რის დამატება?"}</h2>
          <button onClick={mode ? () => { setMode(null); setScanDone(false); } : onClose} style={{ background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--t1)", fontSize: 16 }}>{mode ? "←" : <X size={14} />}</button>
        </div>

        {!mode && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["food","🍽️","საკვები"],["water","💧","წყალი"],["weight","⚖️","წონა"],["scan","📷","ფოტო AI"]].map(([id, em, l]) => (
              <button key={id} onClick={() => setMode(id)} style={{ background: "var(--el)", border: "1px solid var(--bdr)", borderRadius: "var(--r)", padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, cursor: "pointer", fontFamily: "var(--font)" }}>
                <span style={{ fontSize: 30 }}>{em}</span><span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{l}</span>
              </button>
            ))}
          </div>
        )}

        {mode === "food" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden", flex: 1, minHeight: 0 }}>
            {/* კვების სახეობა */}
            <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2, flexShrink: 0 }}>
              {MEAL_TYPES.map(m => (
                <button key={m.key} onClick={() => setMealType(m.key)}
                  style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${mealType===m.key?"var(--bdr-a)":"var(--bdr)"}`, background: mealType===m.key?"var(--acc-dim)":"var(--el)", color: mealType===m.key?"var(--acc)":"var(--t2)", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "var(--font)", whiteSpace:"nowrap" }}>
                  {m.label}
                </button>
              ))}
            </div>
            {/* დამატებული საკვები */}
            {added.length > 0 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, flexShrink: 0 }}>
                {added.map((f, i) => (
                  <div key={i} onClick={() => setAdded(p => p.filter((_,j) => j !== i))}
                    style={{ background: "var(--acc-dim)", border: "1px solid var(--bdr-a)", borderRadius: 20, padding: "4px 11px", fontSize: 12, color: "var(--acc)", flexShrink: 0, cursor: "pointer", display:"flex", alignItems:"center", gap:4 }}>
                    {f.emoji} {f.kcal} kcal ✕
                  </div>
                ))}
              </div>
            )}
            {/* ძებნა */}
            <input className="inp" placeholder="🔍 ძებნა: სახელი ან კატეგ. (ვაშლი, ხილი, ხორცი...)" value={search} onChange={e => setSearch(e.target.value)} style={{ flexShrink: 0 }} />
            {/* კატეგორიები */}
            <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, flexShrink: 0, WebkitOverflowScrolling: "touch" }}>
              {FOOD_CATS.map(c => (
                <button key={c} onClick={() => { setFoodCat(c); setSearch(""); }}
                  style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${foodCat===c?"var(--bdr-a)":"var(--bdr)"}`, background: foodCat===c?"var(--acc-dim)":"var(--el)", color: foodCat===c?"var(--acc)":"var(--t2)", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "var(--font)", whiteSpace:"nowrap" }}>
                  {c}
                </button>
              ))}
            </div>
            {/* სია */}
            <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
              {filtered.length === 0 && <div style={{ textAlign:"center", color:"var(--tm)", fontSize:13, padding:"24px 0" }}>საკვები ვერ მოიძებნა 🔍</div>}
              {filtered.map(f => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bdr)" }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{f.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 1 }}>ც:{f.protein}გ  ნ:{f.carbs}გ  ც:{f.fat}გ</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--acc)", flexShrink:0 }}>{f.kcal}</span>
                  <button onClick={() => { setAdded(p => [...p, f]); showToast(`${f.emoji} დამატებულია!`); }}
                    style={{ width: 30, height: 30, background: "var(--acc-dim)", border: "1px solid var(--bdr-a)", borderRadius: 8, cursor: "pointer", color: "var(--acc)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink:0 }}>
                    <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
            {added.length > 0 && (
              <button className="btn" onClick={() => {
                const totalKcal    = added.reduce((s,f) => s + (f.kcal    || 0), 0);
                const totalProtein = added.reduce((s,f) => s + (f.protein || 0), 0);
                const totalCarbs   = added.reduce((s,f) => s + (f.carbs   || 0), 0);
                const totalFat     = added.reduce((s,f) => s + (f.fat     || 0), 0);
                updateState(p => ({
                  calories: { ...p.calories, current: p.calories.current + totalKcal },
                  protein:  { ...p.protein,  current: Math.round(p.protein.current  + totalProtein) },
                  carbs:    { ...p.carbs,    current: Math.round(p.carbs.current    + totalCarbs)   },
                  fat:      { ...p.fat,      current: Math.round(p.fat.current      + totalFat)     },
                  diary:    { ...(p.diary || {}), [mealType]: [...((p.diary || {})[mealType] || []), ...added.map((f,i) => ({ ...f, id: Date.now()+i }))] },
                }));
                showToast(`${added.length} საკვები → ${MEAL_TYPES.find(m=>m.key===mealType)?.label} ✓`);
                onClose();
              }}>{added.length} საკვები → {MEAL_TYPES.find(m=>m.key===mealType)?.label} ({added.reduce((s,f)=>s+(f.kcal||0),0)} kcal)</button>
            )}
          </div>
        )}

        {mode === "water" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[250, 500, 1000].map(a => <button key={a} onClick={() => setWaterAmt(String(a))} style={{ background: waterAmt === String(a) ? "var(--acc-dim)" : "var(--el)", border: `1px solid ${waterAmt === String(a) ? "var(--bdr-a)" : "var(--bdr)"}`, color: waterAmt === String(a) ? "var(--acc)" : "var(--t1)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, padding: "13px 8px", borderRadius: "var(--r)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><Droplets size={16} color={waterAmt === String(a) ? "var(--acc)" : "var(--blu)"} />{a < 1000 ? `${a}მლ` : "1ლ"}</button>)}
            </div>
            <input className="inp" type="number" placeholder="სხვა (მლ)" value={waterAmt} onChange={e => setWaterAmt(e.target.value)} />
            <button className="btn" onClick={() => { updateState(p => ({ water: { ...p.water, current: +(p.water.current + parseInt(waterAmt) / 1000).toFixed(2) } })); showToast(`+${waterAmt}მლ 💧`); onClose(); }}>+{waterAmt}მლ წყლის დამატება</button>
          </div>
        )}

        {mode === "weight" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <div style={{ fontSize: 56 }}>⚖️</div>
            <input className="inp" type="number" step="0.1" placeholder="წონა კგ" value={wVal} onChange={e => setWVal(e.target.value)} style={{ fontSize: 24, textAlign: "center", fontWeight: 700 }} />
            <button className="btn" disabled={!wVal} onClick={() => { updateState(p => ({ weight: { ...p.weight, current: parseFloat(wVal), history: [...p.weight.history.slice(-6), parseFloat(wVal)] } })); showToast(`წონა ${wVal}კგ ✓`); onClose(); }}>წონის ჩაწერა</button>
          </div>
        )}

        {mode === "scan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#111", borderRadius: "var(--rl)", height: 180, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", border: "1px solid var(--bdr)", overflow: "hidden" }}>
              {scanning ? <div style={{ textAlign: "center" }}><div className="spin" style={{ margin: "0 auto 10px" }} /><div style={{ fontSize: 13, color: "var(--t2)" }}>AI აანალიზებს...</div></div>
                : scanDone ? <div style={{ textAlign: "center" }}><div style={{ fontSize: 48 }}>🥟</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>ხინკალი × 3</div></div>
                : <div style={{ textAlign: "center" }}><Camera size={36} color="var(--tm)" /><div style={{ fontSize: 12, color: "var(--t2)", marginTop: 8 }}>AI ამოიცნობს ქართულ კერძებს</div></div>}
              {!scanDone && !scanning && ["tl", "tr", "bl", "br"].map(pos => <div key={pos} style={{ position: "absolute", width: 34, height: 34, borderColor: "var(--acc)", borderStyle: "solid", borderWidth: 0, ...(pos === "tl" ? { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 7 } : pos === "tr" ? { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 7 } : pos === "bl" ? { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 7 } : { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 7 }) }} />)}
            </div>
            {scanDone ? (
              <div className="card">
                <div style={{ fontSize: 13, color: "var(--acc)", fontWeight: 700, marginBottom: 8 }}>AI ანალიზი</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontWeight: 600 }}>ხინკალი × 3</span><span style={{ color: "var(--acc)", fontWeight: 800 }}>255 kcal</span></div>
                <div style={{ fontSize: 12, color: "var(--t2)" }}>ცილა: 18g • ნახ-წყ: 27g • ცხიმი: 9g</div>
                <button className="btn" style={{ marginTop: 12 }} onClick={() => { updateState(p => ({ calories: { ...p.calories, current: p.calories.current + 255 }, protein: { ...p.protein, current: Math.round(p.protein.current + 18) }, carbs: { ...p.carbs, current: Math.round(p.carbs.current + 27) }, fat: { ...p.fat, current: Math.round(p.fat.current + 9) }, diary: { ...p.diary, snacks: [...(p.diary?.snacks || []), { id: Date.now(), name: "ხინკალი × 3", emoji: "🥟", kcal: 255, protein: 18, carbs: 27, fat: 9 }] } })); showToast("🥟 დამატებულია!"); onClose(); }}>კვების დღიურში დამატება</button>
              </div>
            ) : <button className="btn" onClick={mockScan} disabled={scanning}><Camera size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />ფოტოს გადაღება</button>}
            <div style={{ fontSize: 12, color: "var(--t2)", textAlign: "center" }}>✨ ხინკალი • ხაჭაპური • მწვადი • შაური</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN MEAL EDITOR ────────────────────────────────────────────────────
const CAT_LABELS = { breakfast:"🌅 საუზმე", lunch:"☀️ სადილი", dinner:"🌙 ვახშამი", drinks:"🥤 სასმელი" };

function MealEditor({ onClose, meal, category, onSave }) {
  const [form, setForm] = useState(meal ? { ...meal, ing: meal.ing?.join("\n") ?? "" }
    : { id:"", name:"", emoji:"🍽️", kcal:"", p:"", c:"", f:"", time:"", ing:"" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !meal;

  const handle = () => {
    if (!form.name || !form.kcal) return;
    const saved = {
      ...form,
      id: form.id || (category.slice(0,1) + Date.now()),
      kcal: parseInt(form.kcal) || 0,
      p: parseInt(form.p) || 0,
      c: parseInt(form.c) || 0,
      f: parseInt(form.f) || 0,
      time: parseInt(form.time) || 10,
      ing: form.ing.split("\n").map(s => s.trim()).filter(Boolean),
    };
    onSave(saved);
  };

  const F = ({ label, k, type="text", placeholder="" }) => (
    <div>
      <label style={{ fontSize:11, color:"var(--t2)", marginBottom:4, display:"block" }}>{label}</label>
      <input className="inp" type={type} placeholder={placeholder} value={form[k]}
        onChange={e => set(k, e.target.value)} style={{ marginBottom:0 }} />
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"var(--card)", borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", border:"1px solid var(--bdr)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>{isNew ? "➕ ახალი კერძი" : "✏️ კერძის რედაქტ."}</div>
          <button onClick={onClose} style={{ background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:10, width:32, height:32, cursor:"pointer", color:"var(--t2)" }}>✕</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"60px 1fr", gap:10 }}>
            <F label="Emoji" k="emoji" />
            <F label="სახელი" k="name" placeholder="კერძის სახელი" />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            <F label="კკ" k="kcal" type="number" placeholder="400" />
            <F label="ც-ლა გ" k="p" type="number" placeholder="30" />
            <F label="ნახ. გ" k="c" type="number" placeholder="40" />
            <F label="ც-მ. გ" k="f" type="number" placeholder="15" />
          </div>
          <F label="დრო (წთ)" k="time" type="number" placeholder="15" />
          <div>
            <label style={{ fontSize:11, color:"var(--t2)", marginBottom:4, display:"block" }}>🥄 ინგრედიენტები (ერთი ხაზზე ერთი)</label>
            <textarea value={form.ing} onChange={e => set("ing", e.target.value)}
              rows={4} placeholder={"შვრია 80გ\nბანანი 1ც\nრძე 200მლ"}
              style={{ width:"100%", background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"var(--t1)", fontFamily:"var(--font)", resize:"vertical", boxSizing:"border-box" }} />
          </div>
        </div>

        <div style={{ display:"flex", gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, padding:"13px", borderRadius:12, border:"1px solid var(--bdr)", background:"var(--el)", color:"var(--t1)", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"var(--font)" }}>გაუქმება</button>
          <button onClick={handle} disabled={!form.name || !form.kcal} className="btn" style={{ flex:2 }}>
            {isNew ? "➕ დამატება" : "💾 შენახვა"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminMeals({ showToast }) {
  const [cat, setCat]       = useState("breakfast");
  const [meals, setMeals]   = useState({});
  const [loading, setLoading] = useState(true);
  const [editMeal, setEditMeal] = useState(null); // null=closed, false=new, object=edit
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get("/api/meals");
      setMeals(data);
    } catch(e) { showToast("❌ " + e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const list = (meals[cat] || []).filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase())
  );

  const saveNew = async (item) => {
    try {
      await api.put("/api/meals/" + cat + "/item/" + item.id, item);
      showToast("✅ შენახულია");
      load();
      setEditMeal(null);
    } catch {
      // new item — POST
      try {
        await api.post("/api/meals/" + cat + "/item", item);
        showToast("✅ დაემატა");
        load();
        setEditMeal(null);
      } catch(e) { showToast("❌ " + e.message); }
    }
  };

  const saveEdit = async (item) => {
    try {
      await api.put("/api/meals/" + cat + "/item/" + item.id, item);
      showToast("✅ შენახულია");
      load();
      setEditMeal(null);
    } catch(e) { showToast("❌ " + e.message); }
  };

  const del = async (id, name) => {
    if (!window.confirm(`წაშალო "${name}"?`)) return;
    try {
      await api.del("/api/meals/" + cat + "/item/" + id);
      showToast("🗑️ წაიშალა");
      load();
    } catch(e) { showToast("❌ " + e.message); }
  };

  return (
    <div>
      {editMeal !== null && (
        <MealEditor
          meal={editMeal === false ? null : editMeal}
          category={cat}
          onClose={() => setEditMeal(null)}
          onSave={editMeal === false ? saveNew : saveEdit}
        />
      )}

      {/* Category tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
        {Object.entries(CAT_LABELS).map(([k, l]) => (
          <button key={k} onClick={() => { setCat(k); setSearch(""); }}
            style={{ flexShrink:0, padding:"7px 13px", borderRadius:10, border:`1px solid ${cat===k?"var(--acc)":"var(--bdr)"}`, background:cat===k?"var(--acc)":"var(--el)", color:cat===k?"#0a0a0a":"var(--t2)", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"var(--font)" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ძებნა..."
          style={{ flex:1, background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"var(--t1)", fontFamily:"var(--font)", outline:"none" }} />
        <button onClick={() => setEditMeal(false)}
          style={{ background:"var(--acc)", border:"none", borderRadius:10, padding:"10px 16px", fontSize:13, fontWeight:700, color:"#0a0a0a", cursor:"pointer", fontFamily:"var(--font)", whiteSpace:"nowrap" }}>
          ➕ ახალი
        </button>
      </div>

      <div style={{ fontSize:12, color:"var(--t2)", marginBottom:8 }}>{list.length} კერძი • {CAT_LABELS[cat]}</div>

      {loading ? (
        <div style={{ textAlign:"center", padding:32, color:"var(--t2)" }}>⏳ იტვირთება...</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {list.map(m => (
            <div key={m.id} style={{ background:"var(--card)", border:"1px solid var(--bdr)", borderRadius:13, padding:"11px 13px", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{m.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.name}</div>
                <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap" }}>
                  {[`🔥 ${m.kcal}კკ`, `💪 ${m.p}გ`, `🍞 ${m.c}გ`, `🥑 ${m.f}გ`, `🕒 ${m.time}წთ`].map(t => (
                    <span key={t} style={{ fontSize:10, background:"var(--el)", borderRadius:5, padding:"1px 7px", color:"var(--t2)" }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                <button onClick={() => setEditMeal(m)}
                  style={{ background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:8, padding:"6px 10px", fontSize:13, cursor:"pointer" }}>✏️</button>
                <button onClick={() => del(m.id, m.name)}
                  style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"6px 10px", fontSize:13, color:"#ef4444", cursor:"pointer" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────
function AdminPanel({ onExit }) {
  const { showToast } = useContext(Ctx);
  const [adminTab, setAdminTab] = useState("users");
  const [stats, setStats]   = useState(null);
  const [users, setUsers]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [delId, setDelId]   = useState(null);

  const GOAL_GEO = { lose:"დაკლება", gain:"მომატება", maintain:"შენარჩ.", health:"ჯანმრთ." };
  const ACT_GEO  = { sedentary:"უმოძრაო", light:"მსუბუქი", moderate:"საშ.", active:"აქტიური" };

  const load = useCallback(async (s = search, p = page) => {
    setLoading(true);
    try {
      const [st, us] = await Promise.all([
        api.get("/api/admin/stats"),
        api.get(`/api/admin/users?search=${encodeURIComponent(s)}&page=${p}&pageSize=15`)
      ]);
      setStats(st);
      setUsers(us.users);
      setTotal(us.total);
    } catch (e) {
      showToast("❌ " + (e.message || "შეცდომა"));
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { load(); }, []);

  const doSearch = (v) => { setSearch(v); setPage(1); load(v, 1); };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`წაშალო ${name}?`)) return;
    try {
      await api.del(`/api/admin/users/${id}`);
      showToast(`🗑️ ${name} წაიშალა`);
      load();
    } catch (e) { showToast("❌ " + e.message); }
    setDelId(null);
  };

  const totalPages = Math.ceil(total / 15);

  const StatCard = ({ emoji, label, value, color }) => (
    <div style={{ flex:1, minWidth:120, background:"var(--card)", border:"1px solid var(--bdr)", borderRadius:14, padding:"14px 16px" }}>
      <div style={{ fontSize:22 }}>{emoji}</div>
      <div style={{ fontSize:24, fontWeight:900, color: color || "var(--t1)", marginTop:4 }}>{value}</div>
      <div style={{ fontSize:11, color:"var(--t2)", marginTop:2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", paddingBottom:32 }}>
      {/* Header */}
      <div style={{ background:"var(--card)", borderBottom:"1px solid var(--bdr)", padding:"16px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:20 }}>
        <button onClick={onExit} style={{ background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:10, padding:"7px 13px", fontSize:13, fontWeight:700, color:"var(--t1)", cursor:"pointer", fontFamily:"var(--font)" }}>← უკან</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>🛡️ ადმინ პანელი</div>
          <div style={{ fontSize:11, color:"var(--t2)" }}>FitGeo მართვის სისტემა</div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--bdr)", background:"var(--card)" }}>
        {[["users","👥 მომხმარ."],["meals","🍽️ კვება"]].map(([id,l]) => (
          <button key={id} onClick={() => setAdminTab(id)}
            style={{ flex:1, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"var(--font)", background:"none", border:"none", borderBottom:`2px solid ${adminTab===id?"var(--acc)":"transparent"}`, color:adminTab===id?"var(--acc)":"var(--t2)", transition:"all .2s" }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding:"16px 16px 0" }}>

        {adminTab === "meals" && <AdminMeals showToast={showToast} />}

        {adminTab === "users" && <>
        {/* Stats */}
        {stats && (
          <>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
              <StatCard emoji="👥" label="სულ მომხმარებელი" value={stats.totalUsers} />
              <StatCard emoji="🆕" label="დღეს დარეგ." value={stats.todayRegistered} color="var(--acc)" />
              <StatCard emoji="📅" label="კვირაში" value={stats.thisWeek} color="var(--yel)" />
            </div>

            {/* Goal breakdown */}
            <div className="card" style={{ marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🎯 მიზნების განაწილება</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(stats.goalBreakdown).map(([g, n]) => (
                  <div key={g} style={{ background:"var(--el)", borderRadius:8, padding:"5px 12px", fontSize:12 }}>
                    <span style={{ fontWeight:700 }}>{GOAL_GEO[g] || g}</span>
                    <span style={{ color:"var(--acc)", marginLeft:6 }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity + Gender */}
            <div style={{ display:"flex", gap:10, marginBottom:14 }}>
              <div className="card" style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>⚡ აქტივობა</div>
                {Object.entries(stats.activityBreakdown).map(([a, n]) => (
                  <div key={a} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                    <span style={{ color:"var(--t2)" }}>{ACT_GEO[a] || a}</span>
                    <span style={{ fontWeight:700 }}>{n}</span>
                  </div>
                ))}
              </div>
              <div className="card" style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>👤 სქესი</div>
                {Object.entries(stats.genderBreakdown).map(([g, n]) => (
                  <div key={g} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                    <span style={{ color:"var(--t2)" }}>{g === "male" ? "მამრ." : "მდედ."}</span>
                    <span style={{ fontWeight:700 }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Search */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <input
            value={search}
            onChange={e => doSearch(e.target.value)}
            placeholder="🔍 მომხმარებლის ძებნა..."
            style={{ flex:1, background:"var(--el)", border:"1px solid var(--bdr)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"var(--t1)", fontFamily:"var(--font)", outline:"none" }}
          />
          <button onClick={() => load()} style={{ background:"var(--acc)", border:"none", borderRadius:10, padding:"10px 16px", fontSize:13, fontWeight:700, color:"#0a0a0a", cursor:"pointer", fontFamily:"var(--font)" }}>↻</button>
        </div>

        {/* Users count */}
        <div style={{ fontSize:12, color:"var(--t2)", marginBottom:8 }}>სულ: {total} მომხმარებელი</div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:"var(--t2)", fontSize:14 }}>⏳ იტვირთება...</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {users.length === 0 && (
              <div style={{ textAlign:"center", padding:40, color:"var(--t2)" }}>მომხმარებელი ვერ მოიძებნა</div>
            )}
            {users.map(u => (
              <div key={u.id} style={{ background:"var(--card)", border:`1px solid ${u.isAdmin ? "rgba(74,222,128,.4)" : "var(--bdr)"}`, borderRadius:14, padding:"13px 15px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  {/* Avatar */}
                  <div style={{ width:40, height:40, borderRadius:"50%", background: u.isAdmin ? "var(--acc)" : "var(--el)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                    {u.isAdmin ? "🛡️" : (u.gender === "female" ? "👩" : "👨")}
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:800 }}>{u.name}</span>
                      {u.isAdmin && <span style={{ fontSize:10, background:"rgba(74,222,128,.15)", color:"var(--acc)", border:"1px solid rgba(74,222,128,.3)", borderRadius:6, padding:"1px 7px" }}>ადმინი</span>}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:5 }}>
                      {[
                        u.age ? `${u.age}წ` : null,
                        u.gender === "female" ? "♀️" : "♂️",
                        u.weight ? `${u.weight}კგ` : null,
                        u.height ? `${u.height}სმ` : null,
                        u.goal ? GOAL_GEO[u.goal] || u.goal : null,
                        u.activity ? ACT_GEO[u.activity] || u.activity : null,
                      ].filter(Boolean).map((v, i) => (
                        <span key={i} style={{ fontSize:11, background:"var(--el)", borderRadius:6, padding:"2px 8px", color:"var(--t2)" }}>{v}</span>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:"var(--tm)", marginTop:4 }}>📅 {u.createdAt}</div>
                  </div>
                  {/* Delete */}
                  {!u.isAdmin && (
                    <button
                      onClick={() => deleteUser(u.id, u.name)}
                      style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:9, padding:"7px 10px", fontSize:13, color:"#ef4444", cursor:"pointer", flexShrink:0 }}>
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:16 }}>
            <button onClick={() => { const p = Math.max(1, page-1); setPage(p); load(search, p); }}
              disabled={page === 1}
              style={{ padding:"8px 16px", borderRadius:10, border:"1px solid var(--bdr)", background:"var(--el)", color:"var(--t1)", fontSize:12, cursor:"pointer", opacity: page===1?0.4:1 }}>← წინა</button>
            <span style={{ padding:"8px 12px", fontSize:12, color:"var(--t2)" }}>{page} / {totalPages}</span>
            <button onClick={() => { const p = Math.min(totalPages, page+1); setPage(p); load(search, p); }}
              disabled={page === totalPages}
              style={{ padding:"8px 16px", borderRadius:10, border:"1px solid var(--bdr)", background:"var(--el)", color:"var(--t1)", fontSize:12, cursor:"pointer", opacity: page===totalPages?0.4:1 }}>შემდეგი →</button>
          </div>
        )}
        </>}
      </div>
    </div>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────

// ── localStorage helpers ────────────────────────────────────────────────────
const LS_STATE   = "fitgeo_state";
const LS_PROFILE = "fitgeo_profile";
const lsGet  = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const lsSet  = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ── Build full state from profile + stored progress ─────────────────────────
// currentW is the single source of truth for weight.
// Priority: stored state weight → profile (registration) weight → 75 fallback
function buildState(profileData, storedState) {
  const s   = storedState || {};
  const stW = s.weight?.current || 0;          // tracked weight from stored state
  const prW = parseFloat(profileData?.weight) || 75; // registration weight
  const currentW = stW > 0 ? stW : prW;        // prefer tracked, fallback to registration
  const base = makeCleanState({ ...profileData, weight: String(currentW) });
  return {
    ...base,
    calories:     { goal: base.calories.goal,  current: s.calories?.current  || 0 },
    protein:      { goal: base.protein.goal,   current: s.protein?.current   || 0 },
    carbs:        { goal: base.carbs.goal,     current: s.carbs?.current     || 0 },
    fat:          { goal: base.fat.goal,       current: s.fat?.current       || 0 },
    water:        { goal: base.water.goal,     current: s.water?.current     || 0 },
    steps:        { goal: base.steps.goal,     current: s.steps?.current     || 0 },
    weight:       { goal: base.weight.goal,    current: currentW,
                    history: s.weight?.history?.length ? s.weight.history : [currentW] },
    diary:        { breakfast: [], lunch: [], dinner: [], snacks: [], ...(s.diary || {}) },
    chatHistory:  s.chatHistory  || base.chatHistory,
    measurements: s.measurements || base.measurements,
    challenges:   s.challenges   || base.challenges,
    achievements: s.achievements || base.achievements,
  };
}

export default function FitGeo() {
  const [profile, setProfile] = useState(() => lsGet(LS_PROFILE));
  const [tab, setTab]         = useState("home");

  // Initial state from localStorage — shown instantly before server responds
  const [state, setState] = useState(() => {
    if (!api.getToken()) return INIT;
    const prof = lsGet(LS_PROFILE);
    if (!prof) return INIT;
    return buildState(prof, lsGet(LS_STATE));
  });

  const [showAdd,         setShowAdd]         = useState(false);
  const [toast,           setToast]           = useState(null);
  const [appLoading,      setAppLoading]      = useState(!!api.getToken());
  const [stateReady,      setStateReady]      = useState(!api.getToken());
  const [showAdmin,       setShowAdmin]       = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightModalInput,setWeightModalInput]= useState("");

  const showToast    = msg => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const updateState  = useCallback(fn => setState(p => ({ ...p, ...fn(p) })), []);
  const saveLocal    = s  => lsSet(LS_STATE, s);

  // ── Load state from server on mount ────────────────────────────────────────
  useEffect(() => {
    if (!api.getToken()) { setAppLoading(false); setStateReady(true); return; }

    api.getState()
      .then(data => {
        // 1. Resolve profile: server profile wins, but keep local weight if server has none
        const serverProf = data?.profile;
        const localProf  = lsGet(LS_PROFILE);
        const prof = serverProf || localProf;
        if (serverProf) {
          setProfile(serverProf);
          lsSet(LS_PROFILE, serverProf);
        }

        if (prof) {
          // 2. Resolve current weight: prefer whichever source has a real (non-zero) value
          const localState  = lsGet(LS_STATE);
          const serverW     = data?.appState?.weight?.current || 0;
          const localW      = localState?.weight?.current     || 0;
          // Pick the best available weight
          const bestW = serverW > 0 ? serverW : localW;

          // 3. Merge appState: use server as base, override weight with bestW if server had none
          const mergedAppState = serverW > 0
            ? data.appState
            : { ...(data?.appState || {}),
                weight: { ...(data?.appState?.weight || {}),
                           current:  bestW,
                           history:  localState?.weight?.history || (bestW > 0 ? [bestW] : []) } };

          const built = buildState(prof, mergedAppState);
          setState(built);
          saveLocal(built);
          api.saveState(built).catch(() => {});

          // 4. Show weight prompt if no real weight is set yet
          if (built.weight.current <= 0 || Math.abs(built.weight.current - 75) < 0.1) {
            const hist = built.weight.history || [];
            if (hist.every(w => Math.abs(w - 75) < 0.1)) setShowWeightModal(true);
          }
        }
        setStateReady(true);
      })
      .catch(() => {
        // Server down — use localStorage
        const prof = lsGet(LS_PROFILE);
        const cached = lsGet(LS_STATE);
        if (prof) { setState(buildState(prof, cached)); setStateReady(true); }
        else if (cached) { setState({ ...INIT, ...cached }); setStateReady(true); }
      })
      .finally(() => setAppLoading(false));
  }, []);

  // debounced auto-save — blocked until state is confirmed loaded from backend
  useEffect(() => {
    if (!api.getToken() || appLoading || !stateReady) return;
    const t = setTimeout(() => {
      api.saveState(state).catch(() => {});
      saveLocal(state);
    }, 1500);
    return () => clearTimeout(t);
  }, [state, appLoading, stateReady]);

  // ── User confirms/enters their current weight ───────────────────────────
  const handleWeightModalSubmit = () => {
    const w = parseFloat(weightModalInput);
    if (!w || w < 20 || w > 300) return;
    // Update state + both storages + backend profile
    const newProfile = { ...profile, weight: String(w) };
    const newState   = s => ({ weight: { ...s.weight, current: w, history: [w] } });
    setProfile(newProfile);
    lsSet(LS_PROFILE, newProfile);
    updateState(newState);
    api.updateProfile({ weight: String(w) }).catch(() => {});
    setShowWeightModal(false);
    setWeightModalInput("");
    showToast("⚖️ წონა განახლდა!");
  };

  const handleOnboardingDone = (profileData, serverState) => {
    lsSet(LS_PROFILE, profileData);
    setProfile(profileData);
    const built = buildState(profileData, serverState);
    setState(built);
    saveLocal(built);
    api.saveState(built).catch(() => {});
    setStateReady(true);
  };

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem(LS_PROFILE);
    localStorage.removeItem(LS_STATE);
    setProfile(null);
    setState(INIT);
    setStateReady(false);
  };

  const handleProfileUpdate = async (fields) => {
    const updated = await api.updateProfile(fields);
    const newProfile = { ...profile, ...updated };
    lsSet(LS_PROFILE, newProfile);
    setProfile(newProfile);
    // Recalculate goals from updated profile, keep current consumption values
    const goals = makeCleanState(newProfile);
    updateState(s => ({
      calories: { ...s.calories, goal: goals.calories.goal },
      protein:  { ...s.protein,  goal: goals.protein.goal  },
      fat:      { ...s.fat,      goal: goals.fat.goal      },
      carbs:    { ...s.carbs,    goal: goals.carbs.goal    },
      water:    { ...s.water,    goal: goals.water.goal    },
      weight:   { ...s.weight,   goal: goals.weight.goal   },
    }));
  };

  if (appLoading) return (
    <>
      <style>{css}</style>
      <div className="loading-screen">
        <div style={{ fontSize: 48 }}>🌿</div>
        <div className="spin-lg" />
        <div style={{ fontSize: 13, color: "var(--t2)" }}>იტვირთება...</div>
      </div>
    </>
  );

  if (!profile) return (
    <Ctx.Provider value={{ state, updateState, showToast }}>
      <style>{css}</style>
      <Onboarding onDone={handleOnboardingDone} />
    </Ctx.Provider>
  );

  const TABS = [{ id: "home", l: "მთავარი", I: Home }, { id: "food", l: "კვება", I: Utensils }, { id: "workout", l: "ვარჯიში", I: Dumbbell }, { id: "profile", l: "პროფილი", I: User }];

  if (showAdmin && profile?.isAdmin) return (
    <Ctx.Provider value={{ state, updateState, showToast, profile }}>
      <style>{css}</style>
      <AdminPanel onExit={() => setShowAdmin(false)} />
    </Ctx.Provider>
  );

  return (
    <Ctx.Provider value={{ state, updateState, showToast, profile }}>
      <style>{css}</style>
      <div className="app">
        <div className="page">
          {tab === "home" && <HomePage profile={profile} />}
          {tab === "food" && <FoodPage />}
          {tab === "workout" && <WorkoutPage />}
          {tab === "profile" && <ProfilePage profile={profile} onLogout={handleLogout} onAdmin={profile?.isAdmin ? () => setShowAdmin(true) : null} onProfileUpdate={handleProfileUpdate} />}
        </div>
        <nav className="bnav">
          {TABS.slice(0, 2).map(t => <button key={t.id} className={`ni ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}><t.I size={21} strokeWidth={tab === t.id ? 2.5 : 1.8} /><span>{t.l}</span></button>)}
          <button className="fab" onClick={() => setShowAdd(true)}><Plus size={24} color="#0a0a0a" strokeWidth={2.5} /></button>
          {TABS.slice(2).map(t => <button key={t.id} className={`ni ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}><t.I size={21} strokeWidth={tab === t.id ? 2.5 : 1.8} /><span>{t.l}</span></button>)}
        </nav>
        {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
        {toast && <div className="toast">{toast}</div>}
        {showWeightModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"var(--bg,#fff)", borderRadius:22, padding:"32px 28px", width:300, textAlign:"center", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>⚖️</div>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>შეიყვანეთ თქვენი წონა</div>
              <div style={{ fontSize:13, color:"var(--t2,#888)", marginBottom:22 }}>გთხოვთ დაადასტუროთ მიმდინარე წონა</div>
              <input
                type="number" placeholder="კგ (მაგ: 82)"
                value={weightModalInput}
                onChange={e => setWeightModalInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleWeightModalSubmit()}
                autoFocus
                style={{ width:"100%", boxSizing:"border-box", padding:"13px 16px", borderRadius:13, border:"1.5px solid var(--border,#ddd)", fontSize:20, textAlign:"center", background:"var(--card,#f5f5f5)", color:"var(--text,#111)", marginBottom:14, outline:"none" }}
              />
              <button onClick={handleWeightModalSubmit} style={{ width:"100%", padding:14, borderRadius:13, background:"var(--accent,#34c759)", color:"#fff", fontWeight:700, fontSize:15, border:"none", cursor:"pointer", marginBottom:8 }}>
                შენახვა
              </button>
              <button onClick={() => setShowWeightModal(false)} style={{ width:"100%", padding:10, borderRadius:13, background:"transparent", color:"var(--t2,#888)", fontSize:13, border:"none", cursor:"pointer" }}>
                გამოტოვება
              </button>
            </div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
