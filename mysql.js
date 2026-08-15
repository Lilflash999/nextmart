const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nextmart',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

async function initDatabase() {
    try {
        await promisePool.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'nextmart'}`);
        await promisePool.query(`USE ${process.env.DB_NAME || 'nextmart'}`);
        
        // Users table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uid VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                profile_image TEXT,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Products table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id VARCHAR(255) UNIQUE NOT NULL,
                seller_id INT NOT NULL,
                seller_name VARCHAR(100),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100),
                price DECIMAL(10,2) NOT NULL,
                old_price DECIMAL(10,2),
                discount_percentage INT DEFAULT 0,
                is_on_sale BOOLEAN DEFAULT FALSE,
                stock_quantity INT DEFAULT 0,
                in_stock BOOLEAN DEFAULT FALSE,
                main_image TEXT,
                images JSON,
                is_featured BOOLEAN DEFAULT FALSE,
                view_count INT DEFAULT 0,
                purchase_count INT DEFAULT 0,
                average_rating DECIMAL(3,2) DEFAULT 0,
                total_reviews INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Cart table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS cart (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                product_id VARCHAR(255) NOT NULL,
                quantity INT DEFAULT 1,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Wishlist table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS wishlist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                product_id VARCHAR(255) NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_wishlist (user_id, product_id)
            )
        `);
        
        // Orders table with seller_id column
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(255) UNIQUE NOT NULL,
                user_id INT NOT NULL,
                seller_id INT NULL,
                items JSON NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                shipping_address TEXT,
                payment_method VARCHAR(50),
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        
        // Comments table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                comment_id VARCHAR(255) UNIQUE NOT NULL,
                product_id VARCHAR(255) NOT NULL,
                user_id INT NOT NULL,
                username VARCHAR(100),
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Sessions table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(500) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Add seller_id column if it doesn't exist (for existing databases)
        try {
            await promisePool.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id INT NULL
            `);
            await promisePool.query(`
                ALTER TABLE orders ADD FOREIGN KEY IF NOT EXISTS (seller_id) REFERENCES users(id) ON DELETE SET NULL
            `);
        } catch (err) {
            // Column might already exist, ignore error
            console.log('ℹ️ seller_id column already exists or could not be added');
        }
        
        console.log('✅ Database tables created/verified successfully!');
        console.log('📊 Tables: users, products, cart, wishlist, orders, comments, sessions');
        return true;
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        return false;
    }
}

module.exports = { pool, promisePool, initDatabase };