# Verdux plugin — retours d'usage & idées d'amélioration

> Journal tenu pendant la **première utilisation réelle** du plugin verdux (5 skills)
> sur un vrai chantier : migration de la couche « gestion d'événements de débat »
> du front OVOXS (`packages/web`) vers verdux.
>
> Objectif du fichier : remonter tout ce qui a manqué, dérouté, ou pourrait être
> amélioré dans les skills / le plugin. Mis à jour en continu pendant la migration.
>
> Légende sévérité : 🔴 bloquant · 🟠 friction réelle · 🟡 amélioration · 💡 idée

---

## 1. Patterns manquants dans les skills

### 🔴 P1 — « Piloter un graphe depuis un flux push serveur (SSE / WebSocket) »

Le besoin central d'OVOXS : un `EventSource` SSE pousse ~30 types d'événements
serveur (`turn-started`, `vote-closed`, `bonus-cast`, …) qui doivent muter le
slice. Les skills couvrent trois primitives voisines mais **aucune ne traite ce
cas frontalement** :

- `load(observable)` → produit **un field** qui ne garde que la dernière valeur ;
  ne reconstruit pas un état par deltas.
- `reaction$(actionCreator, …)` → réagit à un **flux d'actions internes**, pas à
  un observable externe arbitraire.
- `loadFromFields$` → dérive un field d'autres fields.

Question sans réponse dans la doc : **où vit l'abonnement à l'`Observable<ServerEvent>`,
et comment le transforme-t-on idiomatiquement en actions dispatchées vers le slice ?**
Deux options possibles :
1. L'abonnement reste dans la couche React (un `useEffect`) qui `graph.dispatch()`.
2. Le flux est une **dépendance**, et le graphe le consomme — mais via quelle
   opération ? Un `sideEffect` ne peut pas dispatcher ; une `reaction$` n'écoute
   que des actions.

**Résolution (par l'auteur de verdux, en cours de chantier)** : *« convertir
chaque event SSE en une action verdux »* — i.e. l'option 1. Chaque event devient
une action ; le slice porte un reducer par action ; l'abonnement `EventSource`
reste dans React (c'est le « système externe non-React » que le CLAUDE.md du front
autorise explicitement à abonner dans un `useEffect`) et `graph.dispatch()` les
actions mappées.

⚠️ **Méta-point pour le plugin** : il a fallu que *l'auteur de la lib* tranche ce
point en direct pour qu'un nouvel utilisateur démarre. C'est le signal le plus
fort de ce journal : le pattern le plus structurant d'une app temps réel n'est
documenté nulle part dans les 5 skills, et n'est pas inférable depuis la table
des 9 opérations (aucune ne dit « flux externe → action »).

→ **Suggestion** : ajouter une section (dans `verdux-operations`, ou un nouveau
skill `verdux-realtime`) « Driving a graph from a server-push stream », posant
explicitement l'idiome :
> *Un flux push serveur (SSE/WebSocket) n'est PAS consommé par une opération de
> vertex. On l'abonne dans la couche d'intégration (React effect / module
> singleton), on mappe chaque message entrant en action, et on `graph.dispatch()`.
> Le slice réagit comme à n'importe quelle action. Les conséquences temporelles
> (auto-clear, debounce) se font ensuite EN INTERNE via `reaction$` + opérateur
> injecté (cf P2).*
+ un exemple SSE/WebSocket runnable.

### 🟠 P2 — Transient auto-effaçable (show → attendre N ms → clear)

OVOXS a 4 états transitoires qui s'auto-effacent par timer (popup bonus 2 s+0,5 s,
flash résultat de vote 3 s, flash seuil AR 600 ms, TTL effet AR 8 s). Aujourd'hui
codés en `useEffect`+`setTimeout` fragiles (clés de deps bricolées). C'est
EXACTEMENT ce que l'opérateur injectable (skill testing + DI) rend déterministe
et testable. Mais **aucun exemple ne montre le transient auto-clear** (le cas le
plus courant : toast, popup, flash). L'idiome semble être une `reaction$` qui
émet une action `clear` différée via un opérateur `delay` injecté.

→ **Suggestion** : exemple « self-clearing transient via injected delay operator »
dans `verdux-operations` (et son pendant test dans `verdux-testing`). Très fort
argument de vente du framework face au duo `useEffect`/`setTimeout`.

### 🟠 P7 — Granularité du découpage : vertical (route/feature) + responsabilité unique, pas de fourre-tout

