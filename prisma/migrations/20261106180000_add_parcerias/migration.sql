-- CreateTable
CREATE TABLE `parcerias` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(40) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `instagram` VARCHAR(60) NULL,
    `contato` VARCHAR(120) NULL,
    `observacao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `parcerias_slug_key`(`slug`),
    INDEX `parcerias_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
