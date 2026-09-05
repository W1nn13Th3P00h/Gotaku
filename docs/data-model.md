# Modèle de données

Les référentiels ci-dessous sont fermés. Toute valeur absente est une erreur de saisie, pas
un cas à traiter.

## Zones

26 zones, chacune rattachée à une région. La région ne sert qu'au regroupement d'interface
et à l'équilibrage de couverture du générateur, elle n'est jamais taggée sur un exercice.

| code | libellé | région |
| --- | --- | --- |
| `feet` | Pieds | `foot_ankle` |
| `ankles` | Chevilles | `foot_ankle` |
| `calves` | Mollets | `lower_leg` |
| `shins` | Tibias antérieurs | `lower_leg` |
| `post_shins` | Tibias postérieurs | `lower_leg` |
| `hamstrings` | Ischio-jambiers | `thigh` |
| `quads` | Quadriceps | `thigh` |
| `adductors` | Adducteurs | `thigh` |
| `it_bands` | Bandelettes ilio-tibiales | `thigh` |
| `glutes` | Fessiers | `hip` |
| `hip_flexors` | Fléchisseurs de hanche | `hip` |
| `hip_rotators` | Rotateurs de hanche | `hip` |
| `abs` | Abdominaux | `core` |
| `obliques` | Obliques | `core` |
| `lumbar` | Lombaires | `back` |
| `thoracic` | Thoracique | `back` |
| `lats` | Dorsaux | `back` |
| `traps` | Trapèzes | `back` |
| `neck` | Cervicales | `neck` |
| `shoulders` | Épaules | `shoulder_chest` |
| `shoulder_rotators` | Rotateurs d'épaule | `shoulder_chest` |
| `pecs` | Pectoraux | `shoulder_chest` |
| `biceps` | Biceps | `arm` |
| `triceps` | Triceps | `arm` |
| `forearm_flexors` | Fléchisseurs d'avant-bras | `arm` |
| `forearm_extensors` | Extenseurs d'avant-bras | `arm` |

Régions : `foot_ankle`, `lower_leg`, `thigh`, `hip`, `core`, `back`, `neck`,
`shoulder_chest`, `arm`.

## Zones de mobilité

4 grandes zones de mobilité, référentiel fermé. Sert au réglage « Déficit majeur » de
l'écran Réglages (sélection unique) et à la catégorie « Zones de mobilité » des séances
programmées du générateur (`docs/spec.md`). Chacune est rattachée à plusieurs zones via
`mobility_focus_zones`.

| code | libellé |
| --- | --- |
| `posterior_chain` | Chaîne postérieure |
| `shoulders` | Épaules |
| `overhead` | Au-dessus de la tête |
| `hips_pelvis` | Hanches et bassin |

## Pratiques

7 pratiques sportives, référentiel fermé. Sert au réglage « Pratique sportive » de
l'écran Réglages (multi-sélection, plus un sport principal choisi parmi les pratiques
cochées) et à la catégorie « Sports » des séances programmées du générateur. Chacune est
rattachée à plusieurs zones via `practice_zones`.

| code | libellé |
| --- | --- |
| `trail` | Trail |
| `running` | Course à pied |
| `cycling` | Cyclisme |
| `mtb` | VTT |
| `racquet_sports` | Sports de raquette |
| `yoga` | Yoga |
| `dance` | Danse |

## Types d'exercice

`active_stretch`, `passive_stretch`, `massage`, `muscle_activation`.

Le type porte l'ordonnancement de la séance, voir `docs/generator.md`.

## Matériel

`band`, `barbell`, `box`, `ball`, `foam_roller`, `medicine_ball`, `pipe`, `weight`,
`percussion_gun`.

Il n'existe pas de valeur signifiant l'absence de matériel. Un exercice sans matériel a
une liste vide. « Sans matériel » est une entrée d'interface, jamais une donnée, sinon un
même exercice peut se retrouver tagué à la fois sans matériel et avec un élastique, et le
filtrage devient faux.

## Positions

`standing`, `wall`, `seated`, `quadruped`, `supine`, `prone`, `side_lying`, `hanging`.

La position est un champ interne. Elle sert uniquement à regrouper les exercices dans
l'ordre de la séance pour éviter de se relever entre chaque exercice. Elle n'est jamais
affichée dans l'interface, jamais filtrable, et n'est pas une entrée du générateur. Elle
reste obligatoire dans le JSON de banque, parce que sans elle l'ordonnancement redevient
arbitraire.