**L'axe est vertical, pas horizontal.** Réflexe par défaut en arrivant de Redux
(où l'on découpe souvent les slices par **nature** de la donnée / entité de
domaine : `users`, `votes`, `events`, …) : créer un vertex par type de donnée.
C'est le mauvais axe. Le découpage d'un graphe verdux doit être **vertical — par
feature ou par page/route** (une *slice* au sens vertical), pas **horizontal par
nature**. Un vertex agrège ce dont une tranche de fonctionnalité a besoin, et non
un silo technique partagé par type d'objet. À relier au point déjà en mémoire
« re-render vs graph concern » : on n'ajoute pas un vertex pour une raison de
granularité de rendu, et on ne le découpe pas non plus par nature de donnée.

**Mais « par feature » ne suffit pas — il faut une responsabilité unique.** En
concevant le graphe complet d'une vraie SPA, l'agent guidé par
`verdux-graph-design` a dérivé **deux fois** vers des vertices fourre-tout avant
correction manuelle :
1. un `uiVertex` regroupant tout l'état UI (modals, popups) — fourre-tout **par
   nature** ;
2. après correction, un `debatesVertex` unique (créer + rejoindre + gérer les
   candidatures) — fourre-tout **« par feature » trop large**.

Les deux ont dû être cassés à la main en vertices à responsabilité unique
(`newDebateVertex`, `joinDebateVertex`, `creatorJoinRequestsVertex` + vertices de
route `home`/`debatesList`/`debateDetail`). Le principe directeur n'est posé
explicitement nulle part dans `verdux-graph-design` ; un nouveau venu le devine par
tâtonnement (ou parce que l'auteur de la lib le tranche), alors que c'est la
décision la plus structurante du design de graphe. Ce qui manque ou prête à
confusion :

- **Principe de responsabilité unique non énoncé.** Le skill donne la *mécanique*
  (routes, nesting, upstreams) mais pas l'*heuristique* : **un vertex = une
  responsabilité cohérente ; ne jamais empiler des responsabilités sans rapport**.
  Sans cette phrase, on regroupe « ce qui se ressemble » au lieu de séparer « ce
  qui change pour des raisons différentes ».
- **Modals / overlays / popups non traités.** Ils tombent entre les deux cas du
  skill : ni route, ni « pure présentation » (ils portent un état d'ouverture, un
  formulaire, un intent de soumission, parfois une queue temps réel). À ajouter :
  **un modal/overlay porteur d'état ou de logique = son propre vertex**, au même
  titre qu'une route.
- **« feature » vs « route » ambigu.** « One vertex per route » est bon ; dès qu'on
  raisonne « par feature » on ré-agrège (une feature couvre souvent plusieurs
  routes + modals). Clarifier : **l'unité par défaut est la route (ou le modal),
  pas la feature** ; une feature se *répartit* sur plusieurs vertices.
- **Anti-pattern grab-bag absent.** À ajouter à la liste d'anti-patterns :
  *« Don't create a catch-all vertex that bundles unrelated state — neither by
  nature (a generic `ui`/`modals` vertex) nor by an over-broad "feature" that
  piles up unrelated responsibilities. Split by responsibility. »*
- **« Keep graphs flat / deeper is not better » se lit comme « n'imbrique pas ».**
  Formulé en négatif, ça pousse à tout aplatir sous le root et à **rater des
  imbrications légitimes**. Concret : `debateLive` et `replay` ont été mis à plat
  sous le root, alors que ce sont la salle live et le replay **d'un débat précis**,
  qui consomment le `debate` déjà chargé par `debateDetail` et dont les routes sont
  des sous-routes (`/debates/:id/room`, `/debates/:id/replay`) — ils auraient dû
  être imbriqués sous `debateDetail` (`upstreamFields: ['debate']`) d'emblée. La
  structure du graphe est un **acte de design** ; « flat » n'est pas une valeur par
  défaut, c'est l'absence de structure.

→ **Suggestions** :
- Énoncer noir sur blanc la règle d'axe : **découpage vertical par feature/page,
  pas horizontal par nature**, avec un contre-exemple (le silo `votesVertex` /
  `eventsVertex` partagé entre pages) face à l'exemple correct (`debateLiveVertex`
  qui porte la feature de bout en bout).
- Ajouter une section **« Granularity: divide & conquer »** : un vertex = une
  responsabilité ; unité par défaut = route **ou** modal ; une feature s'étale sur
  plusieurs vertices.
- Étendre **« One vertex per route »** d'un paragraphe modals/overlays.
- Ajouter l'**anti-pattern grab-bag** à la liste existante.
- Donner un **exemple chiffré avant/après** : `debatesVertex` (créer+rejoindre+
  candidatures) → cassé en `home`/`list`/`detail` (routes) + `newDebate`/
  `joinDebate`/`creatorJoinRequests` (modals).
