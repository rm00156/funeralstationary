ALTER TABLE `products` ADD `size_label` varchar(64) DEFAULT 'A5' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `trim_width_mm` smallint DEFAULT 148 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `trim_height_mm` smallint DEFAULT 210 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `template_pages` tinyint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `sized_by_option` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `paper_label` varchar(40) DEFAULT 'Paper' NOT NULL;