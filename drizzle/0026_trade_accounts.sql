CREATE TABLE `trade_firms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`payment_terms_days` smallint,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trade_firms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trade_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firm_id` int NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(120),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `trade_members_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `trade_firm_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `family_name` varchar(160);--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_ref` varchar(60);--> statement-breakpoint
ALTER TABLE `trade_members` ADD CONSTRAINT `trade_members_firm_id_trade_firms_id_fk` FOREIGN KEY (`firm_id`) REFERENCES `trade_firms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trade_members_firm_idx` ON `trade_members` (`firm_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_trade_firm_id_trade_firms_id_fk` FOREIGN KEY (`trade_firm_id`) REFERENCES `trade_firms`(`id`) ON DELETE set null ON UPDATE no action;