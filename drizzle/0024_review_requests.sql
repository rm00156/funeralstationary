CREATE TABLE `review_request_opt_outs` (
	`email` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_request_opt_outs_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `review_request_opt_out` boolean;--> statement-breakpoint
ALTER TABLE `orders` ADD `review_requested_at` timestamp;