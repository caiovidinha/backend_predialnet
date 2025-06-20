#!/bin/bash

TIMESTAMP=$(date +"%F-%H-%M")
BACKUP_FILE="/backups/backup-$TIMESTAMP.sql"

mysqldump -h mysql-container -u root -padmin predialnet > $BACKUP_FILE

echo "Backup feito em $TIMESTAMP"
