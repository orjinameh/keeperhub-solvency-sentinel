export const portalPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Solvency Sentinel — Control Room</title>
<style>
:root{--bg:#05070d;--card:#0b0f1a;--card2:#0e1424;--line:rgba(255,255,255,.08);--txt:#e8edf7;--mut:#8b94a7;--acc:#34d399;--acc2:#a3e635;--red:#f43f5e;--amber:#fbbf24;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.auth-wrap{min-height:70vh;display:grid;place-items:center;padding:40px 24px}
.auth-card{width:100%;max-width:400px;border:1px solid var(--line);border-radius:18px;background:var(--card);padding:34px}
.auth-logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--acc),var(--acc2));display:grid;place-items:center;color:#05110a;font-size:22px;font-weight:900;margin-bottom:18px}
.auth-card h2{font-size:22px;font-weight:800;letter-spacing:-.01em}
.auth-sub{color:var(--mut);font-size:13.5px;margin:8px 0 22px}
.auth-card form{display:grid;gap:14px}
.auth-card label{font-size:12.5px;color:var(--mut)}
.auth-btn{width:100%;justify-content:center;margin-top:4px}
.btn-google{width:100%;justify-content:center;gap:10px;border:1px solid var(--line);background:var(--card);color:var(--fg);font-weight:600;margin-bottom:16px}
.btn-google:hover{border-color:var(--acc);color:var(--fg)}
.auth-divider{display:flex;align-items:center;gap:12px;color:var(--mut);font-size:12.5px;margin-bottom:16px}
.auth-divider::before,.auth-divider::after{content:"";flex:1;height:1px;background:var(--line)}
.auth-switch{margin-top:16px;font-size:13.5px;color:var(--mut);text-align:center}
.auth-switch a{color:var(--acc);cursor:pointer;text-decoration:none}
nav{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;max-width:1120px;margin:0 auto;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;font-weight:700}
.logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--acc2));display:grid;place-items:center;color:#05110a;font-size:16px;font-weight:900}
.nav-right{display:flex;gap:14px;align-items:center;font-size:13.5px;color:var(--mut)}
.nav-right a{color:var(--mut);text-decoration:none}
.nav-right a:hover{color:var(--txt)}
.btn{display:inline-flex;align-items:center;gap:7px;text-decoration:none;font-weight:600;font-size:13.5px;padding:9px 16px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:.15s;font-family:inherit}
.btn-primary{background:linear-gradient(135deg,var(--acc),var(--acc2));color:#05110a}
.btn-primary:hover{filter:brightness(1.08)}
.btn-ghost{border-color:var(--line);color:var(--txt);background:var(--card)}
.btn-ghost:hover{border-color:var(--acc);color:var(--acc)}
.btn-danger{border-color:rgba(244,63,94,.4);color:#fb7185;background:rgba(244,63,94,.08)}
.btn-danger:hover{background:rgba(244,63,94,.16)}
.btn:disabled{opacity:.5;cursor:not-allowed}
main{padding:28px 0 80px}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:24px;flex-wrap:wrap}
.tab{background:none;border:none;color:var(--mut);font-size:14px;font-weight:600;padding:11px 18px;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
.tab:hover{color:var(--txt)}
.tab.active{color:var(--acc);border-bottom-color:var(--acc)}
.panel{display:none}
.panel.active{display:block;animation:rise .2s}
@keyframes rise{from{opacity:0;transform:translateY(3px)}to{opacity:1}}
h1{font-size:24px;font-weight:800;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:14px;margin-top:4px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:20px 0}
.card{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:18px}
.card .lbl{font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.card .num{font-family:var(--mono);font-size:30px;font-weight:700;margin-top:6px}
.card .num.ok{color:#6ee7b7}.card .num.warn{color:#fcd34d}.card .num.bad{color:#fb7185}
.card .hint{font-size:12.5px;color:var(--mut);margin-top:4px}
.section-title{font-size:16px;font-weight:700;margin:26px 0 12px}
.list{display:grid;gap:10px}
.row{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:14px 16px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.row .info{min-width:0}
.row .info .t{font-size:14px;font-weight:600}
.row .info .d{font-size:12.5px;color:var(--mut);font-family:var(--mono);word-break:break-all;margin-top:2px}
.row .info .meta{font-size:12.5px;color:var(--mut);margin-top:2px}
.row .actions{display:flex;gap:8px;flex-wrap:wrap}
.badge{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:700;letter-spacing:.04em}
.b-ok{background:rgba(52,211,153,.12);color:#6ee7b7;border:1px solid rgba(52,211,153,.35)}
.b-warn{background:rgba(251,191,36,.12);color:#fcd34d;border:1px solid rgba(251,191,36,.35)}
.b-bad{background:rgba(244,63,94,.12);color:#fb7185;border:1px solid rgba(244,63,94,.35)}
.b-mut{background:rgba(255,255,255,.06);color:var(--mut);border:1px solid var(--line)}
.b-acc{background:rgba(163,230,53,.12);color:var(--acc2);border:1px solid rgba(163,230,53,.35)}
form.grid-form{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));align-items:end}
label{display:block;font-size:12.5px;color:var(--mut);margin-bottom:5px}
input,select{background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font-size:13.5px;font-family:var(--mono);outline:none;width:100%}
input:focus,select:focus{border-color:var(--acc)}
.msg{margin-top:12px;font-size:13.5px}
.msg.ok{color:var(--acc)}
.msg.err{color:#fb7185}
.codebox{font-family:var(--mono);font-size:13px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;color:var(--acc2);word-break:break-all}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{color:var(--mut);text-align:left;font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.tbl td{padding:10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
.tbl td .mono{font-family:var(--mono);font-size:12px;color:var(--mut);word-break:break-all}
.hf{font-family:var(--mono);font-weight:700}
.hf.ok{color:#6ee7b7}.hf.warn{color:#fcd34d}.hf.bad{color:#fb7185}
.spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.2);border-top-color:var(--acc);border-radius:50%;animation:spin .7s linear infinite;display:inline-block;vertical-align:-3px}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{color:var(--mut);font-size:13.5px;border:1px dashed var(--line);border-radius:12px;padding:18px;text-align:center}
.help{font-size:13px;color:var(--mut);margin-top:6px}
a{color:var(--acc)}
.kv{display:grid;grid-template-columns:130px 1fr;gap:8px 14px;font-size:13.5px}
.kv b{color:var(--mut);font-weight:600}
.copy{cursor:pointer}
</style>
</head>
<body>
<nav>
  <div class="brand"><div class="logo">S</div>Solvency Sentinel</div>
  <div class="nav-right">
    <a href="/">Landing</a>
    <span id="navEmail" style="display:none">…</span>
    <button class="btn btn-ghost" id="logoutBtn" style="display:none">Log out</button>
  </div>
</nav>

<div class="auth-wrap" id="auth">
  <div class="auth-card">
    <div class="auth-logo">S</div>
    <h2>Solvency Sentinel</h2>
    <p class="auth-sub">Sign in to the Control Room to manage your positions, credentials, agent approvals and plugins.</p>
    <a class="btn btn-google" id="googleBtn" href="/api/portal/auth/google">
      <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      <span>Continue with Google</span>
    </a>
    <div class="auth-divider">or continue with email</div>
    <form id="loginForm">
      <div><label>Email</label><input id="loginEmail" type="email" autocomplete="email" required></div>
      <div><label>Password</label><input id="loginPassword" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary auth-btn" type="submit">Sign in</button>
    </form>
    <form id="regForm" style="display:none">
      <div><label>Email</label><input id="regEmail" type="email" autocomplete="email" required></div>
      <div><label>Password (min 8 chars)</label><input id="regPassword" type="password" minlength="8" autocomplete="new-password" required></div>
      <button class="btn btn-primary auth-btn" type="submit">Create account</button>
    </form>
    <div class="auth-switch" id="authSwitch">New here? <a id="showReg">Create an account</a></div>
    <div class="msg" id="authMsg"></div>
  </div>
</div>

<main class="wrap" id="app" style="display:none">
  <h1>Control Room</h1>
  <div class="sub" id="pageSub">Signing in…</div>
  <div class="tabs">
    <button class="tab active" data-tab="overview">Overview</button>
    <button class="tab" data-tab="credentials">Credentials</button>
    <button class="tab" data-tab="agents">Agents</button>
    <button class="tab" data-tab="approvals">Approvals</button>
    <button class="tab" data-tab="plugins">Plugins</button>
  </div>

  <section class="panel active" id="p-overview">
    <div class="cards">
      <div class="card"><div class="lbl">Claimed positions</div><div class="num" id="statPositions">–</div><div class="hint">Wallets you proved you control</div></div>
      <div class="card"><div class="lbl">Plugins active</div><div class="num" id="statPlugins">–</div><div class="hint">Networks under sentinel watch</div></div>
      <div class="card"><div class="lbl">Pending approvals</div><div class="num warn" id="statApprovals">–</div><div class="hint">Broadcasts waiting on you</div></div>
      <div class="card"><div class="lbl">Agent calls</div><div class="num" id="statActivity">–</div><div class="hint">MCP tool invocations recorded</div></div>
    </div>
    <div class="section-title">Your positions</div>
    <div class="list" id="posList"><div class="empty">No claimed positions yet. Claim one on the landing page, or wait for the agent to do it via <code>sentinel_register</code>.</div></div>
    <div class="section-title">Latest agent activity</div>
    <div class="list" id="ovActivity"></div>
  </section>

  <section class="panel" id="p-credentials">
    <div class="sub" style="margin-bottom:14px">Stored secrets are encrypted with AES-256-GCM. The KeeperHub API key is used for dashboard dry-runs; the rescue wallet key can fund future auto-broadcasts.</div>
    <div class="section-title">Saved credentials</div>
    <div class="list" id="credList"></div>
    <div class="section-title">Add credential</div>
    <form class="grid-form" id="credForm">
      <div><label>Name</label><input id="credName" placeholder="KeeperHub org key / Rescue wallet" required></div>
      <div><label>Type</label><select id="credType"><option value="keeperhub-api-key">KeeperHub API key</option><option value="rescue-wallet-key">Rescue wallet private key</option></select></div>
      <div><label>Value</label><input id="credValue" type="password" placeholder="kh_key_… or 0x…" required autocomplete="off"></div>
      <div><button class="btn btn-primary" type="submit">Save</button></div>
    </form>
    <div class="msg" id="credMsg"></div>
  </section>

  <section class="panel" id="p-agents">
    <div class="section-title">MCP endpoint</div>
    <div class="codebox" id="mcpUrl" style="margin-bottom:10px">…</div>
    <div class="help" style="margin-bottom:4px">Bearer token for <code>Authorization</code> header (the server also supports full OAuth):</div>
    <div class="codebox" id="mcpToken">…</div>
    <div class="section-title">Registered tools</div>
    <div class="tbl-wrap" style="overflow:auto"><table class="tbl" id="toolsTbl"><thead><tr><th>Tool</th><th>Purpose</th></tr></thead><tbody></tbody></table></div>
    <div class="section-title">Recent agent calls</div>
    <div class="tbl-wrap" style="overflow:auto"><table class="tbl" id="actTbl"><thead><tr><th>When</th><th>Tool</th><th>Args</th><th>Result</th><th>ms</th></tr></thead><tbody></tbody></table></div>
  </section>

  <section class="panel" id="p-approvals">
    <div class="sub" style="margin-bottom:14px">When an agent asks to broadcast a rescue, it lands here and waits for your decision. Approve to execute, reject to stop.</div>
    <div class="section-title">Pending</div>
    <div class="list" id="apvPending"></div>
    <div class="section-title">History</div>
    <div class="list" id="apvHistory"></div>
  </section>

  <section class="panel" id="p-plugins">
    <div class="sub" style="margin-bottom:14px">Networks and protocols under sentinel watch. Toggle an Aave V3 network on and set the health-factor thresholds that trigger a protective repayment.</div>
    <div class="list" id="pluginList"></div>
    <div class="msg" id="pluginMsg"></div>
  </section>
</main>
<script>
var CHAINS=[
  ["11155111","Ethereum Sepolia"],
  ["84532","Base Sepolia"],
  ["1","Ethereum"],
  ["8453","Base"],
  ["42161","Arbitrum One"],
  ["137","Polygon"]
];
var TOOLS=[
  ["sentinel_check","Read a position's health factor and risk level (read-only)."],
  ["sentinel_monitor","Full protect loop: read, evaluate, simulate, broadcast (held for approval), poll, verify."],
  ["sentinel_register","Record proof of ownership via the wallet's signature so broadcasts are allowed."],
  ["sentinel_status","Fetch the status and verified receipts of a KeeperHub execution."]
];
var state={user:null,positions:[],credentials:[],plugins:[],approvals:[],activity:[],agent:null};
var tab="overview";
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function short(a){return a?a.slice(0,8)+"…"+a.slice(-4):""}
function chainName(id){var c=CHAINS.find(function(x){return x[0]===String(id)});return c?c[1]:(String(id))}
function hfClass(h){var n=Number(h);return n<1.05?"bad":n<1.5?"warn":"ok"}
function ts(t){if(!t)return"–";return new Date(t).toLocaleString()}
function statusBadge(s){var map={healthy:["b-ok","HEALTHY"],watch:["b-warn","WATCH"],critical:["b-bad","CRITICAL"],liquidatable:["b-bad","LIQUIDATABLE"],unverified:["b-mut","UNVERIFIED"],pending:["b-warn","PENDING"],approved:["b-ok","APPROVED"],rejected:["b-bad","REJECTED"],timeout:["b-mut","TIMEOUT"]};var m=map[String(s).toLowerCase()]||["b-mut",String(s).toUpperCase()];return '<span class="badge '+m[0]+'">'+m[1]+'</span>'}
function setTab(t){tab=t;document.querySelectorAll(".tab").forEach(function(b){b.classList.toggle("active",b.dataset.tab===t)});document.querySelectorAll(".panel").forEach(function(p){p.classList.toggle("active",p.id==="p-"+t)});if(t==="approvals")loadApprovals()}
document.querySelectorAll(".tab").forEach(function(b){b.addEventListener("click",function(){setTab(b.dataset.tab)})});

function api(path,opts){
  return fetch(path,opts).then(function(r){return r.json().then(function(d){return {status:r.status,d:d}})})}

function authMsg(txt,ok){
  var m=$("authMsg");m.className="msg "+(ok?"ok":"err");m.textContent=txt;
}
function showAuth(){
  $("auth").style.display="grid";
  $("app").style.display="none";
  $("navEmail").style.display="none";
  $("logoutBtn").style.display="none";
}
function showApp(){
  $("auth").style.display="none";
  $("app").style.display="block";
  $("navEmail").style.display="inline";
  $("logoutBtn").style.display="inline-flex";
}
function toggleAuthMode(reg){
  $("loginForm").style.display=reg?"none":"grid";
  $("regForm").style.display=reg?"grid":"none";
  $("authSwitch").innerHTML=reg?'Have an account? <a id="showLogin">Sign in</a>':'New here? <a id="showReg">Create an account</a>';
wireAuthSwitch();

fetch("/api/portal/auth/status").then(function(r){return r.json()}).then(function(d){
  if(!d.googleConfigured)$("googleBtn").style.display="none";
}).catch(function(){});

  authMsg("",true);
}
function wireAuthSwitch(){
  var sr=$("showReg"),sl=$("showLogin");
  if(sr)sr.addEventListener("click",function(e){e.preventDefault();toggleAuthMode(true)});
  if(sl)sl.addEventListener("click",function(e){e.preventDefault();toggleAuthMode(false)});
}
function submitAuth(path,email,pw,btn){
  btn.disabled=true;
  return api(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:email,password:pw})}).then(function(r){
    if(r.d.ok){showApp();return loadMe()}
    authMsg(r.d.error||"Authentication failed.",false);
    return null;
  }).catch(function(e){authMsg(e.message,false)}).finally(function(){btn.disabled=false});
}
$("loginForm").addEventListener("submit",function(e){
  e.preventDefault();
  submitAuth("/api/portal/login",$("loginEmail").value.trim(),$("loginPassword").value,e.target.querySelector("button[type=submit]"));
});
$("regForm").addEventListener("submit",function(e){
  e.preventDefault();
  submitAuth("/api/portal/register",$("regEmail").value.trim(),$("regPassword").value,e.target.querySelector("button[type=submit]"));
});
wireAuthSwitch();

function loadMe(){
  return api("/api/portal/me").then(function(r){
    if(r.status===401){showAuth();return null}
    state=r.d;
    $("navEmail").textContent=state.user.email;
    $("pageSub").textContent="Welcome back — "+state.user.email;
    renderOverview();renderCredentials();renderAgents();renderPlugins();renderActivity();
    return state;
  }).catch(function(e){
    $("pageSub").textContent="Failed to load: "+e.message;
    showAuth();
  });
}

function renderOverview(){
  $("statPositions").textContent=state.positions.length;
  $("statPlugins").textContent=state.plugins.filter(function(p){return p.enabled}).length;
  var pend=state.approvals.filter(function(a){return a.status==="pending"});
  $("statApprovals").textContent=pend.length;
  $("statActivity").textContent=state.activity.length;
  var el=$("posList");
  if(!state.positions.length){el.innerHTML='<div class="empty">No claimed positions yet. Claim one on the landing page.</div>';return}
  el.innerHTML=state.positions.map(function(p){
    var idx=state.positions.indexOf(p);
    return '<div class="row"><div class="info"><div class="t">'+chainName(p.chainId)+' <span class="hf" id="hf'+idx+'"></span></div>'+
      '<div class="d">'+esc(p.address)+'</div><div class="meta">claimed '+ts(p.registeredAt)+' · <span class="badge b-ok">verified owner</span></div></div>'+
      '<div class="actions"><button class="btn btn-ghost" data-act="live" data-idx="'+idx+'">Refresh health</button>'+
      '<button class="btn btn-primary" data-act="protect" data-idx="'+idx+'">Dry-run protect</button></div></div>';
  }).join("");
  el.querySelectorAll("button").forEach(function(b){
    b.addEventListener("click",function(){
      if(b.dataset.act==="live")liveHealth(+b.dataset.idx);
      if(b.dataset.act==="protect")dryRun(+b.dataset.idx,b);
    });
  });
  state.positions.forEach(function(_,i){liveHealth(i)});
}

function liveHealth(idx){
  var p=state.positions[idx];if(!p)return;
  var el=$("hf"+idx);if(!el)return;
  el.textContent=" …";
  api("/api/status?chainId="+encodeURIComponent(p.chainId)+"&user="+encodeURIComponent(p.address)).then(function(r){
    var hf=r.d.account?Number(r.d.account.healthFactor):null;
    el.innerHTML="<span class='hf "+hfClass(hf)+"'>HF "+String(hf==null?"–":hf.toFixed(4))+"</span> "+statusBadge(r.d.decision?r.d.decision.level:"?");
  }).catch(function(e){el.textContent="err"}).then(function(){
    // ensure any previous spin removed
  });
}

function dryRun(idx,btn){
  var p=state.positions[idx];if(!p)return;
  btn.disabled=true;var orig=btn.textContent;btn.textContent="Running…";
  var row=btn.closest(".row");
  var prev=row.querySelector(".runout");if(prev)prev.remove();
  var out=document.createElement("div");out.className="runout";out.style.cssText="flex-basis:100%;font-size:12.5px;color:var(--mut);font-family:var(--mono)";
  row.appendChild(out);out.textContent="simulating…";
  api("/api/portal/protect/dryrun",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chainId:p.chainId,user:p.address})}).then(function(r){
    var d=r.d;if(!d.ok){out.textContent="✗ "+d.error;return}
    var rep=d.report;
    var lvl=rep.decision.level;
    out.innerHTML="<span class='badge "+ (lvl==="healthy"?"b-ok":lvl==="watch"?"b-warn":"b-bad") +"'>"+esc(lvl.toUpperCase())+"</span> "+esc(rep.decision.reason)+"<br>"+esc((rep.steps||[]).map(function(s){return s.name+": "+s.ok} ).join(" → "));
    var ex=rep.execution;if(ex&&ex.transactionLink){out.innerHTML+="<br>tx: <a href=\""+esc(ex.transactionLink)+"\" target=\"_blank\">"+esc(ex.transactionLink)+"</a>"}
    out.innerHTML+="<br>ran "+ts(rep.startedAt)+" (dry run, nothing broadcast)";
  }).catch(function(e){out.textContent="✗ "+e.message}).then(function(){btn.disabled=false;btn.textContent=orig});
}

function renderCredentials(){
  var el=$("credList");
  if(!state.credentials.length){el.innerHTML='<div class="empty">No credentials saved.</div>';return}
  el.innerHTML=state.credentials.map(function(c){
    var typeLabel=c.type==="keeperhub-api-key"?"KeeperHub API key":"Rescue wallet key";
    var badge=c.type==="keeperhub-api-key"?"b-acc":"b-warn";
    return '<div class="row"><div class="info"><div class="t">'+esc(c.name)+' <span class="badge '+badge+'">'+typeLabel+'</span></div>'+
      '<div class="d">'+esc(c.masked)+'</div><div class="meta">AES-256-GCM encrypted · saved '+ts(c.createdAt)+'</div></div>'+
      '<div class="actions"><button class="btn btn-danger" data-del="'+c.id+'">Delete</button></div></div>';
  }).join("");
  el.querySelectorAll("[data-del]").forEach(function(b){b.addEventListener("click",function(){
    api("/api/portal/credentials/"+b.dataset.del,{method:"DELETE"}).then(function(r){state.credentials=state.credentials.filter(function(c){return c.id!==b.dataset.del});renderCredentials()});
  })});
}
$("credForm").addEventListener("submit",function(e){
  e.preventDefault();
  var name=$("credName").value.trim(),type=$("credType").value,value=$("credValue").value.trim();
  var msg=$("credMsg");
  if(type==="rescue-wallet-key"&&!/^0x[0-9a-fA-F]{64}$/.test(value)){msg.className="msg err";msg.textContent="Wallet key must be a 32-byte private key (0x + 64 hex chars).";return}
  var btn=e.target.querySelector("button[type=submit]");btn.disabled=true;
  api("/api/portal/credentials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:name,type:type,value:value})}).then(function(r){
    msg.className="msg "+(r.d.ok?"ok":"err");msg.textContent=r.d.ok?"Saved and encrypted.":(r.d.error||"Failed");
    if(r.d.ok){state.credentials=r.d.credentials;renderCredentials();e.target.reset()}
  }).finally(function(){btn.disabled=false});
});

function renderAgents(){
  $("mcpUrl").textContent=state.agent.serverUrl;
  $("mcpToken").textContent=state.agent.token?"Bearer "+state.agent.token:"(OAuth — token issued per client)";
  var body=document.querySelector("#toolsTbl tbody");
  body.innerHTML=(state.agent.tools||TOOLS).map(function(t){return "<tr><td><code>"+esc(t[0]||t.name)+"</code></td><td>"+esc(t[1]||t.desc||"")+"</td></tr>"}).join("");
  $("mcpUrl").addEventListener("click",function(){navigator.clipboard.writeText(state.agent.serverUrl)});
}
function renderActivity(){
  var rows=(state.activity||[]).slice(0,12);
  var tbody=document.querySelector("#actTbl tbody");
  if(!rows.length){tbody.innerHTML='<tr><td colspan="5" style="color:var(--mut)">No calls recorded yet — talk to the agent.</td></tr>';return}
  tbody.innerHTML=rows.map(function(a){
    return "<tr><td>"+ts(a.at)+"</td><td><code>"+esc(a.tool)+"</code></td><td class=\"mono\">"+esc(a.args)+"</td><td>"+statusBadge(a.ok?"ok":"fail")+"</td><td>"+a.ms+"</td></tr>";
  }).join("");
  var ov=$("ovActivity");
  if(!rows.length){ov.innerHTML='<div class="empty">No agent activity yet.</div>';return}
  ov.innerHTML=rows.slice(0,6).map(function(a){
    return '<div class="row"><div class="info"><div class="t"><code>'+esc(a.tool)+'</code></div><div class="d">'+esc(a.args)+'</div></div>'+
      '<div class="actions">'+statusBadge(a.ok?"ok":"fail")+'<span style="color:var(--mut);font-size:12px">'+ts(a.at)+' · '+a.ms+'ms</span></div></div>';
  }).join("");
}

function renderPlugins(){
  var el=$("pluginList");
  var merged=CHAINS.map(function(c){
    var p=state.plugins.find(function(x){return String(x.chainId)===String(c[0])});
    return {chainId:c[0],name:c[1],protocol:"aave-v3",enabled:p?p.enabled:false,criticalHf:p?p.criticalHf:1.05,targetHf:p?p.targetHf:1.5,id:p?p.id:""};
  });
  el.innerHTML=merged.map(function(p){
    return '<div class="row"><div class="info"><div class="t">'+esc(p.name)+' <span class="badge b-acc">Aave V3</span> <span class="badge '+(p.enabled?"b-ok":"b-mut")+'">'+(p.enabled?"WATCHING":"OFF")+'</span></div>'+
      '<div class="meta" style="color:var(--mut);font-size:12.5px">chain id '+esc(p.chainId)+'</div></div>'+
      '<div class="actions" style="gap:8px;align-items:center">'+
      '<label style="margin:0">crit <input type="number" step="0.01" min="0.5" max="2" value="'+p.criticalHf+'" style="width:80px" data-f="crit" data-c="'+p.chainId+'"></label>'+
      '<label style="margin:0">target <input type="number" step="0.01" min="1" max="3" value="'+p.targetHf+'" style="width:80px" data-f="target" data-c="'+p.chainId+'"></label>'+
      '<button class="btn btn-ghost" data-save="'+p.chainId+'">Save</button>'+
      '<button class="btn '+(p.enabled?"btn-danger":"btn-primary")+'" data-toggle="'+p.chainId+'" data-en="'+(p.enabled?"1":"0")+'">'+(p.enabled?"Disable":"Enable")+'</button></div></div>';
  }).join("");
  el.querySelectorAll("[data-toggle]").forEach(function(b){b.addEventListener("click",function(){
    savePlugin(b.dataset.toggle,b.dataset.en==="1"?false:true,null,null,function(){renderPlugins()});
  })});
  el.querySelectorAll("[data-save]").forEach(function(b){b.addEventListener("click",function(){
    var crit=el.querySelector("[data-c=\""+b.dataset.save+"\"][data-f=crit]").value;
    var tgt=el.querySelector("[data-c=\""+b.dataset.save+"\"][data-f=target]").value;
    savePlugin(b.dataset.save,null,Number(crit),Number(tgt),function(){renderPlugins()});
  })});
}
function savePlugin(chainId,enabled,crit,tgt,cb){
  var existing=state.plugins.find(function(p){return String(p.chainId)===String(chainId)});
  var body={chainId:chainId,protocol:"aave-v3",enabled:enabled===null?existing?existing.enabled:false:enabled,criticalHf:crit===null?existing?existing.criticalHf:1.05:crit,targetHf:tgt===null?existing?existing.targetHf:1.5:tgt};
  api("/api/portal/plugins",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){
    var m=$("pluginMsg");
    if(r.d.ok){m.className="msg ok";m.textContent="Saved "+chainName(chainId)+".";state.plugins=r.d.plugins;cb&&cb()}
    else{m.className="msg err";m.textContent=r.d.error||"Failed"}
  });
}

