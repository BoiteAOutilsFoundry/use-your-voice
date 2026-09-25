import {DEFAULT_ALIASES} from "./default-aliases.js";
const MOD="use-your-voice"; let recognition=null,listening=false,held=false,activeUntil=0,restartTimer=null,manualStop=false,executionMode="activity",lastAction=null;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;

Hooks.once("init",()=>{
 const settings=[
  ["microphoneId",{name:"Microphone",hint:"Choisissez le périphérique audio utilisé.",scope:"client",config:true,type:String,choices:{"":"Microphone par défaut"},default:""}],
  ["showTranscript",{name:"Mode debug vocal",hint:"Pendant l’écoute, affiche une fenêtre mise à jour en temps réel avec le texte entendu, l’interprétation et le score.",scope:"client",config:true,type:Boolean,default:true}],
  ["activationMode",{name:"Mode d’activation",hint:"Push-to-talk : maintenir la touche. Push-to-activate : un appui active l’écoute pendant la durée configurée.",scope:"client",config:true,type:String,choices:{ptt:"Push-to-talk",activate:"Push-to-activate"},default:"ptt"}],
  ["activationDuration",{name:"Durée Push-to-activate",hint:"Durée pendant laquelle la détection reste active après un appui (en secondes).",scope:"client",config:true,type:Number,default:5,range:{min:1,max:60,step:1}}],
  ["confidence",{name:"Seuil d'exécution automatique",hint:"Score minimum (0 à 100) avant exécution automatique.",scope:"client",config:true,type:Number,default:50,range:{min:0,max:100,step:1}}],
  ["ambiguity",{name:"Marge d'ambiguïté",hint:"Si les deux meilleurs résultats sont séparés de moins de cette valeur, demander confirmation.",scope:"client",config:true,type:Number,default:10,range:{min:0,max:50,step:1}}],
  ["customAliases",{name:"Alias FR / EN",hint:"Liste préremplie : nom anglais → alias français. Vous pouvez la compléter ou la modifier.",scope:"client",config:true,type:String,default:JSON.stringify(DEFAULT_ALIASES,null,2)}],
  ["learnedAliases",{name:"Alias appris",hint:"Alias mémorisés après vos choix manuels dans la fenêtre de confirmation. Ils sont conservés séparément des alias du module et ne sont pas remplacés lors des mises à jour.",scope:"client",config:true,type:String,default:"{}"}]
 ];
 for(const [k,v] of settings) game.settings.register(MOD,k,v);
 const bindVoiceKey=(id,name,hint,defaultBinding,mode)=>game.keybindings.register(MOD,id,{name,hint,editable:[defaultBinding],onDown:()=>{executionMode=mode;const activation=game.settings.get(MOD,"activationMode");if(activation==="activate"){if(!held){held=true;activateForDuration()}return true}if(!held){held=true;manualStop=false;activeUntil=0;startListening()}return true},onUp:()=>{const activation=game.settings.get(MOD,"activationMode");if(activation==="activate"){held=false;return true}held=false;activeUntil=0;stopListening();setDebugState("Terminé");return true},restricted:false});
 bindVoiceKey("ptt","Micro — activité seulement","Reconnaît la commande puis lance l’activité Foundry normalement.",{key:"KeyV",modifiers:["CONTROL"]},"activity");
 bindVoiceKey("pttAuto","Micro — jets automatiques","Reconnaît la commande, utilise l’activité puis lance automatiquement les jets sans fenêtre de configuration.",{key:"KeyV",modifiers:["CONTROL","SHIFT"]},"auto");
});
Hooks.once("ready",async()=>{await refreshMicrophoneChoices();setupRecognition();addButton();});
Hooks.on("renderSettingsConfig",(_app,html)=>{
 const root=html?.[0]??html;
 for(const settingName of ["customAliases","learnedAliases"]){
  const input=root?.querySelector?.(`[name="${MOD}.${settingName}"]`);
  if(!input||input.tagName==="TEXTAREA")continue;
  const textarea=document.createElement("textarea");
  textarea.name=input.name;
  textarea.className=input.className;
  try{textarea.value=JSON.stringify(JSON.parse(input.value||"{}"),null,2)}catch{textarea.value=input.value||""}
  textarea.spellcheck=false; textarea.wrap="off"; input.replaceWith(textarea);
 }
});
async function refreshMicrophoneChoices(){
 try{
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop())}catch(e){}
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="audioinput");
  const setting=game.settings.settings.get(`${MOD}.microphoneId`);
  if(setting){setting.choices={"":"Microphone par défaut"};devices.forEach((d,i)=>setting.choices[d.deviceId]=d.label||`Microphone ${i+1}`)}
 }catch(e){console.warn("[Use Your Voice] Impossible de lister les microphones",e)}
}


