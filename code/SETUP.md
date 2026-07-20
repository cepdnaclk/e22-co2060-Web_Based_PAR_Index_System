# PAR System — ML Integration Setup Guide

> **Clinical system.** Follow every step in order. Do not skip the secrets setup.

---

## Prerequisites

| Tool      | Version   |
|-----------|-----------|
| Java      | 17 or 21  |
| Maven     | 3.9+      |
| MySQL     | 8.0+      |
| Python    | 3.11+     |
| Node.js   | 18+       |

---

## Step 1 — Set Environment Variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

Generate secrets:

```bash
# JWT secret for Spring Boot
openssl rand -base64 32
# ML service key (same command — use a different value)
openssl rand -base64 32
```

Edit `.env`:

```env
DB_PASSWORD=<your_mysql_password>
JWT_SECRET=<generated_jwt_secret>
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_SECRET=<generated_ml_service_key>
```

Export for the current shell session (Spring Boot reads from environment):

```bash
# Linux / macOS
export DB_PASSWORD=<your_mysql_password>
export JWT_SECRET=<generated_jwt_secret>
export ML_SERVICE_URL=http://localhost:8000
export ML_SERVICE_SECRET=<generated_ml_service_key>

# Windows PowerShell
$env:DB_PASSWORD="<your_mysql_password>"
$env:JWT_SECRET="<generated_jwt_secret>"
$env:ML_SERVICE_URL="http://localhost:8000"
$env:ML_SERVICE_SECRET="<generated_ml_service_key>"
```

---

## Step 2 — Run V5 Migration SQL Manually

> Flyway is disabled. Run the migration file directly against your MySQL database.

```bash
mysql -u root -p par_system < backend/src/main/resources/db/migration/V5__add_ml_metrics.sql
```

Or via MySQL Workbench / DBeaver: open `V5__add_ml_metrics.sql` and execute.

**Verify migration ran:**

```sql
-- Should show: ml_confidence_note, version, pre_case_id, finalized_by, finalized_at
DESCRIBE ortho_cases;

-- Should exist
SHOW TABLES LIKE 'ml_metrics';

-- Should show: file_checksum column
DESCRIBE model3d_files;
```

---

## Step 3 — Start Spring Boot

From the project root (the parent of `backend/`):

```bash
cd backend

# Build
mvn clean package -DskipTests

# Run on port 8081
java -jar target/*.jar
```

Or with Maven directly:

```bash
cd backend
mvn spring-boot:run
```

Spring Boot starts on **port 8081**.

**Verify:**

```bash
curl http://localhost:8081/api/v1/health
# Expected: {"status":"UP"} or similar
```

If startup fails with `DB_PASSWORD environment variable is not set` — re-export the variable and retry.

---

## Step 4 — Install Python Dependencies

```bash
cd ml_engine
python -m venv venv
source venv/bin/activate          # Linux/macOS
# or: venv\Scripts\activate       # Windows

pip install -r requirements_ml.txt
```

---

## Step 5 — Start FastAPI ML Service

> In production: bind to 127.0.0.1 (not 0.0.0.0) so only Spring Boot can reach it.

```bash
cd ml_engine
source venv/bin/activate

# Development
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Production (no --reload)
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

FastAPI starts on **port 8000**.

**Verify:**

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"par-ml-engine","model_loaded":false}
```

---

## Step 6 — Run dataset_preprocessor.py

This reads APPROVED training sets from MySQL and generates `.pt` tensor files in `data/preprocessed/`.

> Ensure `.env` in `ml_engine/` has correct DB credentials.

```bash
cd ml_engine
source venv/bin/activate
python dataset_preprocessor.py
```

Expected output:

```
[1/47] Processed set 3
[2/47] Processed set 5
[3/47] FAILED set 7: ground_truth_par=0 is outside range [1, 50]
...
Done. Processed: 44  Skipped: 0  Failed: 3
```

If any sets failed, check `failed_samples.log` for reasons.

---

## Step 7 — Trigger First Training Run

### Via the Admin Panel (recommended):

1. Log in as ADMIN
2. Go to **Admin Panel → ML Engine**
3. Set **Model Version** (e.g. `v1.0`) and **Epochs** (e.g. `50`)
4. Click **Start Training**
5. The panel polls status every 10 seconds
6. Wait for "Training completed!" banner

### Via API (curl):

```bash
# First get a JWT token
TOKEN=$(curl -s -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"adminpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Start training
curl -X POST http://localhost:8081/api/v1/ml/train \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modelVersion":"v1.0","epochs":50}'
```

---

## Step 8 — Verify Integration End-to-End

### 1. Check ML service status

```bash
curl -H "X-ML-Service-Key: $ML_SERVICE_SECRET" \
     http://localhost:8000/status
# Expected: {"model_loaded":true,"current_version":"v1.0",...}
```

### 2. Check Spring Boot can reach ML service

```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8081/api/v1/ml/status
# Expected: {"currentStatus":"COMPLETED","latestVersion":"v1.0",...}
```

### 3. Upload 3 STL files to trigger ML prediction

```bash
curl -X POST http://localhost:8081/api/v1/cases/1/models \
  -H "Authorization: Bearer $TOKEN" \
  -F "upperFile=@/path/to/upper.stl" \
  -F "lowerFile=@/path/to/lower.stl" \
  -F "buccalFile=@/path/to/buccal.stl"
# After upload: check case — mlPredictedScore should populate within ~5 seconds
```

### 4. Verify ML prediction appears in case

```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8081/api/v1/cases/1
# Expected: {...,"mlPredictedScore":23.5,"mlConfidenceNote":"..."}
```

### 5. Check audit log (admin)

```bash
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:8081/api/v1/ml/admin/audit-logs?page=0&size=20"
# Should show ML_PREDICTION entries
```

---

## Rollback a Model (if training goes wrong)

```bash
# List available backups
ls ml_engine/models/backup_*.pt

# Rollback via API (admin only)
curl -X POST http://localhost:8081/api/v1/ml/rollback/backup_20240101_120000 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Clinical Safety Notes

- **Every auto-calculate** is logged at WARNING level with all component values. Check `spring.log`.
- **PAR validation failures** (out-of-range components) are written to `audit_logs` with action `PAR_VALIDATION_FAILED`.
- **ML predictions** never replace geometric PAR scores. They are labeled "Experimental" in the UI.
- **JWT expiry** during landmark placement saves progress to `localStorage`. Users are prompted to restore on next login.
- **Pre/Post case pairing** uses the explicit `pre_case_id` link. Verify the correct PRE case is shown in CaseDetail before finalising.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `DB_PASSWORD not set` on startup | `export DB_PASSWORD=...` and restart |
| ML service returns 403 | Check `ML_SERVICE_SECRET` matches `.env` in both Spring and FastAPI |
| `No trained model available` on predict | Run training first (Step 7) |
| STL upload gives size mismatch error | Re-upload the file; the partial write was deleted automatically |
| 409 on case edit | Another user edited simultaneously; refresh and reapply changes |
| `ground_truth_par=0 is outside range` | Reviewer must set PAR to 1–50 before approving training set |
