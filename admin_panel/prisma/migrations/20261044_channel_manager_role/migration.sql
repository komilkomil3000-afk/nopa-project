-- The channel manager role. Its chat access is edited in the panel.
INSERT INTO "RolePermission" ("roleName", "canLoginPanel", "permissionsJson")
VALUES (
  'channel_manager',
  true,
  '{"chat":{"publishChannels":true,"enterGroups":true,"moderate":true,"publicTags":true,"useBots":true,"export":false,"privateChats":false}}'
)
ON CONFLICT ("roleName") DO NOTHING;
