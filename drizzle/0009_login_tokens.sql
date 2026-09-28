-- Email sign-in links (see src/lib/auth.server.ts). Only a hash of the
-- emailed secret is stored, and consumed_at makes each link single-use.
CREATE TABLE `login_tokens` (
	`id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`email` varchar(255) NOT NULL,
	`redirect_to` varchar(512) NOT NULL DEFAULT '/account',
	`expires_at` timestamp NOT NULL,
	`consumed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `login_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `login_tokens_email_idx` ON `login_tokens` (`email`,`created_at`);