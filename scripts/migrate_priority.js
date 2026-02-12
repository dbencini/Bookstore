require('dotenv').config();
const { sequelize, Category } = require('../models');

async function migrate() {
    try {
        console.log('--- Database Migration: Add Priority & Initialize Bestseller ---');

        // 1. Add priority column manually if it doesn't exist
        const [results] = await sequelize.query("SHOW COLUMNS FROM category LIKE 'priority'");
        if (results.length === 0) {
            console.log('Adding "priority" column to "category" table...');
            await sequelize.query("ALTER TABLE category ADD COLUMN priority INT DEFAULT 0");
        } else {
            console.log('"priority" column already exists.');
        }

        // 2. Ensure "Bestseller" category exists and has priority
        console.log('Ensuring "Bestseller" category exists...');
        const [bestseller, created] = await Category.findOrCreate({
            where: { name: 'Bestseller' },
            defaults: { priority: 100 }
        });

        if (!created && bestseller.priority !== 100) {
            console.log('Updating "Bestseller" category priority...');
            bestseller.priority = 100;
            await bestseller.save();
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
