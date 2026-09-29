$ErrorActionPreference = 'Stop'

# Dossier Tools -> racine du module
$ToolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ModuleRoot = Split-Path -Parent $ToolsDir
$ReleaseDir = Join-Path $ModuleRoot 'Release'
$StageDir = Join-Path $env:TEMP ("use-your-voice-release-" + [guid]::NewGuid().ToString('N'))
$ZipPath = Join-Path $ReleaseDir 'use-your-voice.zip'

Write-Host ''
Write-Host '=== Use Your Voice - Creation de la release Foundry ===' -ForegroundColor Cyan
Write-Host "Module : $ModuleRoot"

# Verifications minimales
$RequiredFiles = @(
    'module.json',
    'scripts',
    'styles'
)

foreach ($RelativePath in $RequiredFiles) {
    $Path = Join-Path $ModuleRoot $RelativePath
    if (-not (Test-Path $Path)) {
        throw "Element requis introuvable : $RelativePath"
    }
}

# Repartir d'une sortie propre
if (Test-Path $ReleaseDir) {
    Remove-Item $ReleaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null
New-Item -ItemType Directory -Path $StageDir | Out-Null

try {
    # Liste blanche : seulement les fichiers utilises par Foundry.
    Copy-Item (Join-Path $ModuleRoot 'module.json') $StageDir -Force
    Copy-Item (Join-Path $ModuleRoot 'scripts') (Join-Path $StageDir 'scripts') -Recurse -Force
    Copy-Item (Join-Path $ModuleRoot 'styles') (Join-Path $StageDir 'styles') -Recurse -Force

    # Le ZIP doit contenir module.json a sa racine (pas de dossier parent).
    Compress-Archive -Path (Join-Path $StageDir '*') -DestinationPath $ZipPath -CompressionLevel Optimal -Force

    # module.json est egalement pratique a joindre a la GitHub Release.
    Copy-Item (Join-Path $ModuleRoot 'module.json') (Join-Path $ReleaseDir 'module.json') -Force

    $Size = [math]::Round((Get-Item $ZipPath).Length / 1KB, 1)
    Write-Host ''
    Write-Host 'Release creee avec succes :' -ForegroundColor Green
    Write-Host "  $ZipPath ($Size Ko)"
    Write-Host "  $(Join-Path $ReleaseDir 'module.json')"
    Write-Host ''
    Write-Host 'Contenu du ZIP : module.json, scripts/, styles/' -ForegroundColor DarkGray
}
finally {
    if (Test-Path $StageDir) {
        Remove-Item $StageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
