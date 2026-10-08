CREATE TABLE `order_refunds` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`stripe_refund_id` varchar(255) NOT NULL,
	`amount_pence` int NOT NULL,
	`status` varchar(32) NOT NULL,
	`reason` varchar(64),
	`refunded_at` timestamp NOT NULL,
	`thintent_credit_ref` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_refunds_stripe_refund_id_unique` UNIQUE(`stripe_refund_id`)
);
--> statement-breakpoint
ALTER TABLE `order_refunds` ADD CONSTRAINT `order_refunds_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_refunds_order_idx` ON `order_refunds` (`order_id`,`refunded_at`);--> statement-breakpoint
CREATE INDEX `orders_payment_intent_idx` ON `orders` (`stripe_payment_intent_id`);