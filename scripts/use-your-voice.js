import { MOD } from "./constants.js";
import { selectedActor, candidates } from "./actor-items.js";
import { rankFor } from "./matcher.js";
import { repeatCount } from "./text-matching.js";
import { createExecutor } from "./executor.js";
import { showSuggestions } from "./dialogs.js";
import { ensureDebugPanel, setDebugCandidates, setDebugState, showLive } from "./debug-ui.js";
import { enhanceSettingsConfig, refreshMicrophoneChoices, registerSettings } from "./settings.js";

/**
 * Point d'entrée du module.
 * Ce fichier orchestre uniquement Foundry, le microphone et les autres services ;
 * le matching, l'UI, les alias et l'exécution D&D5e vivent dans des fichiers dédiés.
 */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
let held = false;
let activeUntil = 0;
let restartTimer = null;
let manualStop = false;
let executionMode = "activity";
let commandInFlight = false;

/** Arrête le Push-to-activate après une exécution réussie, comme dans la version d'origine. */
function stopAfterSuccessfulExecution() {
  if (game.settings.get(MOD, "activationMode") !== "activate") return;
  stopListening();
  console.log("[Use Your Voice] Push-to-activate : microphone désactivé après exécution de l’activité.");
}

const executor = createExecutor({ stopAfterSuccessfulExecution });

/** Enregistrement Foundry : settings et deux raccourcis correspondant aux modes manuel/automatique. */
Hooks.once("init", () => {
  registerSettings();
  bindVoiceKey("ptt", "Micro — activité seulement", "Reconnaît la commande puis lance l’activité Foundry normalement.", { key:"Digit1", modifiers:[] }, "activity");
  bindVoiceKey("pttAuto", "Micro — jets automatiques", "Reconnaît la commande, utilise l’activité puis lance automatiquement les jets sans fenêtre de configuration.", { key:"Digit2", modifiers:[] }, "auto");
});

/** Une fois Foundry prêt : microphones, reconnaissance navigateur et bouton flottant. */
Hooks.once("ready", async () => {
  await refreshMicrophoneChoices();
  setupRecognition();
  addButton();
});

Hooks.on("renderSettingsConfig", enhanceSettingsConfig);

/** Lie une touche Foundry au démarrage/arrêt de la reconnaissance et fixe le mode d'exécution courant. */
function bindVoiceKey(id, name, hint, defaultBinding, mode) {
  game.keybindings.register(MOD, id, {
    name, hint, editable:[defaultBinding], restricted:false,
    onDown: () => {
      executionMode = mode;
      const activation = game.settings.get(MOD, "activationMode");
      if (activation === "activate") {
        if (!held) { held = true; activateForDuration(); }
        return true;
      }
      if (!held) { held = true; manualStop = false; activeUntil = 0; startListening(); }
      return true;
    },
    onUp: () => {
      const activation = game.settings.get(MOD, "activationMode");
      if (activation === "activate") { held = false; return true; }
      held = false; activeUntil = 0; stopListening(); setDebugState("Terminé");
      return true;
    }
  });
}

/** Configure l'API Web Speech et transforme ses événements en prévisualisation puis résolution de commande. */
function setupRecognition() {
  if (!SpeechRecognition) {
    ui.notifications.error("Use Your Voice : reconnaissance vocale indisponible dans ce navigateur.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 10;

  recognition.onstart = () => { listening = true; paint(); showLive("Écoute…", "—", null, true); };
  recognition.onend = () => {
    listening = false; paint();
    const timedActive = game.settings.get(MOD, "activationMode") === "activate" && Date.now() < activeUntil;
    if (timedActive && !manualStop) {
      setDebugState("Écoute…", true);
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => { if (Date.now() < activeUntil && !listening) startRecognitionOnly(); }, 120);
    } else if (held) setDebugState("Traitement…");
    else if (!manualStop) setDebugState("Terminé");
  };
  recognition.onerror = event => {
    listening = false; paint(); setDebugState(`Erreur micro : ${event.error}`);
    ui.notifications.error(`Use Your Voice : erreur micro (${event.error}).`);
  };
  recognition.onresult = event => {
    let interim = "", finalAlternatives = [];
    for (let n = 0; n < event.results.length; n++) {
      const result = event.results[n];
      if (result.isFinal) {
        for (let i = 0; i < result.length; i++) {
          const transcript = result[i].transcript?.trim();
          if (transcript && !finalAlternatives.includes(transcript)) finalAlternatives.push(transcript);
        }
      } else if (result[0]?.transcript) interim += `${result[0].transcript} `;
    }
    const heard = finalAlternatives[0] || interim.trim();
    if (heard) previewCommand(heard);
    if (finalAlternatives.length) resolveCommand(finalAlternatives, performance.now());
  };
}

/** Bouton flottant : il utilise volontairement le mode manuel, comme auparavant. */
function addButton() {
  if (document.querySelector("#uyv-mic")) return;
  const button = document.createElement("button");
  button.id = "uyv-mic"; button.title = "Use Your Voice"; button.innerHTML = '<i class="fas fa-microphone"></i>';
  button.onclick = () => {
    executionMode = "activity";
    if (game.settings.get(MOD, "activationMode") === "activate") activateForDuration();
    else listening ? stopListening() : startListening();
  };
  document.body.appendChild(button);
}

/** Reflète visuellement l'état actif du micro sur le bouton flottant. */
function paint() {
  const active = listening || (game.settings.get(MOD, "activationMode") === "activate" && Date.now() < activeUntil);
  document.querySelector("#uyv-mic")?.classList.toggle("listening", active);
}

/** Démarre uniquement l'API SpeechRecognition, sans redemander l'accès au périphérique. */
function startRecognitionOnly() {
  if (!recognition || listening) return;
  try { manualStop = false; recognition.start(); }
  catch (error) { console.warn("[Use Your Voice] Impossible de relancer la reconnaissance", error); }
}

/** Vérifie l'accès au microphone sélectionné avant de démarrer la reconnaissance. */
async function startListening() {
  if (!recognition || listening) return;
  try {
    manualStop = false;
    const id = game.settings.get(MOD, "microphoneId").trim();
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia(id ? { audio:{ deviceId:{ exact:id } } } : { audio:true });
      stream.getTracks().forEach(track => track.stop());
    }
    startRecognitionOnly();
  } catch (error) {
    console.error("[UYV]", error);
    ui.notifications.error("Use Your Voice : impossible d'accéder au microphone.");
  }
}

