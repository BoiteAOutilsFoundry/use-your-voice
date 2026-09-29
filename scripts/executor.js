import { activitiesOf } from "./actor-items.js";
import { chooseActivity } from "./dialogs.js";
import { setDebugExecution, setDebugState } from "./debug-ui.js";

/**
 * Exécute une activité en mode automatique.
 *
 * Important : Use Your Voice ne lance aucun jet lui-même. Il transmet uniquement
 * à Midi-QOL les paramètres du workflow automatique. Midi-QOL/D&D5e restent
 * responsables de l’attaque, des dégâts, de la consommation, de la concentration
 * et des éventuels templates définis par l’activité.
 */
async function executeAutomatic(activity, label) {
  if (typeof activity?.use !== "function") return false;

  setDebugExecution("Activité automatique", label);

  // D&D5e/Midi-QOL 12.4.x : on lance l'activité elle-même et on ne reconstruit
  // jamais son comportement. Midi-QOL intercepte activity.use() et applique
  // uniquement les options d'automatisation demandées ici.
  const usage = {
    midiOptions: {
      autoRollAttack: true,
      autoRollDamage: "onHit",
      fastForward: true,
      fastForwardAttack: true,
      fastForwardDamage: true,
      workflowOptions: {
        targetConfirmation: "none"
      }
    }
  };

  const result = await activity.use(
    usage,
    { configure: false },
    { create: true }
  );

  if (result === undefined || result === null) return false;
  setDebugExecution("Activité automatique terminée", label);
  return true;
}


/**
 * Options du mode manuel.
 *
 * Midi-QOL hérite sinon des réglages globaux du joueur/GM et peut lancer
 * automatiquement l'attaque puis les dégâts, même si Use Your Voice ne le
 * demande pas. On force donc ici le workflow Midi à rester manuel tout en
 * laissant activity.use() gérer normalement consommation, concentration,
 * gabarit et carte de chat.
 */
function manualUsageOptions() {
  return {
    // D&D5e crée la consommation, concentration, template et carte de chat,
    // mais ne déclenche pas l'action principale (attaque/dégâts) automatiquement.
    subsequentActions: false,
    midiOptions: {
      autoRollAttack: false,
      autoRollDamage: "none"
    }
  };
}

/**
 * Fabrique le moteur d'exécution et encapsule la mémoire de la dernière action.
 * Le callback stopAfterSuccessfulExecution évite de coupler ce fichier au contrôleur micro.
 */
export function createExecutor({ stopAfterSuccessfulExecution }) {
  let lastAction = null;

  function getLastAction() { return lastAction; }

  async function repeatLastAction(count) {
    if (!lastAction?.item) {
      ui.notifications.warn("Use Your Voice : aucune action précédente à répéter.");
      setDebugState("Aucune action à répéter");
      return;
    }
    const total = Math.max(1, Math.min(5, Number(count) || 1));
    console.log("[Use Your Voice] Répétition de la dernière action", { item: lastAction.item.name, activityId: lastAction.activityId, mode: lastAction.mode, count: total });
    for (let i = 0; i < total; i++) {
      setDebugExecution(`Répétition ${i + 1}/${total}`, lastAction.activityName || lastAction.item.name);
      await execute(lastAction.item, lastAction.mode, lastAction.activityId, false);
    }
  }

  /** Sélectionne l'activité puis l'exécute en mode manuel ou automatique. */
  async function execute(item, mode = "activity", forcedActivityId = null, remember = true) {
    try {
      const activities = activitiesOf(item);
      const details = activities.map(activity => `${activity.name || "Sans nom"} [${activity.type || "?"}]`).join(" | ");
      console.log("[Use Your Voice] Activités détectées", { item: item.name, mode, count: activities.length, activities });
      if (!activities.length) setDebugExecution("Aucune activité détectée", "—");
      else setDebugExecution(mode === "auto" ? "Activité trouvée — mode automatique" : "Activité trouvée", details);

      let activity = null;
      if (forcedActivityId) activity = activities.find(candidate => candidate.id === forcedActivityId) ?? null;
      else if (activities.length === 1) activity = activities[0];
      else if (activities.length > 1) {
        activity = await chooseActivity(item, activities);
        if (!activity) { setDebugExecution("Choix de l’activité annulé", "—"); setDebugState("Annulé"); return; }
      }

      if (activity && remember) {
        lastAction = { item, mode, activityId: activity.id, activityName: `${activity.name || "Sans nom"} [${activity.type || "?"}]` };
        console.log("[Use Your Voice] Dernière action mémorisée", { item: item.name, activityId: activity.id, activity: activity.name, mode });
      }

      if (activity) {
        const label = `${activity.name || "Sans nom"} [${activity.type || "?"}]`;
        try {
          if (mode === "auto" && typeof activity.use === "function") {
            const success = await executeAutomatic(activity, label);
            if (!success) { setDebugExecution("Activation annulée ou impossible", label); setDebugState("Échec"); return; }
            setDebugState("Exécuté"); stopAfterSuccessfulExecution(); return;
          }

          // Mode manuel : on lance bien l'activité complète, mais on surcharge
          // explicitement l'automatisation Midi-QOL pour que les réglages globaux
          // "Auto roll attack/damage" ne déclenchent pas les jets à notre place.
          if (typeof activity.use === "function") {
            setDebugExecution("Lancement manuel via activity.use()", label);
            await activity.use(manualUsageOptions(), { configure: true }, { create: true });
            setDebugExecution("Activité lancée — attaque/dégâts manuels", label); setDebugState("Exécuté"); stopAfterSuccessfulExecution(); return;
          }
          if (typeof item.use === "function") {
            setDebugExecution("Lancement manuel via item.use(activityId)", label);
            const usage = manualUsageOptions();
            usage.midiOptions.activityId = activity.id;
            await item.use(usage, { configure: true }, { create: true });
            setDebugExecution("Activité lancée — attaque/dégâts manuels", label); setDebugState("Exécuté"); stopAfterSuccessfulExecution(); return;
          }
        } catch (activityError) {
          console.warn("[Use Your Voice] Échec lancement activité", activityError);
          setDebugExecution(`Échec activité : ${activityError?.message || activityError}`, label);
          // Ne jamais relancer silencieusement le même objet avec item.use() après
          // un échec : l'activité peut déjà avoir créé son workflow Midi et ce
          // second appel réactiverait les jets automatiques / doublerait la conso.
          throw activityError;
        }
      }

      // Repli de compatibilité pour les Items sans activité exploitable mais possédant item.use().
      if (typeof item.use === "function") {
        const label = "—";
        setDebugExecution(mode === "auto" ? "Tentative de repli via item.use()" : "Tentative de repli manuel via item.use()", label);
        if (mode === "auto") await item.use();
        else await item.use(manualUsageOptions(), { configure: true }, { create: true });
        setDebugExecution("Objet lancé via item.use()", label);
        setDebugState("Exécuté"); stopAfterSuccessfulExecution(); return;
      }
      throw new Error("Aucune méthode d'exécution disponible");
    } catch (error) {
      console.error("[Use Your Voice] Échec exécution", item?.name, error);
      setDebugExecution(`ÉCHEC : ${error?.message || error}`); setDebugState("Échec");
      ui.notifications.error(`Use Your Voice : impossible d'utiliser ${item.name}.`);
    }
  }

  return { execute, repeatLastAction, getLastAction };
}
