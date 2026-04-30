-- Step 1: add BAIRRO_CIDADE to the enum while keeping BAIRRO
ALTER TABLE `app_message_targets`
  MODIFY COLUMN `targeting_type` ENUM('GLOBAL','CLIENTE','CIDADE','BAIRRO','BAIRRO_CIDADE','RUA','CEP','CEP_NUMERO') NOT NULL;

-- Step 2: migrate existing BAIRRO rows to BAIRRO_CIDADE
UPDATE `app_message_targets`
SET `targeting_type` = 'BAIRRO_CIDADE'
WHERE `targeting_type` = 'BAIRRO';

-- Step 3: remove BAIRRO from the enum
ALTER TABLE `app_message_targets`
  MODIFY COLUMN `targeting_type` ENUM('GLOBAL','CLIENTE','CIDADE','BAIRRO_CIDADE','RUA','CEP','CEP_NUMERO') NOT NULL;
