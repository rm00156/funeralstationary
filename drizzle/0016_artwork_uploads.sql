CREATE TABLE `artwork_uploads` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`guest_token` char(36),
	`source` enum('pdf','canva') NOT NULL,
	`file_name` varchar(255),
	`storage_key` varchar(512),
	`url` varchar(1024),
	`byte_size` int,
	`canva_url` varchar(1024),
	`analysis` json,
	`analysed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artwork_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `template_id` varchar(64);--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `doc_snapshot` json;--> statement-breakpoint
ALTER TABLE `order_items` ADD `upload_id` char(36);--> statement-breakpoint
ALTER TABLE `order_items` ADD `artwork_snapshot` json;--> statement-breakpoint
ALTER TABLE `order_items` ADD `service_date` date;--> statement-breakpoint
ALTER TABLE `artwork_uploads` ADD CONSTRAINT `artwork_uploads_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `artwork_uploads_user_idx` ON `artwork_uploads` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `artwork_uploads_guest_token_idx` ON `artwork_uploads` (`guest_token`);--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_upload_id_artwork_uploads_id_fk` FOREIGN KEY (`upload_id`) REFERENCES `artwork_uploads`(`id`) ON DELETE set null ON UPDATE no action;