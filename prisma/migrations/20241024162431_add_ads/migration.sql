-- CreateTable
CREATE TABLE `show_ad` (
    `id` VARCHAR(191) NOT NULL,
    `expiresIn` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `show` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `show_ad_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `show_ad` ADD CONSTRAINT `show_ad_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
