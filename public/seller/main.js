const API_URL = window.location.origin;
let currentUser = null;
let currentToken = localStorage.getItem('token');
let sellerProducts = [];
let editingProductId = null;

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

function showSpinner() {
    document.getElementById('spinnerOverlay').classList.add('show');
}

function hideSpinner() {
    document.getElementById('spinnerOverlay').classList.remove('show');
}

function formatCurrency(amount) {
    return '₦' + parseFloat(amount).toLocaleString();
}

function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
}

async function loadUserData() {
    if (!currentToken) {
        window.location.href = '/login/';
        return;
    }
    try {
        const response = await fetch(`${API_URL}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            document.getElementById('sellerName').textContent = currentUser.username || 'Seller';
            document.getElementById('sellerEmail').textContent = currentUser.email || '';
            if (currentUser.profile_image) {
                document.getElementById('sellerAvatar').innerHTML = `<img src="${currentUser.profile_image}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                document.getElementById('sellerAvatar').textContent = getInitials(currentUser.username);
            }
            loadSellerProducts();
            loadSellerStats();
        } else {
            localStorage.removeItem('token');
            window.location.href = '/login/';
        }
    } catch (error) {
        console.error('Error loading user:', error);
        window.location.href = '/login/';
    }
}

async function loadSellerStats() {
    try {
        const response = await fetch(`${API_URL}/api/seller/products`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const products = data.products || [];
            const totalProducts = products.length;
            const totalStock = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
            const totalSales = products.reduce((sum, p) => sum + (p.purchase_count || 0), 0);
            const avgRating = products.length > 0 ?
                (products.reduce((sum, p) => sum + (p.average_rating || 0), 0) / products.length) : 0;
            
            document.getElementById('totalProducts').textContent = totalProducts;
            document.getElementById('totalStock').textContent = totalStock;
            document.getElementById('totalSales').textContent = totalSales;
            document.getElementById('sellerRating').textContent = avgRating.toFixed(1) + ' ⭐';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadSellerProducts() {
    showSpinner();
    try {
        const response = await fetch(`${API_URL}/api/seller/products`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        hideSpinner();
        if (data.success) {
            sellerProducts = data.products || [];
            renderProducts(sellerProducts);
        } else {
            showToast(data.error || 'Failed to load products', 'error');
        }
    } catch (error) {
        hideSpinner();
        showToast('Error loading products', 'error');
    }
}

function renderProducts(products) {
    const container = document.getElementById('sellerProducts');
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>No products listed yet</p>
                <span>Click "Add New Product" to start selling</span>
            </div>
        `;
        return;
    }
    container.innerHTML = '';
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-card';
        const name = product.name || 'Unnamed Product';
        const price = product.price || 0;
        const stock = product.stock_quantity || 0;
        const image = product.main_image || 'https://via.placeholder.com/100x100/FF9F00/FFFFFF?text=Product';
        const status = stock > 0 ? 'In Stock' : 'Out of Stock';
        const statusClass = stock > 0 ? 'in-stock' : 'out-of-stock';
        const sales = product.purchase_count || 0;
        const rating = product.average_rating || 0;
        const productId = product.product_id || product.id;
        
        div.innerHTML = `
            <div class="product-card-image">
                <img src="${image}" alt="${name}">
                <span class="product-status ${statusClass}">${status}</span>
            </div>
            <div class="product-card-info">
                <h3 class="product-card-name">${name}</h3>
                <div class="product-card-price">${formatCurrency(price)}</div>
                <div class="product-card-meta">
                    <span><i class="fas fa-box"></i> ${stock} left</span>
                    <span><i class="fas fa-shopping-bag"></i> ${sales} sold</span>
                    <span><i class="fas fa-star"></i> ${parseFloat(rating).toFixed(1)}</span>
                </div>
                <div class="product-card-actions">
                    <button class="edit-product" data-id="${productId}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-product" data-id="${productId}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
    attachProductActions();
}

function attachProductActions() {
    document.querySelectorAll('.edit-product').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.dataset.id;
            openEditForm(productId);
        });
    });
    document.querySelectorAll('.delete-product').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.dataset.id;
            deleteProduct(productId);
        });
    });
}

