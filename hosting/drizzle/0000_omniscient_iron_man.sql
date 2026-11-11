CREATE TABLE `agent_annotations` (
	`session_key` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`project` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_key` text NOT NULL,
	`device` text NOT NULL,
	`source` text NOT NULL,
	`project` text NOT NULL,
	`session` text NOT NULL,
	`kind` text NOT NULL,
	`at` text NOT NULL,
	`summary` text NOT NULL,
	`evidence` text NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_session_at` ON `agent_events` (`session_key`,`at`);--> statement-breakpoint
CREATE INDEX `agent_event_at` ON `agent_events` (`at`);