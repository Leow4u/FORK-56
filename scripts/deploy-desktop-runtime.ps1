# ============================================================================
# Deploy the prebuilt Windows desktop runtime (Cursor-model Setup).
# ============================================================================
# Called from NSIS customInstall and from the packaged Electron repair path.
# Copies extraResources/runtime into %LOCALAPPDATA%\work4you, rewrites
# pyvenv.cfg, seeds HOME templates only when missing, and writes the
# bootstrap marker. Does NOT call install.ps1 stages, GitHub, or PyPI.
#
# Exit 0 when there is no present runtime (dev packs / stub extraResources).
# Exit 1 only when a present bundle failed to deploy or failed the import probe.
# ============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$BundleDir,

    [Parameter(Mandatory = $true)]
    [string]$Work4YouHome,

    [string]$InstallStampPath = "",
    [string]$PinnedCommit = "",
    [string]$PinnedBranch = "main",
    [switch]$SkipImportProbe,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Utf8NoBom {
    param([string]$Path, [string]$Text)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Text, $utf8)
}

function Get-RuntimeManifest {
    param([string]$Dir)
    $path = Join-Path $Dir "manifest.json"
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try {
        return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        return $null
    }
}

# Keep in sync with work4you_cli/runtime_fingerprint.py
$script:SkipSourceDirs = @{ venv = $true; '.git' = $true; '__pycache__' = $true; bin = $true }
$script:SkipSourceFiles = @{
    '.runtime-ref'                   = $true
    '.runtime-payload'               = $true
    '.work4you-bootstrap-complete'   = $true
    '.install_method'                = $true
}

function Get-FileSha256Hex {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant()
    } finally {
        $stream.Dispose()
        $sha.Dispose()
    }
}

