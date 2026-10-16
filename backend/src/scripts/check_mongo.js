require('dotenv').config();
const mongoose = require('mongoose');

async function testMongo() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/printflow');
  console.log('Connected to MongoDB printflow database');

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections in printflow database:');
  for (const c of collections) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(` - ${c.name}: ${count} documents`);
  }

  await mongoose.disconnect();
}

testMongo().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
