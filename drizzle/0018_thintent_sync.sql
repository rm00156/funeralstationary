ALTER TABLE `orders` ADD `thintent_job_ref` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `thintent_job_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `orders` ADD `shipped_courier` varchar(120);--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_ref` varchar(120);