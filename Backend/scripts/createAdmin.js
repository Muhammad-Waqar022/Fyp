require('dotenv').config();

const connectDatabase = require('../config/database');
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
  const { ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_FIRST_NAME || !ADMIN_LAST_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in Backend/.env.');
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(ADMIN_PASSWORD)) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters and include uppercase, lowercase, and a number.');
  }

  await connectDatabase();
  const user = await User.create({
    firstName: ADMIN_FIRST_NAME,
    lastName: ADMIN_LAST_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
  });
  console.log(`Administrator account created for ${user.email}.`);
}

createAdmin()
  .catch((error) => {
    console.error('Administrator account creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
