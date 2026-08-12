export const DEMO_CHAIN = "11155111";
export const DEMO_USER = "0x4856C80305bFb41ADD710eCA576368ec92221113";

export const landingPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Solvency Sentinel — your agent that stops DeFi liquidations</title>
<meta name="description" content="Solvency Sentinel watches your Aave position and acts the moment health factor drops. Simulate first, broadcast once, verify on-chain. OAuth-authorized MCP for ChatGPT.">
<style>
:root{--bg:#05070d;--card:#0b0f1a;--card2:#0e1424;--line:rgba(255,255,255,.08);--txt:#e8edf7;--mut:#8b94a7;--acc:#34d399;--acc2:#a3e635;--red:#f43f5e;--amber:#fbbf24;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
.hero-bg{position:fixed;inset:0;z-index:-1;background:
radial-gradient(60% 50% at 50% -10%,rgba(52,211,153,.12),transparent 60%),
radial-gradient(40% 40% at 85% 10%,rgba(163,230,53,.07),transparent 60%),
var(--bg)}
a{color:var(--acc)}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
nav{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;max-width:1120px;margin:0 auto}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.02em}
.logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--acc2));display:grid;place-items:center;color:#05110a;font-size:16px;font-weight:900}
.nav-links{display:flex;gap:22px;align-items:center;color:var(--mut);font-size:14px}
.nav-links a{color:var(--mut);text-decoration:none}
.nav-links a:hover{color:var(--txt)}
.pill{border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--acc)}
.hero{padding:72px 24px 40px;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;max-width:1120px;margin:0 auto}
@media(max-width:860px){.hero{grid-template-columns:1fr;padding-top:40px}}
.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--mut)}
.eyebrow .dot{width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 0 rgba(52,211,153,.5);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.5)}70%{box-shadow:0 0 0 8px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
h1{font-size:46px;line-height:1.12;letter-spacing:-.02em;margin:20px 0 16px;font-weight:800}
h1 em{font-style:normal;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--mut);font-size:18px;max-width:520px}
.cta-row{display:flex;gap:14px;margin-top:28px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px;transition:.15s}
.btn-primary{background:linear-gradient(135deg,var(--acc),var(--acc2));color:#05110a}
.btn-primary:hover{filter:brightness(1.08);transform:translateY(-1px)}
.btn-ghost{border:1px solid var(--line);color:var(--txt);background:var(--card)}
.btn-ghost:hover{border-color:var(--acc);color:var(--acc)}
.meta-note{margin-top:18px;font-size:13px;color:var(--mut)}
code{font-family:var(--mono);background:rgba(255,255,255,.06);border:1px solid var(--line);padding:2px 7px;border-radius:6px;font-size:.92em}
/* live card */
.live{border:1px solid var(--line);border-radius:18px;background:var(--card);padding:24px;position:relative;overflow:hidden}
.live::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,var(--red),var(--amber),var(--acc))}
.live-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.live-head .lbl{font-size:13px;color:var(--mut);font-weight:600}
.live-badge{display:inline-flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.08em;font-size:12px;border-radius:999px;padding:5px 12px}
.b-critical{background:rgba(244,63,94,.12);color:#fb7185;border:1px solid rgba(244,63,94,.35);animation:blink 1.2s ease-in-out infinite}
@keyframes blink{50%{opacity:.55}}
.b-liquidatable{background:rgba(244,63,94,.2);color:#fda4af;border:1px solid #f43f5e}
.b-watch{background:rgba(251,191,36,.12);color:#fcd34d;border:1px solid rgba(251,191,36,.35)}
.b-healthy{background:rgba(52,211,153,.12);color:#6ee7b7;border:1px solid rgba(52,211,153,.35)}
.hf-label{font-size:12px;color:var(--mut);letter-spacing:.06em;text-transform:uppercase}
.hf-num{font-family:var(--mono);font-size:56px;font-weight:700;line-height:1.1;letter-spacing:-.02em}
.hf-num.danger{color:#fb7185}
.hf-num.warn{color:#fcd34d}
.hf-num.ok{color:#6ee7b7}
.why{margin-top:4px;font-size:13.5px;color:var(--mut)}
.bars{margin-top:18px;display:grid;gap:12px}
.bar .bl{display:flex;justify-content:space-between;font-size:13px;color:var(--mut);margin-bottom:5px}
.bar .bl b{color:var(--txt);font-family:var(--mono);font-weight:600}
.track{height:9px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}
.fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width .6s ease}
.fill.red{background:linear-gradient(90deg,#f43f5e,#fb923c)}
.live-foot{display:flex;justify-content:space-between;margin-top:18px;font-size:12px;color:var(--mut);font-family:var(--mono)}
.live-foot .dot{width:7px;height:7px;border-radius:50%;background:var(--acc);display:inline-block;margin-right:6px;vertical-align:1px;animation:pulse 2s infinite}
.check{border:1px solid var(--line);background:var(--card);border-radius:14px;padding:14px;margin-bottom:14px}
.check-row{display:flex;gap:10px;flex-wrap:wrap}
.check select,.check input{background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font-size:14px;font-family:var(--mono);outline:none}
.check select{max-width:158px}
.check input{flex:1;min-width:210px}
.check select:focus,.check input:focus{border-color:var(--acc)}
.check-hint{margin-top:9px;font-size:12.5px;color:var(--mut)}
/* sections */
section{padding:72px 0}
h2{font-size:32px;letter-spacing:-.02em;font-weight:800;margin-bottom:10px}
.sec-sub{color:var(--mut);font-size:16px;max-width:640px;margin-bottom:36px}
/* terminal */
.term{border:1px solid var(--line);border-radius:16px;background:#070b13;overflow:hidden}
.term-bar{display:flex;gap:7px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--card)}
.term-bar i{width:11px;height:11px;border-radius:50%;display:inline-block}
.term-bar .t{color:var(--mut);font-size:13px;font-family:var(--mono);margin-left:10px}
.term-body{padding:18px;font-family:var(--mono);font-size:13.5px;min-height:260px;max-height:460px;overflow:auto}
.term-body .ln{white-space:pre-wrap;margin-bottom:9px;opacity:0;animation:rise .25s forwards}
@keyframes rise{to{opacity:1}}
.ln .k{color:#7dd3fc}
.ln .ok{color:var(--acc)}
.ln .fail{color:#fb7185}
.ln .dim{color:#5b6478}
.ln .hl{color:var(--acc2);font-weight:700}
.run-row{display:flex;gap:14px;align-items:center;margin-top:16px;flex-wrap:wrap}
.spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:var(--acc);border-radius:50%;animation:spin .7s linear infinite;display:none}
@keyframes spin{to{transform:rotate(360deg)}}
/* steps grid */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.step{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:20px}
.step .n{font-family:var(--mono);font-size:13px;color:var(--acc);font-weight:700}
.step h3{font-size:17px;margin:8px 0 6px}
.step p{color:var(--mut);font-size:14px}
/* setup */
.setup{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:34px}
.setup .step{border-color:rgba(52,211,153,.25)}
.setup .step .n{color:var(--acc2)}
.url-box{display:flex;gap:10px;align-items:center;border:1px dashed rgba(52,211,153,.4);background:rgba(52,211,153,.05);border-radius:12px;padding:14px 16px;margin-bottom:20px;flex-wrap:wrap}
.url-box code{background:transparent;border:0;font-size:15px;color:var(--acc2)}
.prompts{display:grid;gap:12px;margin-top:26px}
.prompt{border:1px solid var(--line);border-radius:12px;background:var(--card2);padding:14px 16px;font-size:14.5px}
.prompt b{color:var(--acc)}
.prompt .r{color:var(--mut);margin-top:5px;font-size:13px}
/* trust */
.tick{color:var(--acc);font-weight:700}
/* badges */
.badges{display:flex;flex-wrap:wrap;gap:10px}
.badge{border:1px solid var(--line);background:var(--card);color:var(--mut);border-radius:999px;padding:8px 16px;font-size:13.5px;font-weight:600}
.badge b{color:var(--txt)}
footer{border-top:1px solid var(--line);padding:30px 0 60px;color:var(--mut);font-size:13.5px}
footer .wrap{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
@media(max-width:640px){h1{font-size:34px}.hf-num{font-size:44px}}
</style>
</head>
<body>
<div class="hero-bg"></div>

<nav>
  <div class="brand"><span class="logo">&#9829;</span> Solvency&nbsp;Sentinel</div>
  <div class="nav-links">
    <a href="#demo">Live demo</a>
    <a href="#connect">Connect</a>
    <a href="#how">How it works</a>
    <a href="#trust">Trust</a>
    <span class="pill">&#9679; live on Sepolia</span>
  </div>
</nav>

<header class="hero">
  <div>
    <span class="eyebrow"><span class="dot"></span> AI keeper &middot; Model Context Protocol &middot; Aave V3</span>
    <h1>Your agent that stops <em>DeFi liquidations</em> — before the liquidator does.</h1>
    <p class="sub">Solvency Sentinel watches your Aave position and acts the moment your health factor drops. No API keys pasted into chat. OAuth-authorized, simulate-first, on-chain verified.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="#connect">Connect to ChatGPT</a>
      <a class="btn btn-ghost" href="#demo">Watch it act &darr;</a>
    </div>
    <p class="meta-note">One MCP server URL. Ask in plain English: <code>check the position</code> &middot; <code>save it</code></p>
  </div>
  <div>
    <div class="check">
      <div class="check-row">
        <select id="chainSel">
          <option value="11155111">Ethereum Sepolia</option>
          <option value="84532">Base Sepolia</option>
          <option value="1">Ethereum</option>
          <option value="8453">Base</option>
          <option value="42161">Arbitrum One</option>
          <option value="137">Polygon</option>
        </select>
        <input id="addrInput" type="text" spellcheck="false" placeholder="0x… any Aave V3 wallet" value="0x4856C80305bFb41ADD710eCA576368ec92221113">
        <button class="btn btn-primary" id="checkBtn" style="padding:10px 16px">Check</button>
      </div>
      <div class="check-hint">Paste any address &middot; the sentinel checks it on-chain, on any Aave V3 network.</div>
    </div>
    <div class="live">
    <div class="live-head">
      <span class="lbl">LIVE POSITION &mdash; <span id="posName">Ethereum Sepolia</span> &middot; Aave V3</span>
      <span class="live-badge b-healthy" id="badge">LOADING</span>
    </div>
    <div class="hf-label">Health factor</div>
    <div class="hf-num" id="hf">&mdash;</div>
    <div class="why" id="why">Reading on-chain position&hellip;</div>
    <div class="bars">
      <div class="bar">
        <div class="bl"><span>Collateral</span><b id="coll">&mdash;</b></div>
        <div class="track"><div class="fill" id="collFill" style="width:0%"></div></div>
      </div>
      <div class="bar">
        <div class="bl"><span>Debt</span><b id="debt">&mdash;</b></div>
        <div class="track"><div class="fill red" id="debtFill" style="width:0%"></div></div>
      </div>
    </div>
    <div class="live-foot"><span><span class="dot"></span>auto-refreshing</span><span id="updated">&mdash;</span><span id="acct">0x4856&hellip;1113</span></div>
    </div>
  </div>
</header>

<section id="demo">
  <div class="wrap">
    <h2>Watch it decide, then act.</h2>
    <p class="sec-sub">This terminal runs the exact <code>sentinel_monitor</code> tool ChatGPT can call &mdash; read position, evaluate risk, simulate the rescue, then (in dry-run) stop before broadcast.</p>
    <div class="term">
      <div class="term-bar"><i style="background:#f43f5e"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i><span class="t">solvency-sentinel &mdash; sentinel_monitor</span></div>
      <div class="term-body" id="term"></div>
    </div>
    <div class="run-row">
      <button class="btn btn-primary" id="runBtn">Run sentinel_monitor &middot; dry run</button>
      <span class="spin" id="spin"></span>
      <span style="color:var(--mut);font-size:13px">Dry-run = simulated only. Nothing is broadcast.</span>
    </div>
  </div>
</section>

<section id="connect">
  <div class="wrap">
    <h2>Give ChatGPT a financial watchdog.</h2>
    <p class="sec-sub">Same flow as any ChatGPT plugin &mdash; one URL, one OAuth approval.</p>
    <div class="setup">
      <div class="step"><div class="n">01</div><h3>Copy the URL</h3><p>This is the MCP server endpoint.</p></div>
      <div class="step"><div class="n">02</div><h3>Enable Developer mode</h3><p>ChatGPT (web) &rarr; Settings &rarr; Security & login &rarr; Developer mode.</p></div>
      <div class="step"><div class="n">03</div><h3>Add the plugin</h3><p>Plugins &rarr; Browse &rarr; + New Plugin &rarr; name it &ldquo;Solvency&rdquo; &rarr; Server URL. Auth: <b>OAuth</b>.</p></div>
      <div class="step"><div class="n">04</div><h3>Authorize</h3><p>Approve the consent page. Done &mdash; the tools appear.</p></div>
    </div>
    <div class="url-box"><span style="font-size:13px;color:var(--mut)">Server URL</span><code>https://solvency-sentinel.onrender.com/mcp</code><button class="btn btn-ghost" id="copyBtn" style="padding:6px 12px;font-size:13px">Copy</button></div>
    <div class="prompts">
      <div class="prompt"><b>&ldquo;Check my Aave position on Ethereum Sepolia — <span style="font-family:var(--mono);font-size:.9em">0x4856&hellip;1113</span>.&rdquo;</b><div class="r">Agent calls <code>sentinel_check</code> on any Aave V3 network &rarr; reports health factor, debt, risk level. Read-only.</div></div>
      <div class="prompt"><b>&ldquo;It&rsquo;s critical &mdash; preview the rescue.&rdquo;</b><div class="r">Agent runs <code>sentinel_monitor</code> with <code>dryRun: true</code> &rarr; full loop simulated, audit report written.</div></div>
      <div class="prompt"><b>&ldquo;Save it.&rdquo;</b><div class="r">Agent runs the real protect loop &rarr; simulate &rarr; broadcast &rarr; poll &rarr; verify on-chain receipt.</div></div>
    </div>
  </div>
</section>

<section id="how" style="padding-top:0">
  <div class="wrap">
    <h2>The sentinel loop.</h2>
    <p class="sec-sub">Every run is read &rarr; decide &rarr; simulate &rarr; broadcast once &rarr; prove it.</p>
    <div class="grid">
      <div class="step"><div class="n">01 READ</div><h3>Read the position</h3><p>Pulls live health factor, collateral and debt from Aave V3 on-chain.</p></div>
      <div class="step"><div class="n">02 EVALUATE</div><h3>Grade the risk</h3><p>Health factor &rarr; liquidatable / critical / watch / healthy, against your thresholds.</p></div>
      <div class="step"><div class="n">03 SIMULATE</div><h3>Preflight the rescue</h3><p>Simulates the repayment locally. Never broadcasts blind.</p></div>
      <div class="step"><div class="n">04 BROADCAST</div><h3>Broadcast once</h3><p>One idempotent, run-scoped transaction via KeeperHub. Replay-proof.</p></div>
      <div class="step"><div class="n">05 VERIFY</div><h3>Verify on-chain</h3><p>Polls for the receipt and confirms the position is out of danger.</p></div>
      <div class="step"><div class="n">06 REPORT</div><h3>Audit trail</h3><p>Every decision, step and receipt written to a timestamped report.</p></div>
    </div>
  </div>
</section>

<section id="trust" style="padding-top:0">
  <div class="wrap">
    <h2>Built to be trustworthy, not just fast.</h2>
    <div class="grid">
      <div class="step"><h3><span class="tick">&#10003;</span> OAuth 2.1 + PKCE</h3><p>You approve each client. No API keys floating through chat, no long-lived secrets on the agent.</p></div>
      <div class="step"><h3><span class="tick">&#10003;</span> Dry-run by default</h3><p><code>sentinel_check</code> is read-only; <code>sentinel_monitor</code> simulates before it can touch the chain.</p></div>
      <div class="step"><h3><span class="tick">&#10003;</span> Idempotent &amp; verified</h3><p>Run-scoped broadcast keys + on-chain receipt verification &mdash; no double execution, no guesswork.</p></div>
      <div class="step"><h3><span class="tick">&#10003;</span> Verifiable trail</h3><p>Each run writes a full audit report: inputs, decision, steps, execution and receipts.</p></div>
    </div>
  </div>
</section>

<section id="stack" style="padding-top:0">
  <div class="wrap">
    <h2>Open standards, boring rails.</h2>
    <p class="sec-sub">No proprietary plumbing &mdash; the pieces your security team already trusts.</p>
    <div class="badges">
      <span class="badge"><b>Aave V3</b> lending</span>
      <span class="badge"><b>KeeperHub</b> execution</span>
      <span class="badge"><b>MCP</b> agent protocol</span>
      <span class="badge"><b>OAuth 2.1</b> + PKCE</span>
      <span class="badge"><b>ChatGPT</b> plugin</span>
      <span class="badge"><b>RFC 8707</b> resource-scoped</span>
      <span class="badge"><b>TypeScript</b> / viem</span>
      <span class="badge"><b>Sepolia</b> testnet</span>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>Solvency Sentinel &mdash; agentic DeFi risk protection. Demo position on Sepolia Aave V3.</span>
    <span>No funds at risk &middot; dry-runs never broadcast</span>
  </div>
</footer>

<script>
(function () {
  var termEl = document.getElementById("term");
  var badgeEl = document.getElementById("badge");
  var hfEl = document.getElementById("hf");
  var whyEl = document.getElementById("why");
  var collEl = document.getElementById("coll");
  var debtEl = document.getElementById("debt");
  var collFill = document.getElementById("collFill");
  var debtFill = document.getElementById("debtFill");
  var updatedEl = document.getElementById("updated");
  var acctEl = document.getElementById("acct");
  var posNameEl = document.getElementById("posName");
  var chainSel = document.getElementById("chainSel");
  var addrInput = document.getElementById("addrInput");
  var checkBtn = document.getElementById("checkBtn");
  var runBtn = document.getElementById("runBtn");
  var spin = document.getElementById("spin");

  var chainNames = { "1": "Ethereum", "137": "Polygon", "8453": "Base", "42161": "Arbitrum One", "84532": "Base Sepolia", "11155111": "Ethereum Sepolia" };
  var state = { chainId: "11155111", user: "0x4856C80305bFb41ADD710eCA576368ec92221113" };

  function money(v) { return "$" + Number(v).toFixed(2); }

  function shortAddr(a) { return String(a).slice(0, 6) + "…" + String(a).slice(-4); }

  function status() {
    posNameEl.textContent = chainNames[state.chainId] || state.chainId;
    acctEl.textContent = shortAddr(state.user);
    fetch("/api/status?chainId=" + encodeURIComponent(state.chainId) + "&user=" + encodeURIComponent(state.user)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) { badgeEl.textContent = "ERROR"; badgeEl.className = "live-badge b-watch"; whyEl.textContent = d.error || "could not read position"; return; }
      var acct = d.account;
      var dec = d.decision;
      var hf = Number(acct.healthFactor);
      var coll = Number(acct.totalCollateralUsd.replace("$", ""));
      var debt = Number(acct.totalDebtUsd.replace("$", ""));
      var lev = String(dec.level).toUpperCase();
      badgeEl.textContent = lev;
      badgeEl.className = "live-badge b-" + String(dec.level);
      hfEl.textContent = acct.healthFactor;
      hfEl.className = "hf-num " + (lev === "LIQUIDATABLE" || lev === "CRITICAL" ? "danger" : lev === "WATCH" ? "warn" : "ok");
      whyEl.textContent = dec.reason;
      collEl.textContent = acct.totalCollateralUsd;
      debtEl.textContent = acct.totalDebtUsd;
      collFill.style.width = Math.min(100, (coll / (coll + debt || 1)) * 100) + "%";
      debtFill.style.width = Math.min(100, (debt / (coll + debt || 1)) * 100) + "%";
      updatedEl.textContent = new Date(d.timestamp).toLocaleTimeString();
      acctEl.textContent = shortAddr(d.user);
    }).catch(function () { badgeEl.textContent = "OFFLINE"; });
  }

  checkBtn.addEventListener("click", function () {
    var u = addrInput.value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(u)) { whyEl.textContent = "That doesn't look like an address — try 0x + 40 hex characters."; badgeEl.textContent = "INVALID"; return; }
    state.user = u;
    state.chainId = chainSel.value;
    badgeEl.textContent = "CHECKING";
    badgeEl.className = "live-badge b-watch";
    status();
  });

  status();
  setInterval(status, 12000);

  function line(html) {
    var div = document.createElement("div");
    div.className = "ln";
    div.innerHTML = html;
    termEl.appendChild(div);
    termEl.scrollTop = termEl.scrollHeight;
    return div;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  runBtn.addEventListener("click", function () {
    runBtn.disabled = true;
    spin.style.display = "inline-block";
    termEl.innerHTML = "";
    var t0 = Date.now();
    line('<span class="dim">$ sentinel_monitor --chain ' + esc(state.chainId) + ' --user ' + shortAddr(state.user) + ' --dry-run</span>');
    fetch("/api/dryrun", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(state) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        spin.style.display = "none";
        runBtn.disabled = false;
        if (!d.ok || !d.report) { line('<span class="fail">[error] ' + esc(d.error || "unknown") + '</span>'); return; }
        var rep = d.report;
        line('<span class="k">' + esc(rep.taskId) + '</span> <span class="dim">' + esc(rep.chainId + " · " + rep.user.slice(0, 6) + "…" + rep.user.slice(-4)) + '</span>');
        line('<span class="dim">' + esc("started " + rep.startedAt) + '</span>');
        line('<span class="k">[account]</span> hf <span class="hl">' + esc(rep.account.healthFactor) + '</span> · collateral ' + esc(rep.account.totalCollateralUsd) + ' · debt ' + esc(rep.account.totalDebtUsd));
        line('<span class="k">[decision]</span> level <span class="hl">' + esc(String(rep.decision.level).toUpperCase()) + '</span> · shouldAct ' + String(rep.decision.shouldAct) + ' — ' + esc(rep.decision.reason));
        rep.steps.forEach(function (s, i) {
          setTimeout(function () {
            var mark = s.ok ? '<span class="ok">OK</span>' : '<span class="fail">FAIL</span>';
            line('<span class="k">[' + esc(s.name) + ']</span> ' + mark + ' <span class="dim">' + esc(s.detail) + '</span>');
          }, 260 * (i + 1));
        });
        setTimeout(function () {
          var secs = ((Date.now() - t0) / 1000).toFixed(2);
          if (rep.execution) {
            line('<span class="k">[execution]</span> ' + esc(rep.execution.executionId) + ' · ' + esc(rep.execution.status) + (rep.execution.transactionHash ? ' · <span class="ok">' + esc(rep.execution.transactionHash.slice(0, 18)) + '…</span>' : ''));
          }
          line('<span class="k">[dry-run]</span> <span class="ok">simulated only — nothing broadcast</span> <span class="dim">(' + secs + 's)</span>');
        }, 260 * (rep.steps.length + 1));
      })
      .catch(function (e) {
        spin.style.display = "none";
        runBtn.disabled = false;
        line('<span class="fail">[error] ' + esc(e.message) + '</span>');
      });
  });

  document.getElementById("copyBtn").addEventListener("click", function () {
    navigator.clipboard.writeText("https://solvency-sentinel.onrender.com/mcp").then(function () {
      var b = document.getElementById("copyBtn");
      b.textContent = "Copied!";
      setTimeout(function () { b.textContent = "Copy"; }, 1500);
    });
  });
})();
</script>
</body>
</html>`;
