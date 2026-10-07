CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`mime_type` text,
	`duration_ms` integer,
	`fps` real,
	`width` integer,
	`height` integer,
	`has_audio` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`reference_asset_ids` text DEFAULT '[]' NOT NULL,
	`voice_id` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`shot_id` text,
	`capability` text NOT NULL,
	`adapter_id` text NOT NULL,
	`params` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`cost_estimate_usd` real NOT NULL,
	`cost_actual_usd` real,
	`provider_ref` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`next_poll_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`provider` text NOT NULL,
	`amount_usd` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ledger_created_at_idx` ON `ledger` (`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shots` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`index` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`thumbnail_asset_id` text,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thumbnail_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `takes` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`finalised` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `timeline_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`track` integer DEFAULT 0 NOT NULL,
	`position` integer NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`in_ms` integer NOT NULL,
	`out_ms` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
