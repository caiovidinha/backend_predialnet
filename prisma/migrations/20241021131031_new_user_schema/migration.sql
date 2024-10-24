/*
  Warnings:

  - You are about to drop the column `cNumber` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `users_cNumber_key` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `cNumber`;

-- CreateIndex
CREATE UNIQUE INDEX `users_cpf_key` ON `users`(`cpf`);
