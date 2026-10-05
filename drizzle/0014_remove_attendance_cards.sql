-- "Attendance Cards" was a placeholder in the original product list, never a
-- real product: no templates, pricing or designs. Delete it only while nothing
-- references it, so a database where someone did build it out keeps it (and
-- this can't trip a RESTRICT foreign key and fail the deploy).
DELETE FROM `products`
WHERE `slug` = 'attendance-cards'
  AND NOT EXISTS (SELECT 1 FROM `templates` WHERE `templates`.`product_id` = `products`.`id`)
  AND NOT EXISTS (SELECT 1 FROM `paper_options` WHERE `paper_options`.`product_id` = `products`.`id`)
  AND NOT EXISTS (SELECT 1 FROM `quantity_options` WHERE `quantity_options`.`product_id` = `products`.`id`)
  AND NOT EXISTS (SELECT 1 FROM `page_count_options` WHERE `page_count_options`.`product_id` = `products`.`id`)
  AND NOT EXISTS (SELECT 1 FROM `delivery_options` WHERE `delivery_options`.`product_id` = `products`.`id`)
  AND NOT EXISTS (SELECT 1 FROM `designs` WHERE `designs`.`product_id` = `products`.`id`);
