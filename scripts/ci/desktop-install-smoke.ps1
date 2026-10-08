# End-to-end desktop install smoke (Windows NSIS).
# Measures silent Setup duration and verifies the deployed runtime import probe.
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,

    [string]$JsonOut = "install-smoke.json",

    [string]$Work4YouHome = ""
)

$ErrorActionPreference = "Stop"

if (-not $Work4YouHome) {
    $Work4YouHome = Join-Path $env:LOCALAPPDATA "work4you"
}

function Write-JsonFile {
    param([hashtable]$Data, [string]$Path)
    $json = $Data | ConvertTo-Json -Depth 6 -Compress:$false
    [System.IO.File]::WriteAllText($Path, $json + "`n", (New-Object System.Text.UTF8Encoding $false))
}

function Get-UnixMs {
    return [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
}

if (-not (Test-Path -LiteralPath $InstallerPath)) {
    throw "Installer not found: $InstallerPath"
}

$pythonProbe = Join-Path $Work4YouHome "work4you\venv\Scripts\python.exe"
$marker = Join-Path $Work4YouHome "work4you\.work4you-bootstrap-complete"

$installStart = Get-UnixMs
$result = @{
    platform     = "win32"
    mode         = "nsis-silent"
    installer    = (Resolve-Path -LiteralPath $InstallerPath).Path
    work4youHome = $Work4YouHome
    success      = $false
    timingsMs    = @{}
    error        = ""
}

try {
    # Fresh runner, but repeat runs on a dev box should not inherit a stale venv.
    if (Test-Path -LiteralPath $Work4YouHome) {
        Remove-Item -LiteralPath $Work4YouHome -Recurse -Force -ErrorAction SilentlyContinue
    }

    $installStart = Get-UnixMs
    $proc = Start-Process -FilePath $InstallerPath -ArgumentList @("/S") -Wait -PassThru -NoNewWindow
    $installEnd = Get-UnixMs
    $result.timingsMs.install = $installEnd - $installStart
    $result.installExitCode = $proc.ExitCode

    if ($proc.ExitCode -ne 0) {
        throw "NSIS silent install exit code $($proc.ExitCode)"
    }

    if (-not (Test-Path -LiteralPath $pythonProbe)) {
        throw "Missing deployed python after install: $pythonProbe"
    }
    if (-not (Test-Path -LiteralPath $marker)) {
        throw "Missing bootstrap marker after install: $marker"
    }

    $probeStart = Get-UnixMs
    & $pythonProbe -c "import work4you_cli; print('ok')"
    if ($LASTEXITCODE -ne 0) {
        throw "import work4you_cli failed with exit $LASTEXITCODE"
    }
    $probeEnd = Get-UnixMs
    $result.timingsMs.importProbe = $probeEnd - $probeStart
    $result.timingsMs.total = $probeEnd - $installStart
    $result.success = $true
}
catch {
    $result.error = $_.Exception.Message
    if (-not $result.timingsMs.total) {
        $result.timingsMs.total = (Get-UnixMs) - $installStart
    }
    Write-JsonFile -Data $result -Path $JsonOut
    Write-Host ($result | ConvertTo-Json -Depth 6)
    exit 1
}

Write-JsonFile -Data $result -Path $JsonOut
Write-Host ($result | ConvertTo-Json -Depth 6)
exit 0
