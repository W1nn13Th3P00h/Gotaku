# Feature Specification: PWA et rappel push (Lot 5)

**Feature Branch**: `004-pwa-push-reminder`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Lot 5 : PWA et rappel. Manifest, service worker, écran d'installation expliquant l'ajout à l'écran d'accueil iOS. Abonnement Web Push signé VAPID, table d'abonnements (push_subscriptions, déjà en base). Écran de réglage du rappel : heure locale, jours de la semaine, activation, timezone détectée automatiquement et modifiable — un seul rappel en v1. Job Supabase Cron toutes les cinq minutes, Edge Function qui sélectionne les rappels dus, écarte ceux déjà envoyés le jour même (table d'idempotence reminder_sends, unicité sur le couple rappel/date, déjà en base) et ceux dont l'utilisateur a déjà terminé une séance ce jour-là, puis envoie le Web Push. Abonnement en échec 404/410 supprimé ; les autres échecs incrémentent un compteur, abandon après cinq échecs consécutifs. Notification cliquable ouvrant directement l'écran générateur, pas l'accueil. Le push iOS ne fonctionne que si la PWA a été ajoutée à l'écran d'accueil, et la demande de permission doit partir d'un tap explicite, jamais d'un appel automatique au chargement."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Installer la PWA et activer les notifications (Priority: P1)

En tant qu'utilisateur sur iPhone, j'ajoute l'application à mon écran d'accueil puis
j'active les notifications d'un tap explicite, pour que les rappels puissent
m'atteindre plus tard.

**Why this priority**: condition préalable absolue à tout le reste du lot : sans PWA
installée et sans abonnement Web Push enregistré, aucun rappel ne peut jamais être
envoyé, quelle que soit la qualité du reste. C'est aussi la seule partie de ce lot
entièrement vérifiable sans attendre un cycle du job planifié.

**Independent Test**: peut être testé seul en ouvrant l'application dans Safari iOS,
en constatant l'écran d'installation tant que l'app n'est pas ajoutée à l'écran
d'accueil, en l'ajoutant, en rouvrant depuis l'icône, puis en tapant sur « activer les
notifications » et en vérifiant qu'un abonnement apparaît dans `push_subscriptions`.

**Acceptance Scenarios**:

1. **Given** l'application ouverte dans un navigateur sans avoir été ajoutée à l'écran
   d'accueil, **When** l'utilisateur consulte l'écran de réglages des notifications,
   **Then** un écran d'installation explique comment l'ajouter à l'écran d'accueil, et
   aucune tentative de demande de permission n'a lieu automatiquement.
2. **Given** l'application ajoutée à l'écran d'accueil et ouverte depuis son icône,
   **When** l'utilisateur consulte le même écran, **Then** un bouton « activer les
   notifications » est proposé à la place de l'écran d'installation.
3. **Given** ce bouton, **When** l'utilisateur tape dessus, **Then** la demande de
   permission du navigateur apparaît à cet instant précis, jamais avant, jamais au
   chargement de la page.
4. **Given** la permission accordée, **When** l'abonnement se termine, **Then** un
   enregistrement apparaît parmi les abonnements de l'utilisateur, prêt à recevoir des
   envois.
5. **Given** la permission refusée par l'utilisateur, **When** il revient sur l'écran,
   **Then** l'état affiché reflète le refus, sans boucle de re-demande automatique.

---

### User Story 2 - Régler l'heure et les jours du rappel (Priority: P2)

En tant qu'utilisateur, je choisis à quelle heure et quels jours je veux être
relancé, pour que le rappel corresponde à mon rythme plutôt qu'à un horaire imposé.

**Why this priority**: dépend d'avoir déjà un moyen de recevoir des notifications
(User Story 1) pour avoir un sens, mais reste indépendante de l'envoi effectif : un
réglage se sauvegarde et se relit correctement même avant qu'aucun envoi n'ait eu
lieu.

**Independent Test**: peut être testé seul en réglant une heure et des jours, en
rechargeant l'écran, et en vérifiant que le réglage est bien celui sauvegardé — sans
attendre qu'un rappel soit effectivement délivré.

**Acceptance Scenarios**:

1. **Given** l'écran de réglages, **When** l'utilisateur choisit une heure locale et
   au moins un jour de la semaine puis active le rappel, **Then** ce réglage est
   sauvegardé.
2. **Given** un rappel déjà réglé, **When** l'utilisateur rouvre l'écran de réglages,
   **Then** il retrouve exactement l'heure, les jours et l'état d'activation
   précédemment enregistrés.
3. **Given** un rappel actif, **When** l'utilisateur le désactive, **Then** plus aucun
   envoi ne doit avoir lieu tant qu'il reste désactivé.
