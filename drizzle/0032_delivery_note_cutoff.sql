-- Delivery notes carried their own cut-off ("Order before 11am …") while the
-- rest of the site reads ORDER_CUTOFF from src/lib/site.ts (10am). Notes now
-- write {cutoff}, which the pricing loader fills in from site.ts, so the two
-- can't disagree again. The standard note says its days start once printed,
-- so it can't be read as the whole wait. Only the seeded wording is touched;
-- a note an admin has rewritten is left as it is.
UPDATE `delivery_options` SET `note` = 'Order by {cutoff} for next working day' WHERE `note` = 'Order before 11am for next working day';
--> statement-breakpoint
UPDATE `delivery_options` SET `note` = 'Free — 3 to 5 working days once printed' WHERE `note` = 'Free — 3 to 5 working days';