/** Active l'écoute pendant N secondes et relance SpeechRecognition tant que la fenêtre reste ouverte. */
async function activateForDuration() {
  const seconds = Math.max(1, Number(game.settings.get(MOD, "activationDuration")) || 5);
  activeUntil = Date.now() + seconds * 1000; manualStop = false; held = false;
  clearTimeout(restartTimer); setDebugState(`Actif ${seconds} s`, true); paint();
  if (!listening) await startListening();
  restartTimer = setTimeout(() => { activeUntil = 0; stopListening(); setDebugState("Terminé"); paint(); }, seconds * 1000 + 25);
}

/** Arrêt centralisé du micro et des timers de réactivation. */
function stopListening() {
  manualStop = true; activeUntil = 0; clearTimeout(restartTimer); restartTimer = null;
  try { if (recognition && listening) recognition.stop(); } catch (_) {}
  paint();
}

/** Prévisualise le meilleur résultat pendant que l'utilisateur parle, sans exécuter d'action. */
function previewCommand(spoken) {
  const repeat = repeatCount(spoken);
  const lastAction = executor.getLastAction();
  if (repeat) {
    showLive(spoken, lastAction?.item ? `Répéter : ${lastAction.item.name}${repeat > 1 ? ` ×${repeat}` : ""}` : "Aucune action à répéter", lastAction?.item ? 1 : null, true);
    return;
  }
  const actor = selectedActor(false); if (!actor) return;
  const best = rankFor(actor, [spoken])[0];
  showLive(spoken, best?.item?.name || "—", best?.score ?? null, true);
}

/**
 * Résout la transcription finale : répétition, ranking, seuil de confiance,
 * confirmation éventuelle, puis exécution de l'Item/activité retenu.
 */
async function resolveCommand(alternatives, startedAt) {
  if (commandInFlight) {
    console.log("[Use Your Voice] Commande ignorée : une activité est déjà en cours d'exécution.");
    return;
  }

  const heard = (alternatives?.[0] || "").trim();
  const repeat = repeatCount(heard);
  if (repeat) {
    const lastAction = executor.getLastAction();
    showLive(heard, lastAction?.item ? `Répéter : ${lastAction.item.name}${repeat > 1 ? ` ×${repeat}` : ""}` : "Aucune action à répéter", lastAction?.item ? 1 : null, false);
    commandInFlight = true;
    try { await executor.repeatLastAction(repeat); }
    finally { commandInFlight = false; }
    return;
  }

  const actor = selectedActor(); if (!actor) return;
  const items = candidates(actor);
  if (!items.length) { ui.notifications.error("Use Your Voice : aucun sort ou objet utilisable trouvé sur ce personnage."); return; }

  // Seule la transcription principale décide : les alternatives SpeechRecognition peuvent être très éloignées.
  const ranked = rankFor(actor, [heard]);
  const best = ranked[0], second = ranked[1];
  const elapsed = Math.round((performance.now() - startedAt) * 10) / 10;
  const threshold = game.settings.get(MOD, "confidence") / 100;
  const margin = game.settings.get(MOD, "ambiguity") / 100;
  console.log("[Use Your Voice]", { heard, alternatives, elapsedMs:elapsed, results:ranked.slice(0,8).map(result => ({ name:result.item.name, score:Math.round(result.score*100), alias:result.alias })) });

  showLive(heard, best.item.name, best.score, false);
  setDebugCandidates(ranked.slice(0, 5), best);
  const exact = best.score >= 0.999;
  if (!exact && (best.score < threshold || (second && best.score - second.score < margin))) {
    await showSuggestions(heard, ranked.slice(0, 5), async result => {
      if (commandInFlight) return;
      commandInFlight = true;
      try {
        await executor.execute(result.item, executionMode, result.activityId ?? null);
      } finally {
        commandInFlight = false;
      }
    });
    return;
  }

  commandInFlight = true;
  try {
    await executor.execute(best.item, executionMode, best.activityId ?? null);
  } finally {
    commandInFlight = false;
  }
}
