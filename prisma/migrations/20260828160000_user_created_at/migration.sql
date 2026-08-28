-- AlterTable
-- Dois passos de propósito. Se o DEFAULT viesse junto do ADD COLUMN, o MySQL
-- preencheria TODAS as linhas existentes com o instante da migration, e todo
-- usuário antigo apareceria como "cadastrado hoje" no dashboard.
-- Assim, quem já existia fica NULL (data desconhecida) e só cadastro novo
-- recebe a data de verdade.
ALTER TABLE `users` ADD COLUMN `createdAt` DATETIME(3) NULL;
ALTER TABLE `users` ALTER COLUMN `createdAt` SET DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `users_createdAt_idx` ON `users`(`createdAt`);
