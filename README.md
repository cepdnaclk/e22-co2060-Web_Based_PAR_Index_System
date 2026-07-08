# Web-Based PAR Index System

## e22-co2060 — Faculty of Engineering, University of Peradeniya

A web application for automated **Peer Assessment Rating (PAR) index measurement** using 3D dental scan models, with an ML-assisted landmark detection pipeline that reduces manual annotation effort through automated geometric landmark detection and ML-based PAR score validation.

---

# System Architecture

The system is containerised using Docker Compose and consists of four services:

```
                    Browser
                       |
                       |
              http://localhost
                       |
                       |
              React + Nginx Frontend
                       |
              -------------------
              |                 |
              | /api/*          |
              v                 |
       Spring Boot Backend      |
          Port: 8081             |
              |                  |
              |
              v
          MySQL Database

              |
              |
              v
        Python ML Service
          Port: 5001
```

## Docker Services

| Service    | Technology              | Port   |
| ---------- | ----------------------- | ------ |
| Frontend   | React 18 + Vite + Nginx | `80`   |
| Backend    | Spring Boot 3 + JWT     | `8081` |
| ML Service | Flask + Python          | `5001` |
| Database   | MySQL 8                 | `3307` |

---

# Administrator Accounts

Two administrator accounts are pre-seeded in the system.

These are the only accounts with administrator privileges.

| # | Email                                               | Password | Role  |
| - | --------------------------------------------------- | -------- | ----- |
| 1 | [e22014@eng.pdn.ac.lk](mailto:e22014@eng.pdn.ac.lk) | `admin`  | ADMIN |
| 2 | [e22035@eng.pdn.ac.lk](mailto:e22035@eng.pdn.ac.lk) | `admin`  | ADMIN |

> Security note: Change administrator passwords after first deployment.
> Admin accounts can be managed through:
>
> `Admin Panel → User Management`

---

# User Roles

| Role              | Description                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADMIN**         | Full system access including user management, ML training dataset review, and audit logs. Cannot be self-registered.                                                  |
| **ORTHODONTIST**  | Clinical user. Creates patients, uploads 3D models, reviews ML-predicted landmarks, confirms landmarks, calculates PAR scores, and reviews undergraduate submissions. |
| **UNDERGRADUATE** | Uploads anonymised 3D scan datasets with ground-truth PAR scores for ML training.                                                                                     |

---

# Quick Start

## Prerequisites

Install:

* Docker Desktop
* Docker Compose
* Java 17+
* Node.js 20+
* Python 3.11+
* MySQL 8.0 (only required for non-Docker development)

---

# Running with Docker Compose (Recommended)

Navigate to:

```bash
cd code
```

Start all services:

```bash
docker compose up -d
```

The application will be available at:

Frontend:

```
http://localhost
```

Backend API:

```
http://localhost:8081
```

ML Service:

```
http://localhost:5001
```

Database:

```
localhost:3307
```

---

## Check Running Services

```bash
docker compose ps
```

Expected:

```
par-frontend      Up
par-backend       Up
par-ml-service    Up
par-db            Up (healthy)
```

---

## Stop Application

```bash
docker compose down
```

This stops all containers.

Database data remains preserved unless volumes are explicitly removed.

---

## View Logs

All services:

```bash
docker compose logs -f
```

Backend only:

```bash
docker logs -f par-backend
```

Frontend only:

```bash
docker logs -f par-frontend
```

ML service only:

```bash
docker logs -f par-ml-service
```

---

# Local Development

## Backend

```bash
cd backend
./mvnw spring-boot:run
```

Runs:

```
http://localhost:8081
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## ML Service

```bash
cd ml-service

python -m venv venv

# Windows
venv\Scripts\Activate.ps1

pip install -r requirements.txt

