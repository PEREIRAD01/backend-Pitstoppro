-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `plate` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `photoUrl` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `vehicleName` VARCHAR(191) NULL,
    `currentOdometerKm` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Vehicle_userId_idx`(`userId`),
    UNIQUE INDEX `Vehicle_userId_plate_key`(`userId`, `plate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleId` INTEGER NOT NULL,
    `eventType` ENUM('insurance', 'inspection', 'iuc', 'custom') NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `isDone` BOOLEAN NOT NULL DEFAULT false,
    `doneDate` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VehicleEvent_vehicleId_dueDate_idx`(`vehicleId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrackedItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleId` INTEGER NOT NULL,
    `itemType` ENUM('event', 'part') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `startOdometer` INTEGER NULL,
    `validMonths` INTEGER NULL,
    `validKm` INTEGER NULL,
    `dueDate` DATETIME(3) NULL,
    `dueOdometer` INTEGER NULL,
    `isDone` BOOLEAN NOT NULL DEFAULT false,
    `doneDate` DATETIME(3) NULL,
    `doneOdometer` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrackedItem_vehicleId_idx`(`vehicleId`),
    INDEX `TrackedItem_itemType_idx`(`itemType`),
    INDEX `TrackedItem_vehicleId_dueDate_idx`(`vehicleId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrackedItemLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trackedItemId` INTEGER NOT NULL,
    `logDate` DATETIME(3) NOT NULL,
    `odometerKm` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrackedItemLog_trackedItemId_logDate_idx`(`trackedItemId`, `logDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trackedItemId` INTEGER NULL,
    `vehicleEventId` INTEGER NULL,
    `expenseDate` DATETIME(3) NOT NULL,
    `amountEur` DECIMAL(12, 2) NOT NULL,
    `category` ENUM('part', 'event', 'insurance', 'inspection', 'iuc', 'maintenance', 'service', 'fuel', 'toll', 'parking', 'other') NOT NULL,
    `description` VARCHAR(191) NULL,
    `vendor` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Expense_expenseDate_idx`(`expenseDate`),
    INDEX `Expense_trackedItemId_idx`(`trackedItemId`),
    INDEX `Expense_vehicleEventId_idx`(`vehicleEventId`),
    INDEX `Expense_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Maintenance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `vehicleId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `odometerKm` INTEGER NOT NULL,
    `costEur` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `done` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Maintenance_userId_idx`(`userId`),
    INDEX `Maintenance_vehicleId_idx`(`vehicleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleEvent` ADD CONSTRAINT `VehicleEvent_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrackedItem` ADD CONSTRAINT `TrackedItem_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrackedItemLog` ADD CONSTRAINT `TrackedItemLog_trackedItemId_fkey` FOREIGN KEY (`trackedItemId`) REFERENCES `TrackedItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_trackedItemId_fkey` FOREIGN KEY (`trackedItemId`) REFERENCES `TrackedItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_vehicleEventId_fkey` FOREIGN KEY (`vehicleEventId`) REFERENCES `VehicleEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Maintenance` ADD CONSTRAINT `Maintenance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Maintenance` ADD CONSTRAINT `Maintenance_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