function Get-FirstExistingFile {
    param([string]$Root, [string[]]$Relative)
    foreach ($rel in $Relative) {
        $candidate = Join-Path $Root ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Get-SourceTreeSha256 {
    param([string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) { return "" }
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $prefixLen = $rootFull.Length
    $files = @(Get-ChildItem -LiteralPath $rootFull -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
        $rel = $_.FullName.Substring($prefixLen).TrimStart('\', '/')
        $parts = @($rel -split '[\\/]')
        foreach ($part in $parts[0..([Math]::Max(0, $parts.Length - 2))]) {
            if ($script:SkipSourceDirs.ContainsKey($part)) { return $false }
        }
        if ($script:SkipSourceFiles.ContainsKey($_.Name)) { return $false }
        if ($_.Name.EndsWith('.pyc')) { return $false }
        return $true
    } | Sort-Object { $_.FullName.Substring($prefixLen).TrimStart('\', '/').Replace('\', '/') })
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $nul = [byte[]](0)
    foreach ($file in $files) {
        $rel = $file.FullName.Substring($prefixLen).TrimStart('\', '/').Replace('\', '/')
        $relBytes = [Text.Encoding]::UTF8.GetBytes($rel)
        [void]$sha.TransformBlock($relBytes, 0, $relBytes.Length, $null, 0)
        [void]$sha.TransformBlock($nul, 0, 1, $null, 0)
        $bytes = [IO.File]::ReadAllBytes($file.FullName)
        if ($bytes.Length -gt 0) {
            [void]$sha.TransformBlock($bytes, 0, $bytes.Length, $null, 0)
        }
        [void]$sha.TransformBlock($nul, 0, 1, $null, 0)
    }
    [void]$sha.TransformFinalBlock([byte[]]::new(0), 0, 0)
    $hex = [BitConverter]::ToString($sha.Hash).Replace("-", "").ToLowerInvariant()
    $sha.Dispose()
    return $hex
}

function Get-PayloadFingerprint {
    param([string]$Work4YouRoot, [string]$PythonHome, [string]$NodeHome)
    $source = Get-SourceTreeSha256 $Work4YouRoot
    $pyPath = Get-FirstExistingFile $PythonHome @('python.exe', 'bin/python3', 'bin/python')
    $nodePath = Get-FirstExistingFile $NodeHome @('node.exe', 'bin/node', 'node')
    $py = if ($pyPath) { Get-FileSha256Hex $pyPath } else { "" }
    $node = if ($nodePath) { Get-FileSha256Hex $nodePath } else { "" }
    $text = "$source`n$py`n$node"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($text)
        return [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Test-InstalledRuntimeCurrent {
    param([string]$Bundle, [string]$HomeDir)
    $installDir = Join-Path $HomeDir "work4you"
    $pythonHome = Join-Path $HomeDir "python"
    $venvPy = Get-FirstExistingFile $installDir @('venv/Scripts/python.exe', 'venv/bin/python3', 'venv/bin/python')
    if (-not (Test-Path -LiteralPath (Join-Path $Bundle "work4you"))) { return $false }
    if (-not (Test-Path -LiteralPath (Join-Path $Bundle "python"))) { return $false }
    if (-not (Test-Path -LiteralPath $installDir)) { return $false }
    if (-not (Test-Path -LiteralPath $pythonHome)) { return $false }
    if (-not $venvPy) { return $false }
    $incoming = Get-PayloadFingerprint (Join-Path $Bundle "work4you") (Join-Path $Bundle "python") (Join-Path $Bundle "node")
    $installed = Get-PayloadFingerprint $installDir $pythonHome (Join-Path $HomeDir "node")
    return ($incoming -eq $installed)
}

function Update-PyvenvCfg {
    param([string]$VenvDir, [string]$PythonHome)
    $cfg = Join-Path $VenvDir "pyvenv.cfg"
    if (-not (Test-Path -LiteralPath $cfg)) { return }
    $pythonPrefix = $PythonHome.TrimEnd('\', '/')
    $executable = Join-Path $pythonPrefix "python.exe"
    $lines = Get-Content -LiteralPath $cfg
    $seenHome = $false
    $seenExe = $false
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
        if ($line -match '^\s*home\s*=') {
            [void]$out.Add("home = $pythonPrefix")
            $seenHome = $true
        } elseif ($line -match '^\s*executable\s*=') {
            [void]$out.Add("executable = $executable")
            $seenExe = $true
        } else {
            [void]$out.Add($line)
        }
    }
    if (-not $seenHome) { $out.Insert(0, "home = $pythonPrefix") }
    if (-not $seenExe) { [void]$out.Add("executable = $executable") }
    Write-Utf8NoBom -Path $cfg -Text (($out -join "`n") + "`n")
}

function Copy-ReplaceDirectory {
    param([string]$Source, [string]$Destination, [string[]]$Preserve)
    if (-not (Test-Path -LiteralPath $Source)) { return }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        if ($Preserve -contains $_.Name) { return }
        $target = Join-Path $Destination $_.Name
        if ($_.PSIsContainer) {
            if (Test-Path -LiteralPath $target) {
                Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
            }
            Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
        } else {
            Copy-Item -LiteralPath $_.FullName -Destination $target -Force
        }
    }
}

function Seed-HomeTemplates {
    # Do not name this parameter $Home — PowerShell's $HOME is read-only (pwsh 7).
    param([string]$TargetDir, [string]$InstallDir)
    foreach ($name in @("cron", "sessions", "logs", "pairing", "hooks", "image_cache", "audio_cache", "memories", "skills")) {
        New-Item -ItemType Directory -Force -Path (Join-Path $TargetDir $name) | Out-Null
    }
    $envPath = Join-Path $TargetDir ".env"
    if (-not (Test-Path -LiteralPath $envPath)) {
        $example = Join-Path $InstallDir ".env.example"
        if (Test-Path -LiteralPath $example) {
            Copy-Item -LiteralPath $example -Destination $envPath
        } else {
            New-Item -ItemType File -Force -Path $envPath | Out-Null
        }
    }
    $configPath = Join-Path $TargetDir "config.yaml"
    if (-not (Test-Path -LiteralPath $configPath)) {
        $example = Join-Path $InstallDir "cli-config.yaml.example"
        if (Test-Path -LiteralPath $example) {
            Copy-Item -LiteralPath $example -Destination $configPath
        }
    }
    $soulPath = Join-Path $TargetDir "SOUL.md"
    if (-not (Test-Path -LiteralPath $soulPath)) {
        $soul = "You are Work4You, an intelligent AI assistant created by Work4You. You are helpful, knowledgeable, and direct. You assist users with a wide range of tasks including answering questions, writing and editing code, analyzing information, creative work, and executing actions via your tools. You communicate clearly, admit uncertainty when appropriate, and prioritize being genuinely useful over being verbose unless otherwise directed below. Be targeted and efficient in your exploration and investigations.`n"
        Write-Utf8NoBom -Path $soulPath -Text $soul
    }
}

$BundleDir = [System.IO.Path]::GetFullPath($BundleDir)
$Work4YouHome = [System.IO.Path]::GetFullPath($Work4YouHome)
$manifest = Get-RuntimeManifest -Dir $BundleDir

if (-not $manifest -or $manifest.present -ne $true) {
    Write-Host "[work4you] no present prebuilt runtime in $BundleDir; skipping deploy"
    exit 0
}

$bundleWork4You = Join-Path $BundleDir "work4you"
$bundlePython = Join-Path $BundleDir "python"
if (-not (Test-Path -LiteralPath $bundleWork4You) -or -not (Test-Path -LiteralPath $bundlePython)) {
    Write-Error "present runtime manifest is missing work4you/ or python/"
    exit 1
}

if (-not $PinnedCommit -and $InstallStampPath -and (Test-Path -LiteralPath $InstallStampPath)) {
    try {
        $stamp = Get-Content -LiteralPath $InstallStampPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($stamp.commit) { $PinnedCommit = [string]$stamp.commit }
        if (-not $PinnedBranch -and $stamp.branch) { $PinnedBranch = [string]$stamp.branch }
    } catch {}
}
if (-not $PinnedCommit -and $manifest.commit) { $PinnedCommit = [string]$manifest.commit }
if ((-not $PinnedBranch) -and $manifest.branch) { $PinnedBranch = [string]$manifest.branch }
if (-not $PinnedBranch) { $PinnedBranch = "main" }

$installDir = Join-Path $Work4YouHome "work4you"
$pythonHome = Join-Path $Work4YouHome "python"

$skipCopy = -not $Force -and (Test-InstalledRuntimeCurrent -Bundle $BundleDir -HomeDir $Work4YouHome)
if ($skipCopy -and -not $SkipImportProbe) {
    $pythonExe = Join-Path $installDir "venv\Scripts\python.exe"
    $probeOk = $false
    if (Test-Path -LiteralPath $pythonExe) {
        $prevPythonioencoding = $env:PYTHONIOENCODING
        $prevPythonutf8 = $env:PYTHONUTF8
        $env:PYTHONIOENCODING = "utf-8"
        $env:PYTHONUTF8 = "1"
        $env:PYTHONPATH = $installDir
        try {
            & $pythonExe -c "import work4you_cli" | Out-Null
            if ($LASTEXITCODE -eq 0) { $probeOk = $true }
        } catch {
            $probeOk = $false
        } finally {
            if ($null -eq $prevPythonioencoding) { Remove-Item Env:PYTHONIOENCODING -ErrorAction SilentlyContinue } else { $env:PYTHONIOENCODING = $prevPythonioencoding }
            if ($null -eq $prevPythonutf8) { Remove-Item Env:PYTHONUTF8 -ErrorAction SilentlyContinue } else { $env:PYTHONUTF8 = $prevPythonutf8 }
        }
    }
    if (-not $probeOk) { $skipCopy = $false }
}

if ($skipCopy) {
    Write-Host "[work4you] prebuilt runtime already current at $installDir; skipping copy"
    Update-PyvenvCfg -VenvDir (Join-Path $installDir "venv") -PythonHome $pythonHome
    Seed-HomeTemplates -TargetDir $Work4YouHome -InstallDir $installDir
    Write-Utf8NoBom -Path (Join-Path $installDir ".install_method") -Text "desktop`n"
    $runtimeRef = [ordered]@{
        commit     = $PinnedCommit
        branch     = $PinnedBranch
        ref        = $(if ($PinnedCommit) { $PinnedCommit } else { $PinnedBranch })
        updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    Write-Utf8NoBom -Path (Join-Path $installDir ".runtime-ref") -Text (($runtimeRef | ConvertTo-Json -Compress:$false) + "`n")
    $launcherDir = Join-Path $installDir "bin"
    New-Item -ItemType Directory -Force -Path $launcherDir | Out-Null
    $venvDir = Join-Path $installDir "venv"
    foreach ($launcher in @("work4you.exe", "work4you-acp.exe")) {
        $src = Join-Path $venvDir "Scripts\$launcher"
        $dest = Join-Path $launcherDir $launcher
        if ((Test-Path -LiteralPath $src) -and -not (Test-Path -LiteralPath $dest)) {
            Copy-Item -LiteralPath $src -Destination $dest -Force
        }
    }
    if ($PinnedCommit -and $PinnedCommit.Length -ge 7) {
        $marker = [ordered]@{
            schemaVersion = 1
            pinnedCommit  = $PinnedCommit
            pinnedBranch  = $PinnedBranch
            completedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
        Write-Utf8NoBom -Path (Join-Path $installDir ".work4you-bootstrap-complete") -Text (($marker | ConvertTo-Json -Compress:$false) + "`n")
    }
    Write-Host "[work4you] prebuilt runtime ready at $installDir"
    exit 0
}

Write-Host "[work4you] deploying prebuilt runtime to $Work4YouHome"

New-Item -ItemType Directory -Force -Path $Work4YouHome | Out-Null
foreach ($name in @("python", "node", "bin")) {
    $src = Join-Path $BundleDir $name
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $dest = Join-Path $Work4YouHome $name
    if (Test-Path -LiteralPath $dest) {
        Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force
}

Copy-ReplaceDirectory -Source $bundleWork4You -Destination $installDir -Preserve @(".env", ".git")

$venvDir = Join-Path $installDir "venv"
Update-PyvenvCfg -VenvDir $venvDir -PythonHome $pythonHome

Seed-HomeTemplates -TargetDir $Work4YouHome -InstallDir $installDir
Write-Utf8NoBom -Path (Join-Path $installDir ".install_method") -Text "desktop`n"

$runtimeRef = [ordered]@{
    commit     = $PinnedCommit
    branch     = $PinnedBranch
    ref        = $(if ($PinnedCommit) { $PinnedCommit } else { $PinnedBranch })
    updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}
Write-Utf8NoBom -Path (Join-Path $installDir ".runtime-ref") -Text (($runtimeRef | ConvertTo-Json -Compress:$false) + "`n")

# Same layout as install.ps1 Set-PathVariable: launchers live in
# %LOCALAPPDATA%\work4you\work4you\bin, not HOME\bin (HOME\bin is uv/rg).
$launcherDir = Join-Path $installDir "bin"
New-Item -ItemType Directory -Force -Path $launcherDir | Out-Null
foreach ($launcher in @("work4you.exe", "work4you-acp.exe")) {
    $src = Join-Path $venvDir "Scripts\$launcher"
    if (Test-Path -LiteralPath $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $launcherDir $launcher) -Force
    }
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$userPathItems = if ($userPath) { @($userPath -split ";") } else { @() }
$legacyScripts = Join-Path $installDir "venv\Scripts"
$rest = @($userPathItems | Where-Object { $_ -and $_ -ne $launcherDir -and $_ -ne $legacyScripts })
$nodeDir = Join-Path $Work4YouHome "node"
$pathLead = @($launcherDir)
if (Test-Path -LiteralPath (Join-Path $nodeDir "node.exe")) {
    $rest = @($rest | Where-Object { $_ -ne $nodeDir })
    $pathLead = @($nodeDir) + $pathLead
}
$updatedPath = ($pathLead + $rest) -join ";"
if ($updatedPath -ne $userPath) {
    [Environment]::SetEnvironmentVariable("Path", $updatedPath, "User")
}
[Environment]::SetEnvironmentVariable("WORK4YOU_HOME", $Work4YouHome, "User")
$env:WORK4YOU_HOME = $Work4YouHome
$env:Path = "$launcherDir;$env:Path"

$pythonExe = Join-Path $venvDir "Scripts\python.exe"
if (-not $SkipImportProbe) {
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        Write-Error "deployed runtime is missing $pythonExe"
        exit 1
    }

    $prevPythonioencoding = $env:PYTHONIOENCODING
    $prevPythonutf8 = $env:PYTHONUTF8
    $env:PYTHONIOENCODING = "utf-8"
    $env:PYTHONUTF8 = "1"
    $env:PYTHONPATH = $installDir
    try {
        & $pythonExe -c "import work4you_cli" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "deployed interpreter cannot import work4you_cli"
            exit 1
        }
    } finally {
        if ($null -eq $prevPythonioencoding) { Remove-Item Env:PYTHONIOENCODING -ErrorAction SilentlyContinue } else { $env:PYTHONIOENCODING = $prevPythonioencoding }
        if ($null -eq $prevPythonutf8) { Remove-Item Env:PYTHONUTF8 -ErrorAction SilentlyContinue } else { $env:PYTHONUTF8 = $prevPythonutf8 }
    }
}

if ($PinnedCommit -and $PinnedCommit.Length -ge 7) {
    $marker = [ordered]@{
        schemaVersion = 1
        pinnedCommit  = $PinnedCommit
        pinnedBranch  = $PinnedBranch
        completedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    Write-Utf8NoBom -Path (Join-Path $installDir ".work4you-bootstrap-complete") -Text (($marker | ConvertTo-Json -Compress:$false) + "`n")
}

Write-Host "[work4you] prebuilt runtime ready at $installDir"
exit 0