function setupRecognition(){
 if(!SR){ui.notifications.error("Use Your Voice : reconnaissance vocale indisponible dans ce navigateur.");return}
 recognition=new SR(); recognition.lang="fr-FR"; recognition.continuous=false; recognition.interimResults=true; recognition.maxAlternatives=10;
 recognition.onstart=()=>{listening=true;paint();showLive("Écoute…","—",null,true)};
 recognition.onend=()=>{listening=false;paint();const timedActive=game.settings.get(MOD,"activationMode")==="activate" && Date.now()<activeUntil;if(timedActive&&!manualStop){setDebugState("Écoute…");clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(Date.now()<activeUntil&&!listening)startRecognitionOnly()},120)}else if(held){setDebugState("Traitement…")}else if(!manualStop){setDebugState("Terminé")}};
 recognition.onerror=e=>{listening=false;paint();setDebugState(`Erreur micro : ${e.error}`);ui.notifications.error(`Use Your Voice : erreur micro (${e.error}).`)};
 recognition.onresult=e=>{
   let interim="",finalAlts=[];
   for(let n=0;n<e.results.length;n++){
     const r=e.results[n];
     if(r.isFinal){for(let i=0;i<r.length;i++){const s=r[i].transcript?.trim();if(s&&!finalAlts.includes(s))finalAlts.push(s)}}
     else if(r[0]?.transcript)interim+=r[0].transcript+" ";
   }
   const heard=(finalAlts[0]||interim.trim());
   if(heard)previewCommand(heard);
   if(finalAlts.length)resolveCommand(finalAlts,performance.now());
 };
}
function addButton(){if(document.querySelector("#uyv-mic"))return;const b=document.createElement("button");b.id="uyv-mic";b.title="Use Your Voice";b.innerHTML='<i class="fas fa-microphone"></i>';b.onclick=()=>{executionMode="activity";if(game.settings.get(MOD,"activationMode")==="activate")activateForDuration();else listening?stopListening():startListening()};document.body.appendChild(b)}
function paint(){const active=listening || (game.settings.get(MOD,"activationMode")==="activate"&&Date.now()<activeUntil);document.querySelector("#uyv-mic")?.classList.toggle("listening",active)}
function startRecognitionOnly(){if(!recognition||listening)return;try{manualStop=false;recognition.start()}catch(e){console.warn("[Use Your Voice] Impossible de relancer la reconnaissance",e)}}
async function startListening(){if(!recognition||listening)return;try{manualStop=false;const id=game.settings.get(MOD,"microphoneId").trim();if(navigator.mediaDevices?.getUserMedia){const s=await navigator.mediaDevices.getUserMedia(id?{audio:{deviceId:{exact:id}}}:{audio:true});s.getTracks().forEach(t=>t.stop())}startRecognitionOnly()}catch(e){console.error("[UYV]",e);ui.notifications.error("Use Your Voice : impossible d'accéder au microphone.")}}
async function activateForDuration(){
 const seconds=Math.max(1,Number(game.settings.get(MOD,"activationDuration"))||5);
 activeUntil=Date.now()+seconds*1000; manualStop=false; held=false;
 clearTimeout(restartTimer);
 setDebugState(`Actif ${seconds} s`); paint();
 if(!listening)await startListening();
 restartTimer=setTimeout(()=>{activeUntil=0;stopListening();setDebugState("Terminé");paint()},seconds*1000+25);
}
function stopListening(){
 manualStop=true;activeUntil=0;clearTimeout(restartTimer);restartTimer=null;
 try{if(recognition&&listening)recognition.stop()}catch{}
 paint();
}
function stopAfterSuccessfulExecution(){
 if(game.settings.get(MOD,"activationMode")!=="activate")return;
 stopListening();
 console.log("[Use Your Voice] Push-to-activate : microphone désactivé après exécution de l’activité.");
}

function selectedActor(notify=true){
 const controlled=canvas?.tokens?.controlled??[];
 if(controlled.length===1)return controlled[0].actor;
 if(controlled.length>1){if(notify)ui.notifications.error("Use Your Voice : plusieurs personnages sont sélectionnés. Sélectionnez-en un seul.");return null}
 if(game.user.character)return game.user.character;
 if(notify)ui.notifications.error("Use Your Voice : aucun personnage sélectionné et aucun personnage lié à votre utilisateur.");
 return null;
}
const INVENTORY_TYPES=new Set(["weapon","equipment","consumable","tool","loot","backpack"]);
const EQUIPPABLE_TYPES=new Set(["weapon","equipment"]);
function hasActivity(item){const a=item.system?.activities;if(a?.size!==undefined)return a.size>0;if(a?.contents)return a.contents.length>0;if(Array.isArray(a))return a.length>0;return typeof item.use==="function"}
function isAvailableInventoryItem(item){
 if(!INVENTORY_TYPES.has(item.type)||!hasActivity(item))return false;
 // Weapons and equipment only participate in voice matching when actually equipped.
 // This filtering happens BEFORE names/aliases are scored, so an unequipped Shortbow
 // cannot create ambiguity with an equipped Longbow when the player simply says "arc".
 if(EQUIPPABLE_TYPES.has(item.type))return item.system?.equipped===true;
 return true;
}
function candidates(actor){return actor.items.filter(i=>i.type==="spell" || isAvailableInventoryItem(i))}

