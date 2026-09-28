-- The size axis goes, for the same reason colour did (0007).
--
-- Every design is drawn on one A5 artboard and the press PDF is printed at
-- that size, so a size picker could only charge for a format the artwork
-- doesn't have. Size belongs to the product, not the basket. A5 was the only
-- row and priced at ×1, so every remaining price is unchanged.
--
-- The FK must go before the table it points at. Placed orders keep what they
-- chose in order_items.quote_snapshot, which is never rewritten.
ALTER TABLE `designs` DROP FOREIGN KEY `designs_size_option_fk`;--> statement-breakpoint
ALTER TABLE `designs` DROP INDEX `designs_size_option_fk`;--> statement-breakpoint
ALTER TABLE `designs` DROP COLUMN `size_option_id`;--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `size_option_id`;--> statement-breakpoint
DROP TABLE `size_options`;
