param(
    [string]$ModelsDir = (Join-Path $PSScriptRoot "..\models"),
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ModelsDir = [System.IO.Path]::GetFullPath($ModelsDir)

Write-Host "=================================================="
Write-Host "         MangaShot Model Setup & Downloader       "
Write-Host "=================================================="
Write-Host "Target Directory: $ModelsDir"

# Local candidate locations to link from if present
$colourModels = "F:\TEMP\anime\MangaColour\repo\models"
$translateModels = "F:\TEMP\anime\MangaTranslate\repo\models"

# 1. Bubble Detector
$detDir = Join-Path $ModelsDir "detector"
New-Item -ItemType Directory -Force -Path $detDir | Out-Null
$detFile = Join-Path $detDir "comic-speech-bubble-detector.pt"
$srcDet = Join-Path $translateModels "detector\comic-speech-bubble-detector.pt"

if (-not $Force -and (Test-Path $srcDet) -and -not (Test-Path $detFile)) {
    Write-Host "[1/3] Linking bubble detector from $srcDet..."
    Copy-Item $srcDet $detFile -Force
} elseif ($Force -or -not (Test-Path $detFile)) {
    Write-Host "[1/3] Downloading comic-speech-bubble-detector.pt..."
    & curl.exe -L --fail --retry 10 --retry-delay 3 -C - -o $detFile "https://hf-mirror.com/ogkalu/comic-speech-bubble-detector-yolov8m/resolve/main/comic-speech-bubble-detector.pt"
} else {
    Write-Host "[1/3] OK: Bubble detector already exists."
}

# 2. Manga-OCR Base
$ocrDir = Join-Path $ModelsDir "ocr\manga-ocr-base"
$srcOcr = Join-Path $translateModels "ocr\manga-ocr-base"

if (-not $Force -and (Test-Path $srcOcr) -and -not (Test-Path (Join-Path $ocrDir "model.safetensors"))) {
    Write-Host "[2/3] Copying Manga-OCR base from $srcOcr..."
    New-Item -ItemType Directory -Force -Path $ocrDir | Out-Null
    Copy-Item "$srcOcr\*" $ocrDir -Recurse -Force
} elseif ($Force -or -not (Test-Path (Join-Path $ocrDir "model.safetensors"))) {
    Write-Host "[2/3] Downloading Manga-OCR base..."
    New-Item -ItemType Directory -Force -Path $ocrDir | Out-Null
    $smallFiles = @("config.json", "preprocessor_config.json", "special_tokens_map.json", "tokenizer_config.json", "vocab.txt")
    foreach ($f in $smallFiles) {
        $out = Join-Path $ocrDir $f
        if ($Force -or -not (Test-Path $out)) {
            & curl.exe -L --fail --silent --show-error -o $out "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/$f"
        }
    }
    $binWeights = Join-Path $ocrDir "pytorch_model.bin"
    $safeWeights = Join-Path $ocrDir "model.safetensors"
    if (-not (Test-Path $safeWeights)) {
        & curl.exe -L --fail --retry 15 --retry-delay 3 -C - -o $binWeights "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/pytorch_model.bin"
        python -c "
import torch; from pathlib import Path; from safetensors.torch import save_file
sd = torch.load(r'$binWeights', map_location='cpu', weights_only=True)
for k in ['decoder.cls.predictions.decoder.weight', 'decoder.cls.predictions.decoder.bias']:
    if k in sd: sd[k] = sd[k].clone()
save_file(sd, Path(r'$safeWeights'))
"
    }
} else {
    Write-Host "[2/3] OK: Manga-OCR base already exists."
}

# 3. ComfyUI FLUX.2 Colorization Models
$colourDirs = @("diffusion_models", "text_encoders", "vae", "loras")
foreach ($cd in $colourDirs) {
    $targetCd = Join-Path $ModelsDir $cd
    $srcCd = Join-Path $colourModels $cd
    if (-not (Test-Path $targetCd) -and (Test-Path $srcCd)) {
        Write-Host "[3/3] Creating directory junction for $cd -> $srcCd..."
        New-Item -ItemType Junction -Path $targetCd -Target $srcCd | Out-Null
    }
}

Write-Host "=================================================="
Write-Host "MangaShot models setup check complete!"
Write-Host "=================================================="