function norm(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g," ").replace(/[^a-z0-9\s/-]/g," ").replace(/\s+/g," ").trim()}
const VERBS=/^(?:(?:ok\s+)?(?:(?:je|j)\s+)?(?:lance|lancer|utilise|utiliser|active|activer|emploie|employer|attaque(?:\s+avec)?|attaquer(?:\s+avec)?|frappe(?:\s+avec)?|tir(?:e|er)(?:\s+avec)?|bois|boire|prends|prendre|fais|faire|cast|caste)\s+)+/i;
function clean(s){return norm(s).replace(VERBS,"").replace(/^(?:mon|ma|mes|le|la|les|un|une|du|de la|des)\s+/,"").trim()}
function lev(a,b){a=norm(a);b=norm(b);let p=Array.from({length:b.length+1},(_,i)=>i),c=[];for(let i=1;i<=a.length;i++){c[0]=i;for(let j=1;j<=b.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));[p,c]=[c,p]}return p[b.length]}
function dice(a,b){a=norm(a).replace(/\s/g,"");b=norm(b).replace(/\s/g,"");if(a===b)return 1;if(a.length<2||b.length<2)return 0;const m=new Map();let h=0;for(let i=0;i<a.length-1;i++){const q=a.slice(i,i+2);m.set(q,(m.get(q)||0)+1)}for(let i=0;i<b.length-1;i++){const q=b.slice(i,i+2),n=m.get(q)||0;if(n){h++;m.set(q,n-1)}}return 2*h/((a.length-1)+(b.length-1))}
function baseItemName(s){
 // Ignore common D&D enhancement prefixes for matching: "+1 Longbow" must match "longbow" exactly.
 return norm(s).replace(/^\+?\s*[1-3]\s+/,"").trim();
}
function tokenOverlap(a,b){
 const A=new Set(norm(a).split(/\s+/).filter(x=>x.length>1));
 const B=new Set(norm(b).split(/\s+/).filter(x=>x.length>1));
 if(!A.size||!B.size)return 0;
 let common=0; for(const x of A)if(B.has(x))common++;
 return common/Math.max(A.size,B.size);
}
function speechVariant(s){
 // Variantes fréquentes produites par la reconnaissance FR quand on prononce des noms anglais.
 return clean(s)
   .replace(/\blongue\b/g,"long")
   .replace(/\bcourte\b/g,"short")
   .replace(/\s+/g," ")
   .trim();
}
function compactName(s){return norm(s).replace(/\s+/g,"");}
function canonicalFromExactAlias(spoken){
 const b=clean(spoken);
 if(!b)return null;
 const sources=[DEFAULT_ALIASES,customAliases()];
 for(const source of sources){
   for(const [canonical,values] of Object.entries(source||{})){
     const aliases=Array.isArray(values)?values:[values];
     if(aliases.some(a=>clean(a)===b))return canonical;
   }
 }
 return null;
}
function genericWeaponAliases(item){
 if(item?.type!=="weapon")return [];
 const n=baseItemName(item.name);
 const rangedKeywords=["bow","crossbow","blowgun","sling","dart","pistol","musket","firearm","rifle","revolver","shotgun","arquebus","arc","arbalete","sarbacane","fronde","flechette","pistolet","mousquet","fusil"];
 const thrownKeywords=["javelin","spear","trident","net","javeline","lance","trident","filet"];
 const isRanged=rangedKeywords.some(k=>n.includes(k));
 const isThrown=!isRanged && thrownKeywords.some(k=>n.includes(k));
 if(isRanged)return [
   "je tire","tire","je fais feu","fais feu","je tire dessus","tire dessus",
   "I shoot","shoot","I fire","fire","take a shot","I take a shot"
 ];
 if(isThrown)return [
   "je lance","lance","je jette","jette","je lance dessus",
   "I throw","throw","I hurl","hurl"
 ];
 return [
   "je frappe","frappe","je donne un coup","donne un coup","je donne un coup avec mon arme","attaque au corps a corps",
   "I hit","hit","I strike","strike","I attack","attack","I swing","swing","I take a swing"
 ];
}
function repeatCount(spoken){
 const s=norm(spoken);
 const exact=new Map([
   ["encore",1],["encore une fois",1],["repete",1],["repete encore",1],["meme attaque",1],["meme action",1],
   ["again",1],["repeat",1],["same attack",1],["same action",1],["one more time",1],
   ["encore deux fois",2],["repete deux fois",2],["deux fois encore",2],["again twice",2],["repeat twice",2],["repeat two times",2],
   ["encore trois fois",3],["repete trois fois",3],["again three times",3],["repeat three times",3],
   ["encore quatre fois",4],["repete quatre fois",4],["again four times",4],["repeat four times",4],
   ["encore cinq fois",5],["repete cinq fois",5],["again five times",5],["repeat five times",5]
 ]);
 return exact.get(s)??0;
}
async function repeatLastAction(count){
 if(!lastAction?.item){ui.notifications.warn("Use Your Voice : aucune action précédente à répéter.");setDebugState("Aucune action à répéter");return}
 const total=Math.max(1,Math.min(5,Number(count)||1));
 console.log("[Use Your Voice] Répétition de la dernière action",{item:lastAction.item.name,activityId:lastAction.activityId,mode:lastAction.mode,count:total});
 for(let i=0;i<total;i++){
   setDebugExecution(`Répétition ${i+1}/${total}`,lastAction.activityName||lastAction.item.name);
   await execute(lastAction.item,lastAction.mode,lastAction.activityId,false);
 }
}
function matchScore(name,spoken,isItemName=false){
 const rawName=norm(name),rawSpoken=norm(spoken);
 if(rawName && rawName===rawSpoken)return isItemName?1.0:0.999;
 const a=rawName,base=baseItemName(name),b=speechVariant(spoken);
 if(!a||!b)return 0;
 // Priority 1: literal exact name.
 if(a===b)return isItemName?1.0:0.999;
 // Priority 2: exact name after removing +1/+2/+3.
 if(base===b)return isItemName?0.998:0.997;
 // Noms anglais composés : "long sword" / "longue sword" -> "Longsword".
 if(compactName(base)===compactName(b))return isItemName?0.996:0.995;
 // Priority 3: complete phrase/word containment.
 const paddedA=` ${a} `, paddedBase=` ${base} `, paddedB=` ${b} `;
 if(paddedB.includes(` ${a} `)||paddedA.includes(` ${b} `))return 0.94;
 if(paddedB.includes(` ${base} `)||paddedBase.includes(` ${b} `))return 0.93;
 const overlap=Math.max(tokenOverlap(a,b),tokenOverlap(base,b));
 if(overlap>0)return Math.min(0.89,0.72+0.17*overlap);
 // Last resort only: conservative fuzzy matching. Short accidental similarities
 // such as longbow -> longsword/tongues must not receive a high score.
 const target=base||a;
 const edit=1-lev(target,b)/Math.max(target.length,b.length);
 const dg=dice(target,b);
 const fuzzy=Math.max(0,.38*edit+.22*dg);
 return Math.min(0.59,fuzzy);
}
function customAliases(){try{return JSON.parse(game.settings.get(MOD,"customAliases")||"{}")}catch{return {}}}
function learnedAliases(){try{return JSON.parse(game.settings.get(MOD,"learnedAliases")||"{}")}catch{return {}}}
async function learnAlias(heard,item){
 const raw=String(heard??"").trim();
 const normalized=clean(raw);
 if(!raw||!normalized||!item?.name)return;
 const learned=learnedAliases();
 // Remove this spoken form from another learned target first: one pronunciation = one choice.
 for(const [key,values] of Object.entries(learned)){
   const arr=(Array.isArray(values)?values:[values]).filter(v=>clean(v)!==normalized);
   if(arr.length)learned[key]=arr; else delete learned[key];
 }
 const key=item.name;
 const arr=Array.isArray(learned[key])?learned[key]:learned[key]?[learned[key]]:[];
 if(!arr.some(v=>clean(v)===normalized))arr.push(raw);
 learned[key]=arr;
 await game.settings.set(MOD,"learnedAliases",JSON.stringify(learned,null,2));
 console.log("[Use Your Voice] Alias appris",{heard:raw,item:item.name});
}
function learnedTargetFromExactAlias(spoken){
 const b=clean(spoken); if(!b)return null;
 for(const [target,values] of Object.entries(learnedAliases())){
   const aliases=Array.isArray(values)?values:[values];
   if(aliases.some(a=>clean(a)===b))return target;
 }
 return null;
}
function aliasesFor(item){
 const result=[item.name], custom=customAliases(), learned=learnedAliases();
 const itemBase=baseItemName(item.name);
 const canonical=Object.keys(DEFAULT_ALIASES).find(k=>{const nk=norm(k);return nk===itemBase || itemBase.includes(nk) || nk.includes(itemBase)});
 if(canonical)result.push(...DEFAULT_ALIASES[canonical]);
 for(const [k,v] of Object.entries(custom))if(norm(k)===norm(item.name))result.push(...(Array.isArray(v)?v:[v]));
 for(const [k,v] of Object.entries(learned))if(norm(k)===norm(item.name))result.push(...(Array.isArray(v)?v:[v]));
 result.push(...genericWeaponAliases(item));
 return [...new Set(result.filter(Boolean))];
}

