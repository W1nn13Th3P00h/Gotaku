# Feature Specification: Rappels multiples

**Feature Branch**: `006-multiple-reminders`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Permettre plusieurs rappels par utilisateur au lieu d'un seul (par exemple un rappel le matin et un le soir). Contexte déjà vérifié dans le code : la base (table `reminders`, sans contrainte d'unicité sur `user_id`), les policies RLS, et l'Edge Function `send-reminders` gèrent déjà nativement N rappels par utilisateur — la boucle existante traite chaque rappel actif indépendamment. La limitation "un seul rappel en v1" est purement côté application : `lib/push/queries.ts` (`getReminder`/`upsertReminder` bornés à un seul enregistrement via `.limit(1)`/`.maybeSingle()`), `lib/reminders/next.ts` (`nextReminderLabel` prend un seul `Reminder | null`), et l'écran `app/settings/settings-screen.tsx` (un seul formulaire de rappel, pas de liste). Cette évolution doit remplacer cette hypothèse "un seul rappel par utilisateur" (documentée dans `docs/spec.md` et `specs/004-pwa-push-reminder/spec.md` § Assumptions) par la possibilité de créer, modifier et supprimer plusieurs rappels indépendants (heure, jours, timezone, activation chacun), et faire en sorte que l'accueil affiche le prochain rappel à venir parmi tous les rappels actifs de l'utilisateur (et non plus un rappel unique)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Régler plusieurs rappels indépendants (Priority: P1)

En tant qu'utilisateur, je veux régler plus d'un rappel (par exemple un le matin et un
le soir), chacun avec sa propre heure et ses propres jours, pour multiplier mes
occasions d'être relancé sans être limité à un seul horaire par jour.

**Why this priority**: c'est la valeur entière de cette évolution ; sans la
possibilité de créer un second rappel indépendant, rien d'autre n'a de sens.

**Independent Test**: peut être testé seul en créant deux rappels sur l'écran de
réglages (ex. 07:00 tous les jours et 21:00 le week-end), en rechargeant l'écran, et
en vérifiant que les deux sont bien listés avec leurs réglages propres.

**Acceptance Scenarios**:

1. **Given** l'écran de réglages sans aucun rappel, **When** l'utilisateur ajoute un
   premier rappel puis un second avec une heure et des jours différents, **Then** les
   deux rappels sont sauvegardés et réapparaissent tels quels après rechargement de
   l'écran.
2. **Given** deux rappels déjà réglés, **When** l'utilisateur modifie l'heure ou les
   jours de l'un des deux, **Then** seul ce rappel est affecté, l'autre reste inchangé.
3. **Given** deux rappels déjà réglés, **When** l'utilisateur désactive l'un des deux
   sans le supprimer, **Then** ce rappel n'envoie plus de notification mais reste
   visible et réactivable sur l'écran de réglages.

---

### User Story 2 - Supprimer un rappel devenu inutile (Priority: P2)

En tant qu'utilisateur, je veux supprimer un rappel que je n'utilise plus, pour ne pas
accumuler des rappels obsolètes sur l'écran de réglages.

**Why this priority**: complète naturellement la création (US1), mais l'utilisateur
peut déjà obtenir le même effet fonctionnel en désactivant un rappel ; la suppression
est un confort de rangement, pas un chemin critique.

**Independent Test**: peut être testé seul en supprimant l'un de plusieurs rappels
déjà réglés et en vérifiant qu'il disparaît de la liste et ne revient pas après
rechargement.

**Acceptance Scenarios**:

1. **Given** deux rappels réglés, **When** l'utilisateur supprime l'un des deux,
   **Then** seul ce rappel disparaît de la liste, l'historique d'envoi déjà effectué
   pour cet horaire ne réapparaît sur aucun autre rappel.

---

### User Story 3 - Voir le prochain rappel à venir sur l'accueil (Priority: P1)

