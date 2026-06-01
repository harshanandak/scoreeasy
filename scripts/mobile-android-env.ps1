param(
    [switch] $RequireDevice
)

$ErrorActionPreference = 'Stop'

$studioJbr = 'C:\Program Files\Android\Android Studio\jbr'
$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

if (-not $env:JAVA_HOME -and (Test-Path -LiteralPath $studioJbr)) {
    $env:JAVA_HOME = $studioJbr
}

if (-not $env:ANDROID_HOME -and (Test-Path -LiteralPath $sdkRoot)) {
    $env:ANDROID_HOME = $sdkRoot
}

if (-not $env:ANDROID_SDK_ROOT -and $env:ANDROID_HOME) {
    $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}

$pathEntries = @()
if ($env:JAVA_HOME) {
    $pathEntries += (Join-Path $env:JAVA_HOME 'bin')
}
if ($env:ANDROID_HOME) {
    $pathEntries += (Join-Path $env:ANDROID_HOME 'platform-tools')
    $pathEntries += (Join-Path $env:ANDROID_HOME 'emulator')
    $pathEntries += (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin')
}
$env:Path = (($pathEntries | Where-Object { Test-Path -LiteralPath $_ }) + $env:Path) -join ';'

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "ANDROID_SDK_ROOT=$env:ANDROID_SDK_ROOT"

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    throw 'adb was not found. Install Android SDK platform-tools or update ANDROID_HOME.'
}

& $adb.Source devices

if ($RequireDevice) {
    $devices = & $adb.Source devices | Select-String -Pattern "`tdevice$"
    if (-not $devices) {
        throw 'No running Android emulator/device reported by adb devices.'
    }
}
