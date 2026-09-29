USE YOUR VOICE 0.5.3
Target: Foundry VTT 12.343 / D&D5e 4.4.2.

Changes:
- Settings are directly visible in Configure Game Settings > Use Your Voice; no module configuration submenu.
- Actor priority: exactly one selected token -> user's assigned character -> explicit error.
- Features are excluded. Search is restricted to Spells and usable Inventory items.
- Suggestion popup uses native Dialog buttons and executes the selected result.
- Built-in English -> French alias dictionary for common/SRD D&D spells, weapons and adventuring items.
- Custom aliases remain available as JSON in module settings.
- Matching threshold and ambiguity margin are configurable.
- Push-to-talk remains in Configure Controls (Foundry's native keybinding UI), default Ctrl+V.

Important microphone limitation:
The Chromium SpeechRecognition API does not provide a standard deviceId input. The microphoneId setting can request/test permission for a device, but speech recognition may still follow the browser/OS speech-recognition input. For reliable device routing, set the desired microphone as the browser/OS input.

Performance:
Matching is local JavaScript and timed in the F12 console. SpeechRecognition service latency remains browser-dependent.

0.4.1 fixes: microphone dropdown restored; built-in alias dictionary shown directly in settings; large multiline alias editor restored.

0.4.2: exact item-name/alias matches now have strict priority over fuzzy matches; exact matches bypass ambiguity handling.

0.5.0: live interim speech display: Entendu + Interprété + score while speaking.

0.5.1: debug speech display moved from Foundry notifications to a single live-updating debug panel shown only while voice capture is active.

0.5.2: debug panel lifetime is tied to microphone activation. It remains open while the mic button/PTT is active and closes when microphone mode is deactivated.

0.5.3: rollback of the recognition auto-restart introduced in 0.5.2. Live debug panel now follows the real SpeechRecognition listening session without altering spell execution.


Version 0.5.20
- Commandes de répétition : « encore », « répète », « même attaque », « again », « repeat », avec répétitions jusqu’à 5 fois (ex. « encore deux fois », « repeat three times »).
- La répétition relance exactement l’activité initialement choisie et conserve le mode activité/automatique.
- Alias génériques d’armes FR/EN : tir pour arcs/arbalètes/armes à feu, lancer pour armes de jet, frappe/coup/strike/hit/swing pour armes de mêlée.
- Les alias génériques sont appliqués dynamiquement à toutes les armes équipées ; les doublons entre armes sont acceptés puisque seules les armes équipées participent à la reconnaissance.


## Architecture du code

Le dossier `scripts/` est decoupe par responsabilite pour faciliter la maintenance :

- `use-your-voice.js` : point d entree, hooks Foundry et controle du microphone.
- `settings.js` : settings, affichage JSON des alias et liste des microphones.
- `actor-items.js` : selection de l acteur, filtrage des Items et lecture des activites D&D5e.
- `text-matching.js` : normalisation du texte et calcul des scores de similarite.
- `aliases.js` : alias par defaut, personnalises, appris et alias generiques des armes.
- `matcher.js` : classement des sorts/Items/activites selon la commande vocale.
- `debug-ui.js` : panneau de diagnostic vocal.
- `dialogs.js` : confirmations et choix d activite.
- `executor.js` : execution manuelle/automatique, Midi-QOL et repetition de la derniere action.
- `default-aliases.js` : dictionnaire des alias livres avec le module.

V1.07
- Exécution générique : l'activité D&D5e est toujours la source de vérité.
- Mode automatique : activity.use() + options Midi-QOL, sans logique par arme/sort/token.
- Mode manuel : subsequentActions=false pour laisser attaque/dégâts à l'utilisateur.
- Matching des noms composés renforcé (Longsword = Long Sword, etc.).
- Les Items ne sont plus exclus de la recherche simplement parce qu’ils ne sont pas équipés.
- Conservation de l'activityId lors d'une confirmation manuelle.
- Verrou anti-double commande pendant l'exécution d'une activité.
