# Native NSIS install + actual Electron/backend readiness. Always uses a new sandbox.
param(
    [Parameter(Mandatory = $true)][string]$InstallerPath,
    [string]$JsonOut = "install-smoke-windows.json",
    [string]$LogOut = "install-smoke-windows.log",
    [string]$ExpectedCommit = "",
    [string]$Sha256 = "",
    [string]$NextInstallerPath = "",
    [string]$NextCommit = "",
    [string]$NextSha256 = "",
    [switch]$RequireSigned
)
$ErrorActionPreference = "Stop"
$smokeArgs = @((Join-Path $PSScriptRoot "desktop_install_smoke.py"), "--installer", $InstallerPath,
    "--json-out", $JsonOut, "--log-out", $LogOut)
if ($ExpectedCommit) { $smokeArgs += @("--commit", $ExpectedCommit) }
if ($Sha256) { $smokeArgs += @("--sha256", $Sha256) }
if ($NextInstallerPath) { $smokeArgs += @("--next-installer", $NextInstallerPath) }
if ($NextCommit) { $smokeArgs += @("--next-commit", $NextCommit) }
if ($NextSha256) { $smokeArgs += @("--next-sha256", $NextSha256) }
if ($RequireSigned) { $smokeArgs += "--require-signed" }
& python @smokeArgs
exit $LASTEXITCODE
