require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { promisePool, initDatabase } = require('./mysql');
const { generateSitemap } = require('./sitemap');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/sitemap.xml', async (req, res) => {
    try {
        const sitemap = await generateSitemap();
        if (sitemap) {
            res.header('Content-Type', 'application/xml');
            res.send(sitemap);
        } else {
            res.status(500).send('Error generating sitemap');
        }
    } catch (e) {
        res.status(500).send('Error generating sitemap');
    }
});

app.get('/sitemap-static.xml', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// ========== SESSION MIDDLEWARE ==========
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ========== PASSPORT INITIALIZATION ==========
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// ========== GOOGLE OAUTH STRATEGY ==========
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || 'https://nextmart.hidenfree.com/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const username = profile.displayName || email.split('@')[0];
        const profileImage = profile.photos[0]?.value || '';
        
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        let user;
        if (users.length > 0) {
            user = users[0];
            if (!user.profile_image && profileImage) {
                await promisePool.query(
                    'UPDATE users SET profile_image = ? WHERE id = ?',
                    [profileImage, user.id]
                );
                user.profile_image = profileImage;
            }
        } else {
            const uid = 'google_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const result = await promisePool.query(
                'INSERT INTO users (uid, username, email, profile_image, role) VALUES (?, ?, ?, ?, ?)',
                [uid, username, email, profileImage, 'user']
            );
            const [newUser] = await promisePool.query('SELECT * FROM users WHERE id = ?', [result[0].insertId]);
            user = newUser[0];
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

function generateUid() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateProductId() {
    return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateOrderId() {
    return 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateCommentId() {
    return 'cmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }
        const token = authHeader.split('Bearer ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Invalid token' });
    }
}

// ========== GOOGLE AUTH ROUTES ==========
app.get('/api/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
}));

