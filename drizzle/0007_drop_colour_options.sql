-- The colour/ink axis goes.
--
-- A customer prints exactly what they designed: the press PDF is a screenshot
-- of the colour design, so a cheaper "black & white" option charged less for
-- artwork that never changed. Full colour was the ×1 option, so every price
-- that remains is unchanged.
--
-- The FK must go before the table it points at. Placed orders keep what they
-- chose in order_items.quote_snapshot, which is never rewritten.
ALTER TABLE `designs` DROP FOREIGN KEY `designs_colour_option_fk`;--> statement-breakpoint
ALTER TABLE `designs` DROP COLUMN `colour_option_id`;--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `colour_option_id`;--> statement-breakpoint
DROP TABLE `colour_options`;
