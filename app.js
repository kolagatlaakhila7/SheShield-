const $ = id => document.getElementById(id);
let currentHash = "";
let incidentsCache = [];
let toastTimer;
function toast(message) {
  const el=$("toast"); el.textContent=message; el.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.add("hidden"),3000);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function reveal(el, html) { el.innerHTML=html; el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
async function api(path, options={}) {
  const response=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const body=await response.json().catch(()=>({error:"Unexpected server response"}));
  if(!response.ok) throw new Error(body.error||"Request failed");
  return body;
}
function currentFormData() {
  return {
    incidentDate:$("date").value,
    platform:$("platform").value.trim(),
    account:$("account").value.trim(),
    incidentType:$("incidentType").value,
    description:$("description").value.trim(),
    requestedHelp:$("requestedHelp").value.trim()
  };
}
function severityClass(s) { return s==="high"?"high":s==="medium"?"medium":"low"; }
$("message").addEventListener("input",()=>{$("charCount").textContent=`${$("message").value.length} / 8000`;});
$("screenBtn").addEventListener("click",async()=>{
  const message=$("message").value.trim(), incidentType=$("incidentType").value;
  $("screenBtn").disabled=true; $("screenBtn").textContent="Reviewing…";
  try {
    const {result:r}=await api("/api/screen",{method:"POST",body:JSON.stringify({message,incidentType})});
    reveal($("screenResult"),`<span class="risk ${severityClass(r.severity)}">${r.severity.toUpperCase()} · PRELIMINARY</span><h3>${r.severity==="high"?"Several warning signals found":r.severity==="medium"?"Some warning signals found":"Few configured warning signals found"}</h3><p>${esc(r.disclaimer)}</p>${r.signals.length?`<b>Signals found</b><ul>${r.signals.map(s=>`<li><b>${esc(s.category)}</b>: ${s.matched.map(esc).join(", ")}</li>`).join("")}</ul>`:"<p>No configured warning phrases matched.</p>"}<b>Suggested next steps</b><ul>${r.guidance.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`);
  } catch(e) { reveal($("screenResult"),`<b>Could not check this message</b><p>${esc(e.message)}</p>`); }
  finally { $("screenBtn").disabled=false; $("screenBtn").innerHTML='Review message <span>→</span>'; }
});
$("clearBtn").addEventListener("click",()=>{$("message").value="";$("incidentType").value="";$("charCount").textContent="0 / 8000";hide($("screenResult"));});
$("incidentForm").addEventListener("submit",async e=>{
  e.preventDefault();const data=currentFormData();
  if(!data.description&&!data.platform){reveal($("incidentNotice"),"Add a description or platform before saving.");return;}
  try {
    const {incident}=await api("/api/incidents",{method:"POST",body:JSON.stringify(data)});
    reveal($("incidentNotice"),"Incident record saved on this server. Download a copy and keep your original evidence safe.");
    toast("Incident record saved"); await loadIncidents();
  } catch(err) { reveal($("incidentNotice"),esc(err.message)); }
});
function reportText(i) {
 return `SHESHIELD — INCIDENT RECORD\nRecord ID: ${i.id||"unsaved"}\nGenerated: ${new Date().toLocaleString()}\nIncident date/time: ${i.incidentDate||"Not provided"}\nPlatform: ${i.platform||"Not provided"}\nAccount/profile: ${i.account||"Not provided"}\nIncident type: ${i.incidentType||"Not provided"}\n\nDescription:\n${i.description||"Not provided"}\n\nRequested help:\n${i.requestedHelp||"Not provided"}\n\nEvidence checklist:\n[ ] Original messages/screenshots saved\n[ ] Account name/profile URL recorded\n[ ] Dates and times recorded\n[ ] Relevant URLs/files preserved\n[ ] SHA-256 hash recorded if useful\n\nNOTE: User-prepared record only. It is not an official complaint or proof of authenticity. Keep originals unchanged.\n`;
}
function download(name,content,type="text/plain;charset=utf-8") {
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function complaintText(i) {
 return `To the appropriate cybercrime reporting authority,\n\nSubject: Request for assistance regarding online harassment or suspicious online activity\n\nI would like to report an online incident that occurred on ${i.incidentDate||"[date and approximate time]"}. The platform involved was ${i.platform||"[platform/app]"}. The relevant account name or profile link is ${i.account||"[account/profile link, if known]"}.\n\nIncident type: ${i.incidentType||"[type, if known]"}\n\nIncident description:\n${i.description||"[Describe events chronologically and factually, including exact wording where relevant.]"}\n\nI have preserved or will provide available supporting material, such as screenshots, message links, account details, and timestamps. I request guidance on appropriate next steps and review of this incident.\n${i.requestedHelp?"Requested assistance: "+i.requestedHelp:""}\n\nI can provide further details if required.\n\nRegards,\n[Add your name and safe contact details only when submitting through an official channel]\n\nIMPORTANT: Review and correct every detail before use. This is a draft, not a submitted complaint or legal advice. Do not include information you cannot verify.`;
}
$("draftBtn").addEventListener("click",()=>{
  const i=currentFormData();
  if(!i.description&&!i.platform){reveal($("incidentNotice"),"Add some incident details before preparing a draft.");return;}
  $("complaintText").value=complaintText(i);$("complaintDialog").showModal();
});
$("downloadComplaint").addEventListener("click",()=>download("SheShield-Complaint-Draft.txt",$("complaintText").value));
$("copyComplaint").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("complaintText").value);toast("Complaint draft copied");}catch{ $("complaintText").select();document.execCommand("copy");toast("Draft selected for copying");}});
async function loadIncidents() {
  const list=$("incidentList");
  try {
    const {incidents}=await api("/api/incidents");incidentsCache=incidents;
    if(!incidents.length){list.innerHTML='<div class="empty">No incident records yet. Save one above to see it here.</div>';return;}
    list.innerHTML=incidents.map(i=>`<article class="incident-card"><div class="incident-meta">${esc(new Date(i.createdAt).toLocaleString())} · ${esc(i.platform||"Platform not specified")}</div><b>${esc(i.incidentType||"Incident record")}</b><p>${esc(i.description||"No description")}</p><div class="incident-actions"><button class="mini-button" data-action="download" data-id="${esc(i.id)}">Download</button><button class="mini-button" data-action="draft" data-id="${esc(i.id)}">Complaint draft</button><button class="mini-button delete" data-action="delete" data-id="${esc(i.id)}">Delete</button></div></article>`).join("");
  } catch(e) {list.innerHTML=`<div class="empty">API unavailable: ${esc(e.message)}. Run the server using npm start.</div>`;}
}
$("incidentList").addEventListener("click",async e=>{
 const btn=e.target.closest("button[data-action]");if(!btn)return;
 const i=incidentsCache.find(x=>x.id===btn.dataset.id);if(!i)return;
 if(btn.dataset.action==="download")download("SheShield-Incident-Report.txt",reportText(i));
 if(btn.dataset.action==="draft"){$("complaintText").value=complaintText(i);$("complaintDialog").showModal();}
 if(btn.dataset.action==="delete"){
   if(!confirm("Delete this saved incident record? This cannot be undone."))return;
   try{await api(`/api/incidents/${encodeURIComponent(i.id)}`,{method:"DELETE"});toast("Incident record deleted");await loadIncidents();}
   catch(err){toast(err.message);}
 }
});
$("refreshIncidents").addEventListener("click",loadIncidents);
$("hashBtn").addEventListener("click",async()=>{
 const file=$("evidenceFile").files[0];if(!file){reveal($("hashResult"),"Choose a file first.");return;}
 if(!crypto.subtle){reveal($("hashResult"),"SHA-256 is unavailable in this browser context. Try localhost or a secure browser context.");return;}
 try{
  const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
  currentHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
  reveal($("hashResult"),`<b>${esc(file.name)}</b><p>${file.size.toLocaleString()} bytes · Calculated in your browser</p><div class="hash-value">${currentHash}</div><button class="mini-button" id="useHashBtn" type="button">Use this hash for comparison</button>`);
  $("useHashBtn").addEventListener("click",()=>{$("savedHash").value=currentHash;toast("Hash copied to comparison field");});
 }catch(e){reveal($("hashResult"),"Could not calculate the file hash in this browser.");}
});
$("compareHashBtn").addEventListener("click",()=>{
 const saved=$("savedHash").value.trim().toLowerCase();
 if(!currentHash){reveal($("compareResult"),"Calculate the selected file's current hash first.");return;}
 if(!/^[a-f0-9]{64}$/.test(saved)){reveal($("compareResult"),"Enter a valid 64-character SHA-256 hash.");return;}
 const same=saved===currentHash;
 reveal($("compareResult"),`<b>${same?"✓ Hashes match":"! Hashes do not match"}</b><br>${same?"The file contents match the recorded hash.":"The file contents differ from the recorded hash, or the recorded hash belongs to another file."}<br><small>This does not prove authenticity or authorship.</small>`);
});
$("copyHashBtn").addEventListener("click",async()=>{
 if(!currentHash){toast("Calculate a file hash first");return;}
 try{await navigator.clipboard.writeText(currentHash);toast("SHA-256 copied");}catch{$("savedHash").value=currentHash;toast("Hash placed in comparison field");}
});
$("clearLocal").addEventListener("click",async()=>{
 if(!confirm("Delete every incident record saved by this prototype? Download any records you need first."))return;
 try{const {incidents}=await api("/api/incidents");for(const i of incidents)await api(`/api/incidents/${encodeURIComponent(i.id)}`,{method:"DELETE"});await loadIncidents();toast("All saved records deleted");}
 catch(e){toast("Could not delete all records: "+e.message);}
});
$("dismissBanner").addEventListener("click",()=> $("dismissBanner").closest(".safety-banner").remove());
$("langToggle").addEventListener("click",()=>toast("Telugu interface is a planned next iteration; reporting text is currently English."));
async function init(){
 $("date").value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
 try{const h=await api("/api/health");$("apiStatus").textContent=h.ok?"API connected":"API status unknown";}catch{$("apiStatus").textContent="API unavailable";}
 await loadIncidents();
}
init();
