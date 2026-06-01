param(
    [switch] $RequireDevice
)

$ErrorActionPreference = 'Stop'

$studioJbr = 'C:\Program Files\Android\Android Studio\jbr'
$localAppData = $env:LOCALAPPDATA
if (-not $localAppData) {
    $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
}
$sdkRoot = if ($localAppData) { Join-Path $localAppData 'Android\Sdk' } else { $null }

if (-not $env:JAVA_HOME -and (Test-Path -LiteralPath $studioJbr)) {
    $env:JAVA_HOME = $studioJbr
}

if (-not $env:ANDROID_HOME -and $env:ANDROID_SDK_ROOT) {
    $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
}

if (-not $env:ANDROID_HOME -and $sdkRoot -and (Test-Path -LiteralPath $sdkRoot)) {
    $env:ANDROID_HOME = $sdkRoot
}

if (-not $env:ANDROID_SDK_ROOT -and $env:ANDROID_HOME) {
    $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}

$androidSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }

$pathEntries = @()
if ($env:JAVA_HOME) {
    $pathEntries += (Join-Path $env:JAVA_HOME 'bin')
}
if ($androidSdk) {
    $pathEntries += (Join-Path $androidSdk 'platform-tools')
    $pathEntries += (Join-Path $androidSdk 'emulator')
    $pathEntries += (Join-Path $androidSdk 'cmdline-tools\latest\bin')
}
$existingPathEntries = @($pathEntries | Where-Object { Test-Path -LiteralPath $_ })
$env:Path = ($existingPathEntries + @($env:Path)) -join ';'

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
