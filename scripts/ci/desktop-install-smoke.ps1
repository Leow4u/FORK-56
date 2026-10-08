# End-to-end desktop install smoke (Windows NSIS).
# Measures silent Setup duration, logs install/deploy details, verifies import probe.
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,

    [string]$JsonOut = "install-smoke.json",

    [string]$LogOut = "install-smoke.log",

    [string]$Work4YouHome = ""
)

$ErrorActionPreference = "Stop"

if (-not $Work4YouHome) {
    $Work4YouHome = Join-Path $env:LOCALAPPDATA "work4you"
}

function Write-JsonFile {
    param([hashtable]$Data, [string]$Path)
    $json = $Data | ConvertTo-Json -Depth 8 -Compress:$false
    [System.IO.File]::WriteAllText($Path, $json + "`n", (New-Object System.Text.UTF8Encoding $false))
}

function Get-UnixMs {
    return [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
}

function Get-FileSha256Hex {
    param([string]$Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant()
    } finally {
        $stream.Dispose()
        $sha.Dispose()
    }
}

function Get-DirSizeBytes {
    param([string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) { return 0 }
    return (Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
}

function Find-InstalledAppRoot {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Work4You"),
        (Join-Path $env:LOCALAPPDATA "Work4You"),
        (Join-Path ${env:ProgramFiles} "Work4You"),
        (Join-Path ${env:ProgramFiles(x86)} "Work4You")
    )
    foreach ($dir in $candidates) {
        $exe = Join-Path $dir "Work4You.exe"
        if (Test-Path -LiteralPath $exe) { return (Resolve-Path -LiteralPath $dir).Path }
    }
    $found = Get-ChildItem -Path $env:LOCALAPPDATA -Recurse -Filter "Work4You.exe" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($found) { return $found.Directory.FullName }
    return $null
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

$logLines = [System.Collections.Generic.List[string]]::new()
function Log([string]$Message) {
    $line = "{0:u}  {1}" -f (Get-Date), $Message
    $logLines.Add($line) | Out-Null
    Write-Host $line
}

if (-not (Test-Path -LiteralPath $InstallerPath)) {
    throw "Installer not found: $InstallerPath"
}

$installerResolved = (Resolve-Path -LiteralPath $InstallerPath).Path
$installerInfo = Get-Item -LiteralPath $installerResolved
$pythonProbe = Join-Path $Work4YouHome "work4you\venv\Scripts\python.exe"
$marker = Join-Path $Work4YouHome "work4you\.work4you-bootstrap-complete"
$fingerprint = Join-Path $Work4YouHome "work4you\.runtime-fingerprint"

$installStart = Get-UnixMs
$result = @{
    platform      = "win32"
    mode          = "nsis-silent"
    installer     = @{
        path       = $installerResolved
        bytes      = [int64]$installerInfo.Length
        sha256     = ""
    }
    work4youHome  = $Work4YouHome
    installDir    = $null
    runtimeBundle = $null
    success       = $false
    timingsMs     = @{}
    phases        = @()
    error         = ""
}

function Add-Phase {
    param([string]$Name, [int64]$StartMs, [int64]$EndMs, [hashtable]$Extra = @{})
    $phase = @{
        name    = $Name
        startMs = $StartMs
        endMs   = $EndMs
        ms      = ($EndMs - $StartMs)
    }
    foreach ($k in $Extra.Keys) { $phase[$k] = $Extra[$k] }
    $result.phases += ,$phase
}

try {
    Log "=== Work4You desktop install smoke (Windows) ==="
    Log "Installer: $installerResolved ($([int64]$installerInfo.Length) bytes)"

    $hashStart = Get-UnixMs
    $result.installer.sha256 = Get-FileSha256Hex -Path $installerResolved
    $hashEnd = Get-UnixMs
    Log "SHA256: $($result.installer.sha256)"
    Add-Phase -Name "hashInstaller" -StartMs $hashStart -EndMs $hashEnd

    if (Test-Path -LiteralPath $Work4YouHome) {
        Log "Removing prior WORK4YOU_HOME: $Work4YouHome"
        Remove-Item -LiteralPath $Work4YouHome -Recurse -Force -ErrorAction SilentlyContinue
    }

    Log "Starting NSIS silent install (/S)..."
    $installStart = Get-UnixMs
    $proc = Start-Process -FilePath $installerResolved -ArgumentList @("/S") -Wait -PassThru -NoNewWindow
    $installEnd = Get-UnixMs
    $result.timingsMs.install = $installEnd - $installStart
    $result.installExitCode = $proc.ExitCode
    Log "NSIS finished exit=$($proc.ExitCode) durationMs=$($result.timingsMs.install)"
    Add-Phase -Name "nsisSilentInstall" -StartMs $installStart -EndMs $installEnd -Extra @{ exitCode = $proc.ExitCode }

    if ($proc.ExitCode -ne 0) {
        throw "NSIS silent install exit code $($proc.ExitCode)"
    }

    $deployPhasesPath = Join-Path $Work4YouHome "install-deploy-phases.json"
    $deployArtifact = Read-JsonFile -Path $deployPhasesPath
    if ($deployArtifact) {
        $deployTotal = [int64]($deployArtifact.deployTotalMs)
        $result.deployPhases = @($deployArtifact.phases)
        $result.timingsMs.deployRuntime = $deployTotal
        if ($null -ne $result.timingsMs.install) {
            $result.timingsMs.nsisExtractEstimate = [int64]$result.timingsMs.install - $deployTotal
        }
        if ($deployArtifact.skippedCopy -eq $true) {
            Log "Deploy skipped copy (fingerprint match); deployTotalMs=$deployTotal"
        } else {
            Log "Deploy runtime phases recorded; deployTotalMs=$deployTotal"
        }
        foreach ($dp in @($deployArtifact.phases)) {
            $phaseName = "deploy:$($dp.name)"
            $ms = [int64]$dp.ms
            Add-Phase -Name $phaseName -StartMs 0 -EndMs $ms -Extra @{ ms = $ms; deployPhase = $true }
        }
    } else {
        $result.deployPhasesMissing = $true
        Log "WARNING: missing $deployPhasesPath (installer predates deploy phase instrumentation?)"
    }

    $discoverStart = Get-UnixMs
    $installDir = Find-InstalledAppRoot
    $discoverEnd = Get-UnixMs
    $result.installDir = $installDir
    Log "Install dir: $(if ($installDir) { $installDir } else { '<not found>' })"
    Add-Phase -Name "discoverInstallDir" -StartMs $discoverStart -EndMs $discoverEnd -Extra @{ installDir = $installDir }

    if ($installDir) {
        $runtimeDir = Join-Path $installDir "resources\runtime"
        $manifestPath = Join-Path $runtimeDir "manifest.json"
        $stampPath = Join-Path $installDir "resources\install-stamp.json"
        $manifest = Read-JsonFile -Path $manifestPath
        $stamp = Read-JsonFile -Path $stampPath
        $bundleBytes = Get-DirSizeBytes -Root $runtimeDir
        $result.runtimeBundle = @{
            path    = $runtimeDir
            bytes   = [int64]$bundleBytes
            present = if ($manifest) { $manifest.present } else { $null }
            commit  = if ($manifest) { $manifest.commit } else { $null }
            branch  = if ($manifest) { $manifest.branch } else { $null }
        }
        Log "Bundled runtime: $runtimeDir ($bundleBytes bytes) present=$($result.runtimeBundle.present)"
        if ($stamp) {
            Log "install-stamp.json commit=$($stamp.commit) branch=$($stamp.branch)"
        }
    }

    if (-not (Test-Path -LiteralPath $pythonProbe)) {
        throw "Missing deployed python after install: $pythonProbe"
    }
    if (-not (Test-Path -LiteralPath $marker)) {
        throw "Missing bootstrap marker after install: $marker"
    }

    $homeBytes = Get-DirSizeBytes -Root $Work4YouHome
    Log "WORK4YOU_HOME size after install: $homeBytes bytes"
    $pyvenv = Join-Path $Work4YouHome "work4you\venv\pyvenv.cfg"
    if (Test-Path -LiteralPath $pyvenv) {
        $cfg = (Get-Content -LiteralPath $pyvenv -Raw).Trim()
        Log "pyvenv.cfg:`n$cfg"
    }
    if (Test-Path -LiteralPath $fingerprint) {
        Log "runtime fingerprint: $((Get-Content -LiteralPath $fingerprint -Raw).Trim())"
    }

    $probeStart = Get-UnixMs
    Log "Import probe: import work4you_cli"
    $probeOut = & $pythonProbe -c "import work4you_cli; print(work4you_cli.__file__)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "import work4you_cli failed: $probeOut"
    }
    Log "work4you_cli at: $probeOut"
    $probeEnd = Get-UnixMs
    $result.timingsMs.importProbe = $probeEnd - $probeStart
    $result.timingsMs.total = $probeEnd - $installStart
    $result.deployedHomeBytes = [int64]$homeBytes
    $result.success = $true
    Add-Phase -Name "importProbe" -StartMs $probeStart -EndMs $probeEnd
    Log "SUCCESS totalMs=$($result.timingsMs.total)"
}
catch {
    $result.error = $_.Exception.Message
    Log "FAILED: $($result.error)"
    if (-not $result.timingsMs.total) {
        $result.timingsMs.total = (Get-UnixMs) - $installStart
    }
    [System.IO.File]::WriteAllLines($LogOut, $logLines, (New-Object System.Text.UTF8Encoding $false))
    Write-JsonFile -Data $result -Path $JsonOut
    Write-Host ($result | ConvertTo-Json -Depth 8)
    exit 1
}

[System.IO.File]::WriteAllLines($LogOut, $logLines, (New-Object System.Text.UTF8Encoding $false))
Write-JsonFile -Data $result -Path $JsonOut
Write-Host ($result | ConvertTo-Json -Depth 8)
exit 0
