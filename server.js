const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "incidents.json");
const MAX_BODY = 1024 * 1024;
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]\n", { mode: 0o600 });

function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function writeDB(data) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
function send(res, status, payload, headers={}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    ...headers
  });
  res.end(JSON.stringify(payload));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "", size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Request too large"), { status: 413 })); req.destroy(); return; }
      body += chunk.toString("utf8");
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(Object.assign(new Error("Invalid JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
function cleanString(value, max=5000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}
function screenMessage(message, incidentType) {
  const text = message.toLowerCase();
  const rules = [
    {name:"Direct threats or coercion", weight:3, words:["i will hurt you","i will kill you","kill you","hurt you","you will regret","threaten","threatening","blackmail"]},
    {name:"Intimate-image pressure or sextortion concern", weight:4, words:["send nude","send nudes","leak your photos","leak your pictures","share your photos","intimate photos","pay me or","sextortion"]},
    {name:"Repeated unwanted contact or stalking", weight:2, words:["i know where you live","watching you","following you","won't leave you alone","wont leave you alone","keep messaging","contact you everywhere"]},
    {name:"Impersonation or account misuse", weight:2, words:["fake account","pretending to be you","impersonate","stole your account","hacked your account"]},
    {name:"Scam or credential pressure", weight:2, words:["send otp","share your otp","verify your password","click this link","urgent payment","send money now","bank account blocked","claim your prize"]}
  ];
  let score=0, signals=[];
  for (const rule of rules) {
    const matched=rule.words.filter(w=>text.includes(w));
    if(matched.length){score+=rule.weight;signals.push({category:rule.name,matched});}
  }
  const boosts={
    "Threats or intimidation":3,
    "Money demand / sextortion concern":3,
    "Repeated unwanted contact":2,
    "Impersonation / fake profile":2,
    "Suspicious link or scam":2
  };
  score += boosts[incidentType] || 0;
  const severity=score>=5?"high":score>=2?"medium":"low";
  const guidance={
    high:["If safe, do not engage or pay under pressure.","Preserve the original messages, account details, URLs, dates and times.","Consider platform reporting and official cybercrime reporting options.","Tell a trusted person; seek urgent help if you face immediate danger."],
    medium:["Preserve the full conversation and account details.","Do not open suspicious links or share OTPs or passwords.","Review account security and consider platform reporting."],
    low:["Few configured phrases matched; this does not establish that the message is safe.","Trust your judgement and preserve evidence if the contact feels concerning.","Never share OTPs, passwords, or money under pressure."]
  };
  return {severity, score, signals, guidance:guidance[severity], disclaimer:"Preliminary rule-based screening only. It may miss context or flag harmless text; it is not a definitive threat assessment or legal advice."};
}
function safeIncident(input) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    incidentDate: cleanString(input.incidentDate, 60),
    platform: cleanString(input.platform, 120),
    account: cleanString(input.account, 300),
    incidentType: cleanString(input.incidentType, 100),
    description: cleanString(input.description, 8000),
    requestedHelp: cleanString(input.requestedHelp, 1000),
    status: "Saved locally",
    updatedAt: now
  };
}
const MIME = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method==="GET" && url.pathname==="/api/health") return send(res,200,{ok:true,service:"SheShield API",storage:"local JSON file",privacy:"No third-party analytics configured"});
  if (req.method==="POST" && url.pathname==="/api/screen") {
    try {
      const body=await readBody(req);
      const message=cleanString(body.message,8000);
      const incidentType=cleanString(body.incidentType,100);
      if(!message && !incidentType) return send(res,400,{error:"Enter a message or choose an incident type."});
      return send(res,200,{result:screenMessage(message,incidentType)});
    } catch(e){return send(res,e.status||400,{error:e.message||"Could not process request."});}
  }
  if (req.method==="GET" && url.pathname==="/api/incidents") {
    const data=readDB().map(({id,createdAt,incidentDate,platform,account,incidentType,description,requestedHelp,status,updatedAt})=>({id,createdAt,incidentDate,platform,account,incidentType,description,requestedHelp,status,updatedAt}));
    return send(res,200,{incidents:data.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
  }
  if (req.method==="POST" && url.pathname==="/api/incidents") {
    try {
      const body=await readBody(req);
      if(!cleanString(body.description,8000) && !cleanString(body.platform,120)) return send(res,400,{error:"Add a description or platform before saving."});
      const incident=safeIncident(body);
      const data=readDB(); data.push(incident); writeDB(data);
      return send(res,201,{incident});
    } catch(e){return send(res,e.status||400,{error:e.message||"Could not save incident."});}
  }
  const deleteMatch=url.pathname.match(/^\/api\/incidents\/([0-9a-f-]{36})$/i);
  if(req.method==="DELETE" && deleteMatch){
    const data=readDB(), next=data.filter(i=>i.id!==deleteMatch[1]);
    if(next.length===data.length) return send(res,404,{error:"Incident not found."});
    writeDB(next); return send(res,200,{ok:true});
  }
  if(req.method==="GET"){
    let pathname=decodeURIComponent(url.pathname);
    if(pathname==="/") pathname="/index.html";
    const resolved=path.resolve(ROOT,"."+pathname);
    if(!resolved.startsWith(ROOT+path.sep)) return send(res,403,{error:"Forbidden"});
    fs.readFile(resolved,(err,buffer)=>{
      if(err) return send(res,404,{error:"Not found"});
      res.writeHead(200,{"Content-Type":MIME[path.extname(resolved)]||"application/octet-stream","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'","Cache-Control":"no-store"});
      res.end(buffer);
    }); return;
  }
  return send(res,405,{error:"Method not allowed"});
});
server.listen(PORT,"0.0.0.0",()=>console.log(`SheShield running on http://localhost:${PORT}`));
