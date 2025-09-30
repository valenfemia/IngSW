const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 80;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Sequelize from environment
const DIALECT = process.env.DB_DIALECT || 'mysql'; // 'mysql' or 'postgres'
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : (DIALECT === 'postgres' ? 5432 : 3306),
    dialect: DIALECT,
    logging: false
  }
);

// Define Product model (simplified per Tarea 4)
const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  price: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 }
}, { tableName: 'products', timestamps: false });

// Minimal API routes
app.get('/api/products', async (_req, res) => {
  try {
    const items = await Product.findAll({ order: [['id', 'ASC']] });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const created = await Product.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start after DB ready
(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server due to DB error:', err);
    process.exit(1);
  }
})();
