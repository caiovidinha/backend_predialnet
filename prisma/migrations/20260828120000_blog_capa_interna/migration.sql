-- AlterTable
-- Segunda imagem do artigo: a `capa` continua sendo a do card/Open Graph (16:9)
-- e a `capa_interna` é a do topo da página do post, no tamanho original.
-- Colunas nulas: artigo já publicado segue válido sem a imagem nova.
ALTER TABLE `blog_artigos`
    ADD COLUMN `capa_interna_url` TEXT NULL,
    ADD COLUMN `capa_interna_alt` VARCHAR(191) NULL,
    ADD COLUMN `capa_interna_largura` INTEGER NULL,
    ADD COLUMN `capa_interna_altura` INTEGER NULL;
