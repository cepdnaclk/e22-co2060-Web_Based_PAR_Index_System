# Developer Guide — Web-Based PAR Index System

This guide is written from the actual source in the repository (`code/`), not
from the older setup docs at the repo root, some of which are out of date —
see the note at the end of each section where that matters. If something
here disagrees with `SETUP.md` or `README-RUNNING.md`, trust this guide and
the source it was checked against.

---

## 17.1 Architecture Overview

The system is a clinical tool for calculating the Peer Assessment Rating
(PAR) index from 3D dental scans. It is a four-service system:

```
┌──────────────┐      HTTP/JSON       ┌──────────────────┐
│  Frontend     │ ───────────────────▶ │  Backend          │
│  React + Vite │ ◀─────────────────── │  Spring Boot 3.2  │
│  :5173        │      JWT auth        │  :8081             │
└──────────────┘                       └────────┬──────────┘
                                                 │  JDBC
                              X-ML-Service-Key   │
                        ┌──────────────┐         ▼
                        │  ML Service   │◀──MySQL 8.0──▶
                        │  FastAPI      │    :3306/3307
                        │  :8000        │
                        └──────────────┘
```

- **Frontend** talks only to the Spring Boot backend, never directly to the
  ML service.
- **Backend** is the single source of truth: it owns the database, handles
  auth, and is the only service that calls the ML service.
- **ML service** is a stateless prediction/training worker. It has read-only
  access to the backend's uploaded STL files (via a shared Docker volume)
  and its own access to MySQL only for the offline dataset preprocessor —
  the live prediction path never touches the database directly.
- All backend↔ML-service calls are authenticated with a shared secret
  (`X-ML-Service-Key`), separate from user JWTs.

## 17.2 Backend (Spring Boot)

**Stack:** Java 17, Spring Boot 3.2.5, Spring Security, Spring Data JPA,
Flyway, MySQL Connector/J, JJWT, Lombok, springdoc-openapi. Build tool:
Maven (`code/pom.xml`, artifact `par-index-backend`).

**Package layout** (`code/backend/src/main/java/com/parsystem/`):

| Package | Responsibility |
|---|---|
| `config` | `SecurityConfig`, `RestClientConfig`/`RestTemplateConfig` (ML service HTTP client), `AdminSeedConfig` |
| `controller` | REST endpoints — one controller per resource (`CaseController`, `PatientController`, `LandmarkController`, `MLController`, `TrainingSetController`, `UserController`, `AuthController`, `FileServeController`) |
| `service` | Business logic — `PARCalculatorService` (manual scoring), `GeometricPARService` (landmark-based auto scoring), `MLService`/`MLClientService`/`MlPredictionService` (training & prediction orchestration), `StorageService` (file I/O + validation), `AccessControlService` (ownership checks), `AuditService`, `AuthService`, `PatientService`, `UserService`, `LandmarkService` |
| `security` | `JwtUtil` (sign/verify), `JwtAuthFilter` (request-level auth) |
| `entity` | JPA entities mapping 1:1 to the tables in §17.5 |
| `repository` | Spring Data JPA repositories |
| `dto` | Request/response DTOs (`AuthDto`, `LandmarkDto`, `PARScoreDto`) |
| `exception` | `GlobalExceptionHandler` |

**Auth model:** stateless JWT. `JwtAuthFilter` runs once per request,
extracts `Authorization: Bearer <token>`, and populates the Spring Security
context if the token is valid; an invalid/missing/expired token is *not*
rejected at the filter — the request simply proceeds unauthenticated, and
`SecurityConfig`'s URL-pattern rules (`/admin/**` → `ADMIN`,
`/cases/**`/`/patients/**` → `ORTHODONTIST`/`ADMIN`, etc.) plus
method-level `@PreAuthorize` annotations do the actual rejecting. See
`docs/SecurityReview.md` §1 for the full authentication write-up.

**Business rules worth knowing before touching this code** (each backed by
a test — see `docs/BugLog.md`/test suite for the failing-case behavior):
- A POST-stage case can only be created if the patient has a finalized
  PRE-stage case (`CaseController.create`).
