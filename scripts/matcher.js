import { activitiesOf, candidates } from "./actor-items.js";
import { aliasesFor, canonicalFromExactAlias, learnedTargetFromExactAlias } from "./aliases.js";
import { baseItemName, clean, compactName, matchScore, norm, sameItemName } from "./text-matching.js";

/**
 * Classe les Items de l'acteur pour une ou plusieurs transcriptions.
 * Un nom d'activité exact reçoit un score supérieur à 1 afin de contourner le choix d'activité.
 */
export function rankFor(actor, spokenList) {
  const ranked = [];
  const learnedTarget = learnedTargetFromExactAlias(spokenList?.[0]);
  const learnedTargetNorm = learnedTarget ? norm(learnedTarget) : null;
  const exactCanonical = canonicalFromExactAlias(spokenList?.[0]);
  const exactCanonicalNorm = exactCanonical ? norm(exactCanonical) : null;

  for (const item of candidates(actor)) {
    let best = { item, score: 0, spoken: spokenList[0], alias: item.name, kind: "none", activityId: null };

    // Un alias appris exact reflète un choix humain précédent : priorité maximale.
    if (learnedTargetNorm && norm(item.name) === learnedTargetNorm) {
      best = { item, score: 1, spoken: spokenList[0], alias: spokenList[0], kind: `alias appris → ${learnedTarget}`, activityId: null };
    }

    // Les alias FR exacts passent avant le fuzzy matching, même avec un préfixe +1/+2/+3.
    if (exactCanonicalNorm && best.score < 1) {
      const itemBase = baseItemName(item.name);
      const compactBase = compactName(itemBase);
      const compactCanonical = compactName(exactCanonicalNorm);
      if (sameItemName(item.name, exactCanonical)
        || itemBase === exactCanonicalNorm
        || itemBase.includes(exactCanonicalNorm)
        || exactCanonicalNorm.includes(itemBase)
        || compactBase.includes(compactCanonical)
        || compactCanonical.includes(compactBase)) {
        best = { item, score: 1, spoken: spokenList[0], alias: spokenList[0], kind: `alias exact → ${exactCanonical}`, activityId: null };
      }
    }

    for (const spoken of spokenList) {
      const direct = matchScore(item.name, spoken, true);
      if (direct > best.score) best = { item, score: direct, spoken, alias: item.name, kind: "name", activityId: null };

      for (const alias of aliasesFor(item).filter(value => norm(value) !== norm(item.name))) {
        const score = matchScore(alias, spoken, false);
        if (score > best.score) best = { item, score, spoken, alias, kind: "alias", activityId: null };
      }

      // Dire directement le nom d'une activité doit la lancer sans popup de sélection.
      for (const activity of activitiesOf(item)) {
        const activityName = activity?.name?.trim();
        if (!activityName) continue;
        const exactActivity = clean(activityName) === clean(spoken);
        const score = exactActivity ? 1.001 : matchScore(activityName, spoken, true);
        if (score > best.score) best = { item, score, spoken, alias: activityName, kind: `activité → ${activityName}`, activityId: activity.id };
      }
    }
    ranked.push(best);
  }
  return ranked.sort((a, b) => b.score - a.score);
}
