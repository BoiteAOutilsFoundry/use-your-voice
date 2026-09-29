/** Nettoyage commun : accents, casse et ponctuation sont neutralisés pour la comparaison vocale. */
export function norm(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/** Verbes introductifs ignorés dans une commande : « lance », « utilise », « attaque avec », etc. */
const VERBS = /^(?:(?:ok\s+)?(?:(?:je|j)\s+)?(?:lance|lancer|utilise|utiliser|active|activer|emploie|employer|attaque(?:\s+avec)?|attaquer(?:\s+avec)?|frappe(?:\s+avec)?|tir(?:e|er)(?:\s+avec)?|bois|boire|prends|prendre|fais|faire|cast|caste)\s+)+/i;

/** Retire les mots de commande et déterminants pour ne conserver que le nom utile. */
export function clean(value) {
  return norm(value).replace(VERBS, "").replace(/^(?:mon|ma|mes|le|la|les|un|une|du|de la|des)\s+/, "").trim();
}

/** Distance de Levenshtein, utilisée uniquement comme dernier recours de fuzzy matching. */
function levenshtein(a, b) {
  a = norm(a); b = norm(b);
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i), current = [];
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

/** Similarité Dice sur les bigrammes. Complète Levenshtein pour les transcriptions approximatives. */
function dice(a, b) {
  a = norm(a).replace(/\s/g, ""); b = norm(b).replace(/\s/g, "");
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const map = new Map(); let hits = 0;
  for (let i = 0; i < a.length - 1; i++) { const q = a.slice(i, i + 2); map.set(q, (map.get(q) || 0) + 1); }
  for (let i = 0; i < b.length - 1; i++) { const q = b.slice(i, i + 2), n = map.get(q) || 0; if (n) { hits++; map.set(q, n - 1); } }
  return 2 * hits / ((a.length - 1) + (b.length - 1));
}

/** Ignore les préfixes d'amélioration D&D usuels : « +1 Longbow » devient « longbow ». */
export function baseItemName(value) {
  return norm(value).replace(/^\+?\s*[1-3]\s+/, "").trim();
}

function tokenOverlap(a, b) {
  const A = new Set(norm(a).split(/\s+/).filter(x => x.length > 1));
  const B = new Set(norm(b).split(/\s+/).filter(x => x.length > 1));
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common++;
  return common / Math.max(A.size, B.size);
}

/** Corrige quelques transcriptions françaises fréquentes de noms anglais. */
function speechVariant(value) {
  return clean(value).replace(/\blongue\b/g, "long").replace(/\bcourte\b/g, "short").replace(/\s+/g, " ").trim();
}

export function compactName(value) { return norm(value).replace(/\s+/g, ""); }

/** Compare deux noms en ignorant espaces, accents, ponctuation et préfixes +1/+2/+3. */
export function sameItemName(a, b) {
  return compactName(baseItemName(a)) === compactName(baseItemName(b));
}

/**
 * Calcule un score de correspondance entre un nom connu et la phrase reconnue.
 * Les égalités exactes restent prioritaires ; le fuzzy est volontairement plafonné.
 */
export function matchScore(name, spoken, isItemName = false) {
  const rawName = norm(name), rawSpoken = norm(spoken);
  if (rawName && rawName === rawSpoken) return isItemName ? 1.0 : 0.999;
  const a = rawName, base = baseItemName(name), b = speechVariant(spoken);
  if (!a || !b) return 0;
  if (a === b) return isItemName ? 1.0 : 0.999;
  if (base === b) return isItemName ? 0.998 : 0.997;
  if (compactName(base) === compactName(b)) return isItemName ? 0.996 : 0.995;

  const paddedA = ` ${a} `, paddedBase = ` ${base} `, paddedB = ` ${b} `;
  if (paddedB.includes(` ${a} `) || paddedA.includes(` ${b} `)) return 0.94;
  if (paddedB.includes(` ${base} `) || paddedBase.includes(` ${b} `)) return 0.93;

  const overlap = Math.max(tokenOverlap(a, b), tokenOverlap(base, b));
  if (overlap > 0) return Math.min(0.89, 0.72 + 0.17 * overlap);

  const target = base || a;
  const edit = 1 - levenshtein(target, b) / Math.max(target.length, b.length);
  const fuzzy = Math.max(0, .38 * edit + .22 * dice(target, b));
  return Math.min(0.59, fuzzy);
}

/** Détecte les commandes « encore », « répète deux fois », etc. */
export function repeatCount(spoken) {
  const s = norm(spoken);
  const exact = new Map([
    ["encore",1],["encore une fois",1],["repete",1],["repete encore",1],["meme attaque",1],["meme action",1],
    ["again",1],["repeat",1],["same attack",1],["same action",1],["one more time",1],
    ["encore deux fois",2],["repete deux fois",2],["deux fois encore",2],["again twice",2],["repeat twice",2],["repeat two times",2],
    ["encore trois fois",3],["repete trois fois",3],["again three times",3],["repeat three times",3],
    ["encore quatre fois",4],["repete quatre fois",4],["again four times",4],["repeat four times",4],
    ["encore cinq fois",5],["repete cinq fois",5],["again five times",5],["repeat five times",5]
  ]);
  return exact.get(s) ?? 0;
}
