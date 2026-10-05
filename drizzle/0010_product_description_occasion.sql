ALTER TABLE `products` ADD `description` varchar(300);--> statement-breakpoint
ALTER TABLE `products` ADD `occasion` enum('service','after') DEFAULT 'service' NOT NULL;