let debugPanel=null;
function closeLive(){
 if(debugPanel){debugPanel.remove();debugPanel=null}
}
function ensureDebugPanel(){
 if(!game.settings.get(MOD,"showTranscript"))return null;
 if(debugPanel?.isConnected)return debugPanel;
 debugPanel=document.createElement("section");
 debugPanel.id="uyv-debug-panel";
 debugPanel.innerHTML=`
   <div class="uyv-debug-head"><i class="fas fa-microphone"></i><strong>Use Your Voice</strong><span class="uyv-debug-state">Écoute…</span><button type="button" class="uyv-debug-close" title="Fermer" aria-label="Fermer"><i class="fas fa-times"></i></button></div>
   <div class="uyv-debug-row"><span>Entendu</span><strong data-uyv-heard>…</strong></div>
   <div class="uyv-debug-row"><span>Interprété</span><strong data-uyv-match>—</strong></div>
   <div class="uyv-debug-row"><span>Confiance</span><strong data-uyv-score>—</strong></div>
   <div class="uyv-debug-row"><span>Correspondance</span><strong data-uyv-alias>—</strong></div>
   <div class="uyv-debug-row"><span>Propositions</span><strong data-uyv-options>—</strong></div>
   <div class="uyv-debug-row"><span>Activité</span><strong data-uyv-activity>—</strong></div>
   <div class="uyv-debug-row"><span>Exécution</span><strong data-uyv-execution>—</strong></div>`;
 document.body.appendChild(debugPanel);
 debugPanel.querySelector(".uyv-debug-close")?.addEventListener("click",(event)=>{
  event.stopPropagation();
  closeLive();
 });
 makeDebugPanelDraggable(debugPanel);
 return debugPanel;
}
function makeDebugPanelDraggable(panel){
 const handle=panel.querySelector(".uyv-debug-head");
 if(!handle)return;
 let dragging=false,startX=0,startY=0,startLeft=0,startTop=0;
 handle.addEventListener("pointerdown",event=>{
  if(event.button!==0 || event.target.closest("button"))return;
  const rect=panel.getBoundingClientRect();
  dragging=true;startX=event.clientX;startY=event.clientY;startLeft=rect.left;startTop=rect.top;
  panel.style.left=`${rect.left}px`;panel.style.top=`${rect.top}px`;panel.style.right="auto";panel.style.bottom="auto";
  handle.setPointerCapture?.(event.pointerId);event.preventDefault();
 });
 handle.addEventListener("pointermove",event=>{
  if(!dragging)return;
  const maxLeft=Math.max(0,window.innerWidth-panel.offsetWidth);
  const maxTop=Math.max(0,window.innerHeight-panel.offsetHeight);
  panel.style.left=`${Math.min(maxLeft,Math.max(0,startLeft+event.clientX-startX))}px`;
  panel.style.top=`${Math.min(maxTop,Math.max(0,startTop+event.clientY-startY))}px`;
 });
 const stop=event=>{if(!dragging)return;dragging=false;try{handle.releasePointerCapture?.(event.pointerId)}catch(_){}};
 handle.addEventListener("pointerup",stop);handle.addEventListener("pointercancel",stop);
}
function setDebugState(label){
 const panel=ensureDebugPanel();
 if(!panel)return;
 panel.querySelector(".uyv-debug-state").textContent=label;
 panel.classList.toggle("listening",!!held);
}
function showLive(heard,interpreted,scoreValue=null,listeningNow=false){
 if(!game.settings.get(MOD,"showTranscript"))return;
 const panel=ensureDebugPanel();if(!panel)return;
 panel.querySelector("[data-uyv-heard]").textContent=heard||"…";
 panel.querySelector("[data-uyv-match]").textContent=interpreted||"—";
 panel.querySelector("[data-uyv-score]").textContent=scoreValue===null?"—":`${Math.round(scoreValue*100)} %`;
 panel.querySelector(".uyv-debug-state").textContent=listeningNow?"Écoute…":"Terminé";
 panel.classList.toggle("listening",!!listeningNow);
}
function rankFor(actor,spokenList){
 const ranked=[];
 const learnedTarget=learnedTargetFromExactAlias(spokenList?.[0]);
 const learnedTargetNorm=learnedTarget?norm(learnedTarget):null;
 const exactCanonical=canonicalFromExactAlias(spokenList?.[0]);
 const exactCanonicalNorm=exactCanonical?norm(exactCanonical):null;
 for(const item of candidates(actor)){
  let best={item,score:0,spoken:spokenList[0],alias:item.name,kind:"none"};
  // Un alias appris exact a la priorité maximale : il correspond à un choix humain antérieur.
  if(learnedTargetNorm && norm(item.name)===learnedTargetNorm){
    best={item,score:1,spoken:spokenList[0],alias:spokenList[0],kind:`alias appris → ${learnedTarget}`};
  }
  // Un alias FR exact doit gagner avant tout fuzzy matching, même si le nom de l'Item
  // comporte un suffixe/préfixe ajouté par D&D5e ou un module.
  if(exactCanonicalNorm && best.score<1){
    const ib=baseItemName(item.name);
    if(ib===exactCanonicalNorm || ib.includes(exactCanonicalNorm) || exactCanonicalNorm.includes(ib)){
      best={item,score:1,spoken:spokenList[0],alias:spokenList[0],kind:`alias exact → ${exactCanonical}`};
    }
  }
  for(const spoken of spokenList){
   const direct=matchScore(item.name,spoken,true);
   if(direct>best.score)best={item,score:direct,spoken,alias:item.name,kind:"name"};
   for(const alias of aliasesFor(item).filter(a=>norm(a)!==norm(item.name))){
    const s=matchScore(alias,spoken,false);
    if(s>best.score)best={item,score:s,spoken,alias,kind:"alias"};
   }
  }
  ranked.push(best);
 }
 return ranked.sort((a,b)=>b.score-a.score);
}
function previewCommand(spoken){
 const repeat=repeatCount(spoken);
 if(repeat){showLive(spoken,lastAction?.item?`Répéter : ${lastAction.item.name}${repeat>1?` ×${repeat}`:""}`:"Aucune action à répéter",lastAction?.item?1:null,true);return}
 const actor=selectedActor(false);if(!actor)return;
 const best=rankFor(actor,[spoken])[0];
 showLive(spoken,best?.item?.name||"—",best?.score??null,true);
}

