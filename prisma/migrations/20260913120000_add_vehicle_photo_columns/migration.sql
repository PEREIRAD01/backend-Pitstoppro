/*
  Warnings:

  - You are about to drop the column `photoUrl` on the `Vehicle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Vehicle` DROP COLUMN `photoUrl`,
    ADD COLUMN `photoBytes` LONGBLOB NULL,
    ADD COLUMN `photoMimeType` VARCHAR(191) NULL;