- A case can only be finalized once it has a `PARScore` with
  `totalWeighted > 0`.
- Case unfinalize is admin-only and requires a non-blank reason.
- Training-set approval (`TrainingSetController.review`) requires
  `groundTruthPar` in `[1, 50]` and all three model slots (UPPER/LOWER/BUCCAL)
  uploaded.
- Training-set deletion (`TrainingSetController.delete`) is restricted to
  the submission's own owner or an ADMIN — an UNDERGRADUATE cannot delete
  another user's pending submission (fixed; see `BugLog.md` RESOLVED-002).
- 3D model uploads are validated by `StorageService` — extension/MIME
  allow-list (`.stl`/`.obj`), 50 MB size cap, and a path-traversal guard on
  the resolved storage path.

**Test coverage:** 123 tests across 15 classes, all passing — see
`docs/TestingDocumentation.md` for the full breakdown by class, environment,
and testing approach. `LandmarkControllerTest` (13 tests, closing the gap
where `LandmarkController`'s own `@PreAuthorize`/`@Valid` rules were never
directly exercised) may not be pushed to `main` yet — check before relying
on the count from a fresh clone.

**Entry point:** `ParSystemApplication`. Runs on port **8081**.

## 17.3 Frontend (React)

**Stack:** React 19, Vite 8, React Router 7, Axios, Three.js (+ STLLoader,
OrbitControls) for 3D model viewing, Recharts for the ML metrics charts.
No TypeScript compiler — `@types/*` packages are present for editor
IntelliSense only.

**Structure** (`code/frontend/src/`):

| Path | Contents |
|---|---|
| `pages/` | One component per route: `Dashboard`, `Login`, `Register`, `PatientList`, `PatientDetail`, `NewCase`, `CaseDetail`, `TrainingList`, `TrainingSubmit`, `TrainingReview`, `AdminPanel` |
| `components/` | `Layout` (nav shell), `ErrorBoundary`, `Model3DViewer`/`STLViewer`/`Case3DViewer` (Three.js viewers), `ModelUploadSlots`, `LandmarkPanel`, `ThreeDAutoScore`, `AutoScoreResult`, `MLStatusPanel` |
| `context/AuthContext.jsx` | JWT storage, current-user state, login/logout |
| `api/api.js` | Axios instance — base URL from `VITE_API_URL`, attaches the JWT to every request |
| `utils/measurements.js` | Shared geometry/measurement helpers for the 3D viewers |

**Dev server:** `npm run dev` (Vite) on port **5173**. `VITE_API_URL` (set
in `docker-compose.yml` to `http://localhost:8081`) points it at the
backend. `ErrorBoundary` posts uncaught render errors to the backend's
unauthenticated `POST /api/v1/admin/frontend-error` endpoint, which logs
them to `audit_logs`.

**Note on `NEW_DEPENDENCIES.md`:** this file documents dependencies added
during the ML-integration work and is accurate for `package.json` as it
stands — no 3D library beyond `three` was introduced (no react-three-fiber,
no babylon.js).

## 17.4 ML Service (FastAPI)

**Stack:** Python 3.11, FastAPI 0.110, PyTorch 2.2.2 (CPU build), trimesh
(mesh loading/sampling), slowapi (rate limiting), mysql-connector-python
(offline preprocessing only). See `code/ml_service/requirements.txt` for
exact pinned versions.

**Structure** (`code/ml_service/`):

| Path | Contents |
|---|---|
| `app/main.py` | FastAPI app, middleware, all routes |
| `app/core/config.py` | `Settings` (pydantic-settings) — all config from `.env`, nothing hardcoded |
| `app/core/model_store.py` | Loads/saves/rolls back the `.pt` model file |
| `app/core/landmark_detector.py` | Geometric landmark auto-detection from mesh point clouds — see [`LandmarkDetectorFixHistory.md`](LandmarkDetectorFixHistory.md) for the debugging history behind its axis-detection, outlier-removal, and coordinate-space logic before changing it |
| `dataset_preprocessor.py` | Offline script: reads `APPROVED` training sets from MySQL, builds `.pt` tensors under `data/preprocessed/` |

