# Windows installer-lane coverage for scripts/deploy-desktop-runtime.ps1.
# No network. Uses a fake present bundle and -SkipImportProbe.

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $PSScriptRoot
$deploy = Join-Path $here "deploy-desktop-runtime.ps1"
if (-not (Test-Path -LiteralPath $deploy)) {
    throw "missing $deploy"
}

function Assert-True($cond, $msg) {
    if (-not $cond) { throw $msg }
}

$scratch = Join-Path $env:TEMP ("work4you-deploy-test-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Force -Path $scratch | Out-Null
try {
    $stub = Join-Path $scratch "stub"
    New-Item -ItemType Directory -Force -Path $stub | Out-Null
    '{"schemaVersion":1,"present":false}' | Set-Content -LiteralPath (Join-Path $stub "manifest.json") -Encoding ASCII
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deploy -BundleDir $stub -Work4YouHome (Join-Path $scratch "home-stub")
    Assert-True ($LASTEXITCODE -eq 0) "stub runtime must exit 0"

    $bundle = Join-Path $scratch "bundle"
    $work4you = Join-Path $bundle "work4you"
    New-Item -ItemType Directory -Force -Path (Join-Path $work4you "work4you_cli"), (Join-Path $work4you "venv\Scripts"), (Join-Path $bundle "python"), (Join-Path $bundle "node"), (Join-Path $bundle "bin") | Out-Null
    Set-Content -LiteralPath (Join-Path $work4you "work4you_cli\__init__.py") -Value "__version__='0'`n" -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $work4you "cli-config.yaml.example") -Value "model: {}`n" -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $work4you "venv\pyvenv.cfg") -Value "home = C:\Users\runner\python`nexecutable = C:\Users\runner\python\python.exe`n" -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $work4you "venv\Scripts\work4you.exe") -Value "launcher" -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $bundle "python\python.exe") -Value "py" -Encoding ASCII
    $commit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    $manifest = @{
        schemaVersion = 1
        present       = $true
        commit        = $commit
        branch        = "main"
    } | ConvertTo-Json
    Set-Content -LiteralPath (Join-Path $bundle "manifest.json") -Value $manifest -Encoding ASCII

    # Do not assign $home — it is the read-only $HOME automatic variable on pwsh 7.
    $destHome = Join-Path $scratch "home"
    New-Item -ItemType Directory -Force -Path $destHome | Out-Null
    Set-Content -LiteralPath (Join-Path $destHome ".env") -Value "KEEP=1`n" -Encoding ASCII

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deploy `
        -BundleDir $bundle `
        -Work4YouHome $destHome `
        -PinnedCommit $commit `
        -PinnedBranch main `
        -SkipImportProbe
    Assert-True ($LASTEXITCODE -eq 0) "present bundle deploy failed: $LASTEXITCODE"

    $cfg = Get-Content -LiteralPath (Join-Path $destHome "work4you\venv\pyvenv.cfg") -Raw
    Assert-True ($cfg -match [regex]::Escape((Join-Path $destHome "python"))) "pyvenv.cfg was not relocated"
    Assert-True ($cfg -notmatch "runner") "builder path leaked into pyvenv.cfg"
    Assert-True ((Get-Content -LiteralPath (Join-Path $destHome ".env") -Raw) -match "KEEP=1") "HOME .env was overwritten"
    Assert-True (Test-Path -LiteralPath (Join-Path $destHome "work4you\.work4you-bootstrap-complete")) "bootstrap marker missing"
    Assert-True (Test-Path -LiteralPath (Join-Path $destHome "SOUL.md")) "SOUL.md was not seeded"
    Assert-True (Test-Path -LiteralPath (Join-Path $destHome "work4you\bin\work4you.exe")) "launcher was not copied to work4you\bin"
} finally {
    Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "test-deploy-desktop-runtime.ps1: ok"
