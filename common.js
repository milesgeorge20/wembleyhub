/* Wembley Gaming Hub v2 */
const DB_URL = "https://ihepfikmvtplmlgdtbix.supabase.co";
const DB_KEY = "sb_publishable_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZXBmaWttdnRwbG1sbGd0Yml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MzIsImV4cCI6MjA4NzA5NTYzMn0.Y8_pbe95V4z-vU-b-z6Tszv_A8N-u19bWb24zV-f4-8";
let db = null;
try { if (window.supabase) db = window.supabase.createClient(DB_URL, DB_KEY); } catch(e) { console.error(e); }

const DEFAULT_GAMES = [
  {name:"GTA V", rate:2}, {name:"Call of Duty", rate:2}, {name:"Mortal Kombat", rate:2},
  {name:"NBA 2K", rate:2}, {name:"eFootball", rate:2}, {name:"Minecraft", rate:2},
  {name:"Need for Speed", rate:2}, {name:"Other", rate:2}
];

function getSettings(){
  const saved = JSON.parse(localStorage.getItem("wembley_settings") || "null");
  const base = { ps5_fc_rate:50, ps4_fc_rate:30, buffer_minutes:4, games:DEFAULT_GAMES.map(g=>({...g})) };
  if(!saved){ localStorage.setItem("wembley_settings", JSON.stringify(base)); return base; }
  const migrated = { ...base, ...saved };
  if(!Array.isArray(saved.games) || saved.games.length===0){
    const oldGta = Number(saved.ps4_gta_rate);
    migrated.games = base.games.map(g => g.name === "GTA V" && Number.isFinite(oldGta) ? {...g, rate:oldGta} : {...g});
  }
  localStorage.setItem("wembley_settings", JSON.stringify(migrated));
  return migrated;
}
let settings=getSettings();
let active=JSON.parse(localStorage.getItem("wembley_active_sessions") || "{}");

