-- AlterTable
ALTER TABLE `blog_artigos` ADD COLUMN `revalidado_em` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `blog_artigos_status_publicado_em_revalidado_em_idx` ON `blog_artigos`(`status`, `publicado_em`, `revalidado_em`);

-- Artigos já publicados antes desta migração não devem disparar revalidação
-- retroativa quando o job subir pela primeira vez.
UPDATE `blog_artigos` SET `revalidado_em` = NOW(3)
  WHERE `status` = 'publicado' AND `publicado_em` IS NOT NULL AND `publicado_em` <= NOW(3);
