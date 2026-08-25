CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(200),
	`email_verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `template_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`accent_hex` char(7) NOT NULL,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `template_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `template_category_links` (
	`template_id` int NOT NULL,
	`category_id` int NOT NULL,
	`position` smallint NOT NULL DEFAULT 0,
	CONSTRAINT `template_category_links_template_id_category_id_pk` PRIMARY KEY(`template_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`product_id` int NOT NULL,
	`preview_image_url` varchar(1024) NOT NULL,
	`layout` json,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
	`sort_order` smallint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `templates_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `colour_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`multiplier` decimal(6,4) NOT NULL,
	`note` varchar(500),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `colour_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `colour_options_product_id_uq` UNIQUE(`product_id`,`id`),
	CONSTRAINT `colour_options_product_slug_uq` UNIQUE(`product_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `delivery_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`price_pence` int NOT NULL,
	`note` varchar(500) NOT NULL,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `delivery_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_options_product_id_uq` UNIQUE(`product_id`,`id`),
	CONSTRAINT `delivery_options_product_slug_uq` UNIQUE(`product_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `page_count_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`page_count` int NOT NULL,
	`base_rate_pence` int NOT NULL,
	`note` varchar(500),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `page_count_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_count_options_product_id_uq` UNIQUE(`product_id`,`id`),
	CONSTRAINT `page_count_options_product_slug_uq` UNIQUE(`product_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `paper_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`multiplier` decimal(6,4) NOT NULL,
	`note` varchar(500),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `paper_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `paper_options_product_id_uq` UNIQUE(`product_id`,`id`),
	CONSTRAINT `paper_options_product_slug_uq` UNIQUE(`product_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `quantity_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`multiplier` decimal(6,4) NOT NULL,
	`note` varchar(500),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`copies` int NOT NULL,
	CONSTRAINT `quantity_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `quantity_options_product_id_uq` UNIQUE(`product_id`,`id`),
	CONSTRAINT `quantity_options_product_slug_uq` UNIQUE(`product_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `size_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`multiplier` decimal(6,4) NOT NULL,
	`note` varchar(500),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `size_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `size_options_product_id_uq` UNIQUE(`product_id`,`id`),
	CONSTRAINT `size_options_product_slug_uq` UNIQUE(`product_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `design_assets` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`design_id` char(36),
	`guest_token` char(36),
	`storage_key` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`byte_size` int NOT NULL,
	`width` smallint,
	`height` smallint,
	`checksum` char(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `design_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `design_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`design_id` char(36) NOT NULL,
	`version` int NOT NULL,
	`doc` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `design_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `design_versions_design_version_uq` UNIQUE(`design_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `designs` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`guest_token` char(36),
	`template_id` int NOT NULL,
	`product_id` int NOT NULL,
	`name` varchar(200) NOT NULL DEFAULT 'Untitled design',
	`status` enum('draft','ready','ordered','archived') NOT NULL DEFAULT 'draft',
	`doc` json NOT NULL,
	`page_count` smallint GENERATED ALWAYS AS (json_length(`doc`, '$.pages')) STORED NOT NULL,
	`quantity_option_id` int,
	`size_option_id` int,
	`colour_option_id` int,
	`page_count_option_id` int NOT NULL,
	`paper_option_id` int NOT NULL,
	`delivery_option_id` int,
	`thumbnail_url` varchar(1024),
	`last_opened_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `designs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` char(36) NOT NULL,
	`type` varchar(64) NOT NULL,
	`from_status` varchar(32),
	`to_status` varchar(32),
	`note` text,
	`actor` varchar(120),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`design_id` char(36),
	`position` smallint NOT NULL DEFAULT 0,
	`product_id` varchar(64) NOT NULL,
	`template_id` varchar(64) NOT NULL,
	`quantity_option_id` varchar(64),
	`size_option_id` varchar(64),
	`colour_option_id` varchar(64),
	`page_count_option_id` varchar(64),
	`paper_option_id` varchar(64),
	`delivery_option_id` varchar(64),
	`quote_snapshot` json NOT NULL,
	`quantity_copies` int NOT NULL,
	`unit_price_pence` int NOT NULL,
	`line_total_pence` int NOT NULL,
	`doc_snapshot` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_proofs` (
	`id` char(36) NOT NULL,
	`order_item_id` char(36) NOT NULL,
	`version` int NOT NULL,
	`pdf_url` varchar(1024) NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`status` enum('generated','sent','changes_requested','approved') NOT NULL DEFAULT 'generated',
	`sent_at` timestamp,
	`responded_at` timestamp,
	`customer_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_proofs_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_proofs_item_version_uq` UNIQUE(`order_item_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` char(36) NOT NULL,
	`order_number` varchar(20) NOT NULL,
	`user_id` char(36),
	`guest_email` varchar(255),
	`guest_token` char(36),
	`status` enum('draft','awaiting_proof','proof_sent','approved','in_production','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'draft',
	`contact_name` varchar(200),
	`contact_email` varchar(255),
	`contact_phone` varchar(50),
	`address_line1` varchar(255),
	`address_line2` varchar(255),
	`city` varchar(120),
	`postcode` varchar(20),
	`country` char(2) NOT NULL DEFAULT 'GB',
	`delivery_option_id` varchar(64),
	`delivery_label` varchar(200),
	`delivery_price_pence` int,
	`subtotal_pence` int NOT NULL DEFAULT 0,
	`delivery_pence` int NOT NULL DEFAULT 0,
	`vat_pence` int NOT NULL DEFAULT 0,
	`vat_rate` decimal(5,4) NOT NULL DEFAULT '0.2000',
	`total_pence` int NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'GBP',
	`placed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
ALTER TABLE `template_category_links` ADD CONSTRAINT `template_category_links_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_category_links` ADD CONSTRAINT `template_category_links_category_id_template_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `template_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templates` ADD CONSTRAINT `templates_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `colour_options` ADD CONSTRAINT `colour_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_options` ADD CONSTRAINT `delivery_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page_count_options` ADD CONSTRAINT `page_count_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paper_options` ADD CONSTRAINT `paper_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quantity_options` ADD CONSTRAINT `quantity_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `size_options` ADD CONSTRAINT `size_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `design_assets` ADD CONSTRAINT `design_assets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `design_assets` ADD CONSTRAINT `design_assets_design_id_designs_id_fk` FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `design_versions` ADD CONSTRAINT `design_versions_design_id_designs_id_fk` FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_quantity_option_fk` FOREIGN KEY (`product_id`,`quantity_option_id`) REFERENCES `quantity_options`(`product_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_size_option_fk` FOREIGN KEY (`product_id`,`size_option_id`) REFERENCES `size_options`(`product_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_colour_option_fk` FOREIGN KEY (`product_id`,`colour_option_id`) REFERENCES `colour_options`(`product_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_page_count_option_fk` FOREIGN KEY (`product_id`,`page_count_option_id`) REFERENCES `page_count_options`(`product_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_paper_option_fk` FOREIGN KEY (`product_id`,`paper_option_id`) REFERENCES `paper_options`(`product_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designs` ADD CONSTRAINT `designs_delivery_option_fk` FOREIGN KEY (`product_id`,`delivery_option_id`) REFERENCES `delivery_options`(`product_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_design_id_designs_id_fk` FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_proofs` ADD CONSTRAINT `order_proofs_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `design_assets_design_idx` ON `design_assets` (`design_id`);--> statement-breakpoint
CREATE INDEX `design_assets_guest_token_idx` ON `design_assets` (`guest_token`);--> statement-breakpoint
CREATE INDEX `designs_user_updated_idx` ON `designs` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `designs_guest_token_idx` ON `designs` (`guest_token`);--> statement-breakpoint
CREATE INDEX `designs_template_idx` ON `designs` (`template_id`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_guest_token_idx` ON `orders` (`guest_token`);