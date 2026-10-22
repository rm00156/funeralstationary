-- Seven designs were named like files ("Classic Template 2", "Religious Cross
-- 1"); src/lib/classicTemplates.ts and themedTemplates.ts now give them
-- customer names, but the generator never touches an existing row's name.
-- Slugs stay as they are (URLs, order history). A row renamed by an admin in
-- the meantime no longer has its old name, so it is left alone.
UPDATE `templates` SET `name` = 'Simple Celebration' WHERE `slug` = 'classic-template' AND `name` = 'Classic Template';
--> statement-breakpoint
UPDATE `templates` SET `name` = 'Graceful Script' WHERE `slug` = 'classic-template-2' AND `name` = 'Classic Template 2';
--> statement-breakpoint
UPDATE `templates` SET `name` = 'Pastel Blue' WHERE `slug` = 'classic-template-blue' AND `name` = 'Classic Template Blue';
--> statement-breakpoint
UPDATE `templates` SET `name` = 'Pastel Peach' WHERE `slug` = 'classic-template-peach' AND `name` = 'Classic Template Peach';
--> statement-breakpoint
UPDATE `templates` SET `name` = 'Vintage Frame' WHERE `slug` = 'border-corner-2' AND `name` = 'Border Corner 2';
--> statement-breakpoint
UPDATE `templates` SET `name` = 'Ebony Cross' WHERE `slug` = 'religious-cross-1' AND `name` = 'Religious Cross 1';
--> statement-breakpoint
UPDATE `templates` SET `name` = 'Quiet Cross' WHERE `slug` = 'religious-cross-2' AND `name` = 'Religious Cross 2';
