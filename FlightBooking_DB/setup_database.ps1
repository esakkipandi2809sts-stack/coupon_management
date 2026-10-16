# Creates FlightBooking_DB on LocalDB or a standard SQL Server instance.
# Usage:  ./setup_database.ps1                       (LocalDB)
#         ./setup_database.ps1 -Server "localhost"   (SQL Server)
param(
    [string]$Server = "(localdb)\MSSQLLocalDB"
)

Write-Host "Connecting to SQL Server: $Server..." -ForegroundColor Cyan

$connectionString = "Server=$Server;Integrated Security=True;TrustServerCertificate=True;"

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    Write-Host "Connected successfully." -ForegroundColor Green

    $scriptPath = Join-Path $PSScriptRoot "schema_and_seed.sql"
    if (-not (Test-Path $scriptPath)) {
        throw "Could not find schema_and_seed.sql at $scriptPath"
    }

    $scriptContent = Get-Content -Path $scriptPath -Raw

    # Split on GO batch separators
    $batches = [System.Text.RegularExpressions.Regex]::Split(
        $scriptContent, "^\s*GO\s*$",
        [System.Text.RegularExpressions.RegexOptions]::Multiline -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    foreach ($batch in $batches) {
        $trimmed = $batch.Trim()
        if ($trimmed.Length -gt 0) {
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = $trimmed
            $cmd.CommandTimeout = 60
            [void]$cmd.ExecuteNonQuery()
        }
    }

    $conn.Close()
    Write-Host "Database FlightBooking_DB created successfully. Start the backend to seed demo users." -ForegroundColor Green
}
catch {
    Write-Host "Error setting up database: $_" -ForegroundColor Red
    exit 1
}
