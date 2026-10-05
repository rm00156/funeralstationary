-- 0010 added products.description (null) and products.occasion (default
-- 'service'), but db:seed never touches a catalogue that already has rows, and
-- production's was copied, not seeded. Without this, every existing product
-- has no card blurb and the after-the-service cards sit under "For the service".
-- Values match src/db/seedCatalogue.ts. Only rows still at the column defaults
-- are touched, so a blurb or group already set in /admin is left alone.
UPDATE `products` SET `description` = 'Personalise online with their photographs and words. Printed at exact A5, 148 × 210 mm.' WHERE `slug` = 'order-of-service' AND `description` IS NULL;--> statement-breakpoint
UPDATE `products` SET `description` = 'Wallet-sized cards with their photo and dates, for family and friends to keep.' WHERE `slug` = 'memorial-cards' AND `description` IS NULL;--> statement-breakpoint
UPDATE `products` SET `description` = 'A small keepsake with their photo and a favourite verse, to give out on the day.' WHERE `slug` = 'bookmarks' AND `description` IS NULL;--> statement-breakpoint
UPDATE `products` SET `description` = 'Thank everyone who sent flowers, cards or kind words, in your own words.' WHERE `slug` = 'thank-you-cards' AND `description` IS NULL;--> statement-breakpoint
UPDATE `products` SET `description` = 'Cards for guests to fill in at the service, so the family has a record of who came.' WHERE `slug` = 'attendance-cards' AND `description` IS NULL;--> statement-breakpoint
UPDATE `products` SET `description` = 'For a much-loved companion, or to send to someone who has lost theirs.' WHERE `slug` = 'pet-sympathy' AND `description` IS NULL;--> statement-breakpoint
UPDATE `products` SET `occasion` = 'after' WHERE `slug` IN ('thank-you-cards', 'pet-sympathy') AND `occasion` = 'service';
