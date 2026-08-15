const API_URL = window.location.origin;
let currentUser = null;
let currentToken = null;

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star"></i>';
    if (hasHalfStar) stars += '<i class="fas fa-star-half-alt"></i>';
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star"></i>';
    return stars;
}

function renderProducts(products) {
    const container = document.querySelector('.product-grid-container');
    if (!container) return;
    container.innerHTML = '';
    products.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'product-item';
        const price = product.price || 0;
        const oldPrice = product.old_price || 0;
        const stock = product.stock_quantity || 0;
        const discount = product.discount_percentage || 0;
        const name = product.name || 'Product';
        const image = product.main_image || 'https://via.placeholder.com/200x200/FF9F00/FFFFFF?text=Product';
        const productId = product.product_id || product.id;
        const rating = product.average_rating || 0;
        const reviewCount = product.total_reviews || 0;
        
        productItem.innerHTML = `
            <div class="product-image-wrapper" data-id="${productId}">
                <img src="${image}" alt="${name}" />
                ${discount ? `<span class="product-discount">-${discount}%</span>` : ''}
            </div>
            <div class="product-details" data-id="${productId}">
                <div class="product-title">${name}</div>
                <div class="product-rating-stars">
                    ${renderStars(rating)}
                    <span class="rating-count">(${reviewCount})</span>
                </div>
                <div class="product-price-section">
                    <span class="product-current-price">₦${parseFloat(price).toLocaleString()}</span>
                    ${oldPrice ? `<span class="product-old-price">₦${parseFloat(oldPrice).toLocaleString()}</span>` : ''}
                </div>
                <div class="product-quantity">
                    <span class="quantity-label">Available:</span>
                    <span class="quantity-count">${stock} items</span>
                    <div class="quantity-bar">
                        <div class="quantity-bar-fill" style="width: ${Math.min((stock / 100) * 100, 100)}%;"></div>
                    </div>
                </div>
                <div class="product-buttons">
                    <button class="product-add-btn" data-id="${productId}"><i class="fas fa-shopping-cart"></i> Add</button>
                    <button class="product-wishlist-btn" data-id="${productId}"><i class="far fa-heart"></i></button>
                </div>
            </div>
        `;
        container.appendChild(productItem);
    });
    attachProductEventListeners();
}

function attachProductEventListeners() {
    document.querySelectorAll('.product-image-wrapper, .product-details').forEach(element => {
        element.addEventListener('click', function(e) {
            if (e.target.closest('.product-add-btn') || e.target.closest('.product-wishlist-btn')) {
                return;
            }
            const productId = this.dataset.id;
            if (productId) {
                window.location.href = `/review?id=${productId}`;
            }
        });
    });

    document.querySelectorAll('.product-add-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            if (!currentUser) { 
                showToast('Please login to add items to cart', 'error');
                return; 
            }
            const productId = this.dataset.id;
            try {
                const response = await fetch(`${API_URL}/api/cart/add`, { 
                    method: 'POST', 
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${currentToken}` 
                    }, 
                    body: JSON.stringify({ productId, quantity: 1 }) 
                });
                const data = await response.json();
                if (data.success) { 
                    showToast('Added to cart!'); 
                    updateCartCount(); 
                }
            } catch (error) { 
                showToast('Error adding to cart', 'error'); 
            }
        });
    });
    
    document.querySelectorAll('.product-wishlist-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            if (!currentUser) { 
                showToast('Please login to add to wishlist', 'error');
                return; 
            }
            const productId = this.dataset.id;
            const isWishlisted = this.classList.contains('active');
            try {
                const response = await fetch(`${API_URL}/api/wishlist`, { 
                    method: isWishlisted ? 'DELETE' : 'POST', 
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${currentToken}` 
                    }, 
                    body: JSON.stringify({ productId }) 
                });
                const data = await response.json();
                if (data.success) {
                    if (isWishlisted) { 
                        this.classList.remove('active'); 
                        this.innerHTML = '<i class="far fa-heart"></i>'; 
                        showToast('Removed from wishlist'); 
                    } else { 
                        this.classList.add('active'); 
                        this.innerHTML = '<i class="fas fa-heart" style="color:#ef4444;"></i>'; 
                        showToast('Added to wishlist!'); 
                    }
                }
            } catch (error) { 
                showToast('Error updating wishlist', 'error'); 
            }
        });
    });
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/api/products`);
        const data = await response.json();
        if (data.success) renderProducts(data.products);
    } catch (error) { 
        console.error('Error loading products:', error); 
    }
}

async function updateCartCount() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_URL}/api/cart`, { 
            headers: { 'Authorization': `Bearer ${currentToken}` } 
        });
        const data = await response.json();
        if (data.success && data.cart) {
            const count = data.cart.reduce((sum, item) => sum + item.quantity, 0);
            document.querySelectorAll('.order-count').forEach(el => el.textContent = count > 0 ? count : '');
            document.querySelectorAll('.sidebar-nav ul li:last-child .badge.count').forEach(el => el.textContent = count || 0);
        }
    } catch (error) { 
        console.error('Error fetching cart:', error); 
    }
}

