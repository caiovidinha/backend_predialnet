-- CreateTable
CREATE TABLE `parceria_eventos` (
    `id` VARCHAR(191) NOT NULL,
    `parceria` VARCHAR(40) NOT NULL,
    `evento` VARCHAR(32) NOT NULL,
    `sessao` VARCHAR(36) NOT NULL,
    `plano` VARCHAR(32) NULL,
    `detalhe` VARCHAR(64) NULL,
    `origem` VARCHAR(255) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `parceria_eventos_parceria_createdAt_idx`(`parceria`, `createdAt`),
    INDEX `parceria_eventos_createdAt_idx`(`createdAt`),
    INDEX `parceria_eventos_sessao_idx`(`sessao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
