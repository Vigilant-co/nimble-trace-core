// /static/js/app.js
const NimbleTrace = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        API_BASE_URL: 'http://localhost:8080/api',
        REFRESH_INTERVAL: 30000, // 30 seconds
        MAX_PRODUCTS_PER_PAGE: 25,
        WEBSITE_COLORS: {
            'amazon': '#FF9900',
            'digikala': '#3B82F6',
            'ebay': '#E53238',
            'aliexpress': '#FF6A00',
            'walmart': '#0071CE',
            'bestbuy': '#0046BE',
            'target': '#CC0000',
            'newegg': '#8DC63F'
        },
        WEBSITE_ICONS: {
            'amazon': 'A',
            'digikala': 'D',
            'ebay': 'E',
            'aliexpress': 'AE',
            'walmart': 'W',
            'bestbuy': 'BB',
            'target': 'T',
            'newegg': 'N'
        }
    };
    
    // State Management
    let state = {
        products: [],
        filteredProducts: [],
        currentPage: 1,
        totalPages: 1,
        sortBy: 'lastUpdated',
        sortOrder: 'desc',
        searchQuery: '',
        selectedSite: '',
        isLoading: false,
        lastUpdate: null,
        websocket: null
    };
    
    // DOM Elements
    const elements = {
        totalProducts: document.getElementById('totalProducts'),
        activeAlerts: document.getElementById('activeAlerts'),
        successRate: document.getElementById('successRate'),
        updateInterval: document.getElementById('updateInterval'),
        productsTableBody: document.getElementById('productsTableBody'),
        productSearch: document.getElementById('productSearch'),
        siteFilter: document.getElementById('siteFilter'),
        currentPage: document.getElementById('currentPage'),
        totalPages: document.getElementById('totalPages'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        refreshBtn: document.getElementById('refreshBtn'),
        addProductBtn: document.getElementById('addProductBtn'),
        currentTime: document.getElementById('currentTime')
    };
    
    // API Client
    const api = {
        async fetchProducts(params = {}) {
            const query = new URLSearchParams({
                page: params.page || state.currentPage,
                limit: CONFIG.MAX_PRODUCTS_PER_PAGE,
                sort: state.sortBy,
                order: state.sortOrder,
                search: state.searchQuery,
                site: state.selectedSite,
                ...params
            }).toString();
            
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/products?${query}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Failed to fetch products:', error);
                showToast('Failed to load products', 'error');
                return { products: [], total: 0, pages: 1 };
            }
        },
        
        async fetchMetrics() {
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/metrics`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
                return null;
            }
        },
        
        async fetchPriceHistory(productId, interval = '24h') {
            try {
                const response = await fetch(
                    `${CONFIG.API_BASE_URL}/products/${productId}/history?interval=${interval}`
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch price history:', error);
                return [];
            }
        },
        
        async addProduct(url) {
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/products`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url })
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const data = await response.json();
                showToast('Product added successfully', 'success');
                return data;
            } catch (error) {
                console.error('Failed to add product:', error);
                showToast('Failed to add product', 'error');
                throw error;
            }
        },
        
        async deleteProduct(productId) {
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/products/${productId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                showToast('Product deleted', 'success');
                return true;
            } catch (error) {
                console.error('Failed to delete product:', error);
                showToast('Failed to delete product', 'error');
                return false;
            }
        }
    };
    
    // UI Utilities
    const ui = {
        formatPrice(price, currency = 'USD') {
            const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            return formatter.format(price);
        },
        
        formatPercentage(value) {
            const sign = value >= 0 ? '+' : '';
            return `${sign}${value.toFixed(2)}%`;
        },
        
        formatTimeAgo(date) {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            
            if (seconds < 60) return 'Just now';
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
            return `${Math.floor(seconds / 86400)}d ago`;
        },
        
        getWebsiteColor(website) {
            return CONFIG.WEBSITE_COLORS[website.toLowerCase()] || '#6B7280';
        },
        
        getWebsiteIcon(website) {
            return CONFIG.WEBSITE_ICONS[website.toLowerCase()] || '?';
        },
        
        updateCurrentTime() {
            const now = new Date();
            elements.currentTime.textContent = now.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        showLoading() {
            state.isLoading = true;
            document.body.classList.add('loading');
        },
        
        hideLoading() {
            state.isLoading = false;
            document.body.classList.remove('loading');
        }
    };
    
    // Table Rendering
    const render = {
        async updateProductsTable() {
            ui.showLoading();
            
            const data = await api.fetchProducts();
            state.products = data.products;
            state.totalPages = data.pages;
            
            elements.productsTableBody.innerHTML = '';
            
            if (state.products.length === 0) {
                elements.productsTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center" style="padding: 3rem;">
                            <div style="font-size: 0.9rem; color: var(--text-muted);">
                                No products found. Try adding a product or adjusting your filters.
                            </div>
                        </td>
                    </tr>
                `;
                ui.hideLoading();
                return;
            }
            
            state.products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.productId = product.id;
                
                const changeClass = product.change24h >= 0 ? 'change-positive' : 'change-negative';
                const statusClass = product.status === 'stable' ? 'status-stable' :
                                  product.status === 'warning' ? 'status-warning' : 'status-alert';
                const statusText = product.status.charAt(0).toUpperCase() + product.status.slice(1);
                
                row.innerHTML = `
                    <td>
                        <div class="product-cell">
                            <div class="product-icon" style="background: ${ui.getWebsiteColor(product.website)};">
                                ${ui.getWebsiteIcon(product.website)}
                            </div>
                            <div class="product-info">
                                <div class="product-name">${this.escapeHtml(product.name)}</div>
                                <div class="product-meta">
                                    <span class="product-site">${product.website}</span>
                                    <span>•</span>
                                    <span>${product.category || 'Uncategorized'}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="price-cell">${ui.formatPrice(product.currentPrice, product.currency)}</td>
                    <td class="change-cell ${changeClass}">${ui.formatPercentage(product.change24h)}</td>
                    <td>${ui.formatTimeAgo(product.lastUpdated)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="action-btn" title="View Details" data-action="view" data-id="${product.id}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                        <button class="action-btn" title="Delete" data-action="delete" data-id="${product.id}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </td>
                `;
                
                elements.productsTableBody.appendChild(row);
            });
            
            // Update pagination
            elements.currentPage.textContent = state.currentPage;
            elements.totalPages.textContent = state.totalPages;
            elements.prevPage.disabled = state.currentPage === 1;
            elements.nextPage.disabled = state.currentPage === state.totalPages;
            
            ui.hideLoading();
            this.attachTableEventListeners();
        },
        
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        attachTableEventListeners() {
            // View details
            document.querySelectorAll('[data-action="view"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const productId = btn.dataset.id;
                    showProductDetails(productId);
                });
            });
            
            // Delete product
            document.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const productId = btn.dataset.id;
                    const product = state.products.find(p => p.id === productId);
                    
                    if (product && confirm(`Delete ${product.name}?`)) {
                        const success = await api.deleteProduct(productId);
                        if (success) {
                            await render.updateProductsTable();
                            await updateMetrics();
                        }
                    }
                });
            });
            
            // Row click
            document.querySelectorAll('#productsTableBody tr').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        const productId = row.dataset.productId;
                        showProductDetails(productId);
                    }
                });
            });
        },
        
        async updateMetricsDisplay() {
            const metrics = await api.fetchMetrics();
            if (!metrics) return;
            
            elements.totalProducts.textContent = metrics.totalProducts.toLocaleString();
            elements.activeAlerts.textContent = metrics.activeAlerts;
            elements.successRate.textContent = `${metrics.successRate}%`;
            elements.updateInterval.textContent = metrics.averageInterval;
            
            // Update trends
            document.querySelectorAll('.metric-trend').forEach((trend, index) => {
                const values = [
                    metrics.productTrend,
                    metrics.alertTrend,
                    metrics.successTrend,
                    metrics.intervalTrend
                ];
                
                const value = values[index];
                trend.textContent = value >= 0 ? `+${value}` : value;
                trend.className = `metric-trend ${value >= 0 ? 'trend-positive' : 'trend-negative'}`;
            });
        }
    };
    
    // Event Handlers
    const events = {
        init() {
            // Search
            let searchTimeout;
            elements.productSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    state.searchQuery = e.target.value.trim();
                    state.currentPage = 1;
                    render.updateProductsTable();
                }, 300);
            });
            
            // Site filter
            elements.siteFilter.addEventListener('change', (e) => {
                state.selectedSite = e.target.value;
                state.currentPage = 1;
                render.updateProductsTable();
            });
            
            // Pagination
            elements.prevPage.addEventListener('click', () => {
                if (state.currentPage > 1) {
                    state.currentPage--;
                    render.updateProductsTable();
                }
            });
            
            elements.nextPage.addEventListener('click', () => {
                if (state.currentPage < state.totalPages) {
                    state.currentPage++;
                    render.updateProductsTable();
                }
            });
            
            // Sortable headers
            document.querySelectorAll('.sortable').forEach(header => {
                header.addEventListener('click', () => {
                    const sortBy = header.dataset.sort;
                    
                    if (state.sortBy === sortBy) {
                        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.sortBy = sortBy;
                        state.sortOrder = 'desc';
                    }
                    
                    // Update UI
                    document.querySelectorAll('.sortable').forEach(h => {
                        h.classList.remove('sorted-asc', 'sorted-desc');
                    });
                    
                    header.classList.add(`sorted-${state.sortOrder}`);
                    render.updateProductsTable();
                });
            });
            
            // Refresh button
            elements.refreshBtn.addEventListener('click', async () => {
                elements.refreshBtn.classList.add('spin');
                await Promise.all([
                    render.updateProductsTable(),
                    render.updateMetricsDisplay(),
                    window.chartManager?.refreshCharts()
                ]);
                setTimeout(() => {
                    elements.refreshBtn.classList.remove('spin');
                }, 1000);
                showToast('Data refreshed', 'success');
            });
            
            // Add product button
            elements.addProductBtn.addEventListener('click', () => {
                showAddProductModal();
            });
            
            // Auto-refresh
            setInterval(async () => {
                if (!state.isLoading && document.visibilityState === 'visible') {
                    await render.updateMetricsDisplay();
                    await window.chartManager?.updateCharts();
                }
            }, CONFIG.REFRESH_INTERVAL);
            
            // Update current time every second
            setInterval(ui.updateCurrentTime, 1000);
            ui.updateCurrentTime();
            
            // Initialize WebSocket
            this.initWebSocket();
        },
        
        initWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            state.websocket = new WebSocket(wsUrl);
            
            state.websocket.onopen = () => {
                console.log('WebSocket connected');
                showToast('Real-time updates connected', 'success');
            };
            
            state.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'PRICE_UPDATE':
                        handlePriceUpdate(data.payload);
                        break;
                    case 'NEW_ALERT':
                        handleNewAlert(data.payload);
                        break;
                    case 'SCRAPER_STATUS':
                        handleScraperStatus(data.payload);
                        break;
                }
            };
            
            state.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                showToast('Reconnecting to real-time updates...', 'warning');
                
                // Reconnect after 5 seconds
                setTimeout(() => this.initWebSocket(), 5000);
            };
            
            state.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }
    };
    
    // Helper Functions
    function handlePriceUpdate(update) {
        // Update product in table if visible
        const row = document.querySelector(`tr[data-product-id="${update.productId}"]`);
        if (row) {
            const priceCell = row.querySelector('.price-cell');
            const changeCell = row.querySelector('.change-cell');
            const timeCell = row.cells[3];
            
            if (priceCell) priceCell.textContent = ui.formatPrice(update.newPrice, update.currency);
            if (changeCell) {
                changeCell.textContent = ui.formatPercentage(update.change);
                changeCell.className = `change-cell ${update.change >= 0 ? 'change-positive' : 'change-negative'}`;
            }
            if (timeCell) timeCell.textContent = 'Just now';
        }
        
        // Update charts
        window.chartManager?.addDataPoint(update);
    }
    
    function handleNewAlert(alert) {
        showToast(`New alert: ${alert.message}`, 'warning');
        
        // Update alerts count
        const currentAlerts = parseInt(elements.activeAlerts.textContent) || 0;
        elements.activeAlerts.textContent = currentAlerts + 1;
        
        // Play notification sound if enabled
        if (Notification.permission === 'granted') {
            new Notification('NimbleTrace Alert', {
                body: alert.message,
                icon: '/static/images/logo.svg'
            });
        }
    }
    
    function handleScraperStatus(status) {
        const indicator = document.querySelector('.status-indicator');
        const dot = document.querySelector('.status-dot');
        
        if (status === 'healthy') {
            indicator.innerHTML = '<div class="status-dot"></div><span>All Systems Operational</span>';
            indicator.style.background = 'var(--success-bg)';
            indicator.style.borderColor = 'var(--success)';
            dot.style.background = 'var(--success)';
        } else {
            indicator.innerHTML = '<div class="status-dot"></div><span>Degraded Performance</span>';
            indicator.style.background = 'var(--warning-bg)';
            indicator.style.borderColor = 'var(--warning)';
            dot.style.background = 'var(--warning)';
        }
    }
    
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }
    
    function showProductDetails(productId) {
        // Implementation for product details modal
        console.log('Show details for product:', productId);
    }
    
    function showAddProductModal() {
        // Implementation for add product modal
        console.log('Show add product modal');
    }
    
    async function updateMetrics() {
        await render.updateMetricsDisplay();
    }
    
    // Public API
    return {
        init: async function() {
            try {
                ui.showLoading();
                
                // Initialize components
                events.init();
                
                // Load initial data
                await Promise.all([
                    render.updateProductsTable(),
                    render.updateMetricsDisplay()
                ]);
                
                // Initialize charts
                if (window.chartManager) {
                    await window.chartManager.init();
                }
                
                // Request notification permission
                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission();
                }
                
                ui.hideLoading();
                showToast('Dashboard loaded successfully', 'success');
                
            } catch (error) {
                console.error('Failed to initialize dashboard:', error);
                showToast('Failed to load dashboard', 'error');
                ui.hideLoading();
            }
        },
        
        refresh: async function() {
            await render.updateProductsTable();
            await render.updateMetricsDisplay();
            if (window.chartManager) {
                await window.chartManager.refreshCharts();
            }
        },
        
        getState: function() {
            return { ...state };
        },
        
        setFilter: function(filter, value) {
            state[filter] = value;
            state.currentPage = 1;
            return render.updateProductsTable();
        }
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.nimbleTrace = NimbleTrace;
        NimbleTrace.init();
    });
} else {
    window.nimbleTrace = NimbleTrace;
    NimbleTrace.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NimbleTrace;
}