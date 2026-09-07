-- Remove the customer proof-approval loop.
--
-- Mistakes are now caught before payment by the pre-order check
-- (src/lib/designReadiness.ts), so a paid order goes straight to the print
-- queue and the awaiting_proof/proof_sent/approved states have nothing left
-- to mean. The proof itself survives as an admin/press artefact — hence
-- order_proofs staying, minus the columns that only served the review.
--
-- The status enum is widened before it is narrowed: MySQL would otherwise
-- truncate any row still holding a value the new enum lacks.
ALTER TABLE `orders` MODIFY COLUMN `status` enum('draft','awaiting_proof','proof_sent','approved','awaiting_print','in_production','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'draft';--> statement-breakpoint
-- Paid but not yet at press, whichever side of the old review it sat on.
UPDATE `orders` SET `status` = 'awaiting_print' WHERE `status` IN ('awaiting_proof','proof_sent','approved');--> statement-breakpoint
UPDATE `order_events` SET `from_status` = 'awaiting_print' WHERE `from_status` IN ('awaiting_proof','proof_sent','approved');--> statement-breakpoint
UPDATE `order_events` SET `to_status` = 'awaiting_print' WHERE `to_status` IN ('awaiting_proof','proof_sent','approved');--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `status` enum('draft','awaiting_print','in_production','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `orders` DROP INDEX `orders_share_token_unique`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `share_token`;--> statement-breakpoint
ALTER TABLE `order_proofs` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `order_proofs` DROP COLUMN `sent_at`;--> statement-breakpoint
ALTER TABLE `order_proofs` DROP COLUMN `responded_at`;--> statement-breakpoint
ALTER TABLE `order_proofs` DROP COLUMN `customer_note`;
