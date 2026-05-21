# Reemplazo masivo de colores hardcodeados por tokens semanticos
# Solo aplica patrones neutros seguros. No toca gradientes brand ni colores funcionales fuertes.

$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot ".."
$targets = @(
    (Join-Path $root "src/app/(dashboard)"),
    (Join-Path $root "src/components")
)

# Pares [old, new] como reemplazo literal (no regex)
$replacements = @(
    @("bg-white", "bg-card"),
    @("border-[#E2E8F0]", "border-border"),
    @("border-slate-200", "border-border"),
    @("border-slate-300", "border-border"),

    @("text-[#0F172A]", "text-foreground"),
    @("text-slate-900", "text-foreground"),
    @("text-slate-800", "text-foreground"),
    @("text-[#334155]", "text-foreground/90"),
    @("text-slate-700", "text-foreground/90"),

    @("text-[#475569]", "text-muted-foreground"),
    @("text-[#64748B]", "text-muted-foreground"),
    @("text-slate-600", "text-muted-foreground"),
    @("text-slate-500", "text-muted-foreground"),

    @("text-[#94A3B8]", "text-muted-foreground/70"),
    @("text-slate-400", "text-muted-foreground/70"),

    @("bg-[#F8FAFC]", "bg-muted/40"),
    @("bg-slate-50", "bg-muted/40"),
    @("bg-[#F1F5F9]", "bg-muted"),
    @("bg-slate-100", "bg-muted"),

    @("hover:bg-slate-50", "hover:bg-muted/40"),
    @("hover:bg-slate-100", "hover:bg-muted"),
    @("hover:bg-[#F1F5F9]", "hover:bg-muted"),

    @("hover:text-slate-700", "hover:text-foreground"),
    @("hover:text-slate-900", "hover:text-foreground"),
    @("hover:text-[#0F172A]", "hover:text-foreground"),

    @("placeholder:text-slate-400", "placeholder:text-muted-foreground/70"),

    @("text-[#0088D1]", "text-primary"),
    @("hover:text-[#0088D1]", "hover:text-primary"),
    @("hover:text-[#004A99]", "hover:text-primary/80"),

    @("ring-slate-200", "ring-border"),
    @("ring-slate-300", "ring-border"),
    @("divide-slate-200", "divide-border"),
    @("divide-[#E2E8F0]", "divide-border")
)

$filesChanged = 0
$totalReplacements = 0
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($target in $targets) {
    if (-not (Test-Path $target)) { continue }
    $files = Get-ChildItem -Path $target -Recurse -File -Include *.tsx,*.ts
    foreach ($file in $files) {
        $content = [System.IO.File]::ReadAllText($file.FullName, $utf8NoBom)
        if ($null -eq $content) { continue }
        $original = $content
        $fileReplacements = 0
        foreach ($pair in $replacements) {
            $old = $pair[0]
            $new = $pair[1]
            $before = $content
            $content = $content.Replace($old, $new)
            if ($content -ne $before) {
                $count = ([regex]::Matches($before, [regex]::Escape($old))).Count
                $fileReplacements += $count
            }
        }
        if ($content -ne $original) {
            [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
            $filesChanged++
            $totalReplacements += $fileReplacements
            Write-Output ("{0,4} ; {1}" -f $fileReplacements, ($file.FullName.Substring($root.Length + 1)))
        }
    }
}

Write-Output ""
Write-Output ("Archivos modificados : {0}" -f $filesChanged)
Write-Output ("Reemplazos totales   : {0}" -f $totalReplacements)