**Endpoints** (`app/main.py`):

| Method & path | Purpose |
|---|---|
| `GET /health` | Unauthenticated liveness check (used by Docker healthcheck) |
| `GET /status` | Model/training status |
| `POST /predict` | PAR score prediction from mesh files |
| `POST /predict-landmarks` | Geometric landmark auto-detection |
| `POST /predict-par` | PAR calculation from landmarks |
| `POST /train` | Kick off a training run |
| `POST /rollback/{version}` | Roll back to a previous model version |

**Security middleware:** every path except `/health`, `/docs`,
`/openapi.json`, `/redoc` requires header `X-ML-Service-Key` matching
`ML_SERVICE_SECRET`. `/predict` is additionally rate-limited to 10
calls/minute per client IP (slowapi).

**Runs on port 8000.** In the current `docker-compose.yml` it binds
`0.0.0.0` inside the container (only reachable from other containers /
`localhost:8000` on the host via the published port) — `SETUP.md`'s
suggestion to bind `127.0.0.1` in production is a note for a bare-metal
deployment, not how the Docker setup runs it today.

## 17.5 Database Schema

MySQL 8.0, database `par_system`. Seven tables, defined by the Flyway
migrations in §17.6 (the copy at `code/database/schema.sql` is a static
reference snapshot — it is **not** executed automatically; only
`init.sql` is mounted into the MySQL container's entrypoint, and it only
creates the database and an app user, not the schema).

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | Accounts — `role` enum `DENTIST/ORTHODONTIST/UNDERGRADUATE/ADMIN` (`DENTIST` retained in the enum for backward compatibility but rejected everywhere in application code — see `AuthService`/`UserController`) | — |
| `patients` | Patient records | `created_by → users.id` |
| `ortho_cases` | A PRE or POST treatment case for a patient | `patient_id → patients.id`, `created_by → users.id`, self-referential `pre_case_id → ortho_cases.id` (added later; not in the `schema.sql` snapshot — see V-migrations) |
| `par_scores` | One-to-one PAR score per case (manual, auto-landmark, or ML-sourced) | `case_id → ortho_cases.id` (unique) |
| `model3d_files` | Uploaded STL/OBJ files, either attached to a case or a training set | `case_id → ortho_cases.id` (nullable), `training_set_id → training_sets.id` (nullable), `uploaded_by → users.id` |
| `training_sets` | Submitted (mesh + ground-truth PAR) samples for ML training, with review workflow | `submitted_by → users.id`, `reviewer_id → users.id` |
| `audit_logs` | Append-only action log — every state-changing endpoint writes here | `performed_by → users.id` (nullable, for unauthenticated frontend-error logs) |

`landmark_points` and `ml_metrics` (added by V3/V6, see below) aren't in the
`schema.sql` snapshot either — for the authoritative current schema, read
the Flyway migrations in order, not `schema.sql`.

## 17.6 Flyway Migrations

**Flyway is enabled** (`spring.flyway.enabled: true` in
`application.yml`, with `baseline-on-migrate: true`) and
`spring.jpa.hibernate.ddl-auto` is set to `validate` — Hibernate checks the
schema Flyway already built, it never creates or mutates it. This
contradicts `code/SETUP.md`, which says "Flyway is disabled... run V5
manually" — that instruction is stale; do not run migration files by hand
against a Flyway-managed database, it will fight Flyway's own migration
history table.

Migrations live in `code/backend/src/main/resources/db/migration/`:

| File | Adds |
|---|---|
| `V2__init_schema.sql` | Base schema: `users`, `patients`, `ortho_cases`, `par_scores`, `model3d_files`, `training_sets`, `audit_logs` |
| `V3__landmark_points.sql` | `landmark_points` table for 3D-based PAR calculation |
| `V4__seed_admin_accounts.sql` | The two pre-seeded ADMIN accounts (`INSERT IGNORE`, safe to re-run) |
| `V5__training_landmarks_and_ml.sql` | `training_landmark_points` (ground-truth landmarks for ML training) |
| `V6__add_ml_metrics.sql` | `ml_metrics` table + related safety columns |
| `V7__add_par_score_source.sql` | `par_scores.score_source` (`MANUAL`/`AUTO_LANDMARK`/`ML`) |
| `V8__remove_manual_training_landmarks.sql` | Drops `training_landmark_points` — the ML pipeline moved to fully-geometric, no-training-data landmark detection, so this table became dead weight |

