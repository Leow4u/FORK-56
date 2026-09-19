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
    Set-Content -LiteralPath (Join-Path $work4you "venv\Scripts\python.exe") -Value "py" -Encoding ASCII
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
    $expectedPython = [System.IO.Path]::GetFullPath((Join-Path $destHome "python"))
    $cfgNorm = ($cfg -replace '/', '\').ToLowerInvariant()
    Assert-True ($cfgNorm.Contains($expectedPython.ToLowerInvariant())) "pyvenv.cfg was not relocated to $expectedPython`n$cfg"
    Assert-True ($cfg -notmatch '(?i)C:\\Users\\runner\\python') "builder path leaked into pyvenv.cfg`n$cfg"
    Assert-True ((Get-Content -LiteralPath (Join-Path $destHome ".env") -Raw) -match "KEEP=1") "HOME .env was overwritten"
    Assert-True (Test-Path -LiteralPath (Join-Path $destHome "work4you\.work4you-bootstrap-complete")) "bootstrap marker missing"
    Assert-True (Test-Path -LiteralPath (Join-Path $destHome "SOUL.md")) "SOUL.md was not seeded"
    Assert-True (Test-Path -LiteralPath (Join-Path $destHome "work4you\bin\work4you.exe")) "launcher was not copied to work4you\bin"

    $canary = Join-Path $destHome "python\CANARY.txt"
    Set-Content -LiteralPath $canary -Value "keep`n" -Encoding ASCII
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deploy `
        -BundleDir $bundle `
        -Work4YouHome $destHome `
        -PinnedCommit $commit `
        -PinnedBranch main `
        -SkipImportProbe
    Assert-True ($LASTEXITCODE -eq 0) "second deploy (skip) failed: $LASTEXITCODE"
    Assert-True (Test-Path -LiteralPath $canary) "matching payload must not recopy python/"
    Assert-True ((Get-Content -LiteralPath $canary -Raw) -match "keep") "canary overwritten on skip"

    Set-Content -LiteralPath (Join-Path $work4you "work4you_cli\__init__.py") -Value "__version__='1'`n" -Encoding ASCII
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deploy `
        -BundleDir $bundle `
        -Work4YouHome $destHome `
        -PinnedCommit $commit `
        -PinnedBranch main `
        -SkipImportProbe
    Assert-True ($LASTEXITCODE -eq 0) "third deploy (source change) failed: $LASTEXITCODE"
    Assert-True (-not (Test-Path -LiteralPath $canary)) "changed source must recopy python/"
} finally {
    Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "test-deploy-desktop-runtime.ps1: ok"