async function resolveCommand(alts,t0){
 const heard=(alts?.[0]||"").trim();
 const repeat=repeatCount(heard);
 if(repeat){
   showLive(heard,lastAction?.item?`Répéter : ${lastAction.item.name}${repeat>1?` ×${repeat}`:""}`:"Aucune action à répéter",lastAction?.item?1:null,false);
   await repeatLastAction(repeat);
   return;
 }
 const actor=selectedActor();if(!actor)return;
 const items=candidates(actor);if(!items.length){ui.notifications.error("Use Your Voice : aucun sort ou objet utilisable trouvé sur ce personnage.");return}
 // IMPORTANT : la décision se base sur la transcription principale uniquement.
 // Les alternatives SpeechRecognition sont souvent phonétiquement éloignées et pouvaient
 // faire gagner un autre objet (ex. Fireball -> Wall of Fire, Longsword -> Tongues).
 const ranked=rankFor(actor,[heard]);
 const best=ranked[0],second=ranked[1],elapsed=Math.round((performance.now()-t0)*10)/10;
 const threshold=game.settings.get(MOD,"confidence")/100,margin=game.settings.get(MOD,"ambiguity")/100;
 console.log("[Use Your Voice]",{heard,alternatives:alts,elapsedMs:elapsed,results:ranked.slice(0,8).map(x=>({name:x.item.name,score:Math.round(x.score*100),alias:x.alias}))});
 showLive(heard,best.item.name,best.score,false);
 setDebugCandidates(ranked.slice(0,5),best);
 const exact=best.score>=0.999;
 if(!exact && (best.score<threshold || (second&&best.score-second.score<margin))){
   await showSuggestions(heard,ranked.slice(0,5));
   return;
 }
 await execute(best.item,executionMode);
}
function setDebugCandidates(ranked,best){
 const panel=ensureDebugPanel();if(!panel)return;
 const alias=panel.querySelector("[data-uyv-alias]");
 const options=panel.querySelector("[data-uyv-options]");
 if(alias)alias.textContent=best?.alias?`${best.alias} (${best.kind})`:"—";
 if(options)options.textContent=ranked?.length?ranked.map((r,i)=>`${i+1}. ${r.item.name} ${Math.round(r.score*100)} %`).join(" · "):"—";
}
async function showSuggestions(heard,ranked){
 setDebugExecution("Confirmation requise", "—");
 setDebugState("À confirmer");
 setDebugCandidates(ranked,ranked[0]);

 // Le choix est indépendant du mode debug.
 // Si le debug est visible, les boutons sont ajoutés au panneau existant.
 // Sinon, une interface DOM autonome est affichée au centre de Foundry.
 if(game.settings.get(MOD,"showTranscript")){
   const panel=ensureDebugPanel();
   if(panel){
     panel.querySelector(".uyv-inline-confirm")?.remove();
     panel.classList.add("confirming");
     const box=document.createElement("div");
     box.className="uyv-inline-confirm";
     const title=document.createElement("div");
     title.className="uyv-inline-confirm-title";
     title.textContent=`Choisir pour « ${heard} » :`;
     box.appendChild(title);
     ranked.forEach((r,i)=>{
       const b=document.createElement("button");
       b.type="button"; b.className="uyv-inline-choice";
       b.innerHTML=`<span>${i+1}</span><span class="uyv-inline-choice-name"></span><span class="uyv-inline-choice-score">${Math.round(r.score*100)} %</span>`;
       b.querySelector(".uyv-inline-choice-name").textContent=r.item.name;
       b.addEventListener("click",async()=>{
         box.remove(); panel.classList.remove("confirming");
         setDebugState("Choix confirmé"); showLive(heard,r.item.name,r.score,false); setDebugCandidates(ranked,r);
         await learnAlias(heard,r.item);
         await execute(r.item,executionMode);
       });
       box.appendChild(b);
     });
     panel.appendChild(box);
     return;
   }
 }
 return showConfirmationOverlay(heard,ranked);
}

