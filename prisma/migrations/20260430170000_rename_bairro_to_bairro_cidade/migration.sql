-- Rename existing BAIRRO targets to BAIRRO_CIDADE
ALTER TABLE `app_message_targets`
  MODIFY COLUMN `targeting_type` ENUM('GLOBAL','CLIENTE','CIDADE','BAIRRO_CIDADE','RUA','CEP','CEP_NUMERO') NOT NULL;

UPDATE `app_message_targets`
SET `targeting_type` = 'BAIRRO_CIDADE'
WHERE `targeting_type` = 'BAIRRO';
