$ErrorActionPreference = 'Stop'
$node = (Get-Command node).Source
$collector = Join-Path $PSScriptRoot 'collector.mjs'
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $collector + '" run') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'WorkdkAgentCollector' -Action $action -Trigger $trigger -Settings $settings -Description 'Sync selected Agent work events to your workbench' | Out-Null
Start-ScheduledTask -TaskName 'WorkdkAgentCollector'
Write-Host 'Collector startup task installed. To remove: Unregister-ScheduledTask -TaskName WorkdkAgentCollector'
