-- AlterTable: add extended, optional fields to Vehicle
ALTER TABLE `Vehicle`
    ADD COLUMN `year` INTEGER NULL,
    ADD COLUMN `vehicleName` VARCHAR(191) NULL,
    ADD COLUMN `currentOdometerKm` INTEGER NULL;
