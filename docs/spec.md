# Spécification fonctionnelle

## Objectif

Augmenter la fréquence réelle des séances de mobilité et d'étirements. Toutes les
décisions de conception se tranchent contre ce critère, pas contre l'exhaustivité
fonctionnelle. Une friction de trois taps entre l'envie et le premier exercice est un
défaut, un tableau de statistiques manquant n'en est pas un.

## Périmètre v1

Dans le périmètre :

- banque d'exercices consultable et filtrable
- génération automatique d'une séance sous contrainte de durée, de zones et de matériel
- composition manuelle d'une séance, sauvegardable comme modèle réutilisable
- exécution guidée au timer, avec gestion des exercices asymétriques
- historique des séances et couverture des zones sur les 30 derniers jours
- un rappel push quotidien paramétrable en heure et en jours

Hors périmètre, et à ne pas anticiper dans le code :

- progression, niveaux, charges, comptage de répétitions
- visuels, photos, vidéos, illustrations animées
- body map cliquable, la sélection des zones se fait en liste groupée par région
- multi-utilisateur, partage, export social
- apprentissage des préférences, recommandation adaptative
- séance structurée en phases explicites, la séance reste une liste plate ordonnée

## Écrans

### Accueil

Point d'entrée unique. Un bouton de génération dominant, l'heure du prochain rappel, la
date et la durée de la dernière séance, l'accès aux modèles sauvegardés, l'accès à la
banque et à l'historique. Rien d'autre.

### Générateur

Trois entrées obligatoires et trois options.

Durée cible, par presets tappables : 5, 10, 15, 20, 30, 45 minutes.

Zones souhaitées, en liste groupée par région, multi-sélection. Presets de sélection
rapide pour éviter la saisie répétitive : bas du corps, haut du corps, chaîne postérieure,
après course à pied, journée assise. Un preset est une simple liste de codes de zones
définie en constante, pas une entité en base.

Matériel disponible, en chips multi-sélection. Aucune sélection signifie sans matériel.

Options repliées : exclure un type d'exercice, imposer un type, intensité maximale.

Si la combinaison demandée n'est pas satisfaisable, l'écran le dit avant de générer et
propose une sortie explicite, jamais une séance dégradée silencieuse. Voir la section
Échecs de `docs/generator.md`.

### Aperçu de séance

Liste ordonnée des exercices, avec pour chacun le nom, la durée retenue, le type, la zone
primaire et l'indication d'exécution par côté. Durée totale calculée affichée en
comparaison de la durée demandée.

Actions : remplacer un exercice, retirer un exercice, réordonner à la main, régénérer
entièrement, sauvegarder comme modèle, démarrer.

### Exécution

Plein écran, un seul exercice à la fois. Décompte dominant, nom de l'exercice,
instructions et zones travaillées lisibles sans interaction, aperçu du suivant.

Enchaînement automatique. Pause, passer, revenir à l'exercice précédent. Signal sonore à
trois secondes de la fin et au changement d'exercice.

Un exercice asymétrique se déroule en deux phases annoncées explicitement, côté droit puis
côté gauche, chacune de la durée stockée. Le changement de côté est signalé comme un
changement d'exercice.

Écran allumé maintenu pendant toute la séance.

Écran de fin : durée réelle, nombre d'exercices réalisés et passés, zones travaillées.
C'est à cet instant que la séance passe en statut terminée, ce qui alimente la pondération
de fraîcheur du générateur.

Une séance quittée en cours de route reste en statut abandonnée et n'alimente pas la
fraîcheur. Elle est reprenable depuis l'accueil le jour même.

### Banque

Recherche texte sur le nom, filtres par zone, type et matériel. Ce sont les trois seuls
axes exposés dans l'interface.

Fiche exercice en lecture seule : nom, type, zones travaillées avec la zone primaire mise
en évidence, matériel requis, durée cible, instructions, contre-indications, date de
dernière exécution. La position et l'intensité ne sont ni affichées ni filtrables, elles
n'existent que pour l'ordonnancement du générateur.

Tableau de couverture : pour chaque zone, le nombre d'exercices disponibles, avec mise en
évidence des zones sous-alimentées. C'est l'outil de pilotage du remplissage de la banque.

Aucune édition dans l'interface. La banque se modifie dans `data/exercises.json` puis par
seed.

### Séance manuelle

Depuis la banque, ajout d'exercices à une séance en construction. Réordonnancement libre,
ajustement de la durée de chaque exercice dans sa plage autorisée, durée totale calculée
en continu. Sauvegarde comme modèle, ou démarrage direct.

### Historique

Liste inversée des séances : date, durée réelle, nombre d'exercices, zones travaillées,
statut. Vue de synthèse sur 30 jours : zones les plus et les moins travaillées, nombre de
séances, volume total.

### Réglages

Rappels : plusieurs possibles, chacun avec sa propre heure locale, ses propres jours
de la semaine et sa propre activation.

État des notifications, avec écran d'installation expliquant l'ajout à l'écran d'accueil,
puis bouton d'activation des notifications déclenchant la demande de permission.

Timezone, détectée automatiquement, modifiable.

## Rappel push

Un rappel se définit par une heure locale, un ensemble de jours de la semaine et une
timezone. Un job Supabase Cron s'exécute toutes les cinq minutes, appelle une Edge
Function qui sélectionne les rappels dus, écarte ceux déjà envoyés le jour même, écarte
ceux dont l'utilisateur a déjà terminé une séance ce jour-là, et envoie le Web Push signé
VAPID.

L'idempotence repose sur une table d'envois avec unicité sur le couple rappel et date, pas
sur un état porté par le rappel lui-même.

Un abonnement dont l'envoi échoue avec un statut 404 ou 410 est supprimé. Les autres
échecs incrémentent un compteur, et l'abonnement est abandonné après cinq échecs
consécutifs.

Le clic sur la notification ouvre directement l'écran générateur, pas l'accueil.
