FROM debian:latest

RUN apt-get update && apt-get install -y cron mysql-client

COPY backup.sh /backup.sh
RUN chmod +x /backup.sh

# Cria cron job: todos os dias às 03h
RUN echo "0 3 * * * root /backup.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/mysql-backup

RUN chmod 0644 /etc/cron.d/mysql-backup && crontab /etc/cron.d/mysql-backup

CMD ["cron", "-f"]