En tant qu'utilisateur avec plusieurs rappels actifs, je veux que l'accueil m'indique
le tout prochain rappel à venir (peu importe lequel des rappels réglés il s'agit),
pour garder la même information utile qu'avec un rappel unique.

**Why this priority**: régression sinon perçue par l'utilisateur dès le premier
second rappel réglé : l'accueil affichait déjà « prochain rappel » avec un seul
rappel (`docs/spec.md`), ce comportement doit rester correct une fois plusieurs
rappels possibles.

**Independent Test**: peut être testé seul en réglant deux rappels actifs à des
horaires différents et en vérifiant que l'accueil affiche bien l'occurrence la plus
proche dans le temps, pas systématiquement le même des deux rappels.

**Acceptance Scenarios**:

1. **Given** deux rappels actifs dont les prochaines occurrences tombent à des
   moments différents, **When** l'utilisateur consulte l'accueil, **Then** le libellé
   affiché correspond à l'occurrence la plus proche parmi les deux.
2. **Given** un rappel actif et un rappel désactivé, **When** l'utilisateur consulte
   l'accueil, **Then** seul le rappel actif est pris en compte pour le libellé.
3. **Given** aucun rappel actif (aucun réglé, ou tous désactivés, ou aucun avec un
   jour coché), **When** l'utilisateur consulte l'accueil, **Then** l'accueil invite à
   régler un rappel plutôt que d'afficher un libellé trompeur.

---

### Edge Cases

- Deux rappels actifs tombent dus au même moment (même heure locale, jour commun) :
  chacun envoie sa propre notification, indépendamment l'un de l'autre — ce sont deux
  rappels distincts, pas un doublon à fusionner.
- Un utilisateur crée un très grand nombre de rappels (ex. un par heure de la
  journée) : aucune limite fonctionnelle n'est imposée par cette évolution, au-delà
  de ce que l'interface permet raisonnablement d'afficher.
- Un utilisateur supprime tous ses rappels : l'accueil revient au même comportement
  que quand aucun rappel n'avait jamais été réglé.
- Un rappel actif sans aucun jour coché n'existe déjà pas aujourd'hui (refusé à la
  sauvegarde) ; ça reste vrai indépendamment pour chaque rappel une fois plusieurs
  rappels possibles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Les utilisateurs DOIVENT pouvoir créer plusieurs rappels indépendants,
  chacun avec sa propre heure locale, ses propres jours de la semaine, sa propre
  timezone et son propre état d'activation.
- **FR-002**: Les utilisateurs DOIVENT pouvoir modifier un rappel existant sans
  affecter les autres rappels déjà réglés.
- **FR-003**: Les utilisateurs DOIVENT pouvoir supprimer un rappel existant sans
  affecter les autres rappels déjà réglés.
- **FR-004**: Le système NE DOIT PAS accepter qu'un rappel soit actif sans aucun jour
  de la semaine coché (règle déjà existante pour le rappel unique, à conserver
  identique par rappel).
- **FR-005**: L'écran de réglages DOIT afficher l'ensemble des rappels déjà réglés par
  l'utilisateur, chacun avec ses propres contrôles d'édition.
- **FR-006**: L'accueil DOIT afficher le libellé de la prochaine occurrence parmi tous
  les rappels actifs de l'utilisateur (celle dont l'échéance est la plus proche dans
  le temps), et non plus celui d'un rappel unique.
- **FR-007**: L'accueil DOIT se comporter comme aujourd'hui sans rappel réglé (invite
  à régler un rappel) lorsque l'utilisateur n'a aucun rappel actif avec au moins un
  jour coché.
- **FR-008**: L'envoi effectif des notifications (sélection des rappels dus, garde
  anti-doublon quotidien, garde séance déjà terminée) continue de s'appliquer
  indépendamment à chaque rappel, sans changement de comportement pour un utilisateur
  qui n'a réglé qu'un seul rappel.

### Key Entities

- **Rappel** (`reminders`, déjà en base) : heure locale, jours de la semaine,
  timezone, activation. Cette évolution retire la limite applicative d'un seul par
  utilisateur ; la base et l'envoi le permettaient déjà.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur peut régler un second rappel indépendant du premier en
  moins d'une minute depuis l'écran de réglages.
- **SC-002**: 100% des rappels actifs réglés par un utilisateur envoient
  effectivement leur notification à leur horaire propre, sans qu'aucun n'en supprime
  ou n'en remplace un autre.
- **SC-003**: L'accueil affiche toujours l'occurrence la plus proche parmi les
  rappels actifs, jamais une occurrence plus lointaine alors qu'une plus proche
  existe.

## Assumptions

- Aucune limite de nombre n'est imposée sur le nombre de rappels par utilisateur au-delà de ce que permet l'interface.
- Le format et les contraintes d'un rappel individuel (heure locale, jours, timezone, activation, refus d'un rappel actif sans jour) restent ceux déjà définis par `specs/004-pwa-push-reminder/spec.md`, désormais appliqués par rappel plutôt qu'une seule fois par utilisateur.
- Le mono-utilisateur du produit (`docs/spec.md` § Principe V) n'est pas remis en cause : chaque rappel reste rattaché à l'unique utilisateur réel de l'application, cette évolution ajoute de la pluralité de rappels, pas de comptes ou de partage.