document.querySelector('.side-bar').addEventListener('click', function() {
    document.querySelector('.sidebar').classList.add('open');
    document.querySelector('.sidebar-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
});

function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

document.querySelector('.sidebar-close').addEventListener('click', closeSidebar);
document.querySelector('.sidebar-overlay').addEventListener('click', closeSidebar);

document.querySelector('.login-btn').addEventListener('click', function() { 
    window.location.href = '/login/'; 
});
document.querySelector('.signup-btn').addEventListener('click', function() { 
    window.location.href = '/login/'; 
});

document.querySelector('.toggle-switch input').addEventListener('change', function() {
    if (this.checked) {
        document.body.style.background = '#1a1a2e';
        document.body.style.color = '#fff';
        document.querySelectorAll('.product-item').forEach(el => { 
            el.style.background = '#2d2d44'; 
            el.style.borderColor = '#3d3d54'; 
        });
    } else {
        document.body.style.background = '';
        document.body.style.color = '';
        document.querySelectorAll('.product-item').forEach(el => { 
            el.style.background = ''; 
            el.style.borderColor = ''; 
        });
    }
});

document.querySelectorAll('.sidebar-nav ul li').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav ul li').forEach(li => li.classList.remove('active'));
        this.classList.add('active');
        const text = this.querySelector('a span')?.textContent || '';
        if (text.includes('Home')) {
            loadProducts();
        } else if (text.includes('Categories')) {
            showToast('Categories coming soon', 'info');
        } else if (text.includes('Deals')) {
            showToast('Deals coming soon', 'info');
        } else if (text.includes('Orders')) {
            if (!currentUser) { 
                showToast('Please login to view orders', 'error');
                return; 
            }
            loadOrders();
        } else if (text.includes('Wishlist')) {
            if (!currentUser) { 
                showToast('Please login to view wishlist', 'error');
                return; 
            }
            loadWishlist();
        } else if (text.includes('Cart')) {
            if (!currentUser) { 
                showToast('Please login to view cart', 'error');
                return; 
            }
            loadCart();
        }
        if (window.innerWidth <= 768) closeSidebar();
    });
});

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/api/orders`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const container = document.querySelector('.product-grid-container');
            if (!container) return;
            container.innerHTML = '<h3 style="font-family:Inter;padding:20px;width:100%;">My Orders</h3>';
            if (data.orders.length === 0) {
                container.innerHTML += '<p style="text-align:center;color:#6b7280;padding:40px;">No orders found</p>';
                return;
            }
            data.orders.forEach(order => {
                const orderDiv = document.createElement('div');
                orderDiv.style.cssText = 'padding:16px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;font-family:Inter;';
                orderDiv.innerHTML = `
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <strong>Order #${order.order_id.slice(0,8)}</strong>
                        <span style="color:${order.status === 'completed' ? '#10b981' : order.status === 'pending' ? '#f59e0b' : '#ef4444'}">${order.status}</span>
                    </div>
                    <div>Total: ₦${parseFloat(order.total).toLocaleString()}</div>
                    <div style="font-size:12px;color:#6b7280;">${new Date(order.created_at).toLocaleDateString()}</div>
                `;
                container.appendChild(orderDiv);
            });
            closeSidebar();
        }
    } catch (error) {
        showToast('Error loading orders', 'error');
    }
}

async function loadWishlist() {
    try {
        const response = await fetch(`${API_URL}/api/wishlist`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const container = document.querySelector('.product-grid-container');
            if (!container) return;
            container.innerHTML = '<h3 style="font-family:Inter;padding:20px;width:100%;">My Wishlist</h3>';
            if (data.wishlist.length === 0) {
                container.innerHTML += '<p style="text-align:center;color:#6b7280;padding:40px;">Wishlist is empty</p>';
                return;
            }
            data.wishlist.forEach(item => {
                const productDiv = document.createElement('div');
                productDiv.className = 'product-item';
                productDiv.innerHTML = `
                    <div class="product-image-wrapper" data-id="${item.product_id}">
                        <img src="${item.main_image || 'https://via.placeholder.com/200x200/FF9F00/FFFFFF?text=Product'}" alt="${item.name}" />
                    </div>
                    <div class="product-details" data-id="${item.product_id}">
                        <div class="product-title">${item.name}</div>
                        <div class="product-price-section">
                            <span class="product-current-price">₦${parseFloat(item.price).toLocaleString()}</span>
                        </div>
                        <div class="product-buttons">
                            <button class="product-add-btn" data-id="${item.product_id}"><i class="fas fa-shopping-cart"></i> Add</button>
                            <button class="product-wishlist-btn active" data-id="${item.product_id}"><i class="fas fa-heart" style="color:#ef4444;"></i></button>
                        </div>
                    </div>
                `;
                container.appendChild(productDiv);
            });
            attachProductEventListeners();
            closeSidebar();
        }
    } catch (error) {
        showToast('Error loading wishlist', 'error');
    }
}

function groupItemsBySeller(cartItems) {
    const grouped = {};
    cartItems.forEach(item => {
        const sellerId = item.seller_id || 'unknown';
        if (!grouped[sellerId]) {
            grouped[sellerId] = {
                sellerId: sellerId,
                sellerName: item.seller_name || 'Seller ' + sellerId.slice(0, 6),
                sellerWhatsApp: item.seller_whatsapp || '',
                items: []
            };
        }
        grouped[sellerId].items.push(item);
    });
    return Object.values(grouped);
}

function showSellerSelection(sellerGroups, fullMessage) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.3s ease;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: #fff;
        border-radius: 24px;
        padding: 32px;
        max-width: 500px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;
    
    let sellersHtml = '';
    sellerGroups.forEach((group, index) => {
        const total = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        sellersHtml += `
            <button class="seller-select-btn" data-index="${index}" style="
                width: 100%;
                padding: 16px;
                margin-bottom: 12px;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                background: #fff;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: left;
                font-family: 'Inter', sans-serif;
            ">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong style="font-size:16px;">🛍️ ${group.sellerName}</strong>
                        <div style="font-size:13px;color:#6b7280;margin-top:4px;">
                            ${group.items.length} item${group.items.length > 1 ? 's' : ''} • ₦${total.toLocaleString()}
                        </div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:#9ca3af;"></i>
                </div>
            </button>
        `;
    });
    
    modalContent.innerHTML = `
        <h3 style="font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">
            <i class="fab fa-whatsapp" style="color:#25D366;"></i> Contact Sellers
        </h3>
        <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">
            Select which seller you want to contact first. 
            You'll receive the complete order summary in WhatsApp.
        </p>
        ${sellersHtml}
        <button id="contactAllBtn" style="
            width: 100%;
            padding: 16px;
            border: none;
            border-radius: 12px;
            background: #25D366;
            color: #fff;
            font-weight: 700;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Inter', sans-serif;
            margin-top: 8px;
        ">
            <i class="fas fa-users"></i> Contact All Sellers
        </button>
        <button id="closeModalBtn" style="
            width: 100%;
            padding: 12px;
            border: none;
            background: transparent;
            color: #6b7280;
            cursor: pointer;
            font-family: 'Inter', sans-serif;
            margin-top: 8px;
        ">
            Cancel
        </button>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    const style = document.createElement('style');
    style.textContent = `
        .seller-select-btn:hover {
            border-color: #25D366 !important;
            background: #f0fdf4 !important;
            transform: translateX(4px);
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    document.querySelectorAll('.seller-select-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const group = sellerGroups[index];
            const encodedMessage = encodeURIComponent(fullMessage);
            const phoneNumber = group.sellerWhatsApp.replace(/\D/g, '');
            const isDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const whatsappUrl = isDevice 
                ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
                : `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
            
            modal.remove();
            showToast('Opening WhatsApp...', 'success');
            setTimeout(() => {
                window.open(whatsappUrl, '_blank');
                clearCartAfterCheckout();
            }, 1000);
        });
    });
    
    document.getElementById('contactAllBtn').addEventListener('click', function() {
        modal.remove();
        const firstGroup = sellerGroups[0];
        const encodedMessage = encodeURIComponent(fullMessage);
        const phoneNumber = firstGroup.sellerWhatsApp.replace(/\D/g, '');
        const isDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const whatsappUrl = isDevice 
            ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
            : `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
        
        showToast('Opening WhatsApp...', 'success');
        setTimeout(() => {
            window.open(whatsappUrl, '_blank');
            showToast('Contact other sellers from the WhatsApp order summary', 'info');
            clearCartAfterCheckout();
        }, 1000);
    });
    
    document.getElementById('closeModalBtn').addEventListener('click', function() {
        modal.remove();
    });
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function clearCartAfterCheckout() {
    setTimeout(async () => {
        await fetch(`${API_URL}/api/cart/clear`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        updateCartCount();
        loadCart();
    }, 5000);
}

async function processCheckout(sellerGroups, cartItems, grandTotal) {
    try {
        showToast('Creating orders...', 'info');
        
        let allOrders = [];
        for (const group of sellerGroups) {
            const items = group.items;
            const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            const orderData = {
                items: items,
                total: total,
                shippingAddress: 'WhatsApp Order - Buyer will provide address',
                paymentMethod: 'WhatsApp Order',
                sellerId: group.sellerId
            };
            
            const orderResponse = await fetch(`${API_URL}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify(orderData)
            });
            const orderResult = await orderResponse.json();
            
            if (orderResult.success) {
                allOrders.push({
                    orderId: orderResult.orderId,
                    seller: group
                });
            }
        }
        
        if (allOrders.length === 0) {
            showToast('Error creating orders', 'error');
            return;
        }
        
        let message = '🛍️ *NextMart Order Confirmation* 🛍️\n\n';
        message += `👤 *Buyer:* ${currentUser.username || 'Customer'}\n`;
        message += `📧 *Email:* ${currentUser.email || 'N/A'}\n`;
        message += `📱 *Phone:* ${currentUser.phone || 'N/A'}\n\n`;
        message += '─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n';
        
        sellerGroups.forEach((group, index) => {
            const groupTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            message += `*📦 Seller ${index + 1}: ${group.sellerName}*\n`;
            message += `📱 WhatsApp: ${group.sellerWhatsApp}\n`;
            message += `─────────────────\n`;
            
            group.items.forEach((item, itemIndex) => {
                const itemTotal = item.price * item.quantity;
                message += `${itemIndex + 1}. ${item.name}\n`;
                message += `   ₦${parseFloat(item.price).toLocaleString()} × ${item.quantity} = ₦${itemTotal.toLocaleString()}\n`;
            });
            
            message += `─────────────────\n`;
            message += `*Subtotal: ₦${groupTotal.toLocaleString()}*\n\n`;
        });
        
        message += '─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n';
        message += `*💰 Grand Total: ₦${grandTotal.toLocaleString()}*\n\n`;
        message += '📍 *Delivery Address:* (Please provide your address)\n\n';
        message += '📌 *Instructions:*\n';
        message += '• Please contact each seller separately via WhatsApp\n';
        message += '• Confirm your order and delivery details\n';
        message += '• Make payment to the seller directly\n\n';
        message += 'Thank you for shopping at NextMart! 🎉';
        
        showSellerSelection(sellerGroups, message);
        
    } catch (error) {
        console.error('Checkout error:', error);
        showToast('Error processing checkout', 'error');
    }
}

