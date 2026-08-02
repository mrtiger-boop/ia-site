if(!state.builderBlocks)state.builderBlocks=[];
let selectedBlockId=null,blockSeq=0,builderInited=false;
function newBlockId(){return "b"+(++blockSeq)+"_"+Date.now().toString(36)}
function bParseItems(raw){return (raw||"").split("\n").map(l=>l.trim()).filter(Boolean).map(l=>l.split("|").map(s=>s.trim()))}

const BASE_CSS=`:root{--accent:ACCENT}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1c1c1c;line-height:1.65}
.sb-wrap{max-width:1080px;margin:0 auto;padding:0 24px}
.sb-section{padding:72px 0}
.sb-center{text-align:center}
.sb-narrow{max-width:760px}
.sb-h1{font-size:clamp(32px,5vw,54px);margin:0 0 18px;font-weight:800;letter-spacing:-1px}
.sb-h2{font-size:clamp(26px,3.4vw,38px);margin:0 0 32px;font-weight:800}
.sb-sub{font-size:19px;color:#555;max-width:640px;margin:0 auto 30px;white-space:pre-line}
.sb-btn{display:inline-block;background:var(--accent);color:#fff;padding:15px 28px;border-radius:10px;text-decoration:none;font-weight:700;border:0;cursor:pointer;font-size:16px}
.sb-btn-light{background:#fff;color:#111}
.sb-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.sb-grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}
.sb-card{background:#f5f5f3;border-radius:16px;padding:28px}
.sb-price{font-size:32px;font-weight:800;color:var(--accent);margin:8px 0}
.sb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:24px;text-align:center}
.sb-stat strong{display:block;font-size:32px;color:var(--accent);font-weight:800}
.sb-stat span{color:#555}
.sb-faq{border-top:1px solid #e6e6e2;padding:20px 0}
.sb-faq h3{margin:0 0 8px;font-size:18px}
.sb-faq p{margin:0;color:#555}
.sb-cta{background:var(--accent)}
.sb-footer{padding:32px 0;color:#777;font-size:14px;border-top:1px solid #e6e6e2}
@media(max-width:760px){.sb-grid-3,.sb-grid-2{grid-template-columns:1fr}}`;

