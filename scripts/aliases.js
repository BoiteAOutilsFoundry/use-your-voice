import { DEFAULT_ALIASES } from "./default-aliases.js";
import { MOD } from "./constants.js";
import { baseItemName, clean, compactName, norm, sameItemName } from "./text-matching.js";

/** Lit les alias personnalisés sans laisser une erreur JSON casser la reconnaissance. */
export function customAliases() {
  try { return JSON.parse(game.settings.get(MOD, "customAliases") || "{}"); } catch (_) { return {}; }
}

/** Lit les alias appris à partir des confirmations manuelles de l'utilisateur. */
export function learnedAliases() {
  try { return JSON.parse(game.settings.get(MOD, "learnedAliases") || "{}"); } catch (_) { return {}; }
}

/** Cherche si la phrase correspond exactement à un alias livré avec le module ou personnalisé. */
export function canonicalFromExactAlias(spoken) {
  const cleaned = clean(spoken);
  if (!cleaned) return null;
  for (const source of [DEFAULT_ALIASES, customAliases()]) {
    for (const [canonical, values] of Object.entries(source || {})) {
      const aliases = Array.isArray(values) ? values : [values];
      if (aliases.some(alias => clean(alias) === cleaned)) return canonical;
    }
  }
  return null;
}

/** Alias génériques d'attaque adaptés au type d'arme (tir, lancer ou corps-à-corps). */
function genericWeaponAliases(item) {
  if (item?.type !== "weapon") return [];
  const name = baseItemName(item.name);
  const ranged = ["bow","crossbow","blowgun","sling","dart","pistol","musket","firearm","rifle","revolver","shotgun","arquebus","arc","arbalete","sarbacane","fronde","flechette","pistolet","mousquet","fusil"];
  const thrown = ["javelin","spear","trident","net","javeline","lance","trident","filet"];
  const isRanged = ranged.some(k => name.includes(k));
  const isThrown = !isRanged && thrown.some(k => name.includes(k));
  if (isRanged) return ["je tire","tire","je fais feu","fais feu","je tire dessus","tire dessus","I shoot","shoot","I fire","fire","take a shot","I take a shot"];
  if (isThrown) return ["je lance","lance","je jette","jette","je lance dessus","I throw","throw","I hurl","hurl"];
  return ["je frappe","frappe","je donne un coup","donne un coup","je donne un coup avec mon arme","attaque au corps a corps","I hit","hit","I strike","strike","I attack","attack","I swing","swing","I take a swing"];
}

/** Mémorise une transcription validée manuellement et garantit qu'elle ne pointe que vers un seul Item. */
export async function learnAlias(heard, item) {
  const raw = String(heard ?? "").trim();
  const normalized = clean(raw);
  if (!raw || !normalized || !item?.name) return;

  const learned = learnedAliases();
  for (const [key, values] of Object.entries(learned)) {
    const filtered = (Array.isArray(values) ? values : [values]).filter(value => clean(value) !== normalized);
    if (filtered.length) learned[key] = filtered; else delete learned[key];
  }

  const key = item.name;
  const aliases = Array.isArray(learned[key]) ? learned[key] : learned[key] ? [learned[key]] : [];
  if (!aliases.some(value => clean(value) === normalized)) aliases.push(raw);
  learned[key] = aliases;
  await game.settings.set(MOD, "learnedAliases", JSON.stringify(learned, null, 2));
  console.log("[Use Your Voice] Alias appris", { heard: raw, item: item.name });
}

/** Retourne la cible d'un alias appris uniquement lorsque la transcription est exacte. */
export function learnedTargetFromExactAlias(spoken) {
  const cleaned = clean(spoken);
  if (!cleaned) return null;
  for (const [target, values] of Object.entries(learnedAliases())) {
    const aliases = Array.isArray(values) ? values : [values];
    if (aliases.some(alias => clean(alias) === cleaned)) return target;
  }
  return null;
}

/** Construit toutes les formulations acceptées pour un Item donné. */
export function aliasesFor(item) {
  const result = [item.name];
  const custom = customAliases(), learned = learnedAliases();
  const itemBase = baseItemName(item.name);
  const canonical = Object.keys(DEFAULT_ALIASES).find(key => {
    const normalized = norm(key);
    const compactKey = compactName(key);
    const compactItem = compactName(itemBase);
    return sameItemName(key, item.name)
      || normalized === itemBase
      || itemBase.includes(normalized)
      || normalized.includes(itemBase)
      || compactItem.includes(compactKey)
      || compactKey.includes(compactItem);
  });
  if (canonical) result.push(...DEFAULT_ALIASES[canonical]);
  for (const [key, values] of Object.entries(custom)) if (norm(key) === norm(item.name)) result.push(...(Array.isArray(values) ? values : [values]));
  for (const [key, values] of Object.entries(learned)) if (norm(key) === norm(item.name)) result.push(...(Array.isArray(values) ? values : [values]));
  result.push(...genericWeaponAliases(item));
  return [...new Set(result.filter(Boolean))];
}
