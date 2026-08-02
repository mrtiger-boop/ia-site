const SUPABASE_URL = "https://azgahpygwlrrmozbjrqo.supabase.co";
const SUPABASE_KEY = "sb_publishable_fVRUhodws3p_7UVjnODJwg_7UpsyJwQ";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = { user:null, profile:null, plan:"free", credits:0, history:[], generatedFiles:null, templates:[] };
const HISTORY_KEY="siteo_v12_history";
const COMMUNITY_KEY="siteo_v12_community";
const LEAF_KEY="siteo_v12_leaves";
const $=id=>document.getElementById(id);

const els={
  openLoginBtn:$("openLoginBtn"),openSignupBtn:$("openSignupBtn"),logoutBtn:$("logoutBtn"),signupBtn:$("signupBtn"),loginBtn:$("loginBtn"),openResetBtn:$("openResetBtn"),resetPasswordBtn:$("resetPasswordBtn"),switchToLoginBtn:$("switchToLoginBtn"),switchToSignupBtn:$("switchToSignupBtn"),toast:$("toast"),mobileMenuBtn:$("mobileMenuBtn"),navLinks:$("navLinks"),
  creditCount:$("creditCount"),planStatus:$("planStatus"),accountStatus:$("accountStatus"),dashUsername:$("dashUsername"),dashEmail:$("dashEmail"),dashVerified:$("dashVerified"),dashCredits:$("dashCredits"),dashPlan:$("dashPlan"),dashProjects:$("dashProjects"),
  templateForm:$("templateForm"),resultText:$("resultText"),sitePreview:$("sitePreview"),downloadBtn:$("downloadBtn"),copyBtn:$("copyBtn"),saveProjectBtn:$("saveProjectBtn"),buy100Btn:$("buy100Btn"),buy1000Btn:$("buy1000Btn"),proBtn:$("proBtn"),cancelSubBtn:$("cancelSubBtn"),
  clearHistoryBtn:$("clearHistoryBtn"),historyList:$("historyList"),projectsGrid:$("projectsGrid"),shareForm:$("shareForm"),communityGrid:$("communityGrid"),gallerySearch:$("gallerySearch"),sortPopularBtn:$("sortPopularBtn"),leafToggle:$("leafToggle"),leafToggle2:$("leafToggle2"),leafLayer:$("leafLayer"),cursorGlow:$("cursorGlow"),starsCanvas:$("starsCanvas"),templateMegaGrid:$("templateMegaGrid"),templateSearch:$("templateSearch"),templateCategory:$("templateCategory")
};

function notify(m){if(!els.toast)return alert(m);els.toast.textContent=m;els.toast.classList.add("show");setTimeout(()=>els.toast.classList.remove("show"),3500)}
function openModal(id){$(id)?.classList.remove("hidden")}function closeModal(id){$(id)?.classList.add("hidden")}
function safeJSON(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}}
function saveHistory(){localStorage.setItem(HISTORY_KEY,JSON.stringify(state.history))}
function confirmed(){return Boolean(state.user?.email_confirmed_at||state.user?.confirmed_at)}

async function initAuth(){
  state.history=safeJSON(HISTORY_KEY,[]);
  const {data}=await supabaseClient.auth.getSession();
  state.user=data?.session?.user||null;
  if(state.user){await ensureProfile();await loadProfile()}
  updateUI();
  supabaseClient.auth.onAuthStateChange(async(_e,s)=>{
    state.user=s?.user||null;
    if(state.user){await ensureProfile();await loadProfile()}else{state.profile=null;state.plan="free";state.credits=0}
    updateUI();
  });
}

async function ensureProfile(){
  if(!state.user)return;
  const {data:ex}=await supabaseClient.from("profiles").select("*").eq("id",state.user.id).maybeSingle();
  if(ex){state.profile=ex;return}
  const username=state.user.user_metadata?.username||state.user.email?.split("@")[0]||"Utilisateur Siteo";
  const {data,error}=await supabaseClient.from("profiles").insert({id:state.user.id,username,email:state.user.email,plan:"free",credits:100}).select().single();
  if(error)return console.error(error);
  state.profile=data;
}

