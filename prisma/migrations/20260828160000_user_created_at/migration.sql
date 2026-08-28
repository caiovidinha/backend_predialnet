-- AlterTable
-- Dois passos de propósito. Se o DEFAULT viesse junto do ADD COLUMN, o MySQL
-- preencheria TODAS as linhas existentes com o instante da migration, e todo
-- usuário antigo apareceria como "cadastrado hoje" no dashboard.
-- Assim, quem já existia fica NULL (data desconhecida) e só cadastro novo
-- recebe a data de verdade.
--
-- O segundo passo usa MODIFY COLUMN, e não ALTER COLUMN ... SET DEFAULT:
-- este último só aceita valor literal, e recusa CURRENT_TIMESTAMP com erro
-- 1064. MODIFY altera só a definição da coluna — não reescreve o que já está
-- gravado, então os NULLs continuam NULL.
ALTER TABLE `users` ADD COLUMN `createdAt` DATETIME(3) NULL;
ALTER TABLE `users` MODIFY COLUMN `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `users_createdAt_idx` ON `users`(`createdAt`);
