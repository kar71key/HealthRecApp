param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hermesWin = (Resolve-Path (Join-Path $scriptDir "..\node_modules\hermes-compiler\hermesc\linux64-bin\hermesc")).Path
$hermesWsl = (wsl wslpath -a ($hermesWin -replace '\\', '/')).Trim()

if ([string]::IsNullOrWhiteSpace($hermesWsl)) {
  Write-Error "Failed to resolve Hermes compiler path for WSL."
  exit 1
}

$convertedArgs = New-Object System.Collections.Generic.List[string]

for ($i = 0; $i -lt $RemainingArgs.Length; $i++) {
  $arg = $RemainingArgs[$i]

  if ($arg -eq "-out") {
    $convertedArgs.Add($arg)
    $i++
    if ($i -ge $RemainingArgs.Length) {
      break
    }
    $convertedArgs.Add((wsl wslpath -a ($RemainingArgs[$i] -replace '\\', '/')).Trim())
    continue
  }

  if ($arg -eq "-max-diagnostic-width") {
    $convertedArgs.Add($arg)
    $i++
    if ($i -lt $RemainingArgs.Length) {
      $convertedArgs.Add($RemainingArgs[$i])
    }
    continue
  }

  if ($arg.StartsWith("-")) {
    $convertedArgs.Add($arg)
    continue
  }

  $convertedArgs.Add((wsl wslpath -a ($arg -replace '\\', '/')).Trim())
}

& wsl $hermesWsl @convertedArgs
exit $LASTEXITCODE
