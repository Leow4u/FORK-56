# ============================================================================
# Build the prebuilt Windows desktop runtime for Setup.exe extraResources.
# ============================================================================
# Windows CI only. Builds portable Python with locked dependencies, compiled
# interfaces and all standard desktop tools. The app runs this tree directly;
# no HOME deployment or venv rewrite is needed on the user machine.
# ============================================================================

param(
    [string]$RepoRoot = "",
    [string]$OutDir = "",
    [string]$PythonVersion = "3.11",
    [string]$NodeFullVersion = "22.22.0",
    [string]$RipgrepVersion = "14.1.1",
    [string]$ZipOut = "",
    [switch]$SkipRelocateTest
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
if (-not $OutDir) {
    $OutDir = Join-Path $RepoRoot "apps\desktop\build\runtime"
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)

$specPath = Join-Path $RepoRoot "work4you_cli\data\runtime_payload.json"
if (-not (Test-Path -LiteralPath $specPath)) {
    throw "runtime allowlist missing: $specPath"
}

function Get-WindowsArch {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
    if ($arch -eq 'x64' -or $arch -eq 'amd64') { return 'x64' }
    if ($arch -eq 'arm64') { return 'arm64' }
    return 'x64'
}

function Install-UvIfNeeded {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        return (Get-Command uv).Source
    }
    $uvDir = Join-Path $env:TEMP "work4you-ci-uv"
    New-Item -ItemType Directory -Force -Path $uvDir | Out-Null
    $zip = Join-Path $env:TEMP "uv-windows.zip"
    Invoke-WebRequest -Uri "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip" -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $uvDir -Force
    $uv = Get-ChildItem -Path $uvDir -Recurse -Filter "uv.exe" | Select-Object -First 1
    if (-not $uv) { throw "failed to download uv.exe" }
    return $uv.FullName
}

$arch = Get-WindowsArch
$UvCmd = Install-UvIfNeeded
Write-Host "[runtime] uv: $UvCmd  arch=$arch"

if (Test-Path -LiteralPath $OutDir) {
    Remove-Item -LiteralPath $OutDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$payloadRoot = Join-Path $OutDir "work4you"
$pythonHome = Join-Path $OutDir "python"
$nodeHome = Join-Path $OutDir "node"
$binHome = Join-Path $OutDir "bin"
New-Item -ItemType Directory -Force -Path $payloadRoot, $binHome | Out-Null

Write-Host "[runtime] copying allowlist from $RepoRoot"
$prepareScript = Join-Path $RepoRoot "scripts\ci\prepare_desktop_runtime.py"
& python $prepareScript payload --runtime-dir $OutDir --repo-root $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "runtime source copy failed" }

Write-Host "[runtime] installing CPython $PythonVersion"
& $UvCmd python install $PythonVersion
if ($LASTEXITCODE -ne 0) { throw "uv python install $PythonVersion failed" }
$foundPython = & $UvCmd python find --managed-python --no-project $PythonVersion
if ($LASTEXITCODE -ne 0 -or -not $foundPython) { throw "uv python find $PythonVersion failed" }
$foundPython = $foundPython.Trim()
$foundHome = Split-Path -Parent $foundPython
Write-Host "[runtime] copying CPython from $foundHome"
Copy-Item -LiteralPath $foundHome -Destination $pythonHome -Recurse -Force
$bundlePython = Join-Path $pythonHome "python.exe"
if (-not (Test-Path -LiteralPath $bundlePython)) {
    throw "copied CPython is missing python.exe"
}

Write-Host "[runtime] installing locked dependencies into portable Python"
$prepareScript = Join-Path $RepoRoot "scripts\ci\prepare_desktop_runtime.py"
& python $prepareScript python --runtime-dir $OutDir --repo-root $RepoRoot --uv $UvCmd
if ($LASTEXITCODE -ne 0) { throw "portable Python dependency build failed" }
& python $prepareScript interfaces --runtime-dir $OutDir --repo-root $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "interface build failed" }

Copy-Item -LiteralPath $UvCmd -Destination (Join-Path $binHome "uv.exe") -Force

