param(
    [string]$Server = "(localdb)\MSSQLLocalDB"
)

$connectionString = "Server=$Server;Database=FlightBooking_DB;Integrated Security=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "UPDATE dbo.Users SET PasswordHash = (SELECT TOP 1 PasswordHash FROM dbo.Users WHERE Email = 'demo@aerowings.com') WHERE Email IN ('john.doe@example.com', 'sarah.c@example.com');"
$rows = $cmd.ExecuteNonQuery()
$conn.Close()

Write-Host "Updated $rows seed users password hashes successfully!" -ForegroundColor Green
