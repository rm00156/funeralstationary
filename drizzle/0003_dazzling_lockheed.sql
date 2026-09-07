CREATE TABLE `order_proof_pages` (
	`id` char(36) NOT NULL,
	`proof_id` char(36) NOT NULL,
	`page_index` smallint NOT NULL,
	`image_url` varchar(1024) NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_proof_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_proof_pages_proof_page_uq` UNIQUE(`proof_id`,`page_index`)
);
--> statement-breakpoint
ALTER TABLE `order_proofs` MODIFY COLUMN `pdf_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `order_proofs` MODIFY COLUMN `storage_key` varchar(512);--> statement-breakpoint
ALTER TABLE `order_proofs` ADD `doc_snapshot` json NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `share_token` char(36);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_share_token_unique` UNIQUE(`share_token`);--> statement-breakpoint
ALTER TABLE `order_proof_pages` ADD CONSTRAINT `order_proof_pages_proof_id_order_proofs_id_fk` FOREIGN KEY (`proof_id`) REFERENCES `order_proofs`(`id`) ON DELETE cascade ON UPDATE no action;