function openEditForm(productId) {
    const product = sellerProducts.find(p => (p.product_id || p.id) === productId);
    if (!product) return;
    editingProductId = productId;
    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productPrice').value = product.price || 0;
    document.getElementById('productOldPrice').value = product.old_price || '';
    document.getElementById('productStock').value = product.stock_quantity || 0;
    document.getElementById('productCategory').value = product.category || 'Phones';
    document.getElementById('productDesc').value = product.description || '';
    document.getElementById('submitBtnText').textContent = 'Update Product';
    document.getElementById('productFormContainer').classList.add('show');
    document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    editingProductId = null;
    document.getElementById('formTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('submitBtnText').textContent = 'List Product';
    document.getElementById('productFormContainer').classList.remove('show');
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    showSpinner();
    try {
        const response = await fetch(`${API_URL}/api/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        hideSpinner();
        if (data.success) {
            showToast('Product deleted successfully');
            loadSellerProducts();
            loadSellerStats();
        } else {
            showToast(data.error || 'Failed to delete product', 'error');
        }
    } catch (error) {
        hideSpinner();
        showToast('Error deleting product', 'error');
    }
}

// ========== EVENT LISTENERS ==========

// 1. Show form when "Add New Product" is clicked
document.getElementById('showFormBtn').addEventListener('click', function() {
    console.log('Add Product button clicked!');
    document.getElementById('productFormContainer').classList.add('show');
    document.getElementById('formTitle').textContent = 'Add New Product';
    document.getElementById('submitBtnText').textContent = 'List Product';
    document.getElementById('productForm').reset();
    editingProductId = null;
    document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });
});

// 2. Cancel edit / close form
document.getElementById('cancelEdit').addEventListener('click', function() {
    document.getElementById('productFormContainer').classList.remove('show');
    resetForm();
});

// 3. Submit product form
document.getElementById('productForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const oldPrice = parseFloat(document.getElementById('productOldPrice').value) || 0;
    const stock = parseInt(document.getElementById('productStock').value) || 0;
    const category = document.getElementById('productCategory').value;
    const description = document.getElementById('productDesc').value.trim();
    const imageFile = document.getElementById('productImage').files[0];
    
    if (!name) { 
        showToast('Please enter product name', 'error'); 
        return; 
    }
    if (!price || price <= 0) { 
        showToast('Please enter a valid price', 'error'); 
        return; 
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('oldPrice', oldPrice);
    formData.append('stockQuantity', stock);
    formData.append('category', category);
    formData.append('description', description);
    if (imageFile) {
        formData.append('mainImage', imageFile);
    }
    
    showSpinner();
    try {
        let url = `${API_URL}/api/products`;
        let method = 'POST';
        
        if (editingProductId) {
            url = `${API_URL}/api/products/${editingProductId}`;
            method = 'PUT';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        hideSpinner();
        
        if (data.success) {
            showToast(editingProductId ? 'Product updated successfully' : 'Product listed successfully');
            resetForm();
            loadSellerProducts();
            loadSellerStats();
        } else {
            showToast(data.error || 'Failed to save product', 'error');
        }
    } catch (error) {
        hideSpinner();
        console.error('Error:', error);
        showToast('Error saving product', 'error');
    }
});

// 4. Logout
document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        window.location.href = '/';
    }
});

// 5. Back to store
document.getElementById('backToStore').addEventListener('click', function() {
    window.location.href = '/';
});

// 6. Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Seller dashboard loaded!');
     loadUserData();
});

document.addEventListener('DOMContentLoaded', function() {
    const wrapper = document.getElementById('productCategoryWrapper');
    const trigger = document.getElementById('categoryTrigger');
    const options = document.getElementById('categoryOptions');
    const selectedDisplay = document.getElementById('selectedCategory');
    const hiddenInput = document.getElementById('productCategory');
    
    // Toggle dropdown on click
    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        wrapper.classList.toggle('open');
    });
    
    // Select option
    document.querySelectorAll('.custom-option').forEach(option => {
        option.addEventListener('click', function() {
            const value = this.dataset.value;
            const text = this.textContent.trim();
            
            // Update display
            selectedDisplay.textContent = text;
            
            // Update hidden input
            hiddenInput.value = value;
            
            // Update selected class
            document.querySelectorAll('.custom-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
            
            // Close dropdown
            wrapper.classList.remove('open');
            
            // Trigger change event for form validation
            const event = new Event('change', { bubbles: true });
            hiddenInput.dispatchEvent(event);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });
    
    // Set default selected
    const defaultOption = document.querySelector('.custom-option[data-value="Phones"]');
    if (defaultOption) {
        defaultOption.classList.add('selected');
    }
});