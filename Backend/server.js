require('dotenv').config();

const app = require('./app');
const connectDatabase = require('./config/database');
const mongoose = require('mongoose');
const { startOrderExpirationJob } = require('./services/orderExpirationService');

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();

  const server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(PORT, () => resolve(httpServer));
    httpServer.once('error', reject);
  });

  console.log(`E-commerce backend server running on http://localhost:${PORT}`);
  const stopOrderExpirationJob = startOrderExpirationJob();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`${signal} received. Closing the server and database connection.`);

    await stopOrderExpirationJob();
    server.close(async (error) => {
      if (error) {
        console.error('Error while closing the HTTP server:', error.message);
      }

      try {
        await mongoose.disconnect();
        console.log('MongoDB connection closed.');
      } catch (disconnectError) {
        console.error(
          'Error while closing the MongoDB connection:',
          disconnectError.name
        );
        process.exitCode = 1;
      }

      if (error) {
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error(
    `Server startup failed (${error.name}). Verify MONGODB_URI, database network access, and credentials.`
  );
  process.exit(1);
});