async function loadCart() {
    try {
        const response = await fetch(`${API_URL}/api/cart`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const container = document.querySelector('.product-grid-container');
            if (!container) return;
            container.innerHTML = '<h3 style="font-family:Inter;padding:20px;width:100%;">My Cart</h3>';
            
            if (data.cart.length === 0) {
                container.innerHTML += '<p style="text-align:center;color:#6b7280;padding:40px;">Cart is empty</p>';
                return;
            }
            
            const sellerGroups = groupItemsBySeller(data.cart);
            let grandTotal = 0;
            
            sellerGroups.forEach((group) => {
                const groupDiv = document.createElement('div');
                groupDiv.style.cssText = `
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                    border-left: 4px solid #FF9F00;
                `;
                
                let groupTotal = 0;
                let itemsHtml = '';
                
                data.cart.forEach(item => {
                    if (item.seller_id === group.sellerId) {
                        const itemTotal = item.price * item.quantity;
                        groupTotal += itemTotal;
                        itemsHtml += `
                            <div style="display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #e5e7eb;">
                                <img src="${item.main_image || 'https://via.placeholder.com/50x50/FF9F00/FFFFFF?text=Product'}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">
                                <div style="flex:1;">
                                    <div style="font-weight:600;font-size:14px;">${item.name}</div>
                                    <div style="font-size:13px;color:#6b7280;">₦${parseFloat(item.price).toLocaleString()} x ${item.quantity}</div>
                                    <div style="font-weight:700;color:#FF9F00;">₦${itemTotal.toLocaleString()}</div>
                                </div>
                                <button class="remove-cart-btn" data-id="${item.product_id}" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">Remove</button>
                            </div>
                        `;
                    }
                });
                
                groupDiv.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <div>
                            <strong style="font-size:16px;">🛍️ Seller: ${group.sellerName}</strong>
                            <div style="font-size:13px;color:#6b7280;">WhatsApp: ${group.sellerWhatsApp || 'Not available'}</div>
                        </div>
                        <span style="font-weight:700;color:#FF9F00;font-size:16px;">₦${groupTotal.toLocaleString()}</span>
                    </div>
                    ${itemsHtml}
                `;
                container.appendChild(groupDiv);
                grandTotal += groupTotal;
            });
            
            const totalDiv = document.createElement('div');
            totalDiv.style.cssText = 'padding:16px;border-top:2px solid #e5e7eb;margin-top:8px;font-family:Inter;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;';
            
            const allHaveWhatsApp = sellerGroups.every(g => g.sellerWhatsApp);
            
            totalDiv.innerHTML = `
                <div>
                    <span style="font-size:18px;font-weight:700;">Grand Total: ₦${grandTotal.toLocaleString()}</span>
                    <div style="font-size:13px;color:#6b7280;margin-top:4px;">
                        ${sellerGroups.length} seller${sellerGroups.length > 1 ? 's' : ''} • 
                        ${data.cart.length} item${data.cart.length > 1 ? 's' : ''}
                        ${!allHaveWhatsApp ? ' ⚠️ Some sellers don\'t have WhatsApp' : ''}
                    </div>
                </div>
                <button id="checkoutBtn" style="background:#25D366;color:white;border:none;padding:12px 32px;border-radius:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:16px;">
                    <i class="fab fa-whatsapp"></i> WhatsApp Checkout
                </button>
            `;
            container.appendChild(totalDiv);
            
            document.querySelectorAll('.remove-cart-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const productId = this.dataset.id;
                    await removeFromCart(productId);
                    loadCart();
                });
            });
            
            document.getElementById('checkoutBtn')?.addEventListener('click', async function() {
                if (!currentUser) {
                    showToast('Please login to checkout', 'error');
                    return;
                }
                
                if (!allHaveWhatsApp) {
                    showToast('Some sellers don\'t have WhatsApp. Please contact support.', 'error');
                    return;
                }
                
                await processCheckout(sellerGroups, data.cart, grandTotal);
            });
            
            closeSidebar();
        }
    } catch (error) {
        console.error('Error loading cart:', error);
        showToast('Error loading cart', 'error');
    }
}

async function removeFromCart(productId) {
    try {
        const response = await fetch(`${API_URL}/api/cart/remove/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (data.success) {
            showToast('Removed from cart');
            updateCartCount();
        }
    } catch (error) {
        showToast('Error removing item', 'error');
    }
}

document.querySelector('.footer-item.logout').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        currentUser = null;
        currentToken = null;
        localStorage.removeItem('token');
        document.querySelector('.user-name').textContent = 'Guest User';
        document.querySelector('.user-status').textContent = 'Not logged in';
        document.querySelector('.login-btn').style.display = 'flex';
        document.querySelector('.signup-btn').style.display = 'flex';
        document.querySelector('.footer-item.logout').style.display = 'none';
        document.querySelector('.user-avatar').innerHTML = '<i class="fas fa-user-circle"></i>';
        closeSidebar();
        showToast('Logged out successfully');
        loadProducts();
    }
});

