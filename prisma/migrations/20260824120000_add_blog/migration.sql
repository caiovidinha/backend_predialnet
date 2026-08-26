-- CreateTable
CREATE TABLE `blog_categorias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `blog_categorias_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_artigos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `resumo` TEXT NOT NULL,
    `categoriaId` INTEGER NOT NULL,
    `autor` VARCHAR(191) NOT NULL DEFAULT 'Predialnet',
    `corpo` LONGTEXT NOT NULL,
    `capa_url` TEXT NULL,
    `capa_alt` VARCHAR(191) NULL,
    `capa_largura` INTEGER NULL,
    `capa_altura` INTEGER NULL,
    `destaque` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('rascunho', 'publicado', 'arquivado') NOT NULL DEFAULT 'rascunho',
    `publicado_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,
    `tempo_leitura` INTEGER NOT NULL DEFAULT 1,
    `visualizacoes` INTEGER NOT NULL DEFAULT 0,
    `seo_titulo` VARCHAR(191) NULL,
    `seo_descricao` TEXT NULL,
    `seo_noindex` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `blog_artigos_slug_key`(`slug`),
    INDEX `blog_artigos_status_publicado_em_idx`(`status`, `publicado_em`),
    INDEX `blog_artigos_categoriaId_idx`(`categoriaId`),
    INDEX `blog_artigos_destaque_idx`(`destaque`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha_hash` VARCHAR(191) NOT NULL,
    `papel` ENUM('admin', 'editor') NOT NULL DEFAULT 'editor',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ultimo_login` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `blog_usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `revogado_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `blog_refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `blog_refresh_tokens_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_newsletter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `origem` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `blog_newsletter_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_redirecionamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `de` VARCHAR(191) NOT NULL,
    `para` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `blog_redirecionamentos_de_key`(`de`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_auditoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NULL,
    `usuarioNome` VARCHAR(191) NULL,
    `acao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NULL,
    `detalhes` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `blog_auditoria_entidade_entidadeId_idx`(`entidade`, `entidadeId`),
    INDEX `blog_auditoria_criado_em_idx`(`criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `blog_artigos` ADD CONSTRAINT `blog_artigos_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `blog_categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blog_refresh_tokens` ADD CONSTRAINT `blog_refresh_tokens_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `blog_usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Categorias iniciais (alinhadas ao plano de SEO da seção 2.2 da spec)
INSERT INTO `blog_categorias` (`slug`, `nome`, `descricao`, `ordem`) VALUES
    ('tecnologia', 'Tecnologia', 'Como a tecnologia por trás da sua conexão funciona.', 1),
    ('dicas', 'Dicas', 'Ajustes simples para tirar mais da sua internet.', 2),
    ('planos', 'Planos', 'Comparativos e novidades dos planos Predialnet.', 3),
    ('cobertura', 'Cobertura', 'Onde a Predialnet chega e o que muda em cada região.', 4);
