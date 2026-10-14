$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$securePassword = Read-Host "Enter a new unique admin password (at least 14 characters; input hidden)" -AsSecureString
$passwordPointer = [IntPtr]::Zero
try {
  if ($securePassword.Length -lt 14) { throw "Admin password must be at least 14 characters. Run the script again with a longer unique password." }

  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:ADMIN_EMAIL = "admin@albayyan.com"
  $env:ADMIN_NAME = "Admin"
  $env:ADMIN_PASSWORD = $password

  $tsxCli = Join-Path $projectRoot "node_modules\.bin\tsx.cmd"
  if (-not (Test-Path -LiteralPath $tsxCli)) { throw "tsx is missing. Run npm install first." }
  & $tsxCli (Join-Path $projectRoot "scripts\bootstrap-admin.ts")
  if ($LASTEXITCODE -ne 0) { throw "Admin bootstrap failed. Check the database connection and try again." }
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
  Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  if ($securePassword) { $securePassword.Dispose() }
  Remove-Variable password -ErrorAction SilentlyContinue
}