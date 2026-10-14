const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      'MongoDB URI is missing. Set MONGODB_URI in Backend/.env.'
    );
  }

  if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
    console.warn(
      'MONGO_URI is supported for compatibility; use MONGODB_URI in Backend/.env.'
    );
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  await Promise.all(
    Object.values(mongoose.connection.models).map((model) => model.init())
  );

  console.log(`MongoDB connected to database "${mongoose.connection.name}".`);
}

module.exports = connectDatabase;
