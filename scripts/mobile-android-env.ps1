param(
    [switch] $RequireDevice,
    [switch] $StartEmulator,
    [string] $AvdName,
    [switch] $WaitForBoot,
    [switch] $InstallDebug,
    [switch] $LaunchApp,
    [switch] $WriteLocalProperties,
    [switch] $Headless,
    [string] $DeviceSerial,
    [string] $PackageId = 'com.scoreeasy.app',
    [int] $BootTimeoutSeconds = 180
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
$repoRoot = Split-Path -Parent $PSScriptRoot

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

if ($WriteLocalProperties) {
    if (-not $androidSdk) {
        throw 'Android SDK path is not resolved; cannot write android/local.properties.'
    }

    $localPropertiesPath = Join-Path $repoRoot 'android\local.properties'
    $sdkPropertyPath = $androidSdk.Replace('\', '/')
    Set-Content -LiteralPath $localPropertiesPath -Value "sdk.dir=$sdkPropertyPath"
    Write-Host "Wrote $localPropertiesPath with sdk.dir=$sdkPropertyPath"
}

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    throw 'adb was not found. Install Android SDK platform-tools or update ANDROID_HOME.'
}

$emulator = Get-Command emulator -ErrorAction SilentlyContinue

function Invoke-Adb {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]] $AdbArgs
    )

    $result = Invoke-AdbCapture -AdbArgs $AdbArgs
    $result.Output

    if ($result.ExitCode -ne 0) {
        throw "adb failed with exit code $($result.ExitCode)`: $($AdbArgs -join ' ')"
    }
}

function Invoke-AdbCapture {
    param(
        [string[]] $AdbArgs
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = if ($DeviceSerial) {
            & $adb.Source -s $DeviceSerial @AdbArgs 2>$null
        } else {
            & $adb.Source @AdbArgs 2>$null
        }
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    [PSCustomObject]@{
        ExitCode = $exitCode
        Output = @($output)
    }
}

function Get-RunningAndroidDevices {
    $devices = @(& $adb.Source devices | Select-String -Pattern "`tdevice$" | ForEach-Object {
        ($_ -split "`t")[0]
    })

    if ($DeviceSerial) {
        @($devices | Where-Object { $_ -eq $DeviceSerial })
        return
    }

    $devices
}

function Wait-ForAndroidBoot {
    $deadline = [DateTime]::UtcNow.AddSeconds($BootTimeoutSeconds)

    do {
        $waitResult = Invoke-AdbCapture -AdbArgs @('wait-for-device')
        if ($waitResult.ExitCode -ne 0) {
            Start-Sleep -Seconds 2
            continue
        }

        $bootResult = Invoke-AdbCapture -AdbArgs @('shell', 'getprop', 'sys.boot_completed')
        if ($bootResult.ExitCode -ne 0) {
            Start-Sleep -Seconds 2
            continue
        }

        $bootState = ($bootResult.Output | Select-Object -First 1).ToString().Trim()
        if ($bootState -eq '1') {
            Write-Host 'Android device boot completed.'
            return
        }

        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)

    throw "Android emulator/device did not finish booting within $BootTimeoutSeconds seconds."
}

if ($StartEmulator) {
    if (-not $emulator) {
        throw 'emulator was not found. Install Android SDK emulator or update ANDROID_HOME.'
    }

    $runningDevices = Get-RunningAndroidDevices
    if ($runningDevices.Count -eq 0) {
        $avds = @(& $emulator.Source -list-avds | Where-Object { $_ })
        if ($avds.Count -eq 0) {
            throw 'No Android Virtual Devices found. Create one in Android Studio Device Manager.'
        }

        $selectedAvd = if ($AvdName) { $AvdName } else { $avds[0] }
        if ($avds -notcontains $selectedAvd) {
            throw "AVD '$selectedAvd' was not found. Available AVDs: $($avds -join ', ')"
        }

        $emulatorArgs = @('-avd', $selectedAvd, '-no-snapshot-load', '-no-audio')
        if ($Headless) {
            $emulatorArgs += @('-no-window', '-gpu', 'swiftshader_indirect', '-no-boot-anim')
        }

        $startArgs = @{
            FilePath = $emulator.Source
            ArgumentList = $emulatorArgs
            PassThru = $true
        }
        if ($Headless) {
            $startArgs.WindowStyle = 'Hidden'
        }

        $process = Start-Process @startArgs
        Write-Host "Started Android emulator '$selectedAvd' (pid $($process.Id))."
    } else {
        Write-Host "Android device already running: $($runningDevices -join ', ')"
    }

    $WaitForBoot = $true
}

if ($WaitForBoot -or $InstallDebug -or $LaunchApp) {
    Wait-ForAndroidBoot
}

if ($InstallDebug) {
    $apkPath = Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path -LiteralPath $apkPath)) {
        throw "Debug APK not found at $apkPath. Run 'bun run build', 'bunx cap sync android', and 'android\gradlew.bat assembleDebug' first."
    }

    Invoke-Adb -AdbArgs @('install', '-r', $apkPath)
}

if ($LaunchApp) {
    Invoke-Adb -AdbArgs @('shell', 'monkey', '-p', $PackageId, '1')
}

Invoke-Adb devices

if ($RequireDevice) {
    $devices = Get-RunningAndroidDevices
    if (-not $devices) {
        throw 'No running Android emulator/device reported by adb devices.'
    }
}
