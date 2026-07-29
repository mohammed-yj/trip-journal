CREATE TABLE `captures` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`capture_type` text NOT NULL,
	`text_content` text,
	`photo_asset_id` text,
	`object_id` text,
	`exhibition_id` text,
	`photo_group_id` text,
	`captured_at` text NOT NULL,
	`processing_status` text NOT NULL,
	`is_highlight` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `exhibitions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`venue_id` text NOT NULL,
	`exhibition_type` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`official_url` text,
	`curator_or_organizer` text,
	`description` text,
	`catalogue_reference` text,
	`personal_summary` text,
	`cover_photo_id` text,
	`status` text NOT NULL,
	`verification_status` text NOT NULL,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `object_records` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '未命名对象' NOT NULL,
	`original_title` text,
	`object_type` text NOT NULL,
	`creator` text,
	`culture_or_dynasty` text,
	`date_display` text,
	`date_start` integer,
	`date_end` integer,
	`material` text,
	`dimensions` text,
	`provenance` text,
	`excavation_location` text,
	`owning_institution` text,
	`current_venue_id` text,
	`exhibition_id` text,
	`gallery_or_room` text,
	`case_number` text,
	`cave_or_building_number` text,
	`label_transcription` text,
	`personal_observation` text,
	`research_notes` text,
	`source_links` text,
	`verification_status` text NOT NULL,
	`cover_photo_id` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `photo_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`shot_at` text,
	`latitude` text,
	`longitude` text,
	`caption` text,
	`alt_text` text,
	`photo_type` text NOT NULL,
	`photo_group_id` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `photo_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`visit_id` text,
	`object_id` text,
	`cover_photo_id` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `photo_links` (
	`photo_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`photo_id`, `entity_type`, `entity_id`)
);
--> statement-breakpoint
CREATE TABLE `tag_links` (
	`tag_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`tag_id`, `entity_type`, `entity_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tag_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `trip_venues` (
	`trip_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`planned_status` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`trip_id`, `venue_id`)
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`cities` text,
	`status` text NOT NULL,
	`planning_notes` text,
	`places_to_visit` text,
	`research_questions` text,
	`final_summary` text,
	`cover_photo_id` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`original_name` text,
	`venue_type` text NOT NULL,
	`city` text NOT NULL,
	`region_or_state` text,
	`country` text NOT NULL,
	`address` text,
	`latitude` text,
	`longitude` text,
	`official_url` text,
	`opening_notes` text,
	`general_notes` text,
	`personal_impression` text,
	`cover_photo_id` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `visit_exhibitions` (
	`visit_id` text NOT NULL,
	`exhibition_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`visit_id`, `exhibition_id`)
);
--> statement-breakpoint
CREATE TABLE `visit_objects` (
	`visit_id` text NOT NULL,
	`object_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`visit_id`, `object_id`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`visit_date` text NOT NULL,
	`date_precision` text DEFAULT 'day' NOT NULL,
	`started_at` text,
	`ended_at` text,
	`duration_minutes` integer,
	`trip_id` text,
	`visit_status` text NOT NULL,
	`one_sentence_summary` text,
	`detailed_notes` text,
	`highlights` text,
	`disappointments` text,
	`unresolved_questions` text,
	`revisit_intention` text NOT NULL,
	`practical_notes` text,
	`cover_photo_id` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
