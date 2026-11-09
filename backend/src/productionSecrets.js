import { readFileSync } from 'node:fs';

function secret(name) {
  const path = process.env[`${name}_FILE`];
  if (!path) throw new Error(`${name}_FILE is required`);
  const value = readFileSync(path, 'utf8').trim();
  if (!value) throw new Error(`${name}_FILE is empty`);
  return value;
}

const mongoPassword = encodeURIComponent(secret('MONGO_APP_PASSWORD'));
const redisPassword = encodeURIComponent(secret('REDIS_PASSWORD'));
process.env.MONGODB_URI = `mongodb://career_sprout:${mongoPassword}@mongo:27017/career_sprout?authSource=career_sprout`;
process.env.REDIS_URL = `redis://default:${redisPassword}@redis:6379/`;
const { startCampusServer } = await import('./campusServer.js');
await startCampusServer();
