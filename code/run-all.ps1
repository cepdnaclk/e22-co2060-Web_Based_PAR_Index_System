$ErrorActionPreference = 'Stop'

function Assert-Command($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $name. $hint"
    }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Assert-Command java  "Install Java 17+."
Assert-Command mvn   "Install Maven 3.9+."
Assert-Command python "Install Python 3.11+."
Assert-Command npm    "Install Node.js 20+."

$backendDir = Join-Path $root 'backend'
$mlDir      = Join-Path $root 'ml_engine'
$frontDir   = Join-Path $root 'frontend'

Write-Host 'Building backend...' -ForegroundColor Cyan
Push-Location $backendDir
mvn -q -DskipTests package
Pop-Location

Write-Host 'Starting backend...' -ForegroundColor Cyan
$backendProc = Start-Process -FilePath java -ArgumentList '-jar', (Join-Path $backendDir 'target\par-index-backend-1.0.0.jar') -PassThru -WindowStyle Hidden

Write-Host 'Starting ML service...' -ForegroundColor Cyan
$pythonDeps = Join-Path $mlDir 'requirements.txt'
python -m pip install -r $pythonDeps
$mlProc = Start-Process -FilePath python -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000' -WorkingDirectory $mlDir -PassThru -WindowStyle Hidden

Write-Host 'Starting frontend...' -ForegroundColor Cyan
Push-Location $frontDir
if (-not (Test-Path node_modules)) {
    npm install
}
$frontendProc = Start-Process -FilePath npm -ArgumentList 'run', 'dev', '--', '--host' -WorkingDirectory $frontDir -PassThru -WindowStyle Hidden
Pop-Location

$pidFile = Join-Path $root '.run-pids.json'
@{
    backend  = $backendProc.Id
    ml       = $mlProc.Id
    frontend = $frontendProc.Id
} | ConvertTo-Json | Set-Content $pidFile -Encoding UTF8

Write-Host "Started services. PIDs saved to $pidFile" -ForegroundColor Green
Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Green
Write-Host 'Backend:   http://localhost:8081' -ForegroundColor Green
Write-Host 'ML:        http://localhost:8000' -ForegroundColor Green
