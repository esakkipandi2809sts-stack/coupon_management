-- Safe in-place role and username upgrade; existing accounts remain Users.
IF COL_LENGTH(N'dbo.Users', N'Role') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD Role NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Users_Role DEFAULT N'User' WITH VALUES;
END;
GO

IF COL_LENGTH(N'dbo.Users', N'Username') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD Username NVARCHAR(150) NOT NULL
        CONSTRAINT DF_Users_Username DEFAULT N'' WITH VALUES;
END;
GO

UPDATE dbo.Users SET Username = LOWER(Email) WHERE Username = N'';
UPDATE dbo.Users
SET Role = CASE WHEN LOWER(Role) = N'admin' THEN N'Admin' ELSE N'User' END
WHERE Role COLLATE Latin1_General_100_BIN2 NOT IN (N'Admin', N'User');
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_Users_Username' AND object_id = OBJECT_ID(N'dbo.Users')
)
    CREATE UNIQUE NONCLUSTERED INDEX UX_Users_Username ON dbo.Users (Username);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_Users_Role' AND parent_object_id = OBJECT_ID(N'dbo.Users')
)
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role
        CHECK (Role COLLATE Latin1_General_100_BIN2 IN (N'Admin', N'User'));
GO
