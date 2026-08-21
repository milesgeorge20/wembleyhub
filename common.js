const SUPABASE_URL="https://ihepufhkmtplmllgtbix.supabase.co";
const SUPABASE_KEY="sb_publishable_oYfDoonB9xD1gzsUBZPINA_DsvWpCxo";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const DEFAULT_SETTINGS={ps5_fc_rate:50,ps5_block_rate:50,ps4_fc_rate:30,games:[{name:"GTA V",rate:2},{name:"Call of Duty",rate:2},{name:"Mortal Kombat",rate:2},{name:"NBA 2K",rate:2}]};
let settings=JSON.parse(localStorage.getItem("wembley_settings")||"null")||DEFAULT_SETTINGS;
let activeSessions=JSON.parse(localStorage.getItem("wembley_active_sessions")||"{}");
let offlineLogs=JSON.parse(localStorage.getItem("wembley_offline_logs")||"[]");
let cachedCred=JSON.parse(localStorage.getItem("wembley_offline_credential")||"null");
function saveLocal(){localStorage.setItem("wembley_settings",JSON.stringify(settings));localStorage.setItem("wembley_active_sessions",JSON.stringify(activeSessions));localStorage.setItem("wembley_offline_logs",JSON.stringify(offlineLogs))}
function money(n){return`KSh ${Number(n||0).toFixed(2)}`}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function hash(t){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(role,u,p){try{const {data,error}=await sb.from("shop_credentials").select("username,password_hash").eq("username",u).eq("role",role).maybeSingle();if(error)throw error;const h=await hash(p);if(data&&data.password_hash===h){localStorage.setItem("wembley_offline_credential",JSON.stringify({username:u,password_hash:h,role}));return true}}catch(e){if(cachedCred&&cachedCred.username===u&&cachedCred.role===role&&cachedCred.password_hash===await hash(p))return true;throw e}return false}
async function saveCredential(u,p,role){const {error}=await sb.from("shop_credentials").upsert([{username:u,password_hash:await hash(p),role}],{onConflict:"username"});if(error)throw error}
async function loadCloudSettings(){const {data,error}=await sb.from("shop_settings").select("settings").eq("id",1).maybeSingle();if(error)throw error;if(data?.settings){settings={...DEFAULT_SETTINGS,...data.settings};saveLocal()}}
async function saveCloudSettings(){const {error}=await sb.from("shop_settings").upsert({id:1,settings,updated_at:new Date().toISOString()},{onConflict:"id"});if(error)throw error;saveLocal()}
async function insertLog(log){const {error}=await sb.from("session_logs").insert([log]);if(error)throw error}
function queueLog(log){offlineLogs.push(log);saveLocal();syncBadge()}
async function syncOfflineLogs(){if(!navigator.onLine)return;for(const log of [...offlineLogs]){try{await insertLog(log);offlineLogs=offlineLogs.filter(x=>x.local_id!==log.local_id);saveLocal()}catch(e){console.error(e);break}}syncBadge()}
function syncBadge(){document.querySelectorAll("[data-sync]").forEach(x=>x.textContent=offlineLogs.length?`🟠 ${offlineLogs.length} offline record(s)`:"🟢 Synced")}
window.addEventListener("online",()=>{syncOfflineLogs();loadCloudSettings().catch(()=>{})});
setInterval(()=>{syncOfflineLogs();loadCloudSettings().catch(()=>{})},30000);
function beep(){try{const C=window.AudioContext||window.webkitAudioContext,c=new C,o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.25;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>o.frequency.value=660,250);setTimeout(()=>{o.stop();c.close()},700)}catch(e){}}
function calc(s){const minutes=Math.max(1,Math.ceil((Date.now()-new Date(s.startTime))/60000));if(s.billing==="fc")return{minutes,amount:s.type==="PS5"?settings.ps5_fc_rate:settings.ps4_fc_rate};if(s.billing==="ps5block")return{minutes,amount:Math.ceil(minutes/15)*settings.ps5_block_rate};const g=settings.games.find(x=>x.name===s.gameMode);return{minutes,amount:minutes*Number(g?.rate||2)}}
async function finishSession(id){const s=activeSessions[id];if(!s)return;const c=calc(s);const log={attendant_id:localStorage.getItem("wembley_attendant_user")||"Wembley_Attendant",console_name:s.type,game_mode:s.gameMode,start_time:s.startTime,end_time:new Date().toISOString(),duration_minutes:c.minutes,calculated_amount_ksh:c.amount,local_id:crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()};delete activeSessions[id];saveLocal();renderAttendantStations();try{await insertLog(log);alert(`Session Ended!\nTotal Amount Due: ${money(c.amount)}\n🟢 Saved to cloud`)}catch(e){queueLog(log);alert(`Saved Offline!\nTotal Amount: ${money(c.amount)}\n🟠 Will sync when internet returns.`)}}
