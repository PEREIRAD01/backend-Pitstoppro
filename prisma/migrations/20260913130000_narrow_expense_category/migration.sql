-- Remap any legacy category values to `custom` before narrowing the enum,
-- so the ALTER below never fails on out-of-range data.
UPDATE `Expense`
SET `category` = 'custom'
WHERE `category` NOT IN ('part', 'event', 'insurance', 'inspection', 'iuc', 'custom');

-- AlterTable
ALTER TABLE `Expense` MODIFY `category` ENUM('part', 'event', 'insurance', 'inspection', 'iuc', 'custom') NOT NULL;
