import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { checkDBHealth, connectDB, disconnectDB } from '../database.js';

const modelName = 'DatabaseReadinessFixture';
const collectionName = 'database_readiness_fixtures';
const environmentKeys = ['MONGODB_URI', 'NODE_ENV', 'DB_AUTO_INDEX', 'DB_MAX_POOL_SIZE', 'DB_MIN_POOL_SIZE'];
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
let memory;
let model;

before(async () => {
  memory = await MongoMemoryServer.create();
  const uri = memory.getUri('career_sprout_indexes');
  const client = new MongoClient(uri);
  await client.connect();
  await client.db('career_sprout_indexes').collection(collectionName).insertMany([
    { owner: 'owner-a', slug: 'duplicate' },
    { owner: 'owner-a', slug: 'duplicate' },
  ]);
  await client.close();

  const schema = new mongoose.Schema({ owner: String, slug: String });
  schema.index({ owner: 1, slug: 1 }, { unique: true });
  model = mongoose.model(modelName, schema, collectionName);
  Object.assign(process.env, {
    MONGODB_URI: uri,
    NODE_ENV: 'production',
    DB_AUTO_INDEX: 'true',
    DB_MAX_POOL_SIZE: '5',
    DB_MIN_POOL_SIZE: '1',
  });
});

after(async () => {
  await disconnectDB();
  mongoose.deleteModel(modelName);
  if (memory) await memory.stop();
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test('database readiness waits for unique indexes and refuses failed index creation', async () => {
  await assert.rejects(connectDB(), (error) => error.code === 11000);
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal((await checkDBHealth()).ok, false);

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  await client.db('career_sprout_indexes').collection(collectionName).deleteOne({ owner: 'owner-a' });
  await client.close();

  await connectDB();
  assert.equal((await checkDBHealth()).ok, true);
  const indexes = await mongoose.connection.db.collection(collectionName).listIndexes().toArray();
  assert.ok(indexes.some((index) => index.name === 'owner_1_slug_1' && index.unique === true));

  await model.create({ owner: 'owner-a', slug: 'after-index' });
  await assert.rejects(
    model.create({ owner: 'owner-a', slug: 'after-index' }),
    (error) => error.code === 11000,
  );
});
