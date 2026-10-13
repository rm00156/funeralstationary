CREATE TABLE `trade_applications` (
	`id` char(36) NOT NULL,
	`status` enum('pending','approved','declined') NOT NULL DEFAULT 'pending',
	`business_name` varchar(160) NOT NULL,
	`postcode` varchar(10) NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`role` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`volume` varchar(60) NOT NULL,
	`orders` json NOT NULL,
	`notes` text,
	`firm_id` int,
	`decided_by` varchar(255),
	`decided_at` timestamp,
	`decision_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trade_applications` ADD CONSTRAINT `trade_applications_firm_id_trade_firms_id_fk` FOREIGN KEY (`firm_id`) REFERENCES `trade_firms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trade_applications_status_idx` ON `trade_applications` (`status`,`created_at`);