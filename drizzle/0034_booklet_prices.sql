-- The booklet's prices, from the owner's own price list (his previous site's
-- "price list calculator", A5 and A4, 15 to 500 copies) plus 15%. His list is
-- a table of totals; the site prices a copy as page rate x size x quantity
-- break, so these are that model fitted to his list, weighted towards A5 and
-- 30-200 copies (what families order), and scaled so those orders average
-- +15%. A6 has no price of his yet: it is A5 less 20%.
--
-- Copies follow his breaks: 30, 400 and 500 are added, 25 and 75 retired
-- (never deleted — designs reference them). Every update is conditional on
-- the row still holding its seeded value, so a price an admin has already
-- set in /admin is left as it is. Skipped on a database without the booklet.
UPDATE `page_count_options` o JOIN `products` p ON p.`id` = o.`product_id` AND p.`slug` = 'order-of-service'
SET o.`base_rate_pence` = CASE o.`slug`
    WHEN '4' THEN 276 WHEN '8' THEN 402 WHEN '12' THEN 476
    WHEN '16' THEN 589 WHEN '20' THEN 714 WHEN '24' THEN 820 END
WHERE o.`base_rate_pence` = CASE o.`slug`
    WHEN '4' THEN 220 WHEN '8' THEN 300 WHEN '12' THEN 380
    WHEN '16' THEN 460 WHEN '20' THEN 540 WHEN '24' THEN 620 END;
--> statement-breakpoint
UPDATE `quantity_options` o JOIN `products` p ON p.`id` = o.`product_id` AND p.`slug` = 'order-of-service'
SET o.`multiplier` = CASE o.`slug`
    WHEN '50' THEN 0.4181 WHEN '100' THEN 0.2993 WHEN '150' THEN 0.2455
    WHEN '200' THEN 0.2216 WHEN '250' THEN 0.1991 WHEN '300' THEN 0.1946 END
WHERE o.`multiplier` = CASE o.`slug`
    WHEN '50' THEN 0.9 WHEN '100' THEN 0.84 WHEN '150' THEN 0.81
    WHEN '200' THEN 0.78 WHEN '250' THEN 0.76 WHEN '300' THEN 0.74 END;
--> statement-breakpoint
UPDATE `quantity_options` o JOIN `products` p ON p.`id` = o.`product_id` AND p.`slug` = 'order-of-service'
SET o.`is_active` = false
WHERE o.`multiplier` = CASE o.`slug` WHEN '25' THEN 0.95 WHEN '75' THEN 0.87 END;
--> statement-breakpoint
INSERT INTO `quantity_options` (`product_id`, `slug`, `label`, `multiplier`, `note`, `sort_order`, `is_active`, `copies`)
SELECT p.`id`, v.`slug`, v.`slug`, v.`multiplier`, NULL, v.`sort_order`, true, v.`copies`
FROM `products` p
JOIN (
  SELECT '30' AS `slug`, 0.6466 AS `multiplier`, 1 AS `sort_order`, 30 AS `copies`
  UNION ALL SELECT '400', 0.1792, 9, 400
  UNION ALL SELECT '500', 0.1703, 10, 500
) v
WHERE p.`slug` = 'order-of-service'
  AND NOT EXISTS (SELECT 1 FROM `quantity_options` q WHERE q.`product_id` = p.`id` AND q.`slug` = v.`slug`);
--> statement-breakpoint
UPDATE `size_options` o JOIN `products` p ON p.`id` = o.`product_id` AND p.`slug` = 'order-of-service'
SET o.`multiplier` = CASE o.`slug` WHEN 'a6' THEN 0.8 WHEN 'a4' THEN 1.4422 END, o.`is_active` = true
WHERE o.`slug` IN ('a6', 'a4') AND o.`multiplier` = 1 AND o.`is_active` = false;
