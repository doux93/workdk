CREATE TABLE `agent_devices` (
  `device` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `token_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_device_token` ON `agent_devices` (`token_hash`);
