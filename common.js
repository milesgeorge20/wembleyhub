const SUPABASE_URL="https://ihepufhkmtplmllgtbix.supabase.co";
const SUPABASE_KEY="sb_publishable_oYfDoonB9xD1gzsUBZPINA_DsvWpCxo";
let sb=null;try{sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY)}catch(e){console.error(e)}
const DEFAULT_SETTINGS={ps5_fc_rate:50,ps5_block_rate:50,ps4_fc_rate:30,games:[
{name:"GTA V",rate:2},{name:"Call of Duty",rate:2},{name:"Mortal Kombat",rate:2},{name:"NBA 2K",rate:2},{name:"eFootball",rate:2},{name:"Minecraft",rate:2},{name:"Need for Speed",rate:2}]};
let settings=JSON.parse(localStorage.getItem("wembley_settings")||"null")||DEFAULT_SETTINGS;
if(!Array.isArray(settings.games))settings.games=DEFAULT_SETTINGS.games;
let activeSessions=JSON.parse(localStorage.getItem("wembley_active_sessions")||"{}");
let offlineLogs=JSON.parse(localStorage.getItem("wembley_offline_logs")||"[]");
function saveLocal(){localStorage.setItem("wembley_settings",JSON.stringify(settings));localStorage.setItem("wembley_active_sessions",JSON.stringify(activeSessions));localStorage.setItem("wembley_offline_logs",JSON.stringify(offlineLogs))}
function money(n){return`KSh ${Number(n||0).toFixed(2)}`}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function hash(t){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(role,u,p){const {data,error}=await sb.from("shop_credentials").select("username").eq("username",u).eq("password_hash",await hash(p)).eq("role",role).maybeSingle();if(error)throw error;return!!data}
async function saveCredential(u,p,role){const {error}=await sb.from("shop_credentials").upsert([{username:u,password_hash:await hash(p),role}],{onConflict:"username"});if(error)throw error}
async function cloudInsert(log){const {error}=await sb.from("session_logs").insert([log]);if(error)throw error}
function queueOffline(log){offlineLogs.push(log);saveLocal();updateSyncBadge()}
async function syncOfflineLogs(show=false){let done=0;for(const log of [...offlineLogs]){try{await cloudInsert(log);offlineLogs=offlineLogs.filter(x=>x.local_id!==log.local_id);saveLocal();done++}catch(e){break}}updateSyncBadge();if(show)alert(done?`${done} offline record(s) synced.`:"No offline records could be synced yet.")}
function updateSyncBadge(){document.querySelectorAll("[data-offline-count]").forEach(x=>x.textContent=offlineLogs.length?`Offline: ${offlineLogs.length}`:"Cloud synced")}
window.addEventListener("online",()=>syncOfflineLogs());setInterval(()=>navigator.onLine&&syncOfflineLogs(),30000);
function beep(){try{let C=AudioContext||webkitAudioContext,c=new C,o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.2;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>o.frequency.value=660,250);setTimeout(()=>{o.stop();c.close()},500)}catch(e){}}
function blocks(m){return Math.max(1,Math.ceil(m/15))}
function calc(s){let m=Math.max(1,Math.ceil((Date.now()-new Date(s.startTime))/60000));if(s.billing==="fc")return{s:m,amount:s.type==="PS5"?settings.ps5_fc_rate:settings.ps4_fc_rate};if(s.billing==="ps5block")return{s:m,amount:blocks(m)*settings.ps5_block_rate};let g=settings.games.find(x=>x.name===s.gameMode);return{s:m,amount:m*Number(g?.rate||2)}}
async function finishSession(id){let s=activeSessions[id];if(!s)return;let c=calc(s),log={attendant_id:localStorage.getItem("wembley_attendant_user")||"Wembley_Attendant",console_name:s.type,game_mode:s.gameMode,billing_type:s.billing,start_time:s.startTime,end_time:new Date().toISOString(),duration_minutes:c.s,calculated_amount_ksh:c.amount,local_id:crypto.randomUUID?crypto.randomUUID():Date.now()+Math.random()};delete activeSessions[id];saveLocal();renderAttendantStations();try{await cloudInsert(log);alert(`Session Ended!\\nTotal Amount Due: ${money(c.amount)}\\n✓ Saved to cloud`)}catch(e){queueOffline(log);alert(`Saved Offline!\\nTotal Amount: ${money(c.amount)}\\n🟠 Will auto-sync when connection returns.`)}}
