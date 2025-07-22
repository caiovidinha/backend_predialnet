const pushQueue = require('./queues/pushQueue');
pushQueue.isReady().then(() => {
  console.log('✅ Redis & Bull conectados com sucesso');
  process.exit(0);
}).catch(err => {
  console.error('❌ Falha ao conectar na fila:', err);
  process.exit(1);
});
