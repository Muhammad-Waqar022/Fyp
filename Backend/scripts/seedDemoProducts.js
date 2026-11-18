require('dotenv').config();
require('../config/dns')();

const connectDatabase = require('../config/database');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const slugify = require('../utils/slugify');

const demoProducts = [
  {
    name: "'90s Carhartt Detroit Jacket",
    description: 'Distressed Camel',
    price: 185,
    category: 'Outerwear',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=700',
    stockQuantity: 5,
  },
  {
    name: 'Vintage Black Trench Coat',
    description: 'Archival Collection',
    price: 320,
    category: 'Outerwear',
    image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=700',
    stockQuantity: 5,
  },
  {
    name: 'Vintage Denim Jeans',
    description: 'Blue Selvedge Denim',
    price: 145,
    category: 'Denim',
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=700',
    stockQuantity: 5,
  },
  {
    name: 'Wool Gabardine Blazer',
    description: 'Black Premium Wool',
    price: 290,
    category: 'Blazers',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=700',
    stockQuantity: 5,
  },
];

async function seedDemoProducts() {
  await connectDatabase();

  let created = 0;
  let skipped = 0;

  for (const product of demoProducts) {
    const slug = slugify(product.name);
    const existing = await Product.exists({ slug });
    if (existing) {
      skipped += 1;
      continue;
    }

    await Product.create({ ...product, slug });
    created += 1;
  }

  console.log(`Demo products seeded: ${created} created, ${skipped} skipped (already exist).`);
}

seedDemoProducts()
  .catch((error) => {
    const detail = error.code ? `, ${error.code}` : '';
    console.error(`Demo product seeding failed (${error.name}${detail}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
