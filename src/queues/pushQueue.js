// queues/pushQueue.js
const Queue = require('bull');

// carrega REDIS_URL do .env, ou usa localhost como fallback
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const pushQueue = new Queue('pushNotifications', redisUrl);

module.exports = pushQueue;
