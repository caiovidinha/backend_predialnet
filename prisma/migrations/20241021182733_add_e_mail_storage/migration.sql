-- CreateTable
CREATE TABLE `emails` (
    `id` VARCHAR(191) NOT NULL,
    `censoredEmail` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `emails_censoredEmail_key`(`censoredEmail`),
    UNIQUE INDEX `emails_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
