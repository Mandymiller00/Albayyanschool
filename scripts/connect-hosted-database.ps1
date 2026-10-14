$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$databaseLine = Get-Content -LiteralPath ".env" | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $databaseLine) { throw "DATABASE_URL is missing from the project .env file." }

$connectionString = ($databaseLine -replace '^\s*DATABASE_URL\s*=', '').Trim().Trim('"').Trim("'")
$databaseUri = $null
if (-not [System.Uri]::TryCreate($connectionString, [System.UriKind]::Absolute, [ref]$databaseUri) -or $databaseUri.Scheme -notin @("postgresql", "postgres")) {
  throw "DATABASE_URL must be a valid PostgreSQL connection URL."
}
if ($databaseUri.Host -in @("localhost", "127.0.0.1", "::1")) {
  throw "DATABASE_URL still points to localhost. Replace it in .env with the hosted provider connection URL, then rerun this script."
}

$directLine = Get-Content -LiteralPath ".env" | Where-Object { $_ -match '^\s*DIRECT_URL\s*=' } | Select-Object -First 1
if ($directLine) {
  $directString = ($directLine -replace '^\s*DIRECT_URL\s*=', '').Trim().Trim('"').Trim("'")
  $directUri = $null
  if (-not [System.Uri]::TryCreate($directString, [System.UriKind]::Absolute, [ref]$directUri) -or $directUri.Scheme -notin @("postgresql", "postgres")) {
    throw "DIRECT_URL must be a valid PostgreSQL connection URL."
  }
  if ($directUri.Host -in @("localhost", "127.0.0.1", "::1")) {
    throw "DIRECT_URL still points to localhost. Set it to Supabase's session-mode pooler URL before applying the schema."
  }
}

$prismaCli = Join-Path $projectRoot "node_modules\.bin\prisma.cmd"
if (-not (Test-Path -LiteralPath $prismaCli)) { throw "Prisma CLI is missing. Run npm install first." }

& $prismaCli validate
if ($LASTEXITCODE -ne 0) { throw "Prisma schema validation failed." }

& $prismaCli db push
if ($LASTEXITCODE -ne 0) { throw "Could not connect or apply the schema. Check the hosted database URL and provider network settings in .env." }

Write-Host "Connected to hosted PostgreSQL and applied the Prisma schema."
