CREATE TABLE `size_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(200) NOT NULL,
	`multiplier` decimal(6,4) NOT NULL,
	`note` varchar(500),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`width_mm` smallint NOT NULL,
	`height_mm` smallint NOT NULL,
	CONSTRAINT `size_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `size_options_product_id_uq` UNIQUE(`product_id`,`id`),
	CONSTRAINT `size_options_product_slug_uq` UNIQUE(`product_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `size_option_id` varchar(64);--> statement-breakpoint
ALTER TABLE `size_options` ADD CONSTRAINT `size_options_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- The booklet's print sizes. Its designs are drawn at A5 and the press scales
-- them, which is exact because A6, A5 and A4 are one shape. Only A5 starts
-- switched on, at the price A5 already costs (x1), so nothing a customer sees
-- changes on deploy: A6 and A4 wait in /admin for their prices and switching
-- on. Skipped on a database without the booklet.
INSERT INTO `size_options` (`product_id`, `slug`, `label`, `multiplier`, `note`, `sort_order`, `is_active`, `width_mm`, `height_mm`)
SELECT `id`, 'a5', 'A5', 1.0000, NULL, 0, true, 148, 210 FROM `products` WHERE `slug` = 'order-of-service'
UNION ALL
SELECT `id`, 'a6', 'A6', 1.0000, NULL, 1, false, 105, 148 FROM `products` WHERE `slug` = 'order-of-service'
UNION ALL
SELECT `id`, 'a4', 'A4', 1.0000, NULL, 2, false, 210, 297 FROM `products` WHERE `slug` = 'order-of-service';
--> statement-breakpoint
-- A booklet already in a basket would otherwise have no size and read as
-- stale; it was always going to print at A5.
UPDATE `order_items` `oi` JOIN `orders` `o` ON `o`.`id` = `oi`.`order_id`
SET `oi`.`size_option_id` = 'a5'
WHERE `o`.`status` = 'draft' AND `oi`.`product_id` = 'order-of-service' AND `oi`.`size_option_id` IS NULL;
