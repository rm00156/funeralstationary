ALTER TABLE `orders` ADD `stripe_checkout_session_id` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_payment_intent_id` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_stripe_checkout_session_id_unique` UNIQUE(`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `orders_status_placed_idx` ON `orders` (`status`,`placed_at`);