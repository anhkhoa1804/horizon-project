<#
Deploy script for Supabase migrations and Edge Function.

Usage:
1. Copy `.env.supabase.example` -> `.env.supabase` and fill values.
2. From PowerShell run: `./deploy.ps1`

Requirements:
- Node.js 18+
- `supabase` CLI (npx supabase) for function deploy
#>
param()

Set-StrictMode -Version Latest

$envFile = Join-Path $PSScriptRoot '.env.supabase'
if (-not (Test-Path $envFile)) {
    Write-Error "Missing $envFile. Copy .env.supabase.example and fill with real values."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -match '^(\w+)=(.*)$') {
        $k = $matches[1]; $v = $matches[2]
        if ($v -ne '') { Set-Item -Path Env:$k -Value $v }
    }
}

if (-not $env:DATABASE_URL) {
    Write-Error "DATABASE_URL must be set in .env.supabase."
    exit 1
}

if (-not $env:SUPABASE_PROJECT_REF -and $env:SUPABASE_URL -match 'https://([^.]+)\.supabase\.co') {
    $env:SUPABASE_PROJECT_REF = $Matches[1]
}

Write-Output "Applying SQL migrations and pilot seed..."
Push-Location $PSScriptRoot
try {
    & node ./apply-migrations.mjs
    if ($LASTEXITCODE -ne 0) { Write-Error "Migration apply failed"; exit $LASTEXITCODE }
} finally { Pop-Location }

Write-Output "Pushing edge function secrets..."
Push-Location $PSScriptRoot
try {
    & node ./push-edge-secrets.mjs
    if ($LASTEXITCODE -ne 0) { Write-Error "Edge secrets push failed"; exit $LASTEXITCODE }
} finally { Pop-Location }

if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Warning "SUPABASE_ACCESS_TOKEN not set. Ensure 'npx supabase login' has been run."
}

Write-Output "Building shared edge-ingest bundle..."
Push-Location (Join-Path $PSScriptRoot '..\..\services\edge-ingestion')
try {
    & npm run build:edge
    if ($LASTEXITCODE -ne 0) { Write-Error "edge bundle build failed"; exit $LASTEXITCODE }
} finally { Pop-Location }

Write-Output "Deploying edge-ingest function..."

if (-not $env:SUPABASE_PROJECT_REF) {
    Write-Error "SUPABASE_PROJECT_REF is required for function deploy."
    exit 1
}

Push-Location $PSScriptRoot
try {
    & npx supabase functions deploy edge-ingest --project-ref $env:SUPABASE_PROJECT_REF --no-verify-jwt
    if ($LASTEXITCODE -ne 0) { Write-Error "supabase functions deploy failed"; exit $LASTEXITCODE }
} finally { Pop-Location }

Write-Output "Deploy finished."
