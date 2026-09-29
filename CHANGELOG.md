# Changelog

Toutes les modifications notables de **Use Your Voice** sont documentées ici.

Le format s'inspire de *Keep a Changelog* et les versions suivent une numérotation `1.0.x` pour les releases actuelles.

## [1.0.8] - 2026-09-29

### Documentation

- Ajout d'un `README.md` complet.
- Ajout de `CHANGELOG.md`.
- Ajout de la licence MIT dans `LICENSE`.
- Ajout de `CONTRIBUTING.md`.
- Conservation des fichiers de documentation hors du ZIP minimal de release Foundry.

## [1.0.7] - 2026-09-29

### Corrigé

- Exécution basée de manière générique sur l'activité D&D5e, sans traitement spécifique par arme, sort ou token.
- Renforcement de la correspondance des noms composés (`Longsword` / `Long Sword`, etc.).
- Les Items ne sont plus exclus de la recherche simplement parce qu'ils ne sont pas équipés.
- Conservation de l'identifiant d'activité lors d'une confirmation manuelle.
- Verrou empêchant une seconde commande vocale pendant l'exécution d'une activité.

### Modifié

- Le mode automatique transmet les options d'automatisation au workflow Midi-QOL tout en laissant D&D5e / Midi-QOL exécuter l'activité réelle.
- Le mode manuel force l'absence d'automatisation des jets d'attaque et de dégâts pour ce lancement.

## [0.5.20]

### Ajouté

- Commandes de répétition : `encore`, `répète`, `même attaque`, `again`, `repeat`.
- Répétition jusqu'à cinq fois.
- Alias génériques d'armes FR / EN appliqués dynamiquement.

## [0.5.3]

### Corrigé

- Retour au comportement de reconnaissance antérieur après régression liée au redémarrage automatique de `SpeechRecognition`.
- Le panneau de debug suit désormais la session réelle de reconnaissance sans modifier l'exécution des activités.

## [0.5.2]

### Modifié

- Le panneau de debug reste ouvert pendant l'activation du microphone et se ferme à sa désactivation.

## [0.5.1]

### Modifié

- Déplacement du diagnostic vocal des notifications Foundry vers un panneau de debug unique mis à jour en direct.

## [0.5.0]

### Ajouté

- Affichage vocal intermédiaire en direct : texte entendu, interprétation et score.

## [0.4.2]

### Corrigé

- Priorité stricte aux correspondances exactes de nom ou d'alias avant le matching approximatif.
- Les correspondances exactes ignorent la gestion d'ambiguïté.

## [0.4.1]

### Corrigé

- Restauration de la liste des microphones.
- Restauration du dictionnaire d'alias intégré dans les paramètres.
- Restauration de l'éditeur multiligne des alias.
