$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$composeEnvFile = $null

try {
  $databaseLine = Get-Content -LiteralPath ".env" | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if (-not $databaseLine) { throw "DATABASE_URL is missing from the project .env file." }

  $connectionString = ($databaseLine -replace '^\s*DATABASE_URL\s*=', '').Trim().Trim('"').Trim("'")
  $databaseUri = [System.Uri]$connectionString
  $userInfo = $databaseUri.UserInfo.Split(':', 2)
  if ($userInfo.Count -ne 2) { throw "DATABASE_URL must include a PostgreSQL username and password." }

  $databaseName = [System.Uri]::UnescapeDataString($databaseUri.AbsolutePath.TrimStart('/'))
  if (-not $databaseName) { throw "DATABASE_URL must include a database name." }

  $env:POSTGRES_DB = $databaseName
  $env:POSTGRES_USER = [System.Uri]::UnescapeDataString($userInfo[0])
  $env:POSTGRES_PASSWORD = [System.Uri]::UnescapeDataString($userInfo[1])

  $composeEnvFile = Join-Path ([System.IO.Path]::GetTempPath()) ("albayyan-postgres-" + [guid]::NewGuid().ToString("N") + ".env")
  $composeEnvLines = @(
    "POSTGRES_DB='$($env:POSTGRES_DB.Replace("'", "\'"))'",
    "POSTGRES_USER='$($env:POSTGRES_USER.Replace("'", "\'"))'",
    "POSTGRES_PASSWORD='$($env:POSTGRES_PASSWORD.Replace("'", "\'"))'"
  )
  [System.IO.File]::WriteAllLines($composeEnvFile, $composeEnvLines, [System.Text.UTF8Encoding]::new($false))

  docker compose --env-file $composeEnvFile config --quiet
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL Compose configuration is invalid." }

  $dockerService = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
  if ($dockerService -and $dockerService.Status -ne "Running") {
    throw "Docker Desktop service is stopped and this Windows account cannot start it. Start Docker Desktop with an account allowed to start com.docker.service, then rerun this script."
  }

  docker info --format '{{.ServerVersion}}' *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Engine is unavailable. Start Docker Desktop with permission to start its Windows service, wait until it reports Engine running, then rerun this script."
  }

  docker compose --env-file $composeEnvFile up -d --wait
  if ($LASTEXITCODE -ne 0) { throw "Could not start the PostgreSQL container." }

  $prismaCli = Join-Path $projectRoot "node_modules\.bin\prisma.cmd"
  if (-not (Test-Path -LiteralPath $prismaCli)) { throw "Prisma CLI is missing. Run npm install first." }
  & $prismaCli db push
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL started, but Prisma could not apply the schema." }

  Write-Host "PostgreSQL is ready at localhost:5432 and the Prisma schema is applied."
} finally {
  Remove-Item Env:POSTGRES_DB -ErrorAction SilentlyContinue
  Remove-Item Env:POSTGRES_USER -ErrorAction SilentlyContinue
  Remove-Item Env:POSTGRES_PASSWORD -ErrorAction SilentlyContinue
  if ($composeEnvFile) { Remove-Item -LiteralPath $composeEnvFile -Force -ErrorAction SilentlyContinue }
}
