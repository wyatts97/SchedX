// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

// Switch to admin database
db = db.getSiblingDB('admin');

// Create the schedx database
db = db.getSiblingDB('schedx');

// Create a user for the schedx database
db.createUser({
  user: 'schedx_user',
  pwd: 'schedx_password',
  roles: [
    {
      role: 'readWrite',
      db: 'schedx'
    }
  ]
});

// Create initial collections
db.createCollection('users');
db.createCollection('tweets');
db.createCollection('accounts');
db.createCollection('notifications');
db.createCollection('twitter_apps');

print('MongoDB initialization completed successfully'); 