4. **Given** l'écran de réglages ouvert pour la première fois, **When** la timezone de
   l'appareil est détectée, **Then** elle est proposée par défaut, modifiable par
   l'utilisateur si besoin.
5. **Given** un rappel déjà réglé, **When** l'utilisateur ne sélectionne plus aucun
   jour de la semaine, **Then** la sauvegarde est refusée ou le rappel est
   automatiquement traité comme désactivé, jamais silencieusement gardé actif sans
   jour valide.

---

### User Story 3 - Recevoir le rappel au bon moment, une seule fois (Priority: P3)

En tant qu'utilisateur qui a réglé un rappel, je le reçois à l'heure prévue, pas plus
d'une fois par jour, jamais un jour où j'ai déjà fait ma séance, et un tap dessus
m'amène directement à l'écran de génération.

**Why this priority**: c'est la valeur finale du lot (« le rappel arrive sur le
téléphone à l'heure prévue »), mais elle s'appuie entièrement sur les deux stories
précédentes (un abonnement existant, un rappel réglé) : sans elles, il n'y a rien à
envoyer ni personne à qui l'envoyer.

**Independent Test**: peut être testé en préparant un rappel dû (heure/jour
correspondant à maintenant, dans son fuseau), en déclenchant un cycle de sélection, et
en vérifiant qu'un envoi a lieu une seule fois, qu'un second cycle le même jour
n'envoie pas de doublon, et qu'aucun envoi n'a lieu si une séance a déjà été terminée
ce jour-là.

**Acceptance Scenarios**:

1. **Given** un rappel actif dont l'heure et le jour, dans sa timezone, correspondent
   au moment présent, **When** le cycle de sélection s'exécute, **Then** un envoi Web
   Push a lieu vers les abonnements actifs de l'utilisateur.
2. **Given** un rappel déjà envoyé aujourd'hui, **When** un nouveau cycle de sélection
   s'exécute le même jour, **Then** aucun second envoi n'a lieu pour ce rappel.
3. **Given** une séance déjà terminée aujourd'hui par l'utilisateur, **When** son
   rappel serait par ailleurs dû, **Then** aucun envoi n'a lieu.
4. **Given** un envoi qui échoue avec un statut 404 ou 410, **When** le cycle traite
   cet échec, **Then** l'abonnement concerné est supprimé.
5. **Given** un envoi qui échoue pour une autre raison, **When** le cycle traite cet
   échec, **Then** le compteur d'échecs de l'abonnement augmente, sans le supprimer
   avant le cinquième échec consécutif.
6. **Given** un abonnement qui atteint son cinquième échec consécutif, **When** le
   cycle suivant traite un nouvel échec, **Then** cet abonnement est supprimé.
7. **Given** un envoi réussi, **When** l'utilisateur tape sur la notification reçue,
   **Then** l'écran générateur s'ouvre directement, pas l'écran d'accueil.
8. **Given** un abonnement dont l'envoi réussit, **When** le cycle suivant traite un
   nouveau rappel dû, **Then** le compteur d'échecs de cet abonnement repart de zéro.

### Edge Cases

- Rappel dû exactement à la limite d'un cycle de sélection (toutes les cinq minutes) :
  ni oublié, ni envoyé deux fois par deux cycles qui se chevaucheraient.