function saveState(){
  localStorage.setItem("wembley_settings",JSON.stringify(settings));
  localStorage.setItem("wembley_active_sessions",JSON.stringify(active));
}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function toast(msg,type="info"){
  let t=document.getElementById("toast"); if(!t)return;
  t.textContent=msg;
  t.className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl font-bold "+(type==="error"?"bg-red-600":type==="success"?"bg-emerald-600":"bg-slate-800")+" text-white";
  setTimeout(()=>t.classList.add("hidden"),3500);
}
async function hashPassword(p){
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(p));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function verifyUser(role,user,pass){
  const key=role==="admin"?"wembley_admin":"wembley_attendant";
  const saved=JSON.parse(localStorage.getItem(key)||"null");
  if(!saved)return false;
  return saved.username===user && saved.hash===await hashPassword(pass);
}
function logout(){ sessionStorage.removeItem("wembley_role"); location.reload(); }
function requireLogin(role){
  if(sessionStorage.getItem("wembley_role")!==role){
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
    return false;
  }
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  return true;
}
function setupLogin(role){
  document.getElementById("login-title").textContent=role==="admin"?"Admin Login":"Attendant Login";
  document.getElementById("login-form").onsubmit=async e=>{
    e.preventDefault();
    const u=document.getElementById("login-user").value.trim(), p=document.getElementById("login-pass").value;
    if(await verifyUser(role,u,p)){
      sessionStorage.setItem("wembley_role",role); location.reload();
    } else toast("Incorrect username or password.","error");
  };
}
function startSession(id,type,mode,minutes=null,rate=null){
  if(active[id])return;
  active[id]={type,gameMode:mode,startTime:new Date().toISOString(),minutes:minutes?Number(minutes):null,rate:rate!=null?Number(rate):null};
  saveState(); renderStations(); toast(`${mode} started on ${type}.`,"success");
}
function beep(){
  try{
    const C=window.AudioContext||window.webkitAudioContext, c=new C(), o=c.createOscillator(),g=c.createGain();
    o.type="sine";o.frequency.value=880;g.gain.setValueAtTime(.0001,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.35,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.25);
    o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.28);
    setTimeout(()=>{const o2=c.createOscillator();o2.frequency.value=660;o2.connect(g);o2.start();o2.stop(c.currentTime+.28)},320);
  }catch(e){}
}
let endedTimers={};
function timerText(s){
  const elapsed=Math.max(0,Date.now()-new Date(s.startTime).getTime());
  if(s.minutes){
    const left=Math.max(0,s.minutes*60000-elapsed);
    const total=Math.floor(left/1000),h=Math.floor(total/3600),m=Math.floor(total%3600/60),sec=total%60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  }
  const total=Math.floor(elapsed/1000),h=Math.floor(total/3600),m=Math.floor(total%3600/60),sec=total%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function updateTimers(){
  Object.entries(active).forEach(([id,s])=>{
    const el=document.getElementById("timer-"+id); if(el)el.textContent=timerText(s);
    if(s.minutes){
      const left=s.minutes*60000-(Date.now()-new Date(s.startTime).getTime());
      if(left<=0 && !endedTimers[id]){
        endedTimers[id]=true; beep(); toast(`${s.type} ${s.gameMode} time is finished!`,"error");
        const badge=document.getElementById("done-"+id); if(badge)badge.classList.remove("hidden");
      }
    }
  });
}
async function endSession(id){
  const s=active[id]; if(!s)return;
  const end=new Date(), start=new Date(s.startTime);
  const duration=Math.max(1,Math.round((end-start)/60000));
  let amount;
  if(s.gameMode==="FC Match") amount=s.type==="PS5"?settings.ps5_fc_rate:settings.ps4_fc_rate;
  else amount=duration*(s.rate ?? 2);
  const log={attendant_id:"Wembley_Attendant",console_name:s.type,game_mode:s.gameMode,start_time:s.startTime,end_time:end.toISOString(),duration_minutes:duration,calculated_amount_ksh:amount};
  delete active[id]; saveState(); renderStations();
  let ok=false;
  if(db){try{const r=await db.from("session_logs").insert([log]);ok=!r.error}catch(e){}}
  if(!ok){
    const q=JSON.parse(localStorage.getItem("wembley_offline_logs")||"[]");q.push(log);localStorage.setItem("wembley_offline_logs",JSON.stringify(q));
  }
  toast(`Session ended. Amount due: KSh ${amount.toFixed(2)}${ok?"":" (saved offline)"}`,ok?"success":"info");
}
async function syncLogs(){
  const q=JSON.parse(localStorage.getItem("wembley_offline_logs")||"[]");
  if(!q.length)return;
  if(!db)return;
  try{const r=await db.from("session_logs").insert(q);if(!r.error){localStorage.removeItem("wembley_offline_logs");toast("Offline records synchronized.","success");}}catch(e){}
}
function gameOptions(){
  return settings.games.map(g=>`<option value="${esc(g.name)}">${esc(g.name)} — KSh ${Number(g.rate).toFixed(2)}/min</option>`).join("");
}
function renderStations(){
  const grid=document.getElementById("stations-grid"); if(!grid)return;
  const stations=[{id:"ps5_1",type:"PS5",name:"PS5 - Station 1"},{id:"ps4_1",type:"PS4",name:"PS4 - Station 2"},{id:"ps4_2",type:"PS4",name:"PS4 - Station 3"}];
  grid.innerHTML=stations.map(st=>{
    const s=active[st.id];
    if(s)return `<div class="bg-slate-900 p-5 rounded-2xl border border-indigo-500/50 shadow-lg">
      <div class="flex justify-between items-center mb-3"><h3 class="text-xl font-bold">${st.name}</h3><span class="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold animate-pulse">LIVE</span></div>
      <p class="text-slate-400 text-sm">Game: <b class="text-white">${esc(s.gameMode)}</b></p>
      <p id="timer-${st.id}" class="text-3xl font-black text-indigo-400 my-4">${timerText(s)}</p>
      ${s.minutes?`<p id="done-${st.id}" class="hidden text-red-400 font-bold mb-3">🔔 TIME FINISHED — END SESSION</p>`:""}
      <button onclick="endSession('${st.id}')" class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold">End Session & Bill</button>
    </div>`;
    if(st.type==="PS5")return `<div class="bg-slate-900 p-5 rounded-2xl border border-slate-700">
      <div class="flex justify-between mb-4"><h3 class="text-xl font-bold">${st.name}</h3><span class="px-2 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-bold">OPEN</span></div>
      <button onclick="startSession('${st.id}','PS5','FC Match')" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold">⚽ Start FC Match — KSh ${settings.ps5_fc_rate} / game</button>
    </div>`;
    return `<div class="bg-slate-900 p-5 rounded-2xl border border-slate-700">
      <div class="flex justify-between mb-4"><h3 class="text-xl font-bold">${st.name}</h3><span class="px-2 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-bold">OPEN</span></div>
      <div class="space-y-3">
        <button onclick="startSession('${st.id}','PS4','FC Match')" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold">⚽ Start FC Match — KSh ${settings.ps4_fc_rate} / game</button>
        <select id="game-${st.id}" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3">${gameOptions()}</select>
        <select id="mins-${st.id}" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3">
          <option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option>
        </select>
        <button onclick="startTimedGame('${st.id}')" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold">🎮 Start Timed Game</button>
      </div>
    </div>`;
  }).join("");
}
function startTimedGame(id){
  const g=document.getElementById("game-"+id), m=document.getElementById("mins-"+id);
  const game=settings.games.find(x=>x.name===g.value)||{rate:2};
  startSession(id,"PS4",g.value,m.value,game.rate);
}
async function createCredential(role){
  const u=document.getElementById(role+"-new-user").value.trim(), p=document.getElementById(role+"-new-pass").value;
  if(!u||p.length<6){toast("Username required and password must be at least 6 characters.","error");return;}
  localStorage.setItem(role==="admin"?"wembley_admin":"wembley_attendant",JSON.stringify({username:u,hash:await hashPassword(p)}));
  document.getElementById(role+"-new-pass").value="";
  toast(`${role==="admin"?"Admin":"Attendant"} credentials saved.`,"success");
}
function fillSettings(){
  const a=document.getElementById("set-ps5"),b=document.getElementById("set-ps4"),c=document.getElementById("set-buffer");
  if(a){a.value=settings.ps5_fc_rate;b.value=settings.ps4_fc_rate;c.value=settings.buffer_minutes;}
  const list=document.getElementById("game-list");
  if(list)list.innerHTML=settings.games.map((g,i)=>`<div class="flex gap-2 mb-2"><input id="gn${i}" value="${esc(g.name)}" class="flex-1 bg-slate-800 rounded px-3 py-2"><input id="gr${i}" type="number" step=".5" value="${g.rate}" class="w-28 bg-slate-800 rounded px-3 py-2"><button onclick="removeGame(${i})" class="px-3 bg-red-600 rounded">×</button></div>`).join("");
}
function saveAdminSettings(){
  if(!Array.isArray(settings.games)) settings.games=DEFAULT_GAMES.map(g=>({...g}));
  settings.ps5_fc_rate=Number(document.getElementById("set-ps5").value)||0;
  settings.ps4_fc_rate=Number(document.getElementById("set-ps4").value)||0;
  settings.buffer_minutes=Number(document.getElementById("set-buffer").value)||0;
  settings.games=settings.games.map((g,i)=>({name:document.getElementById("gn"+i).value.trim()||g.name,rate:Number(document.getElementById("gr"+i).value)||0}));
  saveState();fillSettings();renderStations();toast("Settings saved.","success");
}
function addGame(){
  if(!Array.isArray(settings.games)) settings.games=DEFAULT_GAMES.map(g=>({...g}));
  settings.games.push({name:"New Game",rate:2});
  saveState(); fillSettings();
}
function removeGame(i){
  if(!Array.isArray(settings.games) || settings.games.length<=1)return;
  settings.games.splice(i,1); saveState(); fillSettings();
}
async function adminDashboard(){
  fillSettings();
  const f=document.getElementById("filter").value;
  let data=[];
  if(db){try{let q=db.from("session_logs").select("*").order("start_time",{ascending:false});if(f!=="all"){const d=new Date();d.setDate(d.getDate()-(f==="week"?7:30));q=q.gte("start_time",d.toISOString())}const r=await q;if(!r.error)data=r.data||[];}catch(e){}}
  if(!data.length)data=JSON.parse(localStorage.getItem("wembley_offline_logs")||"[]");
  let rev=0,min=0;
  const rows=data.map(x=>{const a=Number(x.calculated_amount_ksh)||0,m=Number(x.duration_minutes)||0;rev+=a;min+=m;return `<tr class="border-b border-slate-800"><td class="p-3">${new Date(x.start_time).toLocaleString()}</td><td class="p-3">${esc(x.console_name)}</td><td class="p-3">${esc(x.game_mode)}</td><td class="p-3">${m} mins</td><td class="p-3 text-emerald-400 font-bold">KSh ${a.toFixed(2)}</td></tr>`}).join("");
  document.getElementById("stat-revenue").textContent="KSh "+rev.toFixed(2);
  document.getElementById("stat-sessions").textContent=data.length;
  document.getElementById("stat-hours").textContent=(min/60).toFixed(1);
  document.getElementById("audit").innerHTML=rows||`<tr><td colspan="5" class="p-5 text-center text-slate-500">No records.</td></tr>`;
}
