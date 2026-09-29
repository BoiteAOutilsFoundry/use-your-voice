import { INVENTORY_TYPES } from "./constants.js";

/**
 * Retourne l'acteur à utiliser : token contrôlé en priorité, puis personnage lié à l'utilisateur.
 * Refuse volontairement plusieurs tokens pour éviter de lancer une action sur le mauvais acteur.
 */
export function selectedActor(notify = true) {
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length === 1) return controlled[0].actor;
  if (controlled.length > 1) {
    if (notify) ui.notifications.error("Use Your Voice : plusieurs personnages sont sélectionnés. Sélectionnez-en un seul.");
    return null;
  }
  if (game.user.character) return game.user.character;
  if (notify) ui.notifications.error("Use Your Voice : aucun personnage sélectionné et aucun personnage lié à votre utilisateur.");
  return null;
}

/**
 * Indique si une activité est réservée à l'automatisation interne de Midi-QOL.
 *
 * Midi-QOL a fait évoluer le stockage de cette option selon ses versions :
 * - anciennes versions 12.4.x : `midiAutomationOnly` ;
 * - versions récentes : `midiProperties.automationOnly`.
 *
 * Les chemins de flags sont conservés comme sécurité pour les documents migrés.
 */
export function isMidiAutomationOnly(activity) {
  if (!activity) return false;

  return activity.midiAutomationOnly === true
    || activity.midiProperties?.automationOnly === true
    || activity.flags?.["midi-qol"]?.automationOnly === true
    || activity.flags?.["midi-qol"]?.midiAutomationOnly === true;
}

/** Vérifie qu'un Item possède au moins une activité utilisable par Use Your Voice. */
export function hasActivity(item) {
  const activities = activitiesOf(item);
  if (activities.length > 0) return true;

  // Compatibilité avec les Items plus anciens qui exposent directement item.use().
  return !item.system?.activities && typeof item.use === "function";
}

/**
 * Filtre les objets d'inventaire utilisables à la voix.
 * Aucun traitement selon l'équipement ou le type d'arme : si l'Item possède
 * une activité exploitable, Use Your Voice peut la lancer. C'est l'activité
 * D&D5e elle-même qui décide ensuite si son usage est autorisé.
 */
export function isAvailableInventoryItem(item) {
  return INVENTORY_TYPES.has(item.type) && hasActivity(item);
}

/** Retourne tous les sorts, compétences et objets pouvant participer à la recherche vocale. */
export function candidates(actor) {
  return actor.items.filter(item => item.type === "spell" || isAvailableInventoryItem(item));
}

/** Normalise les différentes formes de collection utilisées par D&D5e pour exposer les activités. */
export function activitiesOf(item) {
  const activities = item.system?.activities;
  if (!activities) return [];

  let list = [];
  if (Array.isArray(activities.contents)) list = activities.contents;
  else if (Array.isArray(activities)) list = activities;
  else {
    try { list = [...activities]; } catch (_) {}
    if (list.length === 0 && typeof activities.values === "function") {
      try { list = [...activities.values()]; } catch (_) {}
    }
  }

  // Les activités "Automation Only" sont des briques internes Midi-QOL :
  // elles ne doivent ni être reconnues vocalement, ni apparaître dans un choix.
  return list.filter(activity => !isMidiAutomationOnly(activity));
}
