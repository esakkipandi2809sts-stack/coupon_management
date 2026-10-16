-- Optional: promote a previously verified account to the configured Admin username.
-- Prefer first-run seeding via Admin:Password in user-secrets or environment settings.
DECLARE @AdminEmail NVARCHAR(150) = N'admin@example.com';

UPDATE dbo.Users
SET Username = N'admin', Role = N'Admin'
WHERE Email = @AdminEmail;

IF @@ROWCOUNT = 0
    THROW 50001, 'No user matched @AdminEmail. Register or verify the account first.', 1;
