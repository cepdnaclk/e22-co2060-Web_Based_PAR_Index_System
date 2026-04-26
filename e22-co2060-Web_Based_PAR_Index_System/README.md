# Web-Based PAR Index System

> **e22-co2060** · UG 2nd Year Project · Full-Stack Web Application

A web application for computing the **Peer Assessment Rating (PAR) Index** in orthodontics. Dentists and Orthodontists manage patient cases and compute PAR scores from component inputs. Dental Science Undergraduates contribute anonymised 3D dental model sets to build an ML training dataset for future automated prediction.

---

## Tech Stack

| Layer    | Technology              |
|----------|------------------------|
| Frontend | React 19, React Router, Axios, Recharts |
| Backend  | Spring Boot 3.2, Spring Security, JJWT |
| Database | MySQL 8.x, Flyway migrations |
| Auth     | JWT (stateless, BCrypt passwords) |
| Docs     | Springdoc / Swagger UI |
| DevOps   | Docker, Docker Compose |

---

## Project Structure

```
e22-co2060-Web_Based_PAR_Index_System/
├── backend/
│   ├── src/main/java/com/parsystem/
│   │   ├── config/          SecurityConfig.java
│   │   ├── controller/      Auth, User, Patient, Case, TrainingSet
│   │   ├── dto/             Request/Response objects
│   │   ├── entity/          User, Patient, OrthoCase, PARScore,
│   │   │                    Model3DFile, TrainingSet, AuditLog
│   │   ├── exception/       GlobalExceptionHandler
│   │   ├── repository/      JPA repositories
│   │   ├── security/        JwtUtil, JwtAuthFilter
│   │   └── service/         Auth, User, Patient, PAR, Storage, Audit
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/    V1__init_schema.sql (Flyway)
│   ├── Dockerfile
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── api/             api.js (Axios client)
│   │   ├── components/      Layout.jsx, ModelUploadSlots.jsx
│   │   ├── context/         AuthContext.jsx
│   │   └── pages/           Login, Register, Dashboard, PatientList,
│   │                        PatientDetail, NewCase, CaseDetail,
│   │                        TrainingSubmit, TrainingList, AdminPanel
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── database/
│   └── schema.sql           (reference only — Flyway manages migrations)
├── docs/
│   ├── SRS/
│   └── diagrams/
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# 1. Clone the repo
git clone <repo-url>
cd e22-co2060-Web_Based_PAR_Index_System

# 2. Create .env (copy and edit)
cp .env.example .env

# 3. Build and start all services
docker compose up --build

# App: http://localhost
# API: http://localhost:8081
# Swagger: http://localhost:8081/swagger-ui.html
```

### Option B — Manual (development)

**Prerequisites:** Java 17, Maven, Node.js 20, MySQL 8

```bash
# 1. Create MySQL database
mysql -u root -p
CREATE DATABASE par_system;
CREATE USER 'paruser'@'localhost' IDENTIFIED BY 'parpass';
GRANT ALL PRIVILEGES ON par_system.* TO 'paruser'@'localhost';

# 2. Start backend
cd backend
# Set env vars or edit application.yml
export DB_USER=paruser DB_PASS=parpass
export JWT_SECRET=<your-32-char-base64-key>
mvn spring-boot:run

# 3. Start frontend (new terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

Create a `.env` file in the project root (for Docker Compose):

```env
DB_NAME=par_system
DB_USER=paruser
DB_PASS=parpass
DB_ROOT_PASS=rootpass
JWT_SECRET=ChangeThisToASecureBase64EncodedKeyAtLeast32Chars
STORAGE_DIR=/app/uploads
```

> **Never commit `.env` to Git.** It is already in `.gitignore`.

---

## User Roles

| Role | Access |
|------|--------|
| `DENTIST` | Manage own patients, create/calculate cases, upload clinical 3D models |
| `ORTHODONTIST` | Same as Dentist |
| `UNDERGRADUATE` | Submit anonymised 3D model sets for ML training dataset |
| `ADMIN` | All of the above + user management, training dataset review, audit log |

---

## PAR Score Calculation

The system implements the **British weighted PAR scoring scheme**:

| Component | Raw Score Range | Weight | Max Weighted |
|-----------|----------------|--------|-------------|
| Upper Anterior Segment | 0–10 | ×1 | 10 |
| Lower Anterior Segment | 0–10 | ×1 | 10 |
| Buccal Occlusion — Left | 0–5 | ×1 | 5 |
| Buccal Occlusion — Right | 0–5 | ×1 | 5 |
| Overjet | 0–5 | ×6 | 30 |
| Overbite | 0–4 | ×2 | 8 |
| Centreline | 0–2 | ×4 | 8 |

**Post-treatment classification:**
- **Greatly Improved** — ≥ 30% reduction AND ≥ 22 point decrease
- **Improved** — ≥ 30% reduction
- **No Different or Worse** — < 30% reduction

---

## 3D Model Upload

Each case (clinical or training) requires **three model files**:

| Slot | Description | Formats | Max Size |
|------|-------------|---------|---------|
| `UPPER` | Upper arch scan | STL, OBJ | 50 MB |
| `LOWER` | Lower arch scan | STL, OBJ | 50 MB |
| `BUCCAL` | Buccal view scan | STL, OBJ | 50 MB |

Files are stored at:
- Clinical: `uploads/clinical/{caseId}/{slot}_{uuid}.{ext}`
- Training: `uploads/training/{setId}/{slot}_{uuid}.{ext}`

---

## API Documentation

Swagger UI is available in development at:
```
http://localhost:8081/swagger-ui.html
```

Key endpoint groups:

| Group | Base Path |
|-------|-----------|
| Auth | `/api/v1/auth/` |
| Patients | `/api/v1/patients/` |
| Cases | `/api/v1/cases/` |
| Training Sets | `/api/v1/training-sets/` |
| Admin | `/api/v1/admin/` |
| ML (future) | `/api/v1/cases/{id}/predict` *(stub)* |

---

## Database Schema

Managed by **Flyway** — migrations run automatically on startup.

```
users            → id, name, email, password_hash, role, is_active
patients         → id, reference_id, name, dob, contact, created_by
ortho_cases      → id, patient_id, stage, is_finalized, ml_predicted_score*
par_scores       → id, case_id, [7 components], total_weighted, classification
model3d_files    → id, case_id|training_set_id, slot, file_name, storage_path
training_sets    → id, submitted_by, ground_truth_par, status, reviewer_id
audit_logs       → id, performed_by, action, entity_type, entity_id
```

*`ml_predicted_score` is reserved for the future ML prediction phase (currently NULL).

---

## Future Enhancements

- **ML-Based PAR Prediction** — Train a model on the approved undergraduate dataset; stub endpoint at `/api/v1/cases/{id}/predict` is already wired
- **In-Browser 3D Viewer** — Render STL/OBJ files with Three.js
- **Automated Landmark Detection** — Pre-process 3D models to suggest PAR component scores
- **Advanced Analytics** — Population-level PAR score trends and benchmarking
- **Mobile App** — React Native companion for chairside data entry

---

## Development Notes

- `ddl-auto: validate` — Flyway owns the schema; Hibernate only validates it
- JWT is stateless — no server-side sessions; safe for horizontal scaling
- `StorageService` is interface-abstracted — swap local filesystem for AWS S3 without touching controllers
- All audit-critical actions are logged to `audit_logs` automatically