function closeConfirmationOverlay(){
 document.querySelector("#uyv-confirm-overlay")?.remove();
}
async function showConfirmationOverlay(heard,ranked){
 closeConfirmationOverlay();
 const overlay=document.createElement("div");
 overlay.id="uyv-confirm-overlay";
 const win=document.createElement("div"); win.className="uyv-confirm-window";
 const header=document.createElement("div"); header.className="uyv-confirm-header";
 const h=document.createElement("strong"); h.textContent="Use Your Voice — Confirmation";
 const close=document.createElement("button"); close.type="button"; close.className="uyv-confirm-close"; close.title="Annuler"; close.innerHTML='<i class="fas fa-times"></i>';
 header.append(h,close);
 const body=document.createElement("div"); body.className="uyv-confirm-body";
 const heardEl=document.createElement("div"); heardEl.className="uyv-confirm-heard"; heardEl.textContent=`Entendu : « ${heard} »`;
 const help=document.createElement("div"); help.className="uyv-confirm-help"; help.textContent="Choisissez l’action voulue :";
 const choices=document.createElement("div"); choices.className="uyv-confirm-choices";
 ranked.forEach((r,i)=>{
   const b=document.createElement("button"); b.type="button"; b.className="uyv-confirm-choice";
   const idx=document.createElement("span"); idx.className="uyv-confirm-index"; idx.textContent=String(i+1);
   const name=document.createElement("span"); name.className="uyv-confirm-name"; name.textContent=r.item.name;
   const score=document.createElement("span"); score.className="uyv-confirm-score"; score.textContent=`${Math.round(r.score*100)} %`;
   b.append(idx,name,score);
   b.addEventListener("click",async()=>{closeConfirmationOverlay(); await learnAlias(heard,r.item); await execute(r.item,executionMode)});
   choices.appendChild(b);
 });
 body.append(heardEl,help,choices); win.append(header,body); overlay.appendChild(win); document.body.appendChild(overlay);
 close.addEventListener("click",closeConfirmationOverlay);
 overlay.addEventListener("click",e=>{if(e.target===overlay)closeConfirmationOverlay()});
 console.log("[Use Your Voice] Confirmation DOM affichée",ranked.map(r=>({name:r.item.name,score:Math.round(r.score*100)})));
}

