$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
if (-not (Test-Path -LiteralPath $envPath)) { throw "Project .env file was not found." }

$securePassword = Read-Host "Enter the Supabase database password (input hidden)" -AsSecureString
$passwordPointer = [IntPtr]::Zero
try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $encodedPassword = [System.Uri]::EscapeDataString($password)
  $username = "postgres.iaacmbpavuplfhxckwfi"
  $poolerHost = "aws-0-eu-west-1.pooler.supabase.com"
  $databaseUrl = "postgresql://${username}:${encodedPassword}@${poolerHost}:6543/postgres?pgbouncer=true"
  $directUrl = "postgresql://${username}:${encodedPassword}@${poolerHost}:5432/postgres"

  $content = [System.IO.File]::ReadAllText($envPath)
  $newline = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
  $content = [regex]::Replace($content, '(?m)^\s*DATABASE_URL\s*=.*$', "DATABASE_URL=`"$databaseUrl`"")
  if ([regex]::IsMatch($content, '(?m)^\s*DIRECT_URL\s*=')) {
    $content = [regex]::Replace($content, '(?m)^\s*DIRECT_URL\s*=.*$', "DIRECT_URL=`"$directUrl`"")
  } else {
    if (-not $content.EndsWith("`n")) { $content += $newline }
    $content += "DIRECT_URL=`"$directUrl`"$newline"
  }
  [System.IO.File]::WriteAllText($envPath, $content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Supabase connection URLs were written to the ignored .env file. Credentials were not displayed."
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
  if ($password) { [Array]::Clear($password.ToCharArray(), 0, $password.Length) }
  if ($securePassword) { $securePassword.Dispose() }
  Remove-Variable password, encodedPassword, databaseUrl, directUrl -ErrorAction SilentlyContinue
}