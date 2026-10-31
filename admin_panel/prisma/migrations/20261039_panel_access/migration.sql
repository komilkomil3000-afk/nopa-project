-- Panel access control. These columns were first applied by hand on the live database,
-- so every statement is idempotent (IF NOT EXISTS) and safe to run there again.

-- Per-user override of the role default: NULL = follow the role, true/false = force allow/deny.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "panelAccess" BOOLEAN;

-- Whether a role may sign in to the admin panel, plus its fine-grained permission set (JSON text).
ALTER TABLE "RolePermission" ADD COLUMN IF NOT EXISTS "canLoginPanel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RolePermission" ADD COLUMN IF NOT EXISTS "permissionsJson" TEXT;
