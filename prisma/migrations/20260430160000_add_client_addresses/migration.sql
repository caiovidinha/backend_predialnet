-- CreateTable
CREATE TABLE `client_addresses` (
    `id` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NOT NULL,
    `cidade` VARCHAR(191) NULL,
    `bairro` VARCHAR(191) NULL,
    `cep` VARCHAR(191) NULL,
    `numero` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_addresses_cpf_key`(`cpf`),
    INDEX `client_addresses_cep_idx`(`cep`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
