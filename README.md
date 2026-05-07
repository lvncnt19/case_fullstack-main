# Case Technique — Développeur Full Stack

## Contexte

Tu reçois un **agent d'analyse de données** qui fonctionne en mode CLI (terminal).

L'agent peut :

- Répondre à des questions sur des données en générant du **SQL** (via DuckDB)
- Créer des **visualisations** avec Plotly
- Expliquer son **raisonnement** (balises `<thinking>`)
- Enchaîner les étapes automatiquement via des **tool calls**

L'agent est construit avec [PydanticAI](https://ai.pydantic.dev/).

---

## Objectif

**Transformer cet agent CLI en une application web complète.**

L'utilisateur doit pouvoir poser des questions dans une interface web et voir en temps réel :

1. Le **raisonnement** de l'agent (thinking) — affiché progressivement
2. Les **appels d'outils** (tool calls) — nom, arguments, résultat
3. Les **visualisations** Plotly / tableaux de données
4. La **réponse finale** de l'agent

---

## Ce qui est fourni

```
case_fullstack/
├── agent/
│   ├── agent.py              # Création de l'agent PydanticAI
│   ├── context.py            # Contexte injecté dans les tools
│   ├── prompt.py             # System prompt
│   └── tools/
│       ├── query_data.py     # Exécution SQL via DuckDB
│       └── visualize.py      # Création de visualisations Plotly
├── data/                     # Fichiers CSV (tes données de test)
├── output/                   # Visualisations générées
├── main.py                   # Script CLI de démonstration
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

---

## Setup

```bash
# 1. Configurer la clé API
cp .env.example .env
# Éditer .env avec ta clé API

# 2. Ajouter des fichiers CSV dans data/

# 3. Lancer le CLI via Docker
docker compose run --rm agent
```

> Le volume `data/` est monté dans le container — tu peux ajouter/modifier des CSV sans rebuild.
> Les visualisations générées sont dans `output/`.

---

## Ce qui est attendu

### Minimum requis

- [ ] **Backend API** avec endpoint de streaming (SSE ou WebSocket)
- [ ] **Frontend web** avec :
  - [ ] Champ texte pour poser des questions
  - [ ] Affichage **streaming** du thinking (collapsible/dépliable)
  - [ ] Affichage des **tool calls** (nom de l'outil, arguments, résultat)
  - [ ] Rendu des **visualisations Plotly** (graphiques interactifs)
  - [ ] Rendu des **tableaux** de données
- [ ] **Code propre** et structuré

---

## Stack technique

- **Backend** : FastAPI
- **Frontend** : Libre React
- **Streaming** : SSE ou WebSocket (à ton choix)

---

## Critères d'évaluation

| Critère | Description |
|---------|-------------|
| **Fonctionnalité** | Le streaming fonctionne, le thinking s'affiche en temps réel, les tool calls sont visibles, les visualisations s'affichent |
| **Code** | Propre, structuré, lisible, bien découpé |
| **UX** | L'expérience utilisateur est fluide et intuitive |
| **Architecture** | Bonne séparation frontend / backend, gestion des états cohérente |

---

## Ressources utiles

- [PydanticAI — Documentation](https://ai.pydantic.dev/)
- [PydanticAI — Streaming](https://ai.pydantic.dev/streaming/)
- [PydanticAI — Tools](https://ai.pydantic.dev/tools/)
- [Plotly.js — React integration](https://plotly.com/javascript/react/)
- [FastAPI — Streaming Response](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

## Mon implémentation

### Stack utilisée

- Backend : FastAPI + SSE
- Frontend : React + Vite
- Agent : PydanticAI + DuckDB + Plotly

### Lancement de l'application

Configurer d'abord les variables dans le fichier `.env` à la racine du repo (un seul fichier pour backend + frontend) :

```bash
cp .env.example .env
```

Variables minimales à renseigner :
- `OPENAI_API_KEY`
- `API_AUTH_TOKEN`

```bash
# Backend
docker compose up api
```

API disponible sur `http://localhost:8000`.

```bash
# Frontend
cd frontend
npm install
npm run dev
```

Frontend disponible sur `http://localhost:5173`.

### Auth minimale (Bearer token)

Le backend protège `POST /api/chat/stream` avec un token statique :
- `API_AUTH_TOKEN` côté backend

### CORS configurable

Les origines autorisées sont configurées via `CORS_ORIGINS` (liste séparée par des virgules).
Exemple :

```bash
CORS_ORIGINS=http://localhost:5173,https://mon-frontend.example.com
```

### Architecture

```text
case_fullstack/
├── agent/
│   ├── agent.py
│   ├── context.py
│   ├── prompt.py
│   └── tools/
│       ├── query_data.py
│       └── visualize.py
├── backend/
│   ├── app.py
│   ├── schemas.py
│   ├── services/
│   │   ├── chat_stream.py
│   │   ├── datasets.py
│   │   └── events.py
│   └── tests/
│       ├── test_datasets.py
│       └── test_events.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── package.json
│   └── vite.config.js
├── data/
├── output/
├── .github/workflows/ci.yml
├── docker-compose.yml
├── Dockerfile
└── README.md
```

### Tests

```bash
# Backend
pytest backend/tests -q

# Frontend
cd frontend
npm run test
npm run build
```

### CI

Pipeline GitHub Actions dans `.github/workflows/ci.yml` :
- déclenchée sur `push` et `pull_request` vers `master` ;
- job backend : installation Python + `pytest backend/tests -q` ;
- job frontend : `npm ci`, `npm run test`, puis `npm run build` ;
- cache dépendances `pip`/`npm` et annulation des runs obsolètes.

### Limites connues

- Auth minimale basée sur token statique (pas de gestion utilisateur/session).
- Stockage des sessions en mémoire (`SESSION_HISTORIES`) --> historique perdu au redémarrage.
- Couverture de tests ciblée backend services + hook frontend --> pas de test E2E ni de test SSE bout-en-bout.
- Historique chat non paginé (croissance mémoire possible sur longues sessions).
- Les CSV sont rechargés à chaque run (pas de cache optimisé pour gros volumes).
- Thème UI sombre uniquement (pas de mode clair).
- Les tool results SSE sont tronqués à 2000 caractères (la troncature est signalée dans l'UI).