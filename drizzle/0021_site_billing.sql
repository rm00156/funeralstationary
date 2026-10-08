CREATE TABLE `site_billing` (
	`id` tinyint NOT NULL,
	`stripe_customer_id` varchar(255),
	`stripe_subscription_id` varchar(255),
	`subscription_status` varchar(32),
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`current_period_end` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_billing_id` PRIMARY KEY(`id`)
);