Numbering starts at `V2` (no `V1` in the repo — likely an early
schema iteration that was squashed into `V2` before this history began; not
something to recreate).

To add a new migration: create `V9__<description>.sql` in the same folder.
Flyway applies it automatically on next backend startup — no manual step.

## 17.7 Docker & Compose

`code/docker-compose.yml` defines four services:

| Service | Image/build | Port (host) | Notes |
|---|---|---|---|
| `mysql` | `mysql:8.0` | `3307→3306` | Seeded via `database/init.sql` on first run only (bind-mounted read-only into `docker-entrypoint-initdb.d`) |
| `par-ml` | `./ml_service` (Dockerfile) | `8000` | Depends on `mysql` (healthy). Mounts `backend_uploads` **read-only** so it can read case STL files for prediction without ever writing to them |
| `par-backend` | `./backend` (Dockerfile) | `8081` | Depends on `mysql` and `par-ml` (both healthy). Mounts `backend_uploads` read-write |
| `par-frontend` | `node:20-alpine` (no Dockerfile — installs and runs from the mounted source) | `5173` | `npm install && npm run dev -- --host` on container start; depends on `par-backend` |

**Dockerfiles:**
- `code/backend/Dockerfile` — multi-stage: `maven:3.9.9-eclipse-temurin-17` builds the jar, `eclipse-temurin:17-jre-alpine` runs it.
- `code/ml_service/Dockerfile` — `python:3.11-slim`, installs `requirements.txt`, creates `models/` and `data/preprocessed/` at build time.
- Frontend has no Dockerfile; it runs directly off the official Node image with the source bind-mounted, which is why `npm install` happens at container start rather than build time.

**Volumes:** `mysql_data`, `ml_models`, `ml_data`, `backend_uploads` — all
named/persistent, so `docker compose down` (without `-v`) keeps data across
restarts.

**Bring the whole stack up:**
```bash
cd code
docker compose up --build
```

## 17.8 Configuration

All secrets are meant to come from environment variables — see the
`app.jwt.secret`/`app.storage`/`app.ml` block in
`code/backend/src/main/resources/application.yml` and `Settings` in
`code/ml_service/app/core/config.py`, both of which default to empty/blank
values that fail closed rather than falling back to a real secret (`JwtUtil`
even throws at startup if `app.jwt.secret` is blank).

| Variable | Used by | Purpose |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | backend, ML service (preprocessor only) | MySQL connection |
| `JWT_SECRET` | backend | HMAC key for signing/verifying JWTs — must be ≥32 bytes after base64 decode |
| `JWT_EXPIRATION_MS` | backend | Token lifetime (default 86400000 = 24h) |
| `ML_SERVICE_URL` | backend | Base URL the backend uses to call the ML service |
| `ML_SERVICE_SECRET` | backend, ML service | Shared secret for the `X-ML-Service-Key` header |
| `ML_ENABLED` | backend | Feature flag for the whole ML integration (default `true`) |
| `VITE_API_URL` | frontend | Backend base URL for Axios |

`application-example.yml` shows the intended pattern
(`secret: ${JWT_SECRET}`, no fallback) — this is what a real deployment's
config should look like. The committed `application.yml` currently has a
hardcoded fallback for `JWT_SECRET` (documented as `BUG-001` in
`docs/BugLog.md`, confirmed but deliberately not fixed yet).

**⚠ Two more hardcoded credentials, found while first writing this guide —
now resolved:** `code/config.txt` (a plaintext `docker compose config` dump
with real secrets) has been deleted from the repo, and
`code/database/init.sql` no longer hardcodes the `paruser` password — it's
now a comment explaining that the DB and user are created by the official
MySQL image's own `MYSQL_DATABASE`/`MYSQL_USER`/`MYSQL_PASSWORD` env vars
via `docker-compose.yml`, with no credentials committed anywhere in that
file. If `config.txt` was ever pushed to `main` before deletion, it's still
recoverable from git history — worth confirming the secrets it contained
were rotated, not just the file removed.

