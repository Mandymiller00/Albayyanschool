$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Read-SecretValue([string]$Prompt) {
  $secureValue = Read-Host $Prompt -AsSecureString
  $pointer = [IntPtr]::Zero
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $secureValue.Dispose()
  }
}

$databaseUrl = $null
$directUrl = $null
$adminPassword = $null
try {
  $databaseUrl = Read-SecretValue "Neon pooled DATABASE_URL"
  $directUrl = Read-SecretValue "Neon direct DIRECT_URL"
  $env:ADMIN_EMAIL = Read-Host "Initial administrator email"
  $env:ADMIN_NAME = Read-Host "Initial administrator name"
  $adminPassword = Read-SecretValue "Unique administrator password (at least 14 characters)"

  if (-not $databaseUrl.StartsWith("postgresql://") -and -not $databaseUrl.StartsWith("postgres://")) {
    throw "DATABASE_URL must be a PostgreSQL connection string."
  }
  if (-not $directUrl.StartsWith("postgresql://") -and -not $directUrl.StartsWith("postgres://")) {
    throw "DIRECT_URL must be a PostgreSQL connection string."
  }

  $env:DATABASE_URL = $databaseUrl
  $env:DIRECT_URL = $directUrl
  $env:ADMIN_PASSWORD = $adminPassword

  $tsxCli = Join-Path $projectRoot "node_modules\.bin\tsx.cmd"
  if (-not (Test-Path -LiteralPath $tsxCli)) {
    throw "tsx is missing. Run npm install first."
  }
  & $tsxCli (Join-Path $projectRoot "scripts\bootstrap-admin.ts")
  if ($LASTEXITCODE -ne 0) {
    throw "Administrator bootstrap failed. Check the database connection and try again."
  }
} finally {
  Remove-Item Env:DATABASE_URL, Env:DIRECT_URL, Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable databaseUrl, directUrl, adminPassword -ErrorAction SilentlyContinue
}
