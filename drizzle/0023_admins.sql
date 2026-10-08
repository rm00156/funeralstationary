CREATE TABLE `admins` (
	`id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`is_owner` boolean NOT NULL DEFAULT false,
	`added_by` varchar(255),
	`last_sign_in_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `admins_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `login_tokens` ADD `purpose` enum('customer','admin') DEFAULT 'customer' NOT NULL;--> statement-breakpoint
-- The owner: the one admin who can't be removed in /admin/access, so the shop
-- always has someone able to sign in and grant access to everyone else.
INSERT IGNORE INTO `admins` (`id`, `email`, `is_owner`) VALUES ('5f0c2a3e-6b1d-4c8e-9a47-0d3e8b2f71c4', 'rmillermcpherson4@googlemail.com', true);