async function loadProfile(){
  if(!state.user)return;
  const {data,error}=await supabaseClient.from("profiles").select("*").eq("id",state.user.id).single();
  if(error)return console.error(error);
  state.profile=data;state.plan=data.plan||"free";state.credits=Number(data.credits??100);
}

// Les crédits ne sont plus jamais écrits depuis le navigateur (RLS l'interdit désormais) :
// le serveur déduit les crédits lui-même et renvoie la nouvelle valeur après chaque génération.
function applyCreditsFromServer(credits,plan){
  if(typeof credits==="number")state.credits=credits;
  if(plan)state.plan=plan;
}
async function getAccessToken(){const{data}=await supabaseClient.auth.getSession();return data?.session?.access_token||null}
async function authFetch(url,options={}){const token=await getAccessToken();const headers={...(options.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;return fetch(url,{...options,headers})}

function updateUI(){
  const u=state.profile?.username||state.user?.user_metadata?.username||state.user?.email||"Invité";
  const pro=state.plan==="pro";
  const ct=pro?"∞":`${Number(state.credits||0)} crédits`;
  [els.creditCount,els.dashCredits].forEach(e=>{if(e)e.textContent=ct});
  [els.planStatus,els.dashPlan].forEach(e=>{if(e)e.textContent=pro?"Pro":"Free"});
  if(els.accountStatus)els.accountStatus.textContent=u;
  if(els.dashUsername)els.dashUsername.textContent=u;
  if(els.dashEmail)els.dashEmail.textContent=state.user?.email||"Connecte-toi pour voir ton profil.";
  if(els.dashVerified)els.dashVerified.textContent=confirmed()?"Email confirmé":"Email non confirmé";
  if(els.dashProjects)els.dashProjects.textContent=String(state.history.length);
  if(els.openLoginBtn&&els.openSignupBtn&&els.logoutBtn){
    if(state.user){els.openLoginBtn.classList.add("hidden");els.openSignupBtn.classList.add("hidden");els.logoutBtn.classList.remove("hidden")}
    else{els.openLoginBtn.classList.remove("hidden");els.openSignupBtn.classList.remove("hidden");els.logoutBtn.classList.add("hidden")}
  }
  renderHistory();renderProjects();renderCommunity();
  if(window.onAuthUpdate)window.onAuthUpdate();
}

function activeMode(){return document.querySelector(".tab.active[data-generator-tab]")?.dataset.generatorTab||"create"}
function buildPrompt(){
  const mode=activeMode();
  if(mode==="improve")return $("improvePrompt")?.value||"Améliore ce site en version premium.";
  return `Créer un site web complet.

Nom : ${$("projectName")?.value||"Site sans nom"}
Type : ${$("siteType")?.value||"Landing page"}
Style : ${$("style")?.value||"Premium"}

Description :
${$("description")?.value||"Créer un site complet, moderne, responsive et professionnel."}

Inclure hero premium, stats, fonctionnalités, avis, FAQ, CTA, footer, animations, responsive mobile et SEO.`;
}
function updatePreview(files){if(!els.sitePreview||!files)return;els.sitePreview.srcdoc=(files.html||"").replace("</head>",`<style>${files.css||""}</style></head>`).replace("</body>",`<script>${files.js||""}<\/script></body>`)}
function formatResult(f){return`INDEX.HTML\n\n${f.html||""}\n\nSTYLE.CSS\n\n${f.css||""}\n\nSCRIPT.JS\n\n${f.js||""}`}
async function generateSite(e){
  e.preventDefault();
  if(!state.user){openModal("signupModal");return notify("Crée un compte ou connecte-toi.")}
  if(!confirmed())return notify("Confirme ton email avant de générer.");
  if(state.plan!=="pro"&&state.credits<10)return notify("Tu n'as plus assez de crédits.");
  const mode=activeMode(),prompt=buildPrompt(),existingSite=$("existingSiteCode")?.value||"";
  if(els.resultText)els.resultText.textContent="Création en cours...";
  try{
    const r=await authFetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,mode,existingSite})});
    const files=await r.json();
    if(!r.ok){notify(files.error||"Erreur génération.");if(els.resultText)els.resultText.textContent="";return}
    state.generatedFiles={html:files.html||"",css:files.css||"",js:files.js||""};
    applyCreditsFromServer(files.credits,files.plan);
    const title=$("projectName")?.value||(mode==="improve"?"Site amélioré":"Site généré");
    state.history.unshift({id:Date.now(),title,date:new Date().toLocaleString("fr-FR"),files:state.generatedFiles});
    saveHistory();updatePreview(state.generatedFiles);
    if(els.resultText)els.resultText.textContent=formatResult(state.generatedFiles);
    updateUI();notify("Site généré avec succès.");
  }catch(err){console.error(err);notify("Erreur génération.")}
}
async function downloadZip(){if(!state.generatedFiles)return notify("Génère d'abord un site.");const zip=new JSZip();zip.file("index.html",state.generatedFiles.html||"");zip.file("style.css",state.generatedFiles.css||"");zip.file("script.js",state.generatedFiles.js||"");const blob=await zip.generateAsync({type:"blob"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="siteo-site.zip";a.click();URL.revokeObjectURL(a.href)}
async function checkout(type){if(!state.user){openModal("loginModal");return notify("Connecte-toi avant d'acheter.")}try{const r=await authFetch("/api/create-checkout-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type})});const d=await r.json();if(!d.url)return notify(d.error||"Erreur Stripe.");location.href=d.url}catch(e){notify("Erreur paiement.")}}
async function portal(){if(!state.user){openModal("loginModal");return}try{const r=await authFetch("/api/create-portal-session",{method:"POST",headers:{"Content-Type":"application/json"}});const d=await r.json();if(!d.url)return notify(d.error||"Aucun abonnement à gérer.");location.href=d.url}catch(e){notify("Erreur portail.")}}
function esc(t){return String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function renderHistory(){if(!els.historyList)return;if(!state.history.length){els.historyList.innerHTML='<div class="history-item">Aucune création.</div>';return}els.historyList.innerHTML=state.history.slice(0,8).map(i=>`<div class="history-item"><strong>${esc(i.title)}</strong><p>${esc(i.date)}</p></div>`).join("")}
function renderProjects(){if(!els.projectsGrid)return;if(!state.history.length){els.projectsGrid.innerHTML='<div class="project-item">Aucun projet sauvegardé.</div>';return}els.projectsGrid.innerHTML=state.history.map(i=>`<div class="project-item"><h3>${esc(i.title)}</h3><p>${esc(i.date)}</p></div>`).join("")}
function defaults(){return[{id:1,title:"Portfolio Roblox",description:"Portfolio sombre premium pour créations Roblox.",image:"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900",url:"#",likes:18,comments:["Très propre"]},{id:2,title:"Landing SaaS IA",description:"Landing moderne pour un outil IA.",image:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900",url:"#",likes:34,comments:["Stylé"]},{id:3,title:"Restaurant Luxe",description:"Site restaurant premium.",image:"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900",url:"#",likes:21,comments:["Pro"]}]}
function renderCommunity(){if(!els.communityGrid)return;let items=safeJSON(COMMUNITY_KEY,defaults());const q=els.gallerySearch?.value?.toLowerCase().trim();if(q)items=items.filter(i=>(i.title+i.description).toLowerCase().includes(q));els.communityGrid.innerHTML=items.map(i=>`<article class="site-card"><img src="${esc(i.image)}" alt="${esc(i.title)}"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><p>❤️ ${i.likes||0} likes • 💬 ${(i.comments||[]).length}</p><div class="site-card-actions"><button class="ui-btn ui-ghost small like-btn" data-id="${i.id}">Liker</button><button class="ui-btn ui-ghost small comment-btn" data-id="${i.id}">Commenter</button><a class="ui-btn ui-primary small" href="${esc(i.url||"#")}" target="_blank">Voir</a></div></article>`).join("");els.communityGrid.querySelectorAll(".like-btn").forEach(b=>b.addEventListener("click",()=>{const l=safeJSON(COMMUNITY_KEY,defaults()),it=l.find(x=>x.id==b.dataset.id);if(it)it.likes=Number(it.likes||0)+1;localStorage.setItem(COMMUNITY_KEY,JSON.stringify(l));renderCommunity()}));els.communityGrid.querySelectorAll(".comment-btn").forEach(b=>b.addEventListener("click",()=>{const t=prompt("Ton commentaire :");if(!t)return;const l=safeJSON(COMMUNITY_KEY,defaults()),it=l.find(x=>x.id==b.dataset.id);if(it){it.comments=it.comments||[];it.comments.push(t)}localStorage.setItem(COMMUNITY_KEY,JSON.stringify(l));renderCommunity()}))}
async function loadTemplates(){if(!els.templateMegaGrid)return;try{const r=await fetch("/assets/templates-v12.json");state.templates=await r.json()}catch{state.templates=[]}renderTemplates()}
function renderTemplates(){if(!els.templateMegaGrid)return;const q=els.templateSearch?.value?.toLowerCase().trim()||"";const c=els.templateCategory?.value||"";let list=state.templates;if(q)list=list.filter(t=>(t.title+t.category+t.style).toLowerCase().includes(q));if(c)list=list.filter(t=>t.category===c);els.templateMegaGrid.innerHTML=list.slice(0,60).map(t=>`<article><span>🎨</span><h2>${esc(t.title)}</h2><p>${esc(t.category)} • ${esc(t.style)}</p><button class="ui-btn ui-primary full copy-template" data-prompt="${esc(t.prompt)}">Copier</button></article>`).join("");document.querySelectorAll(".copy-template").forEach(b=>b.addEventListener("click",async()=>{const p=b.dataset.prompt||"";await navigator.clipboard.writeText(p);localStorage.setItem("siteo_template_prompt",p);notify("Prompt copié.")}))}
let leafTimer=null;function syncLeaf(on){[els.leafToggle,els.leafToggle2].forEach(b=>{if(b)b.textContent=on?"🍃 Feuilles ON":"🍃 Feuilles OFF"})}function startLeaves(){if(!els.leafLayer||leafTimer)return;leafTimer=setInterval(()=>{const l=document.createElement("span");l.className="leaf";l.textContent=["🍃","🍂","🌿","🍁"][Math.floor(Math.random()*4)];l.style.left=Math.random()*100+"vw";l.style.fontSize=16+Math.random()*20+"px";l.style.animationDuration=5+Math.random()*8+"s";els.leafLayer.appendChild(l);setTimeout(()=>l.remove(),14000)},260)}function stopLeaves(){clearInterval(leafTimer);leafTimer=null;if(els.leafLayer)els.leafLayer.innerHTML=""}function toggleLeaves(){const on=!(localStorage.getItem(LEAF_KEY)==="true");localStorage.setItem(LEAF_KEY,String(on));syncLeaf(on);on?startLeaves():stopLeaves()}
function initEffects(){const on=localStorage.getItem(LEAF_KEY)==="true";syncLeaf(on);if(on)startLeaves();[els.leafToggle,els.leafToggle2].forEach(b=>b?.addEventListener("click",toggleLeaves));document.addEventListener("pointermove",e=>{if(els.cursorGlow){els.cursorGlow.style.left=e.clientX+"px";els.cursorGlow.style.top=e.clientY+"px"}});const c=els.starsCanvas;if(c){const ctx=c.getContext("2d");let stars=[];function resize(){c.width=innerWidth;c.height=innerHeight;stars=Array.from({length:Math.min(120,Math.floor(innerWidth/12))},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.7+.3,v:Math.random()*.25+.06}))}function draw(){ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="rgba(201,138,62,.5)";stars.forEach(s=>{s.y-=s.v;if(s.y<0)s.y=c.height;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill()});requestAnimationFrame(draw)}resize();draw();addEventListener("resize",resize)}}
function initEvents(){els.mobileMenuBtn?.addEventListener("click",()=>els.navLinks?.classList.toggle("open"));els.openSignupBtn?.addEventListener("click",()=>openModal("signupModal"));els.openLoginBtn?.addEventListener("click",()=>openModal("loginModal"));els.switchToLoginBtn?.addEventListener("click",()=>{closeModal("signupModal");openModal("loginModal")});els.switchToSignupBtn?.addEventListener("click",()=>{closeModal("loginModal");openModal("signupModal")});els.openResetBtn?.addEventListener("click",()=>{closeModal("loginModal");openModal("resetModal")});document.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.closeModal)));document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));els.signupBtn?.addEventListener("click",async()=>{const username=$("signupUsername")?.value.trim(),email=$("signupEmail")?.value.trim(),password=$("signupPassword")?.value.trim();if(!username||!email||!password||password.length<6)return notify("Informations invalides.");const{error}=await supabaseClient.auth.signUp({email,password,options:{data:{username},emailRedirectTo:location.origin}});if(error)return notify(error.message);notify("Compte créé. Vérifie ton email.");closeModal("signupModal");openModal("loginModal")});els.loginBtn?.addEventListener("click",async()=>{const email=$("loginEmail")?.value.trim(),password=$("loginPassword")?.value.trim();const{data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)return notify(error.message);state.user=data.user;await ensureProfile();await loadProfile();closeModal("loginModal");updateUI();notify("Connecté")});els.resetPasswordBtn?.addEventListener("click",async()=>{const email=$("resetEmail")?.value.trim();if(!email)return notify("Entre ton email.");const{error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)return notify(error.message);closeModal("resetModal");notify("Email envoyé")});els.logoutBtn?.addEventListener("click",async()=>{await supabaseClient.auth.signOut();state.user=null;state.profile=null;state.plan="free";state.credits=0;updateUI()});document.querySelectorAll("[data-generator-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-generator-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".generator-tab-panel").forEach(p=>p.classList.remove("active"));$(`${b.dataset.generatorTab}Panel`)?.classList.add("active")}));$("templateGrid")?.querySelectorAll("[data-template]").forEach(b=>b.addEventListener("click",()=>{document.querySelector('[data-generator-tab="create"]')?.click();if($("description"))$("description").value=b.dataset.template;notify("Modèle ajouté.")}));const saved=localStorage.getItem("siteo_template_prompt");if(saved&&$("description")){$("description").value=saved;localStorage.removeItem("siteo_template_prompt")}els.templateSearch?.addEventListener("input",renderTemplates);els.templateCategory?.addEventListener("change",renderTemplates);els.templateForm?.addEventListener("submit",generateSite);els.downloadBtn?.addEventListener("click",downloadZip);els.copyBtn?.addEventListener("click",async()=>{await navigator.clipboard.writeText(els.resultText?.textContent||"");notify("Code copié")});els.buy100Btn?.addEventListener("click",()=>checkout("credits_100"));els.buy1000Btn?.addEventListener("click",()=>checkout("credits_1000"));els.proBtn?.addEventListener("click",()=>checkout("pro"));els.cancelSubBtn?.addEventListener("click",portal);els.clearHistoryBtn?.addEventListener("click",()=>{state.history=[];saveHistory();updateUI()});els.gallerySearch?.addEventListener("input",renderCommunity);els.sortPopularBtn?.addEventListener("click",()=>{const l=safeJSON(COMMUNITY_KEY,defaults()).sort((a,b)=>(b.likes||0)-(a.likes||0));localStorage.setItem(COMMUNITY_KEY,JSON.stringify(l));renderCommunity()});els.shareForm?.addEventListener("submit",e=>{e.preventDefault();const l=safeJSON(COMMUNITY_KEY,defaults());l.unshift({id:Date.now(),title:$("shareTitle")?.value||"Site sans titre",description:$("shareDescription")?.value||"",image:$("shareImage")?.value||"https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900",url:$("shareUrl")?.value||"#",likes:0,comments:[]});localStorage.setItem(COMMUNITY_KEY,JSON.stringify(l));els.shareForm.reset();renderCommunity();notify("Site publié")})}
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible")}),{threshold:.12});document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
initEvents();initEffects();loadTemplates();initAuth();
