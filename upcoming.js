const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

const db = admin.database();
const auth = admin.auth();
const bucket = admin.storage().bucket();

function generateUid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class MarketPlace {
    constructor(config = {}) {
        this.marketer = {
            marketId: config.marketId || 'market_' + generateUid(),
            brandName: config.brandName || '',
            brandCategory: config.brandCategory || '',
            brandInfo: config.brandInfo || '',
            brandType: config.brandType || 'iPhone',
            productSlug: config.productSlug || '',
            sellerId: config.sellerId || '',
            sellerName: config.sellerName || '',
            isVerified: config.isVerified || false,
            isTrusted: config.isTrusted || false,
            sellerEmail: config.sellerEmail || '',
            sellerPhone: config.sellerPhone || '',
            sellerAddress: config.sellerAddress || '',
            joinedDate: config.joinedDate || new Date()
        };
        this.price = {
            current: config.marketPrice || 0,
            oldPrice: config.oldPrice || 0,
            currency: config.currency || 'NGN',
            discountPercentage: config.discountPercentage || 0,
            isOnSale: config.isOnSale || false
        };
        this.product = {
            name: config.productName || '',
            description: config.description || '',
            shortDescription: config.shortDescription || '',
            slug: config.productSlug || '',
            category: config.brandCategory || '',
            subCategory: config.subCategory || '',
            tags: config.tags || [],
            brand: config.brandType || 'iPhone',
            sku: config.sku || '',
            weight: config.weight || 0,
            dimensions: config.dimensions || { length: 0, width: 0, height: 0 },
            isNew: config.isNew || false,
            isFeatured: config.isFeatured || false,
            viewCount: config.viewCount || 0,
            purchaseCount: config.purchaseCount || 0
        };
        this.media = {
            mainImage: config.mainImage || '',
            images: config.brandImage || [],
            video: config.video || '',
            thumbnail: config.thumbnail || ''
        };
        this.inventory = {
            stockQuantity: config.stockQuantity || 0,
            lowStockAlert: config.lowStockAlert || 5,
            inStock: config.stockQuantity > 0 || false,
            reservedStock: config.reservedStock || 0,
            soldCount: config.soldCount || 0
        };
        this.variations = config.variations || [];
        this.reviews = {
            averageRating: config.averageRating || 0,
            totalReviews: config.totalReviews || 0,
            reviews: config.review || []
        };
        this.shipping = {
            cost: config.shippingCost || 0,
            deliveryTime: config.deliveryTime || '2-3 business days',
            isFreeShipping: config.isFreeShipping || false,
            shippingZones: config.shippingZones || []
        };
        this.timestamps = {
            createdAt: config.createdAt || new Date(),
            updatedAt: config.updatedAt || new Date()
        };
        this.analytics = {
            wishlistCount: config.wishlistCount || 0,
            clickCount: config.clickCount || 0,
            conversionRate: config.conversionRate || 0
        };
    }
    addReview(userId, rating, comment) {
        if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
        const review = { reviewId: 'rev_' + generateUid(), userId, rating, comment: comment || '', createdAt: new Date() };
        this.reviews.reviews.push(review);
        this.reviews.totalReviews = this.reviews.reviews.length;
        this.reviews.averageRating = this.calculateAverageRating();
        return review;
    }
    calculateAverageRating() {
        if (this.reviews.reviews.length === 0) return 0;
        const total = this.reviews.reviews.reduce((sum, r) => sum + r.rating, 0);
        return parseFloat((total / this.reviews.reviews.length).toFixed(1));
    }
    updateStock(quantity) {
        this.inventory.stockQuantity = quantity;
        this.inventory.inStock = quantity > 0;
        this.timestamps.updatedAt = new Date();
        return this.inventory;
    }
    reduceStock(quantity) {
        if (this.inventory.stockQuantity < quantity) throw new Error('Insufficient stock');
        this.inventory.stockQuantity -= quantity;
        this.inventory.soldCount += quantity;
        this.inventory.inStock = this.inventory.stockQuantity > 0;
        this.timestamps.updatedAt = new Date();
        return this.inventory;
    }
    applyDiscount(percentage) {
        if (percentage < 0 || percentage > 100) throw new Error('Discount must be between 0 and 100');
        this.price.discountPercentage = percentage;
        this.price.isOnSale = true;
        this.price.oldPrice = this.price.current;
        this.price.current = parseFloat((this.price.current * (1 - percentage / 100)).toFixed(2));
        this.timestamps.updatedAt = new Date();
        return this.price;
    }
    removeDiscount() {
        this.price.isOnSale = false;
        this.price.discountPercentage = 0;
        if (this.price.oldPrice > 0) {
            this.price.current = this.price.oldPrice;
            this.price.oldPrice = 0;
        }
        this.timestamps.updatedAt = new Date();
        return this.price;
    }
    incrementViews() {
        this.product.viewCount += 1;
        return this.product.viewCount;
    }
    incrementWishlist() {
        this.analytics.wishlistCount += 1;
        return this.analytics.wishlistCount;
    }
    isInStock() {
        return this.inventory.inStock && this.inventory.stockQuantity > 0;
    }
    getSummary() {
        return {
            id: this.marketer.marketId,
            name: this.product.name,
            price: this.price.current,
            oldPrice: this.price.oldPrice || null,
            isOnSale: this.price.isOnSale,
            discount: this.price.discountPercentage || 0,
            image: this.media.mainImage,
            rating: this.reviews.averageRating,
            totalReviews: this.reviews.totalReviews,
            inStock: this.isInStock(),
            seller: this.marketer.sellerName,
            isVerified: this.marketer.isVerified
        };
    }
    getFullDetails() {
        return { ...this.marketer, ...this.price, ...this.product, media: this.media, inventory: this.inventory, variations: this.variations, reviews: this.reviews, shipping: this.shipping, analytics: this.analytics, timestamps: this.timestamps };
    }
}

module.exports = { admin, auth, db, bucket, MarketPlace, generateUid };