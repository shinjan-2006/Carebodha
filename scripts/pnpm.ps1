param([Parameter(ValueFromRemainingArguments=$true)][string[]]$TaskArguments)
$TaskCommand = Get-Command pnpm -ErrorAction SilentlyContinue
if ($TaskCommand) { $TaskPnpm = $TaskCommand.Source }
else { $TaskPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' }
if (-not (Test-Path -LiteralPath $TaskPnpm)) { throw 'Install pnpm, then run the commands in README.md.' }
& $TaskPnpm @TaskArguments
exit $LASTEXITCODE
