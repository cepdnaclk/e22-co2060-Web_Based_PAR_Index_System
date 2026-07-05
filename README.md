# Web-Based PAR Index System
## e22-co2060 — Faculty of Engineering, University of Peradeniya

A web application for automated Peer Assessment Rating (PAR) index measurement
using 3D dental scan models, with an ML-assisted landmark detection pipeline
that requires zero manual annotation to operate.

---

## Administrator Accounts

Two administrator accounts are pre-seeded in the system.
These are the **only** accounts with admin privileges.
The public registration form does not offer the Administrator role.

| # | Email | Password | Role |
|---|-------|----------|------|
| 1 | e22014@eng.pdn.ac.lk | `admin` | ADMIN |
| 2 | e22035@eng.pdn.ac.lk | `admin` | ADMIN |

> **Security note:** Change the admin passwords after first deployment.
> Admin accounts can be updated via the Admin Panel → User Management.

---

## User Roles

| Role | Description |
|------|-------------|
| **ADMIN** | Full system access — user management, training set review, audit logs. Pre-seeded only, cannot be self-registered. |
| **ORTHODONTIST** | Clinical access — create patients, upload 3D models, review/confirm ML-predicted landmarks, calculate PAR scores. Also reviews (approves/rejects) undergraduate training submissions. |
| **UNDERGRADUATE** | Submit anonymised 3D scan sets + ground-truth PAR score to the ML training dataset. |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Java 17+ (for local development)
- Node.js 20+ (for frontend development, and the root dev orchestrator — see below)
- Python 3.11+ (for the ML service — local development)
- MySQL 8.0

### Run with Docker Compose

```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8081
- ML service: http://localhost:5001
- MySQL: localhost:3306

### Local Development — one command (recommended)

A root-level dev orchestrator runs the backend, frontend, and ML service
together in a single terminal (labeled, color-coded output), instead of
needing three separate terminal windows.

**One-time setup:**
```bash
npm install
```

**Every time after that:**
```bash
npm run dev
```

This runs `mvn spring-boot:run`, `npm run dev` (frontend), and the
Flask ML service together. `Ctrl+C` once stops all three.

> Requires MySQL running separately (not managed by this script), and the
> ML service's Python virtual environment already created at
> `code/ml-service/venv/` (see ML service setup below). If your venv path
> differs, edit the `dev:ml` script in the root `package.json`.

### Local Development — running each service separately

If you'd rather run things individually (e.g. to restart just one
service without affecting the others):

**Backend**
```bash
cd backend
./mvnw spring-boot:run
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**ML service**
```bash
cd ml-service
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

---

## Database Setup

Schema and seed data are applied automatically on first run via Flyway migrations
and the `docker-entrypoint-initdb.d` scripts in Docker Compose.

For manual setup:
```bash
mysql -u root -p par_system < database/schema.sql
mysql -u root -p par_system < database/data.sql
```

> Note: this backend runs with `spring.flyway.enabled=false` and
> `ddl-auto=update` in local development — Hibernate applies entity
> changes automatically on startup. The migration files under
> `db/migration/` document schema history and are the source of truth
> for a production Flyway-managed deployment.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Three.js (STL/OBJ viewer) |
| Backend | Spring Boot 3, Spring Security, JWT |
| Database | MySQL 8, Flyway migrations |
| ML service | Python, Flask, NumPy/SciPy, trimesh, scikit-learn |
| 3D rendering | Three.js — STLLoader, OBJLoader, OrbitControls, Raycaster |
| PAR algorithm | British Standard PAR (7-component, weighted) |
| Containerisation | Docker Compose |

---

## PAR Score Components

The system implements the British Standard weighted PAR index:

| Component | Weight |
|-----------|--------|
| Upper anterior | ×1 |
| Lower anterior | ×1 |
| Buccal left | ×1 |
| Buccal right | ×1 |
| Overjet | ×6 |
| Overbite | ×2 |
| Centreline | ×4 |

The scoring formula (`GeometricPARService`) is a direct geometric port of
the reference implementation used in prior senior work, validated
component-by-component against published PAR calibration cases.

---

## ML-Assisted Landmark Detection

The ML pipeline is designed so that **orthodontist workload is limited to
approving or rejecting uploaded training cases** — no manual landmark
annotation is required from anyone, for training or for review of old
cases.

### Why not a single end-to-end learned model

A case's ground-truth PAR score is one number; a full landmark set is
~30 coordinate values. One number cannot uniquely determine that many
coordinates, so a model cannot learn landmark *positions* purely from
(mesh, PAR score) pairs — this is a mathematical limitation, not an
engineering gap. The pipeline is split into two genuinely different
problems as a result:

**1. Landmark detection — geometric, not learned (`ml-service/geometry.py`, `arch_geometry.py`, `teeth_naming.py`)**
Detects landmarks via curvature analysis (cusp/incisal tips), then maps
detected points to exact clinical names (`R3M`, `L6MB`, `LCover`, ...)
using the dental arch's own geometry: angular position around the arch
identifies *which tooth*, radial distance from the arch centre
distinguishes buccal (cheek-side, outer curve) from palatal/lingual
(tongue-side, inner curve). **No training data required** — works from
the very first upload. Mesh-boundary/crop-edge vertices are explicitly
excluded from candidate detection, since scan-crop artifacts are sharper
than real cusps and would otherwise dominate the ranking.

**2. PAR-score cross-check — real trained ML (`ml-service/features.py`, `train_regressor.py`)**
A Ridge regression model trained on automatically-computed mesh features
→ the undergraduate-submitted, orthodontist-approved true PAR score. This
*is* genuine supervised ML, because a single score is exactly the kind of
target a single score can predict. Retrains from the full approved-case
pool whenever `train_regressor.py` is rerun — no case ever needs
relabelling.

### Review workflow

Every ML-predicted landmark is stored as `LandmarkPoint(source=ML_PREDICTED, confirmed=false)`.
`GeometricPARService` only reads **confirmed** landmarks — an unconfirmed
prediction can never silently become part of a real PAR score. Clinicians
review, adjust if necessary, and confirm via
`POST /api/v1/cases/{id}/landmarks/{slot}/confirm` before finalising a case.

The backend has ML integration enabled by default (`ML_SERVICE_ENABLED=true`).
If the ml-service isn't running, `/predict-landmarks` simply returns a
clear error — nothing else in the application is affected. Set
`ML_SERVICE_ENABLED=false` to disable the integration entirely.

### Known limitation (documented, not hidden)

Tooth-position bin proportions in `teeth_naming.py` use typical adult
average tooth widths, not proportions measured from this project's own
scans (there is no labelled data yet to fit them from). Contact-point
roles (mesial/distal) are the least reliable role type in the current
heuristic. Treat every ML-predicted point as a starting hypothesis for
clinician review, exactly as the confirm-before-use workflow already
enforces. See `ml-service/README.md` for the full design rationale and
calibration notes.

---

## Security

- JWT-based stateless authentication (1-hour expiry)
- BCrypt password hashing (cost factor 10)
- Role-based access control on all API endpoints
- Admin role cannot be self-registered — pre-seeded accounts only
- Full audit log for all login, register, and data-mutation events