const BLOCKS={
  hero:{label:"Hero",icon:"🚀",
    fields:[{key:"title",type:"text",label:"Titre"},{key:"subtitle",type:"textarea",label:"Sous-titre"},{key:"button",type:"text",label:"Texte du bouton"}],
    defaults:{title:"Le titre qui capte l'attention.",subtitle:"Une phrase claire qui explique ce que tu proposes et pourquoi c'est fait pour eux.",button:"Commencer"},
    render(c){return `<section class="sb-section sb-hero"><div class="sb-wrap sb-center"><h1 class="sb-h1">${esc(c.title)}</h1><p class="sb-sub">${esc(c.subtitle)}</p><a class="sb-btn" href="#">${esc(c.button)}</a></div></section>`}},
  stats:{label:"Chiffres clés",icon:"📊",
    fields:[{key:"items",type:"items",label:"Un chiffre par ligne",hint:"Format : Chiffre|Libellé"}],
    defaults:{items:"500+|Clients satisfaits\n4.9/5|Note moyenne\n24/7|Support disponible"},
    render(c){const items=bParseItems(c.items);return `<section class="sb-section"><div class="sb-wrap sb-stats">${items.map(([n,l])=>`<div class="sb-stat"><strong>${esc(n||"")}</strong><span>${esc(l||"")}</span></div>`).join("")}</div></section>`}},
  features:{label:"Fonctionnalités",icon:"🧩",
    fields:[{key:"title",type:"text",label:"Titre de section"},{key:"items",type:"items",label:"Un bloc par ligne",hint:"Format : Titre|Description"}],
    defaults:{title:"Ce qui nous différencie",items:"Rapide|Mis en place en quelques minutes.\nFiable|Une qualité pensée pour durer.\nSimple|Aucune compétence technique requise."},
    render(c){const items=bParseItems(c.items);return `<section class="sb-section"><div class="sb-wrap"><h2 class="sb-h2">${esc(c.title)}</h2><div class="sb-grid-3">${items.map(([t,d])=>`<div class="sb-card"><h3>${esc(t||"")}</h3><p>${esc(d||"")}</p></div>`).join("")}</div></div></section>`}},
  pricing:{label:"Tarifs",icon:"💳",
    fields:[{key:"items",type:"items",label:"Une offre par ligne",hint:"Format : Nom|Prix|Description"}],
    defaults:{items:"Starter|0€|Pour découvrir.\nPro|19€/mois|Pour aller plus loin.\nBusiness|49€/mois|Pour les équipes."},
    render(c){const items=bParseItems(c.items);return `<section class="sb-section"><div class="sb-wrap sb-grid-3">${items.map(([n,p,d])=>`<div class="sb-card sb-center"><h3>${esc(n||"")}</h3><p class="sb-price">${esc(p||"")}</p><p>${esc(d||"")}</p><a class="sb-btn" href="#">Choisir</a></div>`).join("")}</div></section>`}},
  testimonials:{label:"Témoignages",icon:"⭐",
    fields:[{key:"items",type:"items",label:"Un avis par ligne",hint:"Format : Nom|Avis"}],
    defaults:{items:"Julie M.|Un service au top, je recommande !\nThomas R.|Rapide et professionnel du début à la fin."},
    render(c){const items=bParseItems(c.items);return `<section class="sb-section"><div class="sb-wrap sb-grid-2">${items.map(([n,a])=>`<div class="sb-card"><p>"${esc(a||"")}"</p><strong>${esc(n||"")}</strong></div>`).join("")}</div></section>`}},
  faq:{label:"FAQ",icon:"❓",
    fields:[{key:"title",type:"text",label:"Titre de section"},{key:"items",type:"items",label:"Une question par ligne",hint:"Format : Question|Réponse"}],
    defaults:{title:"Questions fréquentes",items:"Comment ça marche ?|Tu t'inscris et tu commences en quelques minutes.\nPuis-je annuler ?|Oui, à tout moment, sans engagement."},
    render(c){const items=bParseItems(c.items);return `<section class="sb-section"><div class="sb-wrap sb-narrow"><h2 class="sb-h2">${esc(c.title)}</h2>${items.map(([q,a])=>`<div class="sb-faq"><h3>${esc(q||"")}</h3><p>${esc(a||"")}</p></div>`).join("")}</div></section>`}},
  cta:{label:"Appel à l'action",icon:"📣",
    fields:[{key:"title",type:"text",label:"Titre"},{key:"button",type:"text",label:"Texte du bouton"}],
    defaults:{title:"Prêt à te lancer ?",button:"Commencer maintenant"},
    render(c){return `<section class="sb-section sb-cta"><div class="sb-wrap sb-center"><h2 class="sb-h2" style="color:#fff">${esc(c.title)}</h2><a class="sb-btn sb-btn-light" href="#">${esc(c.button)}</a></div></section>`}},
  footer:{label:"Footer",icon:"🔻",
    fields:[{key:"text",type:"text",label:"Texte du footer"}],
    defaults:{text:"© 2026 Mon site. Tous droits réservés."},
    render(c){return `<footer class="sb-footer"><div class="sb-wrap sb-center">${esc(c.text)}</div></footer>`}}
};

function compileSite(){
  const accentEl=document.getElementById("builderAccent");
  const accent=(accentEl&&accentEl.value)||"#2d6a4f";
  const bodyHtml=state.builderBlocks.map(b=>BLOCKS[b.type].render(b.content)).join("\n");
  const html=`<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Mon site</title>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>`;
  const css=BASE_CSS.replace("ACCENT",accent);
  return {html,css,js:""};
}
function recompileAndPreview(){
  const compiled=compileSite();
  state.generatedFiles=compiled;
  updatePreview(compiled);
}

function renderBlockList(){
  const host=document.getElementById("blockList");
  if(!host)return;
  if(!state.builderBlocks.length){host.innerHTML='<div class="history-item">Aucun bloc. Ajoute-en un ci-dessus.</div>';return}
  host.innerHTML=state.builderBlocks.map(b=>{
    const def=BLOCKS[b.type];
    const active=b.id===selectedBlockId;
    return `<div class="history-item" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;${active?"border-color:var(--green-light)":""}">
      <span data-select="${b.id}" style="flex:1"><strong>${def.icon} ${def.label}</strong></span>
      <span style="display:flex;gap:4px;flex-wrap:wrap">
        <button type="button" data-move="up" data-id="${b.id}" class="ui-btn ui-ghost small" style="padding:6px 9px">▲</button>
        <button type="button" data-move="down" data-id="${b.id}" class="ui-btn ui-ghost small" style="padding:6px 9px">▼</button>
        <button type="button" data-dup="${b.id}" class="ui-btn ui-ghost small" style="padding:6px 9px">⧉</button>
        <button type="button" data-del="${b.id}" class="ui-btn ui-ghost small" style="padding:6px 9px">🗑</button>
      </span>
    </div>`;
  }).join("");
  host.querySelectorAll("[data-select]").forEach(el=>el.addEventListener("click",()=>selectBlock(el.dataset.select)));
  host.querySelectorAll("[data-move]").forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();moveBlock(el.dataset.id,el.dataset.move)}));
  host.querySelectorAll("[data-dup]").forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();duplicateBlock(el.dataset.dup)}));
  host.querySelectorAll("[data-del]").forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();removeBlock(el.dataset.del)}));
}

