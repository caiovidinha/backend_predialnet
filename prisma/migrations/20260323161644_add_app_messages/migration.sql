-- CreateTable
CREATE TABLE `app_messages` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `msg_cliente` TEXT NOT NULL,
    `timeout_sec` INTEGER NOT NULL DEFAULT 10,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `app_messages_active_deleted_at_idx`(`active`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_message_targets` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `targeting_type` ENUM('GLOBAL', 'CLIENTE', 'CEP', 'BAIRRO') NOT NULL,
    `targeting_value` VARCHAR(191) NOT NULL DEFAULT '*',

    INDEX `app_message_targets_targeting_type_targeting_value_idx`(`targeting_type`, `targeting_value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `app_message_targets` ADD CONSTRAINT `app_message_targets_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `app_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