function activitiesOf(item){
 const a=item.system?.activities;
 if(!a)return [];
 if(Array.isArray(a.contents))return a.contents;
 if(Array.isArray(a))return a;
 try{return [...a]}catch{}
 if(typeof a.values==="function")try{return [...a.values()]}catch{}
 return [];
}
function setDebugExecution(status,activity="—"){
 const panel=ensureDebugPanel();
 if(!panel)return;
 const a=panel.querySelector("[data-uyv-activity]");
 const e=panel.querySelector("[data-uyv-execution]");
 if(a)a.textContent=activity||"—";
 if(e)e.textContent=status||"—";
}
function hasDamageRoll(activity){
 try{
   const cfg=activity?.getDamageConfig?.({});
   if(cfg?.rolls)return cfg.rolls.length>0;
 }catch(e){console.warn("[Use Your Voice] Vérification dégâts impossible",e)}
 // Older/alternate dnd5e activity implementations may not expose getDamageConfig.
 return !!(activity?.damage?.parts?.length || activity?.damage?.parts?.size);
}
async function autoRollActivity(activity,label){
 const noDialog={configure:false};
 const noMessage={create:true};
 let rolled=false;
 if(activity.type==="attack" && typeof activity.rollAttack==="function"){
   setDebugExecution("Jet d’attaque automatique",label);
   await activity.rollAttack({},noDialog,noMessage); rolled=true;
   if(typeof activity.rollDamage==="function" && hasDamageRoll(activity)){
     setDebugExecution("Jets attaque + dégâts automatiques",label);
     await activity.rollDamage({},noDialog,noMessage);
   }
   return rolled;
 }
 if(["damage","save"].includes(activity.type) && typeof activity.rollDamage==="function" && hasDamageRoll(activity)){
   setDebugExecution("Jet de dégâts automatique",label);
   await activity.rollDamage({},noDialog,noMessage); return true;
 }
 if(activity.type==="heal"){
   const fn=activity.rollHealing??activity.rollHeal;
   if(typeof fn==="function"){
     setDebugExecution("Jet de soins automatique",label);
     await fn.call(activity,{},noDialog,noMessage); return true;
   }
 }
 if(typeof activity.rollFormula==="function"){
   setDebugExecution("Jet automatique",label);
   await activity.rollFormula({},noDialog,noMessage); return true;
 }
 if(typeof activity.roll==="function"){
   setDebugExecution("Jet automatique",label);
   await activity.roll({},noDialog,noMessage); return true;
 }
 return false;
}
async function execute(item,mode="activity",forcedActivityId=null,remember=true){
 try{
   const acts=activitiesOf(item);
   const details=acts.map(a=>`${a.name||"Sans nom"} [${a.type||"?"}]`).join(" | ");
   console.log("[Use Your Voice] Activités détectées",{item:item.name,mode,count:acts.length,activities:acts});
   if(!acts.length)setDebugExecution("Aucune activité détectée","—");
   else setDebugExecution(mode==="auto"?"Activité trouvée — mode automatique":"Activité trouvée",details);

   const activity=(forcedActivityId?acts.find(a=>a.id===forcedActivityId):null)
     ?? acts.find(a=>a.type==="attack")
     ?? acts.find(a=>a.type==="save")
     ?? acts.find(a=>a.type==="damage")
     ?? acts[0];

   if(activity && remember){
     lastAction={item,mode,activityId:activity.id,activityName:`${activity.name||"Sans nom"} [${activity.type||"?"}]`};
     console.log("[Use Your Voice] Dernière action mémorisée",{item:item.name,activityId:activity.id,activity:activity.name,mode});
   }

   if(activity){
     const label=`${activity.name||"Sans nom"} [${activity.type||"?"}]`;
     try{
       if(mode==="auto" && typeof activity.use==="function"){
         // IMPORTANT: when Midi-QOL is active, let Midi own the COMPLETE workflow.
         // Calling activity.use() and then rollAttack()/rollDamage() separately creates
         // disconnected rolls and can bypass DamageBonus/OnUse workflows (Hex, Sneak Attack, etc.).
         const midiActive=game.modules.get("midi-qol")?.active && globalThis.MidiQOL;
         if(midiActive && typeof globalThis.MidiQOL.completeActivityUse==="function"){
           setDebugExecution("Workflow Midi-QOL automatique",label);
           const midiConfig={
             midiOptions:{
               autoRollAttack:true,
               autoRollDamage:"onHit",
               fastForwardAttack:true,
               fastForwardDamage:true,
               workflowOptions:{targetConfirmation:"none"}
             }
           };
           const workflow=await globalThis.MidiQOL.completeActivityUse(activity,midiConfig,{});
           if(workflow===undefined || workflow===null){
             setDebugExecution("Workflow Midi-QOL annulé ou impossible",label);setDebugState("Échec");return;
           }
           setDebugExecution("Workflow Midi-QOL terminé",label);
           setDebugState("Exécuté");stopAfterSuccessfulExecution();return;
         }

         // Fallback when Midi-QOL is not active: use the native D&D5e activity pipeline,
         // then perform the available rolls without configuration dialogs.
         setDebugExecution("Activation automatique sans fenêtre",label);
         const result=await activity.use({subsequentActions:false},{configure:false});
         if(result===undefined){
           setDebugExecution("Activation annulée ou impossible",label);setDebugState("Échec");return;
         }
         const rolled=await autoRollActivity(activity,label);
         setDebugExecution(rolled?"Activité + jets automatiques terminés":"Activité exécutée — aucun jet automatique requis",label);
         setDebugState("Exécuté"); stopAfterSuccessfulExecution(); return;
       }
       if(typeof activity.use==="function"){
         setDebugExecution("Lancement via activity.use()",label);
         await activity.use();
         setDebugExecution("Activité lancée",label);setDebugState("Exécuté");stopAfterSuccessfulExecution();return;
       }
       if(typeof item.use==="function"){
         setDebugExecution("Lancement via item.use(activityId)",label);
         await item.use({activityId:activity.id});
         setDebugExecution("Activité lancée",label);setDebugState("Exécuté");stopAfterSuccessfulExecution();return;
       }
     }catch(activityError){
       console.warn("[Use Your Voice] Échec lancement activité",activityError);
       setDebugExecution(`Échec activité : ${activityError?.message||activityError}`,label);
       if(mode==="auto")throw activityError;
     }
   }
   if(typeof item.use==="function"){
     setDebugExecution("Tentative de repli via item.use()",activity?`${activity.name||"Sans nom"} [${activity.type||"?"}]`:"—");
     await item.use();
     setDebugExecution("Objet lancé via item.use()",activity?`${activity.name||"Sans nom"} [${activity.type||"?"}]`:"—");
     setDebugState("Exécuté");stopAfterSuccessfulExecution();return;
   }
   throw new Error("Aucune méthode d'exécution disponible");
 }catch(e){
   console.error("[Use Your Voice] Échec exécution",item?.name,e);
   setDebugExecution(`ÉCHEC : ${e?.message||e}`);setDebugState("Échec");
   ui.notifications.error(`Use Your Voice : impossible d'utiliser ${item.name}.`);
 }
}