app.get('/api/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/login',
        session: false
    }),
    (req, res) => {
        try {
            const token = jwt.sign(
                { 
                    uid: req.user.uid, 
                    email: req.user.email, 
                    username: req.user.username, 
                    role: req.user.role 
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            res.redirect(`/login?token=${token}`);
        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect('/login?error=google_auth_failed');
        }
    }
);

// ========== AUTH ROUTES ==========
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, username, phone } = req.body;
        
        const [existing] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const uid = generateUid();
        
        await promisePool.query(
            'INSERT INTO users (uid, username, email, password, phone) VALUES (?, ?, ?, ?, ?)',
            [uid, username, email, hashedPassword, phone || '']
        );
        
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [uid]);
        
        res.status(201).json({
            success: true,
            message: 'User created',
            user: {
                uid: user[0].uid,
                email: user[0].email,
                username: user[0].username
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { uid: user.uid, email: user.email, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(200).json({
            success: true,
            token: token,
            user: {
                uid: user.uid,
                email: user.email,
                username: user.username,
                profileImage: user.profile_image,
                role: user.role
            }
        });
    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const user = users[0];
        delete user.password;
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { username, phone } = req.body;
        const updates = [];
        const values = [];
        
        if (username) { updates.push('username = ?'); values.push(username); }
        if (phone) { updates.push('phone = ?'); values.push(phone); }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }
        
        values.push(req.user.uid);
        await promisePool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
            values
        );
        
        res.status(200).json({ success: true, message: 'Profile updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== PRODUCT ROUTES ==========
app.get('/api/products', async (req, res) => {
    try {
        const { limit = 50, category } = req.query;
        let query = 'SELECT * FROM products ORDER BY created_at DESC LIMIT ?';
        let params = [parseInt(limit)];
        
        if (category) {
            query = 'SELECT * FROM products WHERE category = ? ORDER BY created_at DESC LIMIT ?';
            params = [category, parseInt(limit)];
        }
        
        const [products] = await promisePool.query(query, params);
        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/products/:productId', async (req, res) => {
    try {
        const [products] = await promisePool.query(
            'SELECT * FROM products WHERE product_id = ?',
            [req.params.productId]
        );
        
        if (products.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        await promisePool.query(
            'UPDATE products SET view_count = view_count + 1 WHERE product_id = ?',
            [req.params.productId]
        );
        
        res.status(200).json({ success: true, product: products[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const { name, description, category, price, oldPrice, stockQuantity, mainImage } = req.body;
        const productId = generateProductId();
        
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        
        await promisePool.query(
            `INSERT INTO products 
            (product_id, seller_id, seller_name, name, description, category, price, old_price, stock_quantity, main_image) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [productId, user[0].id, user[0].username, name, description, category, price, oldPrice || null, stockQuantity || 0, mainImage || '']
        );
        
        const [product] = await promisePool.query('SELECT * FROM products WHERE product_id = ?', [productId]);
        
        res.status(201).json({ success: true, productId: productId, product: product[0] });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.put('/api/products/:productId', authenticateToken, async (req, res) => {
    try {
        const [products] = await promisePool.query(
            'SELECT * FROM products WHERE product_id = ?',
            [req.params.productId]
        );
        
        if (products.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        
        if (products[0].seller_id !== user[0].id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        const updates = [];
        const values = [];
        const fields = ['name', 'description', 'category', 'price', 'old_price', 'stock_quantity', 'main_image'];
        
        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        });
        
        values.push(req.params.productId);
        await promisePool.query(
            `UPDATE products SET ${updates.join(', ')} WHERE product_id = ?`,
            values
        );
        
        res.status(200).json({ success: true, message: 'Product updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/products/:productId', authenticateToken, async (req, res) => {
    try {
        const [products] = await promisePool.query(
            'SELECT * FROM products WHERE product_id = ?',
            [req.params.productId]
        );
        
        if (products.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        
        if (products[0].seller_id !== user[0].id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        await promisePool.query('DELETE FROM products WHERE product_id = ?', [req.params.productId]);
        
        res.status(200).json({ success: true, message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/seller/products', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        const [products] = await promisePool.query(
            'SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC',
            [user[0].id]
        );
        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ success: false, error: 'Search term required' });
        }
        
        const [products] = await promisePool.query(
            'SELECT * FROM products WHERE name LIKE ? OR description LIKE ? LIMIT 20',
            [`%${q}%`, `%${q}%`]
        );
        
        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== CART ROUTES ==========
app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        const [cart] = await promisePool.query(
            `SELECT c.*, p.name, p.price, p.main_image, p.seller_id, u.username as seller_name, u.phone as seller_whatsapp 
             FROM cart c 
             JOIN products p ON c.product_id = p.product_id 
             JOIN users u ON p.seller_id = u.id 
             WHERE c.user_id = ?`,
            [user[0].id]
        );
        res.status(200).json({ success: true, cart });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/cart/add', authenticateToken, async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        
        const [existing] = await promisePool.query(
            'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
            [user[0].id, productId]
        );
        
        if (existing.length > 0) {
            await promisePool.query(
                'UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?',
                [quantity, user[0].id, productId]
            );
        } else {
            await promisePool.query(
                'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
                [user[0].id, productId, quantity]
            );
        }
        
        const [cart] = await promisePool.query(
            `SELECT c.*, p.name, p.price, p.main_image, p.seller_id, u.username as seller_name, u.phone as seller_whatsapp 
             FROM cart c 
             JOIN products p ON c.product_id = p.product_id 
             JOIN users u ON p.seller_id = u.id 
             WHERE c.user_id = ?`,
            [user[0].id]
        );
        
        res.status(200).json({ success: true, cart });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/cart/remove/:productId', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        await promisePool.query(
            'DELETE FROM cart WHERE user_id = ? AND product_id = ?',
            [user[0].id, req.params.productId]
        );
        
        const [cart] = await promisePool.query(
            `SELECT c.*, p.name, p.price, p.main_image, p.seller_id, u.username as seller_name, u.phone as seller_whatsapp 
             FROM cart c 
             JOIN products p ON c.product_id = p.product_id 
             JOIN users u ON p.seller_id = u.id 
             WHERE c.user_id = ?`,
            [user[0].id]
        );
        
        res.status(200).json({ success: true, cart });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/cart/clear', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        await promisePool.query('DELETE FROM cart WHERE user_id = ?', [user[0].id]);
        res.status(200).json({ success: true, message: 'Cart cleared' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== ORDER ROUTES ==========
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        const [orders] = await promisePool.query(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
            [user[0].id]
        );
        res.status(200).json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        const { items, total, shippingAddress, paymentMethod, sellerId } = req.body;
        const orderId = generateOrderId();
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        
        await promisePool.query(
            'INSERT INTO orders (order_id, user_id, seller_id, items, total, shipping_address, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [orderId, user[0].id, sellerId || null, JSON.stringify(items), total, shippingAddress || '', paymentMethod || 'WhatsApp Order']
        );
        
        res.status(201).json({ success: true, orderId: orderId, message: 'Order placed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        const [orders] = await promisePool.query(
            'SELECT * FROM orders WHERE order_id = ?',
            [req.params.orderId]
        );
        
        if (orders.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        if (orders[0].user_id !== user[0].id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        await promisePool.query(
            'UPDATE orders SET status = ? WHERE order_id = ?',
            [req.body.status, req.params.orderId]
        );
        
        res.status(200).json({ success: true, message: 'Order status updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== COMMENT ROUTES ==========
app.get('/api/products/:productId/comments', async (req, res) => {
    try {
        const [comments] = await promisePool.query(
            'SELECT * FROM comments WHERE product_id = ? ORDER BY created_at DESC',
            [req.params.productId]
        );
        res.status(200).json({ success: true, comments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/products/:productId/comments', authenticateToken, async (req, res) => {
    try {
        const { comment } = req.body;
        const commentId = generateCommentId();
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        
        await promisePool.query(
            'INSERT INTO comments (comment_id, product_id, user_id, username, comment) VALUES (?, ?, ?, ?, ?)',
            [commentId, req.params.productId, user[0].id, user[0].username, comment]
        );
        
        const [comments] = await promisePool.query(
            'SELECT * FROM comments WHERE product_id = ? ORDER BY created_at DESC',
            [req.params.productId]
        );
        
        res.status(201).json({ success: true, commentId: commentId, comments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/products/:productId/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        const [comments] = await promisePool.query(
            'SELECT * FROM comments WHERE comment_id = ?',
            [req.params.commentId]
        );
        
        if (comments.length === 0) {
            return res.status(404).json({ success: false, error: 'Comment not found' });
        }
        
        if (comments[0].user_id !== user[0].id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        await promisePool.query('DELETE FROM comments WHERE comment_id = ?', [req.params.commentId]);
        
        res.status(200).json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== WISHLIST ROUTES ==========
app.post('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const { productId } = req.body;
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        
        try {
            await promisePool.query(
                'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)',
                [user[0].id, productId]
            );
        } catch (err) {
            // Duplicate entry - already in wishlist
        }
        
        res.status(200).json({ success: true, message: 'Added to wishlist' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/wishlist/:productId', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        await promisePool.query(
            'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
            [user[0].id, req.params.productId]
        );
        res.status(200).json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const [user] = await promisePool.query('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
        const [wishlist] = await promisePool.query(
            'SELECT w.*, p.name, p.price, p.main_image FROM wishlist w JOIN products p ON w.product_id = p.product_id WHERE w.user_id = ?',
            [user[0].id]
        );
        res.status(200).json({ success: true, wishlist });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== STATIC PAGE ROUTES ==========
app.get('/seller', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'seller', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login', 'index.html'));
});

app.get('/review', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'review', 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========
async function startServer() {
    const dbInitialized = await initDatabase();
    
    if (dbInitialized) {
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📡 http://localhost:${PORT}`);
            console.log(`🔐 Google OAuth: /api/auth/google`);
        });
    } else {
        console.error('❌ Failed to initialize database. Server not started.');
        process.exit(1);
    }
}

startServer();