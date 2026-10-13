ALTER TABLE `orders` ADD `trade_discount_percent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method` enum('card','account') DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_number` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_status` enum('draft','issued','partially_paid','paid','voided');--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_due_date` date;--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_paid_pence` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_updated_at` timestamp;--> statement-breakpoint
ALTER TABLE `trade_firms` ADD `discount_percent` decimal(5,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `trade_firms` ADD `on_account` boolean DEFAULT false NOT NULL;