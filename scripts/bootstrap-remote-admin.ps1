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

function Normalize-PostgresUrl([string]$Value, [string]$VariableName) {
  $normalizedValue = $Value.Trim().Trim('`').Trim('"').Trim("'").Trim()
  $assignmentPattern = "^(?:export\s+)?$([Regex]::Escape($VariableName))\s*[:=]\s*"
  $normalizedValue = [Regex]::Replace($normalizedValue, $assignmentPattern, "", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase).Trim().Trim('`').Trim('"').Trim("'").Trim()
  if ($normalizedValue -notmatch '^(?i:postgresql|postgres)://\S+$') {
    throw "$VariableName must contain a full Neon connection string beginning with postgresql:// or postgres:// (not just the endpoint hostname)."
  }
  return $normalizedValue
}

$databaseUrl = $null
$directUrl = $null
$adminPassword = $null
try {
  $databaseUrl = Normalize-PostgresUrl (Read-SecretValue "Neon pooled DATABASE_URL") "DATABASE_URL"
  $directUrl = Normalize-PostgresUrl (Read-SecretValue "Neon direct DIRECT_URL") "DIRECT_URL"
  $env:ADMIN_EMAIL = Read-Host "Initial administrator email"
  $env:ADMIN_NAME = Read-Host "Initial administrator name"
  $adminPassword = Read-SecretValue "Unique administrator password (at least 14 characters)"

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
