import { DEFAULT_ALIASES } from "./default-aliases.js";
import { MOD } from "./constants.js";

/** Enregistre les paramètres client du module. */
export function registerSettings() {
  const settings = [
    ["microphoneId", { name:"Microphone", hint:"Choisissez le périphérique audio utilisé.", scope:"client", config:true, type:String, choices:{"":"Microphone par défaut"}, default:"" }],
    ["showTranscript", { name:"Mode debug vocal", hint:"Pendant l’écoute, affiche une fenêtre mise à jour en temps réel avec le texte entendu, l’interprétation et le score.", scope:"client", config:true, type:Boolean, default:true }],
    ["activationMode", { name:"Mode d’activation", hint:"Push-to-talk : maintenir la touche. Push-to-activate : un appui active l’écoute pendant la durée configurée.", scope:"client", config:true, type:String, choices:{ptt:"Push-to-talk",activate:"Push-to-activate"}, default:"ptt" }],
    ["activationDuration", { name:"Durée Push-to-activate", hint:"Durée pendant laquelle la détection reste active après un appui (en secondes).", scope:"client", config:true, type:Number, default:5, range:{min:1,max:60,step:1} }],
    ["confidence", { name:"Seuil d'exécution automatique", hint:"Score minimum (0 à 100) avant exécution automatique.", scope:"client", config:true, type:Number, default:50, range:{min:0,max:100,step:1} }],
    ["ambiguity", { name:"Marge d'ambiguïté", hint:"Si les deux meilleurs résultats sont séparés de moins de cette valeur, demander confirmation.", scope:"client", config:true, type:Number, default:10, range:{min:0,max:50,step:1} }],
    ["customAliases", { name:"Alias FR / EN", hint:"Liste préremplie : nom anglais → alias français. Vous pouvez la compléter ou la modifier.", scope:"client", config:true, type:String, default:JSON.stringify(DEFAULT_ALIASES,null,2) }],
    ["learnedAliases", { name:"Alias appris", hint:"Alias mémorisés après vos choix manuels dans la fenêtre de confirmation. Ils sont conservés séparément des alias du module et ne sont pas remplacés lors des mises à jour.", scope:"client", config:true, type:String, default:"{}" }]
  ];
  for (const [key, config] of settings) game.settings.register(MOD, key, config);
}

/** Remplace les champs JSON d'alias par des textarea lisibles dans les paramètres Foundry. */
export function enhanceSettingsConfig(_app, html) {
  const root = html?.[0] ?? html;
  for (const settingName of ["customAliases", "learnedAliases"]) {
    const input = root?.querySelector?.(`[name="${MOD}.${settingName}"]`);
    if (!input || input.tagName === "TEXTAREA") continue;
    const textarea = document.createElement("textarea");
    textarea.name = input.name; textarea.className = input.className;
    try { textarea.value = JSON.stringify(JSON.parse(input.value || "{}"), null, 2); } catch (_) { textarea.value = input.value || ""; }
    textarea.spellcheck = false; textarea.wrap = "off"; input.replaceWith(textarea);
  }
}

/** Demande temporairement l'accès audio afin d'obtenir les vrais noms des microphones. */
export async function refreshMicrophoneChoices() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio:true }); stream.getTracks().forEach(track => track.stop()); } catch (_) {}
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "audioinput");
    const setting = game.settings.settings.get(`${MOD}.microphoneId`);
    if (setting) {
      setting.choices = { "":"Microphone par défaut" };
      devices.forEach((device, index) => setting.choices[device.deviceId] = device.label || `Microphone ${index + 1}`);
    }
  } catch (error) {
    console.warn("[Use Your Voice] Impossible de lister les microphones", error);
  }
}