## 17.9 Local Setup (without Docker)

1. **Prerequisites:** Java 17+, Maven 3.9+, MySQL 8.0+, Python 3.11+,
   Node.js 20+ (per `README-RUNNING.md`; `SETUP.md` says Node 18+ — 20+ is
   the one that matches the frontend's actual `node:20-alpine` runtime
   used in Docker).
2. **Database:** create the `par_system` database and a user (see
   `database/init.sql` for the pattern — but use a real generated password,
   not the one currently committed there).
3. **Environment:** set `DB_PASSWORD`, `JWT_SECRET`, `ML_SERVICE_SECRET`
   (generate both secrets with e.g. `openssl rand -base64 32`) as
   environment variables, or in a local `.env` the launch scripts read.
4. **Backend:** `cd code/backend && mvn spring-boot:run` — Flyway runs the
   migrations automatically on startup; no manual SQL step needed (ignore
   `SETUP.md` Step 2).
5. **ML service:** `cd code/ml_service && pip install -r requirements.txt
   && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`.
6. **Frontend:** `cd code/frontend && npm install && npm run dev`.
7. **Windows convenience scripts:** `run-all.bat` / `run-all.ps1` in
   `code/` start everything; `stop-all.ps1` stops it. These install
   frontend `node_modules` automatically if missing.

Verify each service against `GET /health` (backend has no `/health` route
documented in the controllers I inspected — check
`GET /api/v1/me` with a valid token instead, or the ML service's
`GET /health`, which does exist).

## 17.10 Development Workflow

- **Branching/commits:** single `main` branch (no other branches on
  `origin` as of this writing) — work lands there directly.
- **Tests:** `cd code/backend && mvn test` — 123 passing JUnit/MockMvc tests
  across 15 classes as of the last verified run (see
  `docs/TestingDocumentation.md` for approach, tooling, and per-class
  breakdown, and `docs/SecurityReview.md`/`docs/BugLog.md` for what's
  covered from a security angle and what isn't). No frontend or
  ML-service automated tests exist yet.
- **Adding a migration:** new `V<n>__description.sql` file, Flyway picks it
  up on next backend start — don't hand-edit already-applied migrations.
- **Adding a dependency:** log it in `NEW_DEPENDENCIES.md` alongside the
  existing entries, with exact version and justification, per that file's
  own convention.
- **Security-sensitive changes:** check `docs/SecurityReview.md` and
  `docs/BugLog.md` first — several intentionally-unfixed findings
  (hardcoded JWT fallback, missing MIME enforcement, etc.) are tracked
  there so they aren't accidentally "fixed" as a side effect of unrelated
  work, or accidentally reintroduced.

## 17.11 Deployment

There is no CI/CD pipeline in this repository (no `.github/workflows/`) —
deployment is manual.

- **Docs site** (`docs/` folder) deploys via GitHub Pages configured to
  serve directly from `main`/`docs` — pushing to `main` is sufficient, no
  build step (see prior work on `docs/index.html`).
- **Application stack** (backend/frontend/ML service/MySQL) has no
  automated deployment target defined in the repo. `docker-compose.yml` is
  written for local/dev use (bind-mounted frontend source, `--reload`-style
  dev servers, host-published MySQL port) rather than a production
  topology — a real deployment would need at minimum: a production
  frontend build (`npm run build`, served statically, not the dev server),
  secrets from a proper secret manager instead of `.env`/`config.txt`, and
  the two hardcoded credentials in §17.8 rotated and removed from history
  first.

---

*This guide reflects the repository as of the commit inspected while
writing it. If the migration list, endpoints, or package layout have moved
on since, the source under `code/` is the source of truth — update this
file alongside any structural change, the same way `docs/BugLog.md`,
`docs/SecurityReview.md`, and `docs/TestingDocumentation.md` are kept in
sync with actual code.*