python app.py
```

Runs:

```
http://localhost:5001
```

---

# Frontend Deployment Configuration

The production frontend uses Nginx.

Nginx provides:

### React SPA Routing

All frontend routes are redirected to:

```
index.html
```

allowing routes such as:

```
/login
/register
/dashboard
```

to work after browser refresh.

### Backend API Proxy

Requests:

```
/api/*
```

are automatically forwarded to:

```
par-backend:8081
```

Example:

```
Browser
 |
 | POST /api/v1/auth/login
 |
Nginx
 |
Spring Boot API
```

---

# Database Setup

Database initialization is handled automatically by Docker Compose.

MySQL container:

```
Database: par_system
Port: 3307
```

Manual setup:

```bash
mysql -u root -p par_system < database/schema.sql

mysql -u root -p par_system < database/data.sql
```

---

# Technology Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Frontend         | React 18, Vite, Three.js                           |
| Backend          | Spring Boot 3, Spring Security, JWT                |
| Database         | MySQL 8                                            |
| ORM              | Hibernate / Spring Data JPA                        |
| ML Service       | Python, Flask, NumPy, SciPy, trimesh, scikit-learn |
| 3D Rendering     | Three.js STLLoader, OBJLoader, OrbitControls       |
| PAR Algorithm    | British Standard PAR Index                         |
| Containerisation | Docker Compose                                     |
| Reverse Proxy    | Nginx                                              |

---

# PAR Score Calculation

The system implements the British Standard weighted PAR index.

| Component      | Weight |
| -------------- | ------ |
| Upper anterior | ×1     |
| Lower anterior | ×1     |
| Buccal left    | ×1     |
| Buccal right   | ×1     |
| Overjet        | ×6     |
| Overbite       | ×2     |
| Centreline     | ×4     |

The calculation is implemented through:

```
GeometricPARService
```

The algorithm uses confirmed clinical landmarks only.

---

# ML-Assisted Landmark Detection

The ML pipeline consists of two separate components.

---

## 1. Automated Landmark Detection

Implemented in:

```
ml-service/
 ├── geometry.py
 ├── arch_geometry.py
 └── teeth_naming.py
```

The system detects dental landmarks using mesh geometry:

* curvature analysis
* cusp and incisal tip detection
* dental arch geometry
* tooth position mapping

No manual landmark annotation is required.

The algorithm identifies:

* tooth positions
* buccal/palatal direction
* clinical landmark names

Examples:

```
R3M
L6MB
LCover
```

---

## 2. ML-Based PAR Score Validation

Implemented using:

```
features.py
train_regressor.py
```

A supervised regression model learns:

```
3D Mesh Features
        |
        |
        v
Predicted PAR Score
```

Training data:

```
Approved undergraduate submissions
+
Orthodontist verified PAR scores
```

The model can be retrained using the complete approved dataset.

---

# Landmark Confirmation Workflow

Every ML-generated landmark is stored as:

```
source = ML_PREDICTED
confirmed = false
```

The PAR calculation service only uses:

```
confirmed = true
```

Workflow:

```
3D Scan Upload
        |
        v
ML Landmark Prediction
        |
        v
Orthodontist Review
        |
        v
Confirm / Adjust Landmarks
        |
        v
PAR Score Calculation
```

Unconfirmed ML predictions cannot affect final clinical results.

---

# ML Service Failure Handling

ML integration is enabled by default:

```
ML_SERVICE_ENABLED=true
```

If ML service is unavailable:

* prediction requests return clear errors
* the main application continues running

ML can be disabled:

```
ML_SERVICE_ENABLED=false
```

---

# Security

Implemented security features:

* JWT stateless authentication
* 1-hour token expiration
* BCrypt password hashing
* Role-based authorization
* Protected API endpoints
* Admin accounts cannot be self-registered
* Audit logging for:

  * Login events
  * Registration events
  * Data modifications

---

# Development Notes

## Docker Rebuild After Code Changes

Frontend:

```bash
docker compose build frontend
docker compose up -d
```

Backend:

```bash
docker compose build backend
docker compose up -d
```

Full rebuild:

```bash
docker compose down

docker compose build --no-cache

docker compose up -d
```

---

# Project Structure

```
code/
|
├── frontend/
|    ├── React application
|    ├── Dockerfile
|    └── nginx.conf
|
├── backend/
|    ├── Spring Boot application
|    ├── JWT Security
|    └── REST APIs
|
├── ml-service/
|    ├── Flask API
|    ├── Landmark detection
|    └── PAR regression model
|
├── database/
|    ├── schema.sql
|    └── data.sql
|
└── docker-compose.yml
```

---

# License

Academic project developed for:

**CO2060 — Web Based Software Development**
Faculty of Engineering
University of Peradeniya
