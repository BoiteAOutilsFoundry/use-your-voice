# Use Your Voice

**Use Your Voice** ajoute des commandes vocales à Foundry VTT pour utiliser les sorts, objets d'inventaire et activités d'un personnage D&D 5e.

Le module reste volontairement générique : il ne contient pas de comportement spécifique à un sort, une arme ou un token. Une commande vocale est résolue vers un Item ou une activité D&D5e, puis l'activité existante est exécutée.

## Compatibilité

- Foundry VTT : **12+** (manifest vérifié jusqu'à 13)
- Système : **D&D5e 4.4.2+**
- Navigateur recommandé : **Chrome / Edge**
- Midi-QOL : recommandé pour le mode de jets automatiques

La reconnaissance vocale repose sur l'API `SpeechRecognition` du navigateur. Son fonctionnement dépend donc du navigateur, des permissions microphone et de l'accès au service de reconnaissance vocale.

## Installation

### Depuis une release GitHub

1. Ouvrir **Add-on Modules** dans Foundry VTT.
2. Installer le module avec l'URL du manifest :
   `https://github.com/BoiteAOutilsFoundry/use-your-voice/releases/latest/download/module.json`
3. Activer **Use Your Voice** dans le monde concerné.

### Installation manuelle

Extraire `use-your-voice.zip` dans le dossier `Data/modules/` de Foundry afin d'obtenir :

```text
Data/modules/use-your-voice/
├── module.json
├── scripts/
└── styles/
```

## Utilisation

Deux raccourcis sont enregistrés par défaut :

- **1 / &** : mode manuel — lance l'activité D&D5e sans forcer les jets d'attaque ou de dégâts.
- **2 / é** : mode automatique — lance l'activité et demande à Midi-QOL d'automatiser attaque et dégâts.

Le bouton microphone flottant utilise le **mode manuel**.

Les raccourcis peuvent être modifiés dans **Configure Controls** de Foundry.

## Résolution des commandes

Le module recherche dans les sorts, objets d'inventaire et activités du personnage actif.

Ordre de sélection du personnage :

1. un unique token sélectionné ;
2. sinon, le personnage assigné à l'utilisateur ;
3. sinon, une erreur explicite est affichée.

Le moteur de reconnaissance prend en charge :

- le nom réel de l'Item ou de l'activité ;
- les alias FR / EN fournis avec le module ;
- les alias personnalisés ;
- les alias appris après confirmation manuelle ;
- les variantes de noms composés (`Longsword`, `Long Sword`, etc.) ;
- les commandes de répétition comme `encore`, `répète`, `again` ou `repeat`.

## Modes d'exécution

### Manuel

Use Your Voice appelle l'activité D&D5e existante et laisse D&D5e / Midi-QOL gérer sa consommation, sa concentration, ses gabarits et sa carte de chat. L'automatisation des jets d'attaque et de dégâts est désactivée pour ce lancement.

### Automatique

Use Your Voice appelle la même activité, mais transmet à Midi-QOL les options nécessaires pour automatiser les jets d'attaque et de dégâts.

Aucune logique n'est codée spécifiquement pour une arme ou un sort particulier.

## Paramètres

Dans **Configure Game Settings → Use Your Voice** :

- mode d'activation du microphone ;
- durée d'écoute ;
- microphone demandé au navigateur ;
- seuil de confiance ;
- marge d'ambiguïté ;
- alias FR / EN ;
- alias appris.

> La sélection du microphone ne garantit pas que `SpeechRecognition` utilisera exactement ce périphérique : cette API ne permet pas d'imposer directement un `deviceId` au moteur de reconnaissance vocale. Le navigateur ou le système peut conserver son périphérique d'entrée par défaut.

## Développement et release

Le dossier `Tools/` contient :

- `Build-Foundry-Release.cmd`
- `Build-Foundry-Release.ps1`

Le script produit :

```text
Release/
├── module.json
└── use-your-voice.zip
```

`use-your-voice.zip` est construit avec une liste blanche et contient uniquement les fichiers nécessaires à Foundry :

```text
module.json
scripts/
styles/
```

## Architecture

- `scripts/use-your-voice.js` : orchestration Foundry et reconnaissance vocale.
- `scripts/settings.js` : paramètres et microphones.
- `scripts/actor-items.js` : acteur, Items et activités D&D5e.
- `scripts/text-matching.js` : normalisation et similarité.
- `scripts/aliases.js` : alias par défaut, personnalisés et appris.
- `scripts/default-aliases.js` : dictionnaire livré avec le module.
- `scripts/matcher.js` : classement des correspondances.
- `scripts/dialogs.js` : confirmations et choix d'activité.
- `scripts/debug-ui.js` : panneau de diagnostic vocal.
- `scripts/executor.js` : exécution manuelle / automatique et répétition.

## Licence

Distribué sous licence **MIT**. Voir [LICENSE](LICENSE).
