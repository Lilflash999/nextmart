const API_URL = window.location.origin;
const spinner = document.getElementById('spinnerOverlay');
const images = [
    '/avatar.jpg',
    'https://via.placeholder.com/400x300/FF9F00/FFFFFF?text=Product+2',
    'https://via.placeholder.com/400x300/FF6B00/FFFFFF?text=Product+3'
];
let currentIndex = 0;
let selectedRating = 0;
let currentUser = null;
let currentToken = localStorage.getItem('token');
let productId = new URLSearchParams(window.location.search).get('id') || 'default';

function showSpinner() { spinner.classList.add('show'); }
function hideSpinner() { spinner.classList.remove('show'); }

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

async function loadUserData() {
    if (!currentToken) return;
    try {
        const response = await fetch(`${API_URL}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            const select = document.getElementById('userIdSelect');
            if (currentUser.username) {
                select.innerHTML = `
                    <option value="${currentUser.username}">${currentUser.username}</option>
                    <option value="Anonymous">Anonymous</option>
                `;
                select.value = currentUser.username;
            }
        } else {
            localStorage.removeItem('token');
            currentToken = null;
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadProductDetails() {
    try {
        const response = await fetch(`${API_URL}/api/products/${productId}`);
        const data = await response.json();
        if (data.success) {
            const product = data.product;
            document.getElementById('productName').textContent = product.name || 'Product';
            document.getElementById('productDesc').textContent = product.description || 'No description available';
            if (product.main_image) {
                document.querySelector('.product-image').src = product.main_image;
            }
        }
    } catch (error) {
        console.error('Error loading product:', error);
    }
}

function updateImage(index) {
    const img = document.querySelector('.product-image');
    img.src = images[index] || images[0];
    const dots = document.querySelectorAll('.image-count span');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

document.querySelector('.left-arrow').addEventListener('click', function() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateImage(currentIndex);
});

document.querySelector('.right-arrow').addEventListener('click', function() {
    currentIndex = (currentIndex + 1) % images.length;
    updateImage(currentIndex);
});

document.querySelectorAll('#starContainer span').forEach(star => {
    star.addEventListener('click', function() {
        selectedRating = parseInt(this.dataset.value);
        document.querySelectorAll('#starContainer span').forEach(s => s.classList.remove('active'));
        for (let i = 0; i < selectedRating; i++) {
            document.querySelectorAll('#starContainer span')[i].classList.add('active');
        }
    });
});

function renderComments(comments) {
    const container = document.getElementById('previewContainer');
    container.innerHTML = '';
    if (!comments || comments.length === 0) {
        container.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;font-family:Inter;">No reviews yet. Be the first!</p>';
        return;
    }
    comments.forEach(comment => {
        const div = document.createElement('div');
        div.className = 'preview-box';
        const img = (comment.username || 'User').split(' ').map(word => word[0]).join('').toUpperCase();
        let time = new Date();
        if (comment.created_at) {
            time = new Date(comment.created_at);
        }
        div.innerHTML = `
            <div class="preview-details">
                <span class="previewer-img" style="background:#FF9F00;">${img}</span>
                <span class="previewer-name">${comment.username || 'User'}</span>
            </div>
            <div id="comment-msg">
                <span class="comment-msg">${comment.comment || 'No message'}</span>
            </div>
            <div class="time-sent">
                <span class="sent-time">${formatTime(time)}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function formatTime(date) {
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
}

async function loadComments() {
    try {
        const response = await fetch(`${API_URL}/api/products/${productId}/comments`);
        const data = await response.json();
        if (data.success) {
            renderComments(data.comments);
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

document.getElementById('sendReview').addEventListener('click', async function() {
    const input = document.querySelector('.preview-input');
    const select = document.getElementById('userIdSelect');
    const comment = input.value.trim();
    const username = select.value;

    if (!comment) {
        showToast('Please write a review', 'error');
        input.focus();
        return;
    }

    if (!currentToken) {
        showToast('Please login to post a review', 'error');
        window.location.href = '/login/';
        return;
    }

    showSpinner();
    try {
        const response = await fetch(`${API_URL}/api/products/${productId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ comment: comment })
        });
        const data = await response.json();
        hideSpinner();

        if (data.success) {
            showToast('Review posted successfully!');
            input.value = '';
            await loadComments();
        } else {
            showToast(data.error || 'Failed to post review', 'error');
        }
    } catch (error) {
        hideSpinner();
        showToast('Something went wrong. Please try again.', 'error');
    }
});

document.querySelector('.preview-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('sendReview').click();
    }
});

loadUserData();
loadProductDetails();
loadComments();
updateImage(0);