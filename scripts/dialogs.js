import { MOD } from "./constants.js";
import { ensureDebugPanel, setDebugCandidates, setDebugExecution, setDebugState, showLive } from "./debug-ui.js";
import { learnAlias } from "./aliases.js";

/** Ferme la popup centrale partagée par les confirmations et choix d'activité. */
export function closeConfirmationOverlay() {
  document.querySelector("#uyv-confirm-overlay")?.remove();
}

/**
 * Demande à l'utilisateur de confirmer un Item lorsque la reconnaissance est ambiguë.
 * executeChoice est injecté pour garder cette UI indépendante du moteur d'exécution.
 */
export async function showSuggestions(heard, ranked, executeChoice) {
  setDebugExecution("Confirmation requise", "—");
  setDebugState("À confirmer");
  setDebugCandidates(ranked, ranked[0]);

  // Avec le debug actif, les choix sont ajoutés directement au panneau existant.
  if (game.settings.get(MOD, "showTranscript")) {
    const panel = ensureDebugPanel();
    if (panel) {
      panel.querySelector(".uyv-inline-confirm")?.remove();
      panel.classList.add("confirming");
      const box = document.createElement("div"); box.className = "uyv-inline-confirm";
      const title = document.createElement("div"); title.className = "uyv-inline-confirm-title"; title.textContent = `Choisir pour « ${heard} » :`;
      box.appendChild(title);
      ranked.forEach((result, index) => {
        const button = document.createElement("button"); button.type = "button"; button.className = "uyv-inline-choice";
        button.innerHTML = `<span>${index + 1}</span><span class="uyv-inline-choice-name"></span><span class="uyv-inline-choice-score">${Math.round(result.score * 100)} %</span>`;
        button.querySelector(".uyv-inline-choice-name").textContent = result.item.name;
        button.addEventListener("click", async () => {
          box.remove(); panel.classList.remove("confirming");
          setDebugState("Choix confirmé"); showLive(heard, result.item.name, result.score, false); setDebugCandidates(ranked, result);
          await learnAlias(heard, result.item);
          await executeChoice(result);
        });
        box.appendChild(button);
      });
      panel.appendChild(box);
      return;
    }
  }

  return showConfirmationOverlay(heard, ranked, executeChoice);
}

/** Popup autonome utilisée lorsque le panneau de debug n'est pas affiché. */
async function showConfirmationOverlay(heard, ranked, executeChoice) {
  closeConfirmationOverlay();
  const overlay = document.createElement("div"); overlay.id = "uyv-confirm-overlay";
  const win = document.createElement("div"); win.className = "uyv-confirm-window";
  const header = document.createElement("div"); header.className = "uyv-confirm-header";
  const title = document.createElement("strong"); title.textContent = "Use Your Voice — Confirmation";
  const close = document.createElement("button"); close.type = "button"; close.className = "uyv-confirm-close"; close.title = "Annuler"; close.innerHTML = '<i class="fas fa-times"></i>';
  header.append(title, close);

  const body = document.createElement("div"); body.className = "uyv-confirm-body";
  const heardEl = document.createElement("div"); heardEl.className = "uyv-confirm-heard"; heardEl.textContent = `Entendu : « ${heard} »`;
  const help = document.createElement("div"); help.className = "uyv-confirm-help"; help.textContent = "Choisissez l’action voulue :";
  const choices = document.createElement("div"); choices.className = "uyv-confirm-choices";

  ranked.forEach((result, index) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "uyv-confirm-choice";
    const idx = document.createElement("span"); idx.className = "uyv-confirm-index"; idx.textContent = String(index + 1);
    const name = document.createElement("span"); name.className = "uyv-confirm-name"; name.textContent = result.item.name;
    const score = document.createElement("span"); score.className = "uyv-confirm-score"; score.textContent = `${Math.round(result.score * 100)} %`;
    button.append(idx, name, score);
    button.addEventListener("click", async () => { closeConfirmationOverlay(); await learnAlias(heard, result.item); await executeChoice(result); });
    choices.appendChild(button);
  });

  body.append(heardEl, help, choices); win.append(header, body); overlay.appendChild(win); document.body.appendChild(overlay);
  close.addEventListener("click", closeConfirmationOverlay);
  overlay.addEventListener("click", event => { if (event.target === overlay) closeConfirmationOverlay(); });
  console.log("[Use Your Voice] Confirmation DOM affichée", ranked.map(result => ({ name: result.item.name, score: Math.round(result.score * 100) })));
}

/** Demande explicitement quelle activité utiliser lorsqu'un Item en contient plusieurs. */
export async function chooseActivity(item, activities) {
  return new Promise(resolve => {
    closeConfirmationOverlay();
    const overlay = document.createElement("div"); overlay.id = "uyv-confirm-overlay";
    const win = document.createElement("div"); win.className = "uyv-confirm-window";
    const header = document.createElement("div"); header.className = "uyv-confirm-header";
    const title = document.createElement("strong"); title.textContent = "Use Your Voice — Choix de l’activité";
    const close = document.createElement("button"); close.type = "button"; close.className = "uyv-confirm-close"; close.title = "Annuler"; close.innerHTML = '<i class="fas fa-times"></i>';
    header.append(title, close);

    const body = document.createElement("div"); body.className = "uyv-confirm-body";
    const itemName = document.createElement("div"); itemName.className = "uyv-confirm-heard"; itemName.textContent = item.name;
    const help = document.createElement("div"); help.className = "uyv-confirm-help"; help.textContent = "Cet élément contient plusieurs activités. Choisissez celle à utiliser :";
    const choices = document.createElement("div"); choices.className = "uyv-confirm-choices";
    const finish = value => { overlay.remove(); resolve(value); };

    activities.forEach((activity, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "uyv-confirm-choice";
      const idx = document.createElement("span"); idx.className = "uyv-confirm-index"; idx.textContent = String(index + 1);
      const name = document.createElement("span"); name.className = "uyv-confirm-name"; name.textContent = activity.name || "Sans nom";
      const type = document.createElement("span"); type.className = "uyv-confirm-score"; type.textContent = activity.type || "activité";
      button.append(idx, name, type); button.addEventListener("click", () => finish(activity)); choices.appendChild(button);
    });

    body.append(itemName, help, choices); win.append(header, body); overlay.appendChild(win); document.body.appendChild(overlay);
    close.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
    setDebugExecution("Choix de l’activité requis", activities.map(activity => activity.name || "Sans nom").join(" | "));
  });
}
