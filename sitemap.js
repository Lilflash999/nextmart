const mysql = require('mysql2/promise');
require('dotenv').config();

async function generateSitemap() {
        const pool = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                port: process.env.DB_PORT || 3306
        });
        
        try {
                // Get all products
                const [products] = await pool.query(
                        'SELECT product_id, name, updated_at FROM products ORDER BY updated_at DESC'
                );
                
                // Get all categories
                const [categories] = await pool.query(
                        'SELECT DISTINCT category FROM products WHERE category IS NOT NULL'
                );
                
                let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    
    <!-- Homepage -->
    <url>
        <loc>https://nextmart.hidenfree.com/</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    
    <!-- Login -->
    <url>
        <loc>https://nextmart.hidenfree.com/login</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    
    <!-- Seller Dashboard -->
    <url>
        <loc>https://nextmart.hidenfree.com/seller</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    
    <!-- Review Page -->
    <url>
        <loc>https://nextmart.hidenfree.com/review</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>
    
    <!-- Category Pages -->
    ${categories.map(cat => `
    <url>
        <loc>https://nextmart.hidenfree.com/category/${cat.category.toLowerCase()}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`).join('')}
    
    <!-- Product Pages -->
    ${products.map(product => `
    <url>
        <loc>https://nextmart.hidenfree.com/product?id=${product.product_id}</loc>
        <lastmod>${product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
        <image:image>
            <image:loc>https://nextmart.hidenfree.com/images/${product.product_id}.jpg</image:loc>
            <image:caption>${product.name}</image:caption>
        </image:image>
    </url>`).join('')}
    
</urlset>`;
                
                return sitemap;
        } catch (error) {
                console.error('Error generating sitemap:', error);
                return null;
        } finally {
                await pool.end();
        }
}

module.exports = { generateSitemap };