- **Reformuler le nesting au positif** : **imbrique un enfant dès qu'il consomme
  les fields d'un parent** (données partagées + granularité de détection). Les deux
  anti-patterns sont **symétriques** — l'imbrication gratuite **et** la platitude
  paresseuse qui rate un partage de données. Exemple dans les deux sens :
  `live`/`replay` ⊂ `detail` (`upstreamFields: ['debate']`) ; mais `detail` **pas**
  sous `list` (un deep-link `/debates/:id` n'a pas besoin de la collection).

Note transverse : même angle mort pour un vertex SSE-fed, un wizard multi-étapes,
une popup déclenchée par un event serveur — **toute unité cohérente d'état +
comportement** mérite son vertex, indépendamment d'une route. La route est **le cas
le plus courant**, pas le seul.

### 🟠 P9 — Politique d'erreur des loaders sous-documentée dans `verdux-operations`

`verdux-operations` présente le loadable comme `status: 'loading' | 'loaded' |
'error'` et `load*` comme « always produces a loadable field … fed by an
observable ». Hypothèse naturelle du lecteur : **si l'observable d'un loader erre,
le field passe en `status:'error'`**. C'est faux aujourd'hui — un loader qui erre
**éteint le vertex entier** (bug source, voir `ISSUES.md` §2 ; à corriger dans le
cœur, pas à contourner dans la doc).

→ **Suggestions (skill, une fois le bug core corrigé)** :
- Dire **explicitement** comment un loader signale une erreur, et que l'erreur d'un
  field n'éteint pas le vertex.
- Documenter la distinction **erreur terminale (RxJS) vs récupérable (source qui
  refetch)** — piège n°1 quand on branche `load*` sur un cache type TanStack Query.
- Mentionner l'**asymétrie de politique d'erreur** entre `compute*` (try/catch →
  `error`, récupérable), `load*` et `reaction*` (`catchError` → `console.error` +
  `NEVER`, réaction morte silencieuse), pour que le lecteur sache à quoi s'attendre
  par opération.

## 2. Frictions sur l'intégration React / routeur

### 🟡 P3 — Routeur non-observable (TanStack Router)

`verdux-graph-design` et `-dependency-injection` montrent
`router.productPage.match$` — un routeur **observable**. OVOXS utilise TanStack
Router, qui n'expose pas de `match$`. La doc « le routeur est une dépendance, pas
un vertex » est juste, mais l'exemple suppose un routeur RxJS. Manque : comment
binder un **param de route** (`debateId`) à un vertex quand le routeur n'est pas
observable (le param arrive comme prop/loader, pas comme flux).

→ **Suggestion** : une note « adapter un routeur non-observable » — soit wrapper
le param en `Subject`/`BehaviorSubject`, soit dispatcher une action `debateOpened(id)`
depuis le composant de route.

### 🟡 P4 — `useVertexState` Suspense-first vs vertex « slice pur » (sans field loadable)

Le vertex de migration OVOXS est alimenté **uniquement par des actions** (chaque
event SSE → action) : aucun `load`/`loadFromFields`, donc **zéro field loadable**.
Du coup `useVertexState` (Suspense-first, prédicat `status === 'loaded'`) est
sur-dimensionné — il n'y a jamais de phase `loading`. J'ai utilisé l'échappatoire
documentée `useObservableState(vertex.state$, vertex.currentState)`, ce qui est
parfait ici.

→ Le skill `verdux-react-integration` présente cette échappatoire comme un
**dernier recours**. Or pour un vertex « slice pur » (= tout remplacement de
reducer redux classique, cas ultra-courant), `state$` + `useObservableState` est
en fait le choix **primaire et idiomatique**, pas un hack. Suggestion : ajouter
une note « vertex sans field loadable → `state$`/`useObservableState`, pas de
Suspense à forcer ». Sinon un nouveau venu croit devoir envelopper de `<Suspense>`
un état qui n'a rien d'asynchrone.

## 3. Ce qui marche très bien (à garder)

- ✅ **Opérateur injectable pour les transients auto-clear** : `time.timer(ms)`
  injecté résout *exactement* le point douloureux (popup/flash/TTL en
  `useEffect`+`setTimeout`). Mieux : un `ManualClock` maison (un `Subject` par
  appel `timer(ms)`, `fire(ms)` = `next(0)+complete()`) rend testables **sans
  fake timers** le séquençage `concat`, le **reset par `switchMap`**,
  l'indépendance par clé via `groupBy`, et le parallélisme via `mergeMap`. Le
  pattern du skill tient au-delà du simple debounce — jusqu'aux machines à états
  temporelles complètes. (À ajouter en exemple, cf P2.)
- ✅ **`reaction$` re-dispatche de façon synchrone** : les tests se lisent
  `dispatch → clock.fire(ms) → assert` en linéaire, zéro `await`, zéro
  `flushPromises`. La promesse « `Subject.next` pilote le temps synchroniquement »
  du skill testing s'étend bien aux `reaction$` qui re-dispatchent.
- ✅ **Immer (RTK) + détection de changement verdux** : les no-ops (`score`
  inchangé, `reconnecting` qui préserve `match`, clear de flash périmé) préservent
  l'identité objet **gratuitement** (early-return sans mutation) → `pick()` ne
  ré-émet pas. L'ancien reducer le faisait à la main par spreads ; le slice est
  bien plus court et plus sûr. Argument de vente fort.

- ✅ La table de décision des 9 opérations (`verdux-operations`) est excellente
  pour choisir vite.
- ✅ Le pattern opérateur-injectable (DI + testing) résout proprement le
  non-déterminisme temporel — pile le point douloureux d'OVOXS.
- ✅ `verdux-testing` « tester le vertex comme une unité » + `Subject` stubs :
  cadre clair, anti-marble-tests bienvenu.
- ✅ La distinction `currentState` vs `currentLoadableState` est bien posée.

## 4. Verdict du chantier (migration live-débat livrée)

Le vertex `debateLive` (≈30 actions = 1 par event SSE, 4 transients en `reaction$`)
remplace un `useReducer` + 5 `useEffect`/`setTimeout`, à **contrat de hook
préservé**. Vérifié par 41 tests unitaires + un audit adverse multi-agents
(parité reducer/events, correction des reactions, idiome). Résultat :

- **Parité comportementale : correcte**, zéro divergence fonctionnelle (les ≈30
  events et tous les no-ops/branches freeze préservés).
- **Idiome corrigé suite à l'audit** : la dépendance `time` (consommateur unique)
  a été déplacée du root vers le vertex via `configureDownstreamVertex({ slice,
  dependencies: { time } })`. ✅ Confirmé : `injectedWith` sur un **vertex
  downstream** fonctionne, et `createGraph({ vertices: [downstream.injectedWith(...)] })`
  atteint le root transitivement (pas besoin de lister le root). Et un root **sans
  `dependencies`** (`configureRootVertex({ slice })`) est accepté — bon, mais la
  doc gagnerait à montrer explicitement ce root « puits vide sans deps ».
- **Faux positifs de l'audit, instructifs pour la doc** : les auditeurs ont
  soupçonné des *races* de dispatch (un `bonusPopupExited` périmé atterrissant
  après un nouveau `bonusPopupShown`) et une fuite de timers après reset. Ces
  craintes présupposent un dispatch **asynchrone/batché**. Or verdux re-dispatche
  les `reaction$` **synchroniquement** et `switchMap` annule synchroniquement —
  donc en JS single-thread, aucune races possible. J'ai **rejeté** le « guard par
  popupId » suggéré (complexité inutile) et **ajouté à la place des tests** qui
  prouvent la sûreté (annulation `switchMap`, no-op des clears périmés post-reset
  via les gardes de reducer).

  → **Suggestion forte pour le plugin** : documenter noir sur blanc que **le
  re-dispatch des `reaction$` est synchrone** (et que `Subject.next`/`timer`
  pilotent le temps synchroniquement). C'est une garantie *cruciale* pour
  raisonner sur la correction — son absence a conduit des reviewers compétents à
  halluciner des races. À mettre dans `verdux-operations` (section reactions) et
  `verdux-testing`.

### 💡 P6 — Idée : exemple « machine à états transitoire » de bout en bout

Le pattern réellement gagnant ici — `reaction$(shown, switchMap(concat(timer→exit,
timer→clear)))` + `groupBy` (indépendance par clé) + `mergeMap` (parallélisme par
id) + opérateur `timer` injecté + `ManualClock` (un `Subject` par appel) pour
tester séquençage/annulation **sans fake timers** — mériterait un exemple
canonique unique. C'est l'argument de vente le plus fort de verdux face à
`useEffect`+`setTimeout`, et il combine 4 skills (operations, DI, testing,
react-integration). Aujourd'hui il faut le reconstituer soi-même.

---

_(journal clos pour ce chantier — rouvrir si nouvelle feature migrée)_