Write-Host "[runtime] portable Node $NodeFullVersion"
$nodeZipName = "node-v$NodeFullVersion-win-$arch.zip"
if ($arch -eq "arm64") { $nodeZipName = "node-v$NodeFullVersion-win-arm64.zip" }
$nodeZip = Join-Path $env:TEMP $nodeZipName
$nodeExtract = Join-Path $env:TEMP "work4you-node-extract"
Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeFullVersion/$nodeZipName" -OutFile $nodeZip -UseBasicParsing
if (Test-Path -LiteralPath $nodeExtract) { Remove-Item -LiteralPath $nodeExtract -Recurse -Force }
Expand-Archive -Path $nodeZip -DestinationPath $nodeExtract -Force
$nodeInner = Get-ChildItem -Path $nodeExtract -Directory | Select-Object -First 1
if (-not $nodeInner) { throw "Node zip did not contain a directory" }
Copy-Item -LiteralPath $nodeInner.FullName -Destination $nodeHome -Recurse -Force

Write-Host "[runtime] ripgrep $RipgrepVersion"
$rgAsset = if ($arch -eq "arm64") {
    "ripgrep-$RipgrepVersion-aarch64-pc-windows-msvc.zip"
} else {
    "ripgrep-$RipgrepVersion-x86_64-pc-windows-msvc.zip"
}
$rgZip = Join-Path $env:TEMP $rgAsset
$rgExtract = Join-Path $env:TEMP "work4you-rg-extract"
Invoke-WebRequest -Uri "https://github.com/BurntSushi/ripgrep/releases/download/$RipgrepVersion/$rgAsset" -OutFile $rgZip -UseBasicParsing
if (Test-Path -LiteralPath $rgExtract) { Remove-Item -LiteralPath $rgExtract -Recurse -Force }
Expand-Archive -Path $rgZip -DestinationPath $rgExtract -Force
$rgExe = Get-ChildItem -Path $rgExtract -Recurse -Filter "rg.exe" | Select-Object -First 1
if (-not $rgExe) { throw "ripgrep zip missing rg.exe" }
Copy-Item -LiteralPath $rgExe.FullName -Destination (Join-Path $binHome "rg.exe") -Force

Write-Host "[runtime] preparing standard browser and computer-use"
& python (Join-Path $RepoRoot "scripts\ci\build-desktop-capabilities.py") --runtime-dir $OutDir --repo-root $RepoRoot --uv $UvCmd
if ($LASTEXITCODE -ne 0) { throw "browser/computer-use build failed" }
& python (Join-Path $RepoRoot "scripts\ci\build-desktop-core-tools.py") --runtime-dir $OutDir --repo-root $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "core tools build failed" }
& python (Join-Path $RepoRoot "scripts\ci\build-desktop-voice.py") --runtime-dir $OutDir --repo-root $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "voice/wake build failed" }

$commit = $env:GITHUB_SHA
if (-not $commit) {
    try { $commit = (git -C $RepoRoot rev-parse HEAD).Trim() } catch { $commit = "" }
}
$branch = $env:GITHUB_REF_NAME
if (-not $branch) { $branch = "main" }

$manifest = [ordered]@{
    schemaVersion = 1
    present       = $true
    commit        = $commit
    branch        = $branch
    arch          = $arch
    python        = $PythonVersion
    node          = $NodeFullVersion
    builtAt       = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $OutDir "manifest.json"), (($manifest | ConvertTo-Json -Compress:$false) + "`n"), $utf8)

& python $prepareScript finalize --runtime-dir $OutDir --repo-root $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "runtime finalization failed" }
if (-not $SkipRelocateTest) {
    Write-Host "[runtime] verifying relocated runtime without deployment"
    & python $prepareScript verify --runtime-dir $OutDir --repo-root $RepoRoot
    if ($LASTEXITCODE -ne 0) { throw "runtime relocation verification failed" }
}

if ($ZipOut) {
    $ZipOut = [System.IO.Path]::GetFullPath($ZipOut)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ZipOut) | Out-Null
    if (Test-Path -LiteralPath $ZipOut) { Remove-Item -LiteralPath $ZipOut -Force }
    Write-Host "[runtime] writing $ZipOut"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($OutDir, $ZipOut)
}

Write-Host "[runtime] ready at $OutDir"