Même statut pour `intensity` : renseignée à la saisie, consommée par le générateur pour
l'ordonnancement, invisible côté interface.

## Symétrie

`symmetric`, `asymmetric`.

Un exercice asymétrique s'exécute côté par côté. Sa durée stockée est celle d'un seul
côté, et son coût réel en séance vaut le double.

## Schéma SQL

```sql
create type exercise_type as enum (
  'active_stretch', 'passive_stretch', 'massage', 'muscle_activation'
);

create type body_position as enum (
  'standing', 'wall', 'seated', 'quadruped', 'supine', 'prone', 'side_lying', 'hanging'
);

create type symmetry_type as enum ('symmetric', 'asymmetric');

create type session_status as enum ('draft', 'in_progress', 'completed', 'abandoned');

create type session_source as enum ('generated', 'manual', 'template');

create type item_status as enum ('pending', 'done', 'skipped');

create table zones (
  code   text primary key,
  label  text not null,
  region text not null,
  sort   int  not null
);

create table equipment (
  code  text primary key,
  label text not null,
  sort  int  not null
);

create table mobility_focuses (
  code  text primary key,
  label text not null,
  sort  int  not null
);

create table mobility_focus_zones (
  focus_code text not null references mobility_focuses(code),
  zone_code  text not null references zones(code),
  primary key (focus_code, zone_code)
);

create table practices (
  code  text primary key,
  label text not null,
  sort  int  not null
);

create table practice_zones (
  practice_code text not null references practices(code),
  zone_code     text not null references zones(code),
  primary key (practice_code, zone_code)
);

create table exercises (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  instructions      text[] not null check (array_length(instructions, 1) between 1 and 6),
  type              exercise_type not null,
  position          body_position not null,
  symmetry          symmetry_type not null,
  intensity         int not null check (intensity between 1 and 3),
  duration_target_s int not null check (duration_target_s between 10 and 600),
  duration_min_s    int not null,
  duration_max_s    int not null,
  contraindications text,
  notes             text,
  media_url         text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (duration_min_s <= duration_target_s and duration_target_s <= duration_max_s),
  check (duration_min_s >= 10)
);

create table exercise_zones (
  exercise_id uuid not null references exercises(id) on delete cascade,
  zone_code   text not null references zones(code),
  is_primary  boolean not null default false,
  primary key (exercise_id, zone_code)
);

-- exactement une zone primaire par exercice
create unique index exercise_one_primary_zone
  on exercise_zones (exercise_id) where is_primary;

create table exercise_equipment (
  exercise_id    uuid not null references exercises(id) on delete cascade,
  equipment_code text not null references equipment(code),
  primary key (exercise_id, equipment_code)
);

create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  status              session_status not null default 'draft',
  source              session_source not null,
  target_duration_s   int not null,
  actual_duration_s   int,
  requested_zones     text[] not null default '{}',
  available_equipment text[] not null default '{}',
  excluded_types      exercise_type[] not null default '{}',
  seed                bigint not null,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz
);

create table session_items (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  ord         int not null,
  duration_s  int not null,   -- snapshot, par côté si per_side
  per_side    boolean not null default false,
  status      item_status not null default 'pending',
  unique (session_id, ord)
);

create table session_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references session_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  ord         int not null,
  duration_s  int not null,
  per_side    boolean not null default false,
  unique (template_id, ord)
);

create table user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  available_equipment text[] not null default '{}',
  practices           text[] not null default '{}',
  main_practice       text references practices(code),
  major_deficit_focus text references mobility_focuses(code),
  updated_at          timestamptz not null default now()
);

create table reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  time_local time not null,
  weekdays   int[] not null,      -- 1 = lundi, 7 = dimanche
  timezone   text not null,
  active     boolean not null default true
);

create table reminder_sends (
  reminder_id uuid not null references reminders(id) on delete cascade,
  sent_on     date not null,
  sent_at     timestamptz not null default now(),
  primary key (reminder_id, sent_on)
);

create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text unique not null,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   int not null default 0
);

create view exercise_last_performed as
select si.exercise_id, max(s.completed_at) as last_performed_at
from session_items si
join sessions s on s.id = si.session_id
where s.status = 'completed' and si.status = 'done'
group by si.exercise_id;
```

RLS activée sur `user_settings`, `sessions`, `session_items`, `session_templates`,
`template_items`, `reminders`, `reminder_sends`, `push_subscriptions`, avec une policy
unique par table sur `user_id = auth.uid()`. `zones`, `equipment`, `mobility_focuses`,
`mobility_focus_zones`, `practices`, `practice_zones`, `exercises`, `exercise_zones`,
`exercise_equipment` sont en lecture pour tout utilisateur authentifié, en écriture pour la
seule clé de service utilisée par le seed.

