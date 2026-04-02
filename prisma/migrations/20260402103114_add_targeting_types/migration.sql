-- AlterEnum: add CIDADE, RUA, CEP_NUMERO to TargetingType
ALTER TABLE `app_message_targets` MODIFY COLUMN `targeting_type` ENUM('GLOBAL', 'CLIENTE', 'CIDADE', 'BAIRRO', 'RUA', 'CEP', 'CEP_NUMERO') NOT NULL;
