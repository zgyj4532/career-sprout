const password = cat('/run/secrets/mongo_app_password').trim();
if (!password) throw new Error('Mongo application password is empty');
db.getSiblingDB('career_sprout').createUser({
  user: 'career_sprout',
  pwd: password,
  roles: [{ role: 'readWrite', db: 'career_sprout' }],
});
