import { MOD } from "./constants.js";

let debugPanel = null;

/** Ferme complètement le panneau de diagnostic vocal. */
export function closeLive() {
  if (debugPanel) { debugPanel.remove(); debugPanel = null; }
}

/** Crée le panneau de debug à la demande et le rend déplaçable. */
export function ensureDebugPanel() {
  if (!game.settings.get(MOD, "showTranscript")) return null;
  if (debugPanel?.isConnected) return debugPanel;

  debugPanel = document.createElement("section");
  debugPanel.id = "uyv-debug-panel";
  debugPanel.innerHTML = `
    <div class="uyv-debug-head"><i class="fas fa-microphone"></i><strong>Use Your Voice</strong><span class="uyv-debug-state">Écoute…</span><button type="button" class="uyv-debug-close" title="Fermer" aria-label="Fermer"><i class="fas fa-times"></i></button></div>
    <div class="uyv-debug-row"><span>Entendu</span><strong data-uyv-heard>…</strong></div>
    <div class="uyv-debug-row"><span>Interprété</span><strong data-uyv-match>—</strong></div>
    <div class="uyv-debug-row"><span>Confiance</span><strong data-uyv-score>—</strong></div>
    <div class="uyv-debug-row"><span>Correspondance</span><strong data-uyv-alias>—</strong></div>
    <div class="uyv-debug-row"><span>Propositions</span><strong data-uyv-options>—</strong></div>
    <div class="uyv-debug-row"><span>Activité</span><strong data-uyv-activity>—</strong></div>
    <div class="uyv-debug-row"><span>Exécution</span><strong data-uyv-execution>—</strong></div>`;
  document.body.appendChild(debugPanel);
  debugPanel.querySelector(".uyv-debug-close")?.addEventListener("click", event => { event.stopPropagation(); closeLive(); });
  makeDraggable(debugPanel);
  return debugPanel;
}

/** Gestion isolée du drag du panneau afin que l'UI de debug ne pollue pas la logique vocale. */
function makeDraggable(panel) {
  const handle = panel.querySelector(".uyv-debug-head");
  if (!handle) return;
  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    dragging = true; startX = event.clientX; startY = event.clientY; startLeft = rect.left; startTop = rect.top;
    panel.style.left = `${rect.left}px`; panel.style.top = `${rect.top}px`; panel.style.right = "auto"; panel.style.bottom = "auto";
    handle.setPointerCapture?.(event.pointerId); event.preventDefault();
  });
  handle.addEventListener("pointermove", event => {
    if (!dragging) return;
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
    panel.style.left = `${Math.min(maxLeft, Math.max(0, startLeft + event.clientX - startX))}px`;
    panel.style.top = `${Math.min(maxTop, Math.max(0, startTop + event.clientY - startY))}px`;
  });
  const stop = event => { if (!dragging) return; dragging = false; try { handle.releasePointerCapture?.(event.pointerId); } catch (_) {} };
  handle.addEventListener("pointerup", stop); handle.addEventListener("pointercancel", stop);
}

/** Met à jour uniquement l'état général du panneau : écoute, traitement, terminé, erreur... */
export function setDebugState(label, listening = false) {
  const panel = ensureDebugPanel();
  if (!panel) return;
  panel.querySelector(".uyv-debug-state").textContent = label;
  panel.classList.toggle("listening", !!listening);
}

/** Affiche la transcription courante et le meilleur résultat de matching. */
export function showLive(heard, interpreted, scoreValue = null, listeningNow = false) {
  if (!game.settings.get(MOD, "showTranscript")) return;
  const panel = ensureDebugPanel(); if (!panel) return;
  panel.querySelector("[data-uyv-heard]").textContent = heard || "…";
  panel.querySelector("[data-uyv-match]").textContent = interpreted || "—";
  panel.querySelector("[data-uyv-score]").textContent = scoreValue === null ? "—" : `${Math.round(scoreValue * 100)} %`;
  panel.querySelector(".uyv-debug-state").textContent = listeningNow ? "Écoute…" : "Terminé";
  panel.classList.toggle("listening", !!listeningNow);
}

/** Affiche la correspondance retenue et les meilleures propositions de la recherche. */
export function setDebugCandidates(ranked, best) {
  const panel = ensureDebugPanel(); if (!panel) return;
  const alias = panel.querySelector("[data-uyv-alias]");
  const options = panel.querySelector("[data-uyv-options]");
  if (alias) alias.textContent = best?.alias ? `${best.alias} (${best.kind})` : "—";
  if (options) options.textContent = ranked?.length ? ranked.map((r, i) => `${i + 1}. ${r.item.name} ${Math.round(r.score * 100)} %`).join(" · ") : "—";
}

/** Affiche l'activité D&D5e choisie et l'étape d'exécution courante. */
export function setDebugExecution(status, activity = "—") {
  const panel = ensureDebugPanel();
  if (!panel) return;
  const activityEl = panel.querySelector("[data-uyv-activity]");
  const executionEl = panel.querySelector("[data-uyv-execution]");
  if (activityEl) activityEl.textContent = activity || "—";
  if (executionEl) executionEl.textContent = status || "—";
}