function renderEditorForm(){
  const host=document.getElementById("blockEditor");
  if(!host)return;
  const b=state.builderBlocks.find(x=>x.id===selectedBlockId);
  if(!b){host.innerHTML="";return}
  const def=BLOCKS[b.type];
  host.innerHTML=`<label style="margin-top:18px">Modifier : ${def.icon} ${esc(def.label)}</label>`+def.fields.map(f=>{
    const val=esc(b.content[f.key]||"");
    if(f.type==="textarea"||f.type==="items"){
      return `<label>${esc(f.label)}${f.hint?` <small style="color:var(--muted);font-weight:400">(${esc(f.hint)})</small>`:""}</label><textarea data-field="${f.key}" rows="${f.type==="items"?5:3}">${val}</textarea>`;
    }
    return `<label>${esc(f.label)}</label><input data-field="${f.key}" value="${val}">`;
  }).join("");
  host.querySelectorAll("[data-field]").forEach(el=>el.addEventListener("input",()=>{
    b.content[el.dataset.field]=el.value;
    recompileAndPreview();
  }));
}

function addBlock(type){
  const def=BLOCKS[type];if(!def)return;
  const block={id:newBlockId(),type,content:{...def.defaults}};
  state.builderBlocks.push(block);
  selectedBlockId=block.id;
  renderBlockList();renderEditorForm();recompileAndPreview();
}
function moveBlock(id,dir){
  const i=state.builderBlocks.findIndex(b=>b.id===id);if(i<0)return;
  const j=dir==="up"?i-1:i+1;
  if(j<0||j>=state.builderBlocks.length)return;
  [state.builderBlocks[i],state.builderBlocks[j]]=[state.builderBlocks[j],state.builderBlocks[i]];
  renderBlockList();recompileAndPreview();
}
function duplicateBlock(id){
  const i=state.builderBlocks.findIndex(b=>b.id===id);if(i<0)return;
  const clone={id:newBlockId(),type:state.builderBlocks[i].type,content:{...state.builderBlocks[i].content}};
  state.builderBlocks.splice(i+1,0,clone);
  renderBlockList();recompileAndPreview();
}
function removeBlock(id){
  state.builderBlocks=state.builderBlocks.filter(b=>b.id!==id);
  if(selectedBlockId===id)selectedBlockId=state.builderBlocks[0]?.id||null;
  renderBlockList();renderEditorForm();recompileAndPreview();
}
function selectBlock(id){selectedBlockId=id;renderBlockList();renderEditorForm()}

function initBuilderApp(){
  const palette=document.getElementById("blockPalette");
  if(palette){
    palette.innerHTML=Object.entries(BLOCKS).map(([type,def])=>`<button type="button" data-add="${type}">${def.icon} ${esc(def.label)}</button>`).join("");
    palette.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>addBlock(btn.dataset.add)));
  }
  document.getElementById("builderAccent")?.addEventListener("input",recompileAndPreview);
  document.getElementById("builderGenerateBtn")?.addEventListener("click",()=>{
    const compiled=compileSite();state.generatedFiles=compiled;
    const resultEl=document.getElementById("resultText");
    if(resultEl)resultEl.textContent=formatResult(compiled);
    updatePreview(compiled);
    notify("Code généré.");
  });
  document.getElementById("builderDownloadBtn")?.addEventListener("click",downloadZip);
  document.getElementById("builderCopyBtn")?.addEventListener("click",async()=>{
    await navigator.clipboard.writeText(document.getElementById("resultText")?.textContent||"");
    notify("Code copié");
  });
  document.getElementById("builderSaveBtn")?.addEventListener("click",()=>{
    if(!state.builderBlocks.length)return notify("Ajoute au moins un bloc.");
    const compiled=compileSite();state.generatedFiles=compiled;
    state.history.unshift({id:Date.now(),title:"Site construit à la main",date:new Date().toLocaleString("fr-FR"),files:compiled});
    saveHistory();updateUI();
    notify("Site sauvegardé dans tes projets.");
  });
  renderBlockList();
  recompileAndPreview();
}

function renderBuilderGate(){
  const locked=document.getElementById("builderLocked");
  const app=document.getElementById("builderApp");
  if(!locked||!app)return;
  const isPro=state.plan==="pro";
  locked.classList.toggle("hidden",isPro);
  app.classList.toggle("hidden",!isPro);
  if(isPro&&!builderInited){builderInited=true;initBuilderApp()}
}
window.onAuthUpdate=renderBuilderGate;
renderBuilderGate();