document.querySelector('.feature-item').addEventListener('click', function(e) {
    const text = this.querySelector('span')?.textContent || '';
    if (text.includes('Sell on NextMart')) {
        if (!currentUser) {
            showToast('Please login to sell on NextMart', 'error');
            setTimeout(() => window.location.href = '/login/', 1500);
            return;
        }
        window.location.href = '/seller';
    } else if (text.includes('Customer Support')) {
        showToast('support@nextmart.com', 'info');
    } else if (text.includes('Help & FAQ')) {
        showToast('Help & FAQ coming soon', 'info');
    }
});

async function loadUserData() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const response = await fetch(`${API_URL}/api/auth/profile`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const data = await response.json();
        if (data.success) {
            currentToken = token;
            currentUser = data.user;
            document.querySelector('.user-name').textContent = data.user.username || 'User';
            document.querySelector('.user-status').textContent = 'Online';
            document.querySelector('.login-btn').style.display = 'none';
            document.querySelector('.signup-btn').style.display = 'none';
            document.querySelector('.footer-item.logout').style.display = 'flex';
            if (data.user.profile_image) {
                document.querySelector('.user-avatar').innerHTML = `<img src="${data.user.profile_image}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            }
            updateCartCount();
        } else {
            localStorage.removeItem('token');
        }
    } catch (error) { 
        localStorage.removeItem('token'); 
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
    loadUserData();
});

const search = document.querySelector('.user-search');
const searchList = document.getElementById('searchRes');
const overlay = document.querySelector('.spinner-overlay');
let tapped = false;

document.getElementById('search').addEventListener('click', function() {
    if (tapped) { 
        search.focus(); 
        return; 
    }
    overlay.style.display = 'flex';
    search.disabled = true;
    setTimeout(() => { 
        overlay.style.display = 'none'; 
        search.disabled = false; 
        search.focus(); 
        tapped = true; 
    }, 2500);
});

search.addEventListener('blur', function() { 
    search.disabled = true; 
    searchList.classList.add('loading'); 
    tapped = false; 
});

search.addEventListener('input', async function() {
    this.value = this.value.replace(/[^A-Za-z0-9\s]/g, '');
    const query = this.value.trim();
    if (!query) { 
        searchList.innerHTML = ''; 
        searchList.style.display = 'none'; 
        return; 
    }
    overlay.style.display = 'flex';
    search.disabled = true;
    searchList.style.display = 'flex';
    searchList.innerHTML = '<div class="loading-text">Searching...</div>';
    try {
        const response = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        overlay.style.display = 'none';
        search.disabled = false;
        searchList.innerHTML = '';
        if (data.success && data.products.length > 0) {
            data.products.forEach(product => {
                const div = document.createElement('div');
                div.className = 'objects';
                div.innerHTML = `
                    <div id="product-detail">
                        <img src="${product.main_image || 'placeholder.jpg'}" alt="${product.name}" />
                        <span class="product-name">${product.name}</span>
                        <i class="bi bi-cart-plus add-market-search" data-id="${product.product_id}"></i>
                    </div>
                    <span class="product-price">₦${parseFloat(product.price || 0).toLocaleString()}</span>
                `;
                searchList.appendChild(div);
            });
            searchList.querySelectorAll('.add-market-search').forEach(btn => {
                btn.addEventListener('click', async function() {
                    if (!currentUser) { 
                        showToast('Please login', 'error');
                        return; 
                    }
                    const productId = this.dataset.id;
                    const response = await fetch(`${API_URL}/api/cart/add`, { 
                        method: 'POST', 
                        headers: { 
                            'Content-Type': 'application/json', 
                            'Authorization': `Bearer ${currentToken}` 
                        }, 
                        body: JSON.stringify({ productId, quantity: 1 }) 
                    });
                    const data = await response.json();
                    if (data.success) { 
                        showToast('Added to cart!'); 
                        updateCartCount(); 
                    }
                });
            });
        } else {
            searchList.innerHTML = `<div class="no-results"><i class="bi bi-search"></i><p>No products found for "${query}"</p><span>Try different keywords</span></div>`;
        }
    } catch (error) {
        overlay.style.display = 'none';
        search.disabled = false;
        searchList.innerHTML = `<div class="error-message"><i class="bi bi-exclamation-triangle"></i><p>Something went wrong</p></div>`;
    }
});

let istapped = false;
const whatsapp = document.querySelector('.whatsapp-icon');
if (whatsapp) {
    whatsapp.addEventListener('click', function() {
        istapped = !istapped;
        if (istapped) {
            whatsapp.classList.add('animate');
        } else {
            whatsapp.classList.remove('animate');
            whatsapp.style.right = '9px';
            const message = 'hello what is your emergency or what do you want to talk about';
            const encoded = encodeURIComponent(message);
            const number = '2347040089123';
            const isDevice = /Android|IPhone/i.test(navigator.userAgent);
            const msg = isDevice ? `https://wa.me/${number}?text=${encoded}` : `https://web.whatsapp.com/send?phone=${number}&text=${message}`;
            window.open(msg);
            setTimeout(() => { 
                whatsapp.classList.add('animate');
                whatsapp.style.right = '';
            }, 2500);
        }
    });
}

document.querySelector('.cart-icon').addEventListener('click', function() {
    if (!currentUser) {
        showToast('Please login to continue', 'error');
        return;
    }
    loadCart();
});