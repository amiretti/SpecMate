<#
.SYNOPSIS
  Configura los campos de un GitHub Project y los completa desde los issues del repo.

.DESCRIPTION
  - Agrega al Project los issues abiertos del repo que falten y archiva los items de
    issues cerrados (con -SkipArchive no archiva nada).
  - Crea los campos Tamaño (S, M, L) y Etapa (MVP, post-MVP) si no existen.
  - Para cada issue del Project:
      Tamaño  <- la línea "**Tamaño:** X" del cuerpo del issue (si hay)
      Etapa   <- la etiqueta MVP o post-MVP; las historias heredan la de su épica (MVP)
      Status  <- Backlog, solo si está vacío
  Las vistas, el campo Iteración y las automatizaciones se configuran en la web
  (la CLI de GitHub no los soporta).

.EXAMPLE
  gh auth refresh -s project
  .\tools\github-project.ps1 -Number 4 -Owner amiretti -Repo amiretti/SpecMate
#>
param(
  [Parameter(Mandatory)] [int] $Number,
  [Parameter(Mandatory)] [string] $Owner,
  [Parameter(Mandatory)] [string] $Repo,
  [switch] $SkipArchive
)
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1: la salida de gh es UTF-8; sin esto, la ñ y los acentos se rompen.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# Nombre del campo sin caracteres no ASCII en el código fuente (evita depender de la codificación del archivo).
$SizeName = "Tama$([char]0x00F1)o"


function Get-Fields {
  (gh project field-list $Number --owner $Owner --format json --limit 50 | ConvertFrom-Json).fields
}

function Ensure-SingleSelect([string] $Name, [string[]] $Options) {
  $field = Get-Fields | Where-Object { $_.name -eq $Name }
  if (-not $field) {
    gh project field-create $Number --owner $Owner --name $Name --data-type SINGLE_SELECT --single-select-options ($Options -join ',') | Out-Null
    Write-Host "campo creado: $Name"
  } else {
    Write-Host "campo existente: $Name"
  }
}

Ensure-SingleSelect $SizeName @('S', 'M', 'L')
Ensure-SingleSelect 'Etapa' @('MVP', 'post-MVP')

$projectId = (gh project view $Number --owner $Owner --format json | ConvertFrom-Json).id

# Sincronizar items: issues abiertos que faltan, adentro; issues cerrados, archivados.
$current = (gh project item-list $Number --owner $Owner --format json --limit 500 | ConvertFrom-Json).items
$inProject = @($current | ForEach-Object { $_.content.number } | Where-Object { $_ })
$open = gh issue list --repo $Repo --state open --limit 500 --json number,url | ConvertFrom-Json
foreach ($i in $open) {
  if ($inProject -notcontains $i.number) {
    gh project item-add $Number --owner $Owner --url $i.url | Out-Null
    Write-Host "#$($i.number) agregado"
  }
}
if (-not $SkipArchive) {
  $closed = @((gh issue list --repo $Repo --state closed --limit 500 --json number | ConvertFrom-Json).number)
  foreach ($item in $current) {
    if ($item.content.number -and ($closed -contains $item.content.number)) {
      gh project item-archive $Number --owner $Owner --id $item.id | Out-Null
      Write-Host "#$($item.content.number) archivado (cerrado)"
    }
  }
}
$fields = Get-Fields
$size   = $fields | Where-Object { $_.name -eq $SizeName }
$stage  = $fields | Where-Object { $_.name -eq 'Etapa' }
$status = $fields | Where-Object { $_.name -eq 'Status' }
$backlog = $status.options | Where-Object { $_.name -eq 'Backlog' }

function Set-Option($item, $field, [string] $optionName) {
  $opt = $field.options | Where-Object { $_.name -eq $optionName }
  if (-not $opt) { Write-Warning "$($field.name): no existe la opción '$optionName'"; return }
  gh project item-edit --id $item.id --project-id $projectId --field-id $field.id --single-select-option-id $opt.id | Out-Null
}

$items = (gh project item-list $Number --owner $Owner --format json --limit 200 | ConvertFrom-Json).items
foreach ($item in $items) {
  $num = $item.content.number
  if (-not $num) { continue }
  $issue = gh issue view $num --repo $Repo --json labels,body | ConvertFrom-Json
  $labels = $issue.labels.name

  if ($issue.body -match ('\*\*' + $SizeName + ':\*\*\s*([SML])\b')) { Set-Option $item $size $Matches[1] }

  if ($labels -contains 'post-MVP') { Set-Option $item $stage 'post-MVP' }
  elseif ($labels -contains 'MVP' -or $labels -contains 'historia') { Set-Option $item $stage 'MVP' }

  if ($backlog -and -not $item.status) { Set-Option $item $status 'Backlog' }

  Write-Host "#$num listo"
}
Write-Host "Hecho: $($items.Count) items revisados."
