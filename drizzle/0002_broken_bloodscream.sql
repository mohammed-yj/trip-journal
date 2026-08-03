CREATE INDEX `map_marks_country_idx` ON `map_marks` (`country_code`);--> statement-breakpoint
CREATE INDEX `map_marks_source_idx` ON `map_marks` (`source_type`,`source_id`);