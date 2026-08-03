CREATE TABLE `map_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`mark_key` text NOT NULL,
	`scope` text NOT NULL,
	`country_code` text NOT NULL,
	`country_name` text NOT NULL,
	`admin1_code` text,
	`admin1_name` text,
	`city_name` text,
	`latitude` text,
	`longitude` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `map_marks_mark_key_unique` ON `map_marks` (`mark_key`);