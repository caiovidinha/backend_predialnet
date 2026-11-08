-- CreateTable
CREATE TABLE `push_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'sent', 'delivered', 'failed') NOT NULL DEFAULT 'pending',
    `ticketId` VARCHAR(191) NULL,
    `errorCode` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `push_deliveries_notificationId_idx`(`notificationId`),
    INDEX `push_deliveries_userId_idx`(`userId`),
    INDEX `push_deliveries_notificationId_status_idx`(`notificationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `redisOk` BOOLEAN NOT NULL,
    `redisMs` DOUBLE NULL,
    `dbOk` BOOLEAN NOT NULL,
    `dbMs` DOUBLE NULL,
    `queueWaiting` INTEGER NULL,
    `queueActive` INTEGER NULL,
    `queueCompleted` INTEGER NULL,
    `queueFailed` INTEGER NULL,
    `queueDelayed` INTEGER NULL,
    `memRssMb` DOUBLE NULL,
    `memHeapUsedMb` DOUBLE NULL,
    `uptimeS` INTEGER NULL,
    `pm2` JSON NULL,
    `logFiles` JSON NULL,
    `alerts` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `health_snapshots_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `push_deliveries` ADD CONSTRAINT `push_deliveries_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_deliveries` ADD CONSTRAINT `push_deliveries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

