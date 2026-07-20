# Run Instructions

This bundle is meant to run on Windows with local tools installed.

## Required

- Java 17 or newer
- Maven 3.9 or newer
- Python 3.11 or newer
- Node.js 20 or newer
- MySQL 8 running locally on port 3306

## Quick start

1. Copy `.env.example` to `.env`
2. Fill in `DB_PASSWORD`, `JWT_SECRET`, and `ML_SERVICE_SECRET`
3. Make sure MySQL is running and the `par_system` database exists
4. Run `run-all.bat`

## Stop

Run `stop-all.ps1`

## URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8081`
- ML service: `http://localhost:8000`

## Notes

- The backend expects the database and migrations to be available.
- If `frontend/node_modules` is missing, the launcher will install dependencies automatically.