`user_settings.available_equipment` porte le matériel disponible de l'utilisateur, réglé
depuis l'écran Réglages. C'est la valeur initiale de `equipment` au chargement du
générateur ; l'utilisateur peut encore la restreindre ponctuellement sur l'aperçu d'une
séance donnée (voir `docs/generator.md`), sans que cela ne réécrive ce réglage global.

`user_settings.practices`/`main_practice`/`major_deficit_focus` portent respectivement les
pratiques sportives cochées, le sport principal (doit appartenir à `practices`, validé côté
application) et le déficit majeur de mobilité, réglés depuis l'écran Réglages. Ils
alimentent la présélection de zones de la séance personnalisée et la catégorie « Sports »
des séances programmées du générateur (voir `docs/generator.md` et `docs/spec.md`).

## Format du JSON de banque

`data/exercises.json` est la source de vérité. Un tableau d'objets, validé par Zod avant
tout écriture. Le `slug` est la clé d'idempotence du seed.

```json
{
  "slug": "couch-stretch",
  "name": "Couch stretch",
  "type": "passive_stretch",
  "position": "quadruped",
  "symmetry": "asymmetric",
  "zones": ["hip_flexors", "quads"],
  "primary_zone": "hip_flexors",
  "equipment": ["box"],
  "intensity": 3,
  "duration_target_s": 90,
  "duration_min_s": 60,
  "duration_max_s": 150,
  "instructions": [
    "Genou arrière au sol contre le mur ou la box, tibia à la verticale.",
    "Serre les fessiers et bascule le bassin en arrière pour effacer la cambrure.",
    "Redresse le buste progressivement, respire lentement et ne relâche pas le bassin."
  ],
  "contraindications": "À éviter en cas de douleur de genou en flexion complète."
}
```

Règles de validation Zod, toutes bloquantes :

- `slug` en minuscules et tirets, unique dans le fichier
- `zones` non vide, valeurs dans le référentiel, sans doublon
- `primary_zone` obligatoirement présente dans `zones`
- `equipment` sans doublon, valeurs dans le référentiel, tableau vide autorisé
- `duration_min_s` inférieure ou égale à `duration_target_s`, elle-même inférieure ou égale
  à `duration_max_s`
- `instructions` de 1 à 6 entrées, chacune non vide
- un exercice de type `massage` doit déclarer au moins un matériel, sauf s'il est
  explicitement réalisable à la main, auquel cas `notes` doit le préciser

Le seed est transactionnel. Une seule erreur de validation annule l'ensemble, sans
écriture partielle.

## Trophées

Référentiel fermé, comme les autres, miroir exact de `lib/trophies/definitions.ts`.
Trois familles, calculées après chaque séance `completed` et persistées dans
`user_trophies` (jamais recalculées à la volée pour l'affichage).

**Streak** (jours consécutifs, voir `lib/stats/streak.ts`) : six paliers.

| palier (jours) | label |
| --- | --- |
| 7 | bronze |
| 30 | argent |
| 100 | or |
| 200 | platine |
| 500 | diamant |
| 1000 | maître |

**Région** : mêmes six paliers de comptage, appliqués à chacune des 9 régions du
référentiel Zones ci-dessus (`foot_ankle`, `lower_leg`, `thigh`, `hip`, `core`,
`back`, `neck`, `shoulder_chest`, `arm`), soit 9 × 6 = 54 trophées.

| palier (séances) | label |
| --- | --- |
| 10 | bronze |
| 50 | argent |
| 100 | or |
| 200 | platine |
| 500 | diamant |
| 1000 | maître |

Une séance compte pour une région si elle contient au moins un `session_items` dont
l'exercice a une zone primaire (`exercise_zones.is_primary`) appartenant à cette
région (voir la fonction SQL `trophy_region_progress()`).

**Volume horaire total** : `sum(actual_duration_s)` sur toutes les séances
`completed`, en heures. Dix paliers, de 100h à 1000h par pas de 100h. Pas de label :
seul le chiffre (ex. « 300h ») est affiché sur le badge une fois débloqué.

Le trophée est débloqué dès que le seuil est atteint ou dépassé, y compris quand
plusieurs paliers sont franchis d'un coup (ex. un volume qui passe directement de
50h à 350h débloque les paliers 100h, 200h et 300h). Aucune notification : le
déblocage n'est visible que sur l'écran `/trophies`.