- Utilisateur avec plusieurs abonnements actifs (plusieurs appareils ajoutés à l'écran
  d'accueil) : un rappel dû envoie vers chacun, mais ne compte qu'une fois pour
  l'idempotence du jour.
- Changement de timezone par l'utilisateur entre deux jours : le jour et l'heure dus
  se recalculent dans la nouvelle timezone dès le réglage suivant.
- Rappel désactivé puis réactivé le jour même où il avait déjà été envoyé : ne
  redéclenche pas un second envoi ce jour-là (l'idempotence porte sur le rappel et la
  date, pas sur son état d'activation).
- Aucun abonnement actif au moment où un rappel est dû (notifications jamais activées,
  ou tous les abonnements abandonnés) : le cycle ne plante pas, ne fait simplement
  aucun envoi pour ce rappel.
- Demande de permission déjà refusée par l'utilisateur au niveau du système
  d'exploitation : l'écran de réglages ne doit pas tenter de la redemander en boucle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT proposer une application installable sur l'écran
  d'accueil (manifest, service worker), condition déjà connue pour que le Web Push
  fonctionne sur iOS.
- **FR-002**: Le système DOIT afficher un écran d'installation expliquant comment
  ajouter l'application à l'écran d'accueil, tant qu'elle n'y est pas encore ajoutée.
- **FR-003**: Le système NE DOIT JAMAIS demander la permission de notification
  automatiquement au chargement d'une page ; cette demande DOIT toujours partir d'un
  tap explicite de l'utilisateur sur un bouton dédié.
- **FR-004**: Une fois la permission accordée, le système DOIT enregistrer un
  abonnement Web Push signé VAPID pour l'appareil de l'utilisateur.
- **FR-005**: Les utilisateurs DOIVENT pouvoir régler un rappel unique : une heure
  locale, un ensemble de jours de la semaine, une timezone, et son activation.
- **FR-006**: La timezone DOIT être détectée automatiquement à l'ouverture de l'écran
  de réglages, tout en restant modifiable par l'utilisateur.
- **FR-007**: Le système NE DOIT PAS accepter un rappel actif sans aucun jour de la
  semaine sélectionné.
- **FR-008**: Le système DOIT exécuter, à intervalle régulier (au plus toutes les cinq
  minutes), une sélection des rappels dus au moment présent, dans la timezone propre à
  chaque rappel.
- **FR-009**: Le système NE DOIT PAS envoyer un rappel une seconde fois le même jour,
  quel que soit le nombre de cycles de sélection exécutés ce jour-là.
- **FR-010**: Le système NE DOIT PAS envoyer un rappel dont l'utilisateur a déjà
  terminé une séance le jour même.
- **FR-011**: Un envoi dû DOIT être adressé à tous les abonnements actifs de
  l'utilisateur concerné.
- **FR-012**: Un abonnement dont l'envoi échoue avec un statut HTTP 404 ou 410 DOIT
  être supprimé immédiatement.
- **FR-013**: Un abonnement dont l'envoi échoue pour toute autre raison DOIT voir son
  compteur d'échecs consécutifs augmenter, et n'être supprimé qu'après le cinquième
  échec consécutif.
- **FR-014**: Un envoi réussi vers un abonnement DOIT remettre à zéro son compteur
  d'échecs consécutifs.
- **FR-015**: Un tap sur une notification reçue DOIT ouvrir directement l'écran
  générateur (Lot 2), jamais l'écran d'accueil.

### Key Entities

- **Abonnement Web Push** (`push_subscriptions`, déjà en base) : un point de
  destination d'envoi pour un appareil de l'utilisateur, avec son compteur d'échecs
  consécutifs et la date de son dernier succès.
- **Rappel** (`reminders`, déjà en base) : heure locale, jours de la semaine,
  timezone, activation — un seul par utilisateur en v1.
- **Envoi de rappel** (`reminder_sends`, déjà en base) : la trace qu'un rappel donné a
  été traité pour une date donnée, unique sur ce couple, indépendante du nombre
  d'abonnements réellement notifiés.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur qui suit l'écran d'installation puis active les
  notifications obtient un abonnement enregistré sans étape non expliquée.
- **SC-002**: Un rappel réglé pour une heure et des jours donnés déclenche
  effectivement un envoi à cette heure, ce jour-là, et jamais plus d'une fois ce
  jour-là.
- **SC-003**: Un jour où une séance a déjà été terminée, aucun rappel n'est reçu pour
  ce jour, même si l'heure réglée est atteinte.
- **SC-004**: Un abonnement mort (404/410) ne reçoit plus aucune tentative d'envoi
  après sa suppression.
- **SC-005**: Toucher une notification reçue amène à l'écran générateur en une seule
  action, sans détour par l'accueil.

## Assumptions

- Un seul rappel par utilisateur en v1 (déjà acté par `docs/spec.md`) : les écrans et
  requêtes ne gèrent pas une liste de rappels multiples.
- Les icônes d'application nécessaires au manifest sont un point d'assets minimal
  (monogramme ou icône unique suffisante), pas un sujet de design à ce stade — la
  spec produit exclut explicitement les visuels élaborés du périmètre v1.
- La génération des clés VAPID, leur dépôt en variable d'environnement, le déploiement
  de l'Edge Function et la création du job Supabase Cron sont des actions manuelles
  ponctuelles à exécuter par l'utilisateur avec ses propres identifiants ; elles ne
  sont pas exécutées automatiquement au nom de l'utilisateur (secrets et déploiement
  réel sur le projet hébergé).
- Le test réel d'un rappel de bout en bout (réception effective sur un iPhone) ne peut
  se faire que sur un appareil réel, après les étapes manuelles ci-dessus ; ce que
  cette feature peut garantir avant cela, c'est la justesse de la logique de sélection
  et d'idempotence, testable sans dépendre d'un envoi réel.
- « Terminé une séance le jour même » reprend la même notion de jour calendaire local
  déjà utilisée au Lot 3, mais évaluée dans la timezone du rappel plutôt que celle du
  navigateur (le calcul se fait côté serveur, sans navigateur ouvert).
