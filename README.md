# Web-Based PAR Index System
## e22-co2060 — Faculty of Engineering, University of Peradeniya

A web application for automated Peer Assessment Rating (PAR) index measurement
using 3D dental scan models.

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
| **ORTHODONTIST** | Clinical access — create patients, upload 3D models, place landmarks, calculate PAR scores. |
| **UNDERGRADUATE** | Submit anonymised 3D scan sets to the ML training dataset. |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Java 17+ (for local development)
- Node.js 20+ (for frontend development)
- MySQL 8.0

### Run with Docker Compose

```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8081
- MySQL: localhost:3306

### Local Development

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

---

## Database Setup

Schema and seed data are applied automatically on first run via Flyway migrations
and the `docker-entrypoint-initdb.d` scripts in Docker Compose.

For manual setup:
```bash
mysql -u root -p par_system < database/schema.sql
mysql -u root -p par_system < database/data.sql
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Three.js (STL/OBJ viewer) |
| Backend | Spring Boot 3, Spring Security, JWT |
| Database | MySQL 8, Flyway migrations |
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

---

## Security

- JWT-based stateless authentication (1-hour expiry)
- BCrypt password hashing (cost factor 10)
- Role-based access control on all API endpoints
- Admin role cannot be self-registered — pre-seeded accounts only
- Full audit log for all login, register, and data-mutation events
