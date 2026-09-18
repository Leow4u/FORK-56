# ============================================================================
# Build the prebuilt Windows desktop runtime for Setup.exe extraResources.
# ============================================================================
# Windows CI only. Filters the runtime allowlist, installs portable CPython
# via uv, creates a venv, runs `uv sync --extra all --locked`, ships portable
# Node + rg + uv, then relocates the tree to a temp HOME and probes
# `import work4you_cli`.
# ============================================================================

param(
    [string]$RepoRoot = "",
    [string]$OutDir = "",
    [string]$PythonVersion = "3.11",
    [string]$NodeFullVersion = "22.20.0",
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
$spec = Get-Content -LiteralPath $specPath -Raw -Encoding UTF8 | ConvertFrom-Json

function Test-RuntimeRelativePath {
    param([string]$Rel)
    $rel = $Rel.Replace('\', '/').Trim('/')
    if (-not $rel) { return $false }
    $parts = @($rel.Split('/') | Where-Object { $_ -and $_ -ne '.' })
    if ($parts -contains '..') { return $false }
    $top = $parts[0]
    if ($spec.directories -contains $top) { return $true }
    foreach ($prefix in @($spec.prefixes)) {
        $p = [string]$prefix
        if ($rel -eq $p -or $rel.StartsWith("$p/")) { return $true }
        if ($p.StartsWith("$rel/")) { return $true }
    }
    if ($parts.Count -eq 1) {
        if ($spec.files -contains $top) { return $true }
        if ($spec.include_root_python_modules -and $top.EndsWith('.py')) { return $true }
    }
    return $false
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
Get-ChildItem -LiteralPath $RepoRoot -Force | ForEach-Object {
    $rel = $_.Name
    if ($_.PSIsContainer) {
        $children = Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue
        foreach ($file in $children) {
            $inner = $file.FullName.Substring($RepoRoot.Length).TrimStart('\', '/')
            if (-not (Test-RuntimeRelativePath $inner)) { continue }
            $dest = Join-Path $payloadRoot $inner
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
        }
    } else {
        if (-not (Test-RuntimeRelativePath $rel)) { return }
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $payloadRoot $rel) -Force
    }
}

Write-Host "[runtime] installing CPython $PythonVersion"
& $UvCmd python install $PythonVersion
if ($LASTEXITCODE -ne 0) { throw "uv python install $PythonVersion failed" }
$foundPython = & $UvCmd python find $PythonVersion
if ($LASTEXITCODE -ne 0 -or -not $foundPython) { throw "uv python find $PythonVersion failed" }
$foundPython = $foundPython.Trim()
$foundHome = Split-Path -Parent $foundPython
Write-Host "[runtime] copying CPython from $foundHome"
Copy-Item -LiteralPath $foundHome -Destination $pythonHome -Recurse -Force
$bundlePython = Join-Path $pythonHome "python.exe"
if (-not (Test-Path -LiteralPath $bundlePython)) {
    throw "copied CPython is missing python.exe"
}

Write-Host "[runtime] creating venv + sync --extra all --locked"
$venvDir = Join-Path $payloadRoot "venv"
$env:UV_PROJECT_ENVIRONMENT = $venvDir
$env:VIRTUAL_ENV = $venvDir
$env:UV_PYTHON = $bundlePython
Push-Location $payloadRoot
try {
    & $UvCmd venv $venvDir --python $bundlePython
    if ($LASTEXITCODE -ne 0) { throw "uv venv failed" }
    & $UvCmd sync --extra all --locked
    if ($LASTEXITCODE -ne 0) { throw "uv sync --extra all --locked failed" }
} finally {
    Pop-Location
}

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

$deploySrc = Join-Path $RepoRoot "scripts\deploy-desktop-runtime.ps1"
Copy-Item -LiteralPath $deploySrc -Destination (Join-Path $OutDir "deploy-desktop-runtime.ps1") -Force

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

if (-not $SkipRelocateTest) {
    Write-Host "[runtime] relocate self-test"
    $testHome = Join-Path $env:TEMP ("work4you-runtime-relocate-" + [guid]::NewGuid().ToString("n"))
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deploySrc `
            -BundleDir $OutDir `
            -Work4YouHome $testHome `
            -PinnedCommit $commit `
            -PinnedBranch $branch
        if ($LASTEXITCODE -ne 0) { throw "relocate deploy failed" }
        $probe = Join-Path $testHome "work4you\venv\Scripts\python.exe"
        $env:PYTHONPATH = Join-Path $testHome "work4you"
        & $probe -c "import work4you_cli"
        if ($LASTEXITCODE -ne 0) { throw "relocate probe failed" }
    } finally {
        Remove-Item -LiteralPath $testHome -Recurse -Force -ErrorAction SilentlyContinue
    }
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
