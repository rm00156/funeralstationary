-- Delivery moves from the order to the line.
--
-- Delivery options are product-scoped, so an order-level choice could only
-- ever describe one product — which is why a basket used to refuse a second
-- product. Each line now carries its own option (the slug column already
-- existed, mirroring the order's), with the label and price snapshotted
-- beside it; orders.delivery_pence becomes the sum across lines.
--
-- Existing rows. Slug, label and price must come from ONE source per line,
-- or they can disagree (a line saying `standard` but "Next day £10"):
--
--  * Placed orders: the line's quote_snapshot. It was frozen at the pay
--    click together with orders.delivery_pence, so it is what was charged.
--    The order's own delivery columns are not trustworthy here — the old
--    basket picker wrote them without touching the lines, so they can hold
--    a choice made after the snapshot.
--  * Draft baskets: the order's columns, because that same picker only ever
--    wrote there — the order holds the customer's current choice and the
--    line's snapshot is a stale placeholder. A draft with no choice yet
--    falls back to the snapshot.
--
-- orders.delivery_pence (untouched) stays what was actually charged; for an
-- old multi-line order it no longer equals Σ line delivery, which is the
-- honest result — delivery used to be charged once per order.
ALTER TABLE `order_items` ADD `delivery_label` varchar(200);--> statement-breakpoint
ALTER TABLE `order_items` ADD `delivery_price_pence` int;--> statement-breakpoint
UPDATE `order_items` `oi`
  JOIN `orders` `o` ON `o`.`id` = `oi`.`order_id`
  SET `oi`.`delivery_option_id` = JSON_UNQUOTE(JSON_EXTRACT(`oi`.`quote_snapshot`, '$.delivery.id')),
      `oi`.`delivery_label` = JSON_UNQUOTE(JSON_EXTRACT(`oi`.`quote_snapshot`, '$.delivery.label')),
      `oi`.`delivery_price_pence` = CAST(JSON_EXTRACT(`oi`.`quote_snapshot`, '$.delivery.pricePence') AS SIGNED)
  WHERE `o`.`status` <> 'draft' OR `o`.`delivery_option_id` IS NULL;--> statement-breakpoint
UPDATE `order_items` `oi`
  JOIN `orders` `o` ON `o`.`id` = `oi`.`order_id`
  SET `oi`.`delivery_option_id` = `o`.`delivery_option_id`,
      `oi`.`delivery_label` = `o`.`delivery_label`,
      `oi`.`delivery_price_pence` = `o`.`delivery_price_pence`
  WHERE `o`.`status` = 'draft' AND `o`.`delivery_option_id` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `delivery_option_id`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `delivery_label`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `delivery_price_pence`;
