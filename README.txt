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
