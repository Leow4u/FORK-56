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
    [switch]$SkipImportProbe
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
    param([string]$Home, [string]$InstallDir)
    foreach ($name in @("cron", "sessions", "logs", "pairing", "hooks", "image_cache", "audio_cache", "memories", "skills")) {
        New-Item -ItemType Directory -Force -Path (Join-Path $Home $name) | Out-Null
    }
    $envPath = Join-Path $Home ".env"
    if (-not (Test-Path -LiteralPath $envPath)) {
        $example = Join-Path $InstallDir ".env.example"
        if (Test-Path -LiteralPath $example) {
            Copy-Item -LiteralPath $example -Destination $envPath
        } else {
            New-Item -ItemType File -Force -Path $envPath | Out-Null
        }
    }
    $configPath = Join-Path $Home "config.yaml"
    if (-not (Test-Path -LiteralPath $configPath)) {
        $example = Join-Path $InstallDir "cli-config.yaml.example"
        if (Test-Path -LiteralPath $example) {
            Copy-Item -LiteralPath $example -Destination $configPath
        }
    }
    $soulPath = Join-Path $Home "SOUL.md"
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

Seed-HomeTemplates -Home $Work4YouHome -InstallDir $installDir
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