function loadApprovals(){
  api("/api/portal/approvals").then(function(r){
    if(r.status!==200)return;
    state.approvals=r.d.approvals;
    var pend=state.approvals.filter(function(a){return a.status==="pending"});
    var hist=state.approvals.filter(function(a){return a.status!=="pending"});
    var ep=$("apvPending"),eh=$("apvHistory");
    ep.innerHTML=pend.length?pend.map(function(a){
      var payload=JSON.parse(a.payload||"{}");var fn=payload.functionName||"?";var args=payload.functionArgs||"";
      return '<div class="row"><div class="info"><div class="t">'+esc(a.summary)+' '+statusBadge(a.status)+'</div>'+
        '<div class="d">'+chainName(a.chainId)+' · '+esc(short(a.user))+' · '+fn+'('+esc(args.slice(0,90))+')</div>'+
        '<div class="meta">requested '+ts(a.createdAt)+' · task '+esc(short(a.taskId))+'</div></div>'+
        '<div class="actions"><button class="btn btn-primary" data-apv="'+a.id+'" data-dec="approved">Approve</button>'+
        '<button class="btn btn-danger" data-apv="'+a.id+'" data-dec="rejected">Reject</button></div></div>';
    }).join(""):'<div class="empty">No pending approvals.</div>';
    eh.innerHTML=hist.length?hist.map(function(a){
      return '<div class="row"><div class="info"><div class="t">'+esc(a.summary)+' '+statusBadge(a.status)+'</div>'+
        '<div class="d">'+chainName(a.chainId)+' · '+esc(short(a.user))+'</div>'+
        '<div class="meta">'+ts(a.createdAt)+' · resolved '+ts(a.resolvedAt)+(a.resolvedBy?" by "+esc(a.resolvedBy):"")+'</div></div></div>';
    }).join(""):'<div class="empty">No history yet.</div>';
    ep.querySelectorAll("[data-apv]").forEach(function(b){b.addEventListener("click",function(){
      b.disabled=true;
      api("/api/portal/approvals/"+b.dataset.apv+"/resolve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({decision:b.dataset.dec})}).then(function(r){loadApprovals()});
    })});
  });
}

$("logoutBtn").addEventListener("click",function(){
  api("/api/portal/logout",{method:"POST"}).then(function(){showAuth()});
});

document.addEventListener("visibilitychange",function(){if(!document.hidden&&tab==="approvals")loadApprovals()});
setInterval(function(){if(tab==="approvals")loadApprovals()},6000);

loadMe();
</script>
</body>
</html>`;
