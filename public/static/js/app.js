// SecureBank - Online Banking Portal JavaScript

(function() {
    'use strict';

    // ==================== State Management ====================
    const state = {
        token: localStorage.getItem('access_token'),
        refreshToken: localStorage.getItem('refresh_token'),
        user: JSON.parse(localStorage.getItem('user') || 'null'),
        accounts: [],
        currentPage: 'dashboard',
        currentAccount: null,
        transactionsPage: 1,
        recentTransactions: {},
        currentTransaction: null
    };

    // ==================== API Helper ====================
    async function api(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : endpoint;
        const token = state.token;

        // Skip auth header for login and register endpoints
        const isAuthEndpoint = endpoint === '/login/' || endpoint === '/register/';

        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        if (token && !isAuthEndpoint) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401 && !isAuthEndpoint) {
                logout();
                showToast('Session expired. Please login again.', 'warning');
                return null;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.message ||
                    Object.values(errorData).flat().join(', ') ||
                    'An error occurred';
                throw new Error(errorData.detail || errorData.message || errorMessage);
            }

            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                showToast('Network error. Please check your connection.', 'error');
            }
            throw error;
        }
    }

    // ==================== Utility Functions ====================
    function formatCurrency(amount, currency = 'NGN') {
        const symbols = { 'NGN': '₦', 'USD': '$' };
        const symbol = symbols[currency] || '₦';
        return symbol + new Intl.NumberFormat('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    function formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // ==================== Authentication ====================
    async function login(username, password) {
        try {
            const data = await api('/login/', {
                method: 'POST',
                // Mobile browsers and password managers can add whitespace when
                // filling a username. Usernames are not meaningful with it.
                body: { username: username.trim(), password },
            });

            if (data && data.access) {
                state.token = data.access;
                state.refreshToken = data.refresh;
                state.user = { username: data.username };
                
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                localStorage.setItem('user', JSON.stringify({ username: data.username }));
                
                showToast('Login successful!', 'success');
                showApp();
                navigateTo('dashboard');
            }
        } catch (error) {
            showToast(error.message || 'Login failed', 'error');
        }
    }

    async function register(username, email, password) {
        try {
            await api('/register/', {
                method: 'POST',
                body: { username, email, password },
            });
            showToast('Account created! Please login.', 'success');
            showLogin();
        } catch (error) {
            showToast(error.message || 'Registration failed', 'error');
        }
    }

    function logout() {
        state.token = null;
        state.refreshToken = null;
        state.user = null;
        state.accounts = [];
        
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        showLogin();
    }

    // ==================== View Navigation ====================
    function showLogin() {
        hideAllPages();
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('app-page').style.display = 'none';
        window.location.hash = 'login';
    }

    function showRegister() {
        hideAllPages();
        document.getElementById('register-page').style.display = 'flex';
        document.getElementById('app-page').style.display = 'none';
        window.location.hash = 'register';
    }

    function showApp() {
        hideAllPages();
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('register-page').style.display = 'none';
        document.getElementById('app-page').style.display = 'flex';
        
        if (state.user) {
            document.getElementById('user-greeting').textContent = `Hi, ${state.user.username}`;
        }
        
        loadAccounts();
    }

    function hideAllPages() {
        document.querySelectorAll('.page').forEach(page => {
            page.style.display = 'none';
        });
    }

    function navigateTo(page) {
        state.currentPage = page;
        
        // Hide all content pages
        document.querySelectorAll('.content-page').forEach(p => {
            p.style.display = 'none';
        });

        // Show selected page
        const pageEl = document.getElementById(`${page}-page`);
        if (pageEl) {
            pageEl.style.display = 'block';
        }

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Close mobile sidebar
        closeSidebar();

        // Load page data
        switch (page) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'accounts':
                loadAccountsPage();
                break;
            case 'transfers':
                populateAccountSelects();
                break;
            case 'payees':
                loadPayees();
                populatePayeeSelects();
                break;
            case 'bills':
                loadPendingPayments();
                populatePayeeSelects();
                break;
            case 'profile':
                loadProfile();
                break;
        }
    }

    // ==================== Dashboard ====================
    async function loadDashboard() {
        await loadAccounts();
        await loadRecentActivity();
    }

    async function promptForFunding(accountId, currency) {
        const symbol = getCurrencySymbol(currency);
        const amount = prompt(`Enter amount to fund (${symbol}):`);
        
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            if (amount !== null) {
                showToast('Please enter a valid amount', 'warning');
            }
            return;
        }

        try {
            const result = await api('/accounts/fund/', {
                method: 'POST',
                body: { 
                    account_id: accountId, 
                    amount: parseFloat(amount) 
                },
            });

            if (result) {
                showToast(`Account funded successfully with ${symbol}${parseFloat(amount).toLocaleString()}!`, 'success');
                loadAccounts();
            }
        } catch (error) {
            showToast(error.message || 'Failed to fund account', 'error');
        }
    }

    async function loadAccounts() {
        try {
            const accounts = await api('/accounts/');
            state.accounts = accounts || [];
            
            const container = document.getElementById('dashboard-accounts');
            if (state.accounts.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#x1F4B3;</div><div class="empty-state-text">No accounts found</div></div>';
                return;
            }

            container.innerHTML = state.accounts.map(account => `
                <div class="account-card ${account.account_type}" data-account-id="${account.id}">
                    <div class="account-type">${account.currency || 'NGN'}</div>
                    <div class="account-name">${escapeHtml(account.name)}</div>
                    <div class="account-number">${account.account_number || 'N/A'}</div>
                    <div class="account-balance">${formatCurrency(account.balance, account.currency)}</div>
                    <div class="account-balance-label">Available Balance</div>
                    <button class="btn btn-fund" data-account-id="${account.id}" data-currency="${account.currency || 'NGN'}">+ Fund</button>
                </div>
            `).join('');

            // Add click handlers
            container.querySelectorAll('.account-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('btn-fund')) {
                        showAccountDetail(card.dataset.accountId);
                    }
                });
            });

            // Add fund button handlers
            container.querySelectorAll('.btn-fund').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const accountId = btn.dataset.accountId;
                    const currency = btn.dataset.currency;
                    promptForFunding(accountId, currency);
                });
            });
        } catch (error) {
            showToast('Failed to load accounts', 'error');
        }
    }

    async function loadRecentActivity() {
        const container = document.getElementById('recent-activity');
        
        try {
            const data = await api('/recent-activity/');
            const transactions = data?.slice(0, 5) || [];

            if (transactions.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No recent activity</div></div>';
                return;
            }

            // Cache transaction details for click-to-view
            state.recentTransactions = {};
            transactions.forEach(tx => {
                state.recentTransactions[tx.id] = tx;
            });

            container.innerHTML = transactions.map(tx => {
                const isDebit = parseFloat(tx.amount) < 0;
                const absAmount = Math.abs(parseFloat(tx.amount));
                const txCurrency = tx.currency || 'NGN';
                return `
                <div class="activity-item ${isDebit ? 'debit' : 'credit'}" data-tx-id="${tx.id}" style="cursor: pointer;">
                    <span class="activity-icon">${isDebit ? '&#x2B07;' : '&#x2B06;'}</span>
                    <div class="activity-details">
                        <div class="activity-title">${escapeHtml(tx.remark) || 'Transaction'}</div>
                        <div class="activity-date">${formatDate(tx.date)}</div>
                    </div>
                    <span class="activity-amount ${isDebit ? 'debit' : 'credit'}">
                        ${isDebit ? '-' : ''}${formatCurrency(absAmount, txCurrency)}
                    </span>
                </div>`;
            }).join('');

            // Attach click handlers
            container.querySelectorAll('.activity-item').forEach(item => {
                item.addEventListener('click', () => {
                    const txId = parseInt(item.dataset.txId, 10);
                    showTransactionDetail(txId);
                });
            });
        } catch (error) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Unable to load activity</div></div>';
        }
    }

    // ==================== Transaction Detail ====================
    function showTransactionDetail(txId) {
        const tx = state.recentTransactions && state.recentTransactions[txId];
        if (!tx) {
            showToast('Transaction not found', 'error');
            return;
        }

        const isDebit = parseFloat(tx.amount) < 0;
        const absAmount = Math.abs(parseFloat(tx.amount));
        const currency = tx.currency || 'NGN';
        const datetime = new Date(tx.date);

        // Set icon and amount display
        const iconEl = document.getElementById('tx-detail-icon');
        iconEl.innerHTML = isDebit ? '&#x2B07;' : '&#x2B06;';
        iconEl.style.background = isDebit ? 'rgba(198,40,40,0.15)' : 'rgba(46,125,50,0.15)';
        iconEl.style.color = isDebit ? 'var(--danger)' : 'var(--success)';

        const amountEl = document.getElementById('tx-detail-amount');
        amountEl.textContent = `${isDebit ? '-' : ''}${formatCurrency(absAmount, currency)}`;
        amountEl.style.color = isDebit ? 'var(--danger)' : 'var(--success)';

        document.getElementById('tx-detail-type').textContent = isDebit ? 'Debit (Money Out)' : 'Credit (Money In)';
        document.getElementById('tx-detail-description').textContent = tx.remark || 'Transaction';
        document.getElementById('tx-detail-datetime').textContent = datetime.toLocaleString();
        document.getElementById('tx-detail-status').textContent = 'Completed';
        document.getElementById('tx-detail-id').textContent = `TXN-${txId.toString().padStart(6, '0')}`;

        // Payment Method
        document.getElementById('tx-detail-payment-method').textContent = tx.payment_method || 'N/A';

        // Recipient Details
        const recipient = tx.recipient_details;
        if (recipient) {
            const parts = [];
            if (recipient.name) parts.push(recipient.name);
            if (recipient.account_number) parts.push(`Account: ${recipient.account_number}`);
            document.getElementById('tx-detail-recipient').textContent = parts.join(' | ') || 'N/A';
        } else {
            document.getElementById('tx-detail-recipient').textContent = 'N/A';
        }

        // Set current transaction for sharing
        state.currentTransaction = {
            ...tx,
            currency,
            isDebit,
            absAmount
        };

        // Show the page
        document.querySelectorAll('.content-page').forEach(p => {
            p.style.display = 'none';
        });
        document.getElementById('transaction-detail-page').style.display = 'block';

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    function hideTransactionDetail() {
        document.getElementById('transaction-detail-page').style.display = 'none';
    }

    // ==================== Share Transaction ====================
    function openShareModal() {
        const tx = state.currentTransaction;
        if (!tx) return;

        const currency = tx.currency || 'NGN';
        const datetime = new Date(tx.date).toLocaleString();
        const isDebit = tx.isDebit;

        const receiptHtml = `
            <div class="receipt-header">
                <div class="receipt-logo">&#x1F3E6;</div>
                <div class="receipt-bank-name">VORD Bank</div>
                <div class="receipt-subtitle">Online Banking Portal</div>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-row">
                <span class="receipt-label">Transaction ID</span>
                <span class="receipt-value">TXN-${tx.id.toString().padStart(6, '0')}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Date &amp; Time</span>
                <span class="receipt-value">${datetime}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Type</span>
                <span class="receipt-value">${isDebit ? 'Debit (Money Out)' : 'Credit (Money In)'}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Payment Method</span>
                <span class="receipt-value">${escapeHtml(tx.payment_method || 'N/A')}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Description</span>
                <span class="receipt-value">${escapeHtml(tx.remark || 'Transaction')}</span>
            </div>
            ${tx.recipient_details ? `
            <div class="receipt-row">
                <span class="receipt-label">Recipient</span>
                <span class="receipt-value">${escapeHtml(tx.recipient_details.name || 'N/A')}</span>
            </div>
            ${tx.recipient_details.account_number ? `
            <div class="receipt-row">
                <span class="receipt-label">Account Number</span>
                <span class="receipt-value">${escapeHtml(tx.recipient_details.account_number)}</span>
            </div>` : ''}
            ` : ''}
            <div class="receipt-divider"></div>
            <div class="receipt-total-row">
                <span class="receipt-total-label">Amount</span>
                <span class="receipt-total-value" style="color: ${isDebit ? '#c62828' : '#2e7d32'}">
                    ${isDebit ? '-' : ''}${formatCurrency(tx.absAmount, currency)}
                </span>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-footer">
                <p>Thank you for banking with VORD Bank</p>
                <p class="receipt-footer-note">This is a computer-generated receipt and does not require a signature.</p>
            </div>
        `;

        document.getElementById('share-receipt').innerHTML = receiptHtml;
        document.getElementById('share-tx-modal').style.display = 'flex';
    }

    function closeShareModal() {
        document.getElementById('share-tx-modal').style.display = 'none';
    }

    function copyReceiptToClipboard() {
        const receipt = document.getElementById('share-receipt');
        const text = receipt.innerText;

        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Receipt copied to clipboard', 'success');
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showToast('Receipt copied to clipboard', 'success');
            } else {
                showToast('Failed to copy', 'error');
            }
        } catch (err) {
            showToast('Failed to copy', 'error');
        } finally {
            document.body.removeChild(textarea);
        }
    }

    function downloadReceipt() {
        const receipt = document.getElementById('share-receipt');
        const text = receipt.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${state.currentTransaction?.id || 'unknown'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Receipt downloaded', 'success');
    }

    // ==================== Accounts ====================
    async function loadAccountsPage() {
        const container = document.getElementById('accounts-list');
        
        try {
            const accounts = await api('/accounts/');
            state.accounts = accounts || [];

            if (state.accounts.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#x1F4B3;</div><div class="empty-state-text">No accounts found</div></div>';
                return;
            }

            container.innerHTML = state.accounts.map(account => `
                <div class="account-card ${account.account_type}" data-account-id="${account.id}">
                    <div class="account-type">${account.currency || 'NGN'}</div>
                    <div class="account-name">${escapeHtml(account.name)}</div>
                    <div class="account-number">${account.account_number || 'N/A'}</div>
                    <div class="account-balance">${formatCurrency(account.balance, account.currency)}</div>
                    <div class="account-balance-label">Available Balance</div>
                </div>
            `).join('');

            container.querySelectorAll('.account-card').forEach(card => {
                card.addEventListener('click', () => {
                    showAccountDetail(card.dataset.accountId);
                });
            });
        } catch (error) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load accounts</div></div>';
        }
    }

    async function showAccountDetail(accountId) {
        hideAllPages();
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('register-page').style.display = 'none';
        document.getElementById('app-page').style.display = 'flex';
        
        document.getElementById('account-detail-page').style.display = 'block';
        document.querySelectorAll('.content-page:not(#account-detail-page)').forEach(p => {
            p.style.display = 'none';
        });

        try {
            const account = await api(`/accounts/${accountId}/`);
            state.currentAccount = account;

            document.getElementById('account-detail-name').textContent = account.name;
            document.getElementById('account-detail-type').textContent = `${account.account_type} (${account.currency || 'NGN'})`;
            document.getElementById('account-detail-balance').textContent = formatCurrency(account.balance, account.currency);

            // Add account number to detail card
            const detailCard = document.getElementById('account-detail-card');
            const existingAcctNum = detailCard.querySelector('.account-number-row');
            if (existingAcctNum) existingAcctNum.remove();
            
            const acctNumRow = document.createElement('div');
            acctNumRow.className = 'detail-row account-number-row';
            acctNumRow.innerHTML = `
                <span class="detail-label">Account Number</span>
                <span class="detail-value">${account.account_number || 'N/A'}</span>
            `;
            detailCard.insertBefore(acctNumRow, detailCard.firstChild);

            loadAccountTransactions(accountId);
            loadAccountStatements(accountId);
        } catch (error) {
            showToast('Failed to load account details', 'error');
        }
    }

    async function loadAccountTransactions(accountId, page = 1, search = '', date = '') {
        const tbody = document.getElementById('transactions-body');
        tbody.innerHTML = '<tr><td colspan="3" class="loading-cell">Loading...</td></tr>';

        try {
            let url = `/accounts/${accountId}/transactions/?page=${page}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (date) url += `&date=${date}`;

            const data = await api(url);
            const transactions = data?.results || [];

            if (transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No transactions found</td></tr>';
            } else {
                tbody.innerHTML = transactions.map(tx => `
                    <tr>
                        <td>${formatDate(tx.date)}</td>
                        <td>${escapeHtml(tx.remark) || '-'}</td>
                        <td class="${parseFloat(tx.amount) >= 0 ? 'amount-positive' : 'amount-negative'}">
                            ${parseFloat(tx.amount) >= 0 ? '+' : ''}${formatCurrency(tx.amount, state.currentAccount?.currency)}
                        </td>
                    </tr>
                `).join('');
            }

            // Render pagination
            renderPagination(data, page, (newPage) => loadAccountTransactions(accountId, newPage, search, date));
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Failed to load transactions</td></tr>';
        }
    }

    async function loadAccountStatements(accountId) {
        const container = document.getElementById('statements-list');
        
        try {
            const statements = await api(`/accounts/${accountId}/statements/`);
            
            if (!statements || statements.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No statements available</div></div>';
                return;
            }

            container.innerHTML = statements.map(stmt => `
                <div class="statement-item">
                    <span class="statement-icon">&#x1F4C4;</span>
                    <div class="statement-info">
                        <div class="statement-month">${formatDate(stmt.month)}</div>
                        <div class="statement-date">Generated: ${formatDate(stmt.created_at)}</div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load statements</div></div>';
        }
    }

    function renderPagination(data, currentPage, callback) {
        const container = document.getElementById('transactions-pagination');
        const totalPages = Math.ceil((data?.count || 0) / 10);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        
        // Previous button
        html += `<button ${!data.previous ? 'disabled' : ''} onclick="window.bankApp.goToPage(${currentPage - 1})">&laquo;</button>`;
        
        // Page numbers
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="window.bankApp.goToPage(${i})">${i}</button>`;
        }
        
        // Next button
        html += `<button ${!data.next ? 'disabled' : ''} onclick="window.bankApp.goToPage(${currentPage + 1})">&raquo;</button>`;
        
        container.innerHTML = html;
    }

    function goToPage(page) {
        if (state.currentAccount) {
            const search = document.getElementById('transaction-search')?.value || '';
            const date = document.getElementById('transaction-date-filter')?.value || '';
            loadAccountTransactions(state.currentAccount.id, page, search, date);
        }
    }

    // ==================== Transfers ====================
    const TRANSFER_TYPES = {
        'NGN': [
            { value: 'NIP', label: 'NIP Transfer' },
            { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
        ],
        'USD': [
            { value: 'ACH', label: 'ACH Transfer' },
            { value: 'WIRE', label: 'Wire Transfer' },
        ],
    };

    const CURRENCY_SYMBOLS = {
        'NGN': '₦',
        'USD': '$',
    };

    function getCurrencySymbol(currency) {
        return CURRENCY_SYMBOLS[currency] || '₦';
    }

    function updateCurrencySymbol(selectId, symbolId, typeSelectId) {
        const select = document.getElementById(selectId);
        const symbolEl = document.getElementById(symbolId);
        const typeSelect = document.getElementById(typeSelectId);
        
        if (!select) return;
        
        select.addEventListener('change', () => {
            const selectedOption = select.options[select.selectedIndex];
            const currency = selectedOption.dataset.currency || 'NGN';
            
            // Update currency symbol
            if (symbolEl) {
                symbolEl.textContent = getCurrencySymbol(currency);
            }
            
            // Update transfer types
            if (typeSelect) {
                const types = TRANSFER_TYPES[currency] || TRANSFER_TYPES['NGN'];
                typeSelect.innerHTML = types.map(t => 
                    `<option value="${t.value}">${t.label}</option>`
                ).join('');
            }
        });
    }

    function populateAccountSelects() {
        const internalSelect = document.getElementById('internal-from-account');
        const externalSelect = document.getElementById('external-from-account');

        // Internal transfer select
        if (internalSelect) {
            const currentValue = internalSelect.value;
            internalSelect.innerHTML = '<option value="">Select source account</option>' +
                state.accounts.map(acc => 
                    `<option value="${acc.id}" data-currency="${acc.currency || 'NGN'}">${escapeHtml(acc.name)} (${acc.currency}) - ${formatCurrency(acc.balance, acc.currency)}</option>`
                ).join('');
            internalSelect.value = currentValue;
        }

        // External transfer select
        if (externalSelect) {
            const currentValue = externalSelect.value;
            externalSelect.innerHTML = '<option value="">Select source account</option>' +
                state.accounts.map(acc => 
                    `<option value="${acc.id}" data-currency="${acc.currency || 'NGN'}">${escapeHtml(acc.name)} (${acc.currency}) - ${formatCurrency(acc.balance, acc.currency)}</option>`
                ).join('');
            externalSelect.value = currentValue;
        }

        // Setup currency symbol updates
        updateCurrencySymbol('internal-from-account', 'internal-currency-symbol', null);
        updateCurrencySymbol('external-from-account', 'external-currency-symbol', 'external-transfer-type');
    }

    async function handleInternalTransfer(e) {
        e.preventDefault();
        const form = e.target;
        
        const fromAccount = form.from_account.value;
        const toAccount = form.to_account.value;
        const amount = parseFloat(form.amount.value);
        const description = form.description.value;

        if (!fromAccount) {
            showToast('Please select a source account', 'warning');
            return;
        }

        if (!toAccount) {
            showToast('Please enter an account number', 'warning');
            return;
        }

        try {
            await api('/transactions/transfer/', {
                method: 'POST',
                body: { from_account: fromAccount, to_account: toAccount, amount: amount, description },
            });
            showToast('Transfer to Vord successful!', 'success');
            form.reset();
            loadAccounts();
        } catch (error) {
            showToast(error.message || 'Transfer failed', 'error');
        }
    }

    async function handleExternalTransfer(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            account: parseInt(form.account.value),
            recipient_name: form.recipient_name.value,
            recipient_account_number: form.recipient_account_number.value,
            recipient_routing_number: form.recipient_routing_number.value,
            amount: parseFloat(form.amount.value),
            transfer_type: form.transfer_type.value,
        };

        try {
            await api('/transactions/external/', {
                method: 'POST',
                body: data,
            });
            showToast('External transfer initiated!', 'success');
            form.reset();
            loadAccounts();
        } catch (error) {
            showToast(error.message || 'Transfer failed', 'error');
        }
    }

    // ==================== Fund Account ====================
    async function handleFundAccount(e) {
        e.preventDefault();
        const form = e.target;
        
        if (!state.currentAccount) {
            showToast('No account selected', 'error');
            return;
        }

        const amount = parseFloat(form.amount.value);

        if (!amount || amount <= 0) {
            showToast('Please enter a valid amount', 'warning');
            return;
        }

        try {
            const result = await api('/accounts/fund/', {
                method: 'POST',
                body: { 
                    account_id: state.currentAccount.id, 
                    amount: amount 
                },
            });

            if (result) {
                showToast(`Account funded successfully with ${formatCurrency(amount, state.currentAccount.currency)}!`, 'success');
                form.reset();
                // Refresh account details
                showAccountDetail(state.currentAccount.id);
                // Refresh accounts list
                loadAccounts();
            }
        } catch (error) {
            showToast(error.message || 'Failed to fund account', 'error');
        }
    }

    // ==================== Payees ====================
    async function loadPayees() {
        const container = document.getElementById('payees-list');
        
        try {
            const payees = await api('/payees/');

            if (!payees || payees.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No payees saved</div></div>';
                return;
            }

            container.innerHTML = payees.map(payee => `
                <div class="payee-card">
                    <div class="payee-name">${escapeHtml(payee.name)}</div>
                    ${payee.nickname ? `<div class="payee-nickname">${escapeHtml(payee.nickname)}</div>` : ''}
                    <div class="payee-account">Account: ****${payee.account_number?.slice(-4) || ''}</div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load payees</div></div>';
        }
    }

    function populatePayeeSelects() {
        const selects = [
            document.getElementById('bill-payee'),
            document.getElementById('schedule-payee'),
        ];

        selects.forEach(async (select) => {
            if (select) {
                try {
                    const payees = await api('/payees/');
                    if (payees && payees.length > 0) {
                        select.innerHTML = '<option value="">Choose a payee</option>' +
                            payees.map(p => 
                                `<option value="${p.id}">${escapeHtml(p.name)}${p.nickname ? ` (${escapeHtml(p.nickname)})` : ''}</option>`
                            ).join('');
                    }
                } catch (error) {
                    // Silently fail
                }
            }
        });
    }

    async function handleAddPayee(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            name: form.name.value,
            nickname: form.nickname.value,
            account_number: form.account_number.value,
            routing_number: form.routing_number.value,
        };

        try {
            await api('/payees/add/', {
                method: 'POST',
                body: data,
            });
            showToast('Payee added successfully!', 'success');
            form.reset();
            loadPayees();
        } catch (error) {
            showToast(error.message || 'Failed to add payee', 'error');
        }
    }

    // ==================== Bills ====================
    async function handlePayBill(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            payee: parseInt(form.payee.value),
            amount: parseFloat(form.amount.value),
        };

        try {
            await api('/bills/pay/', {
                method: 'POST',
                body: data,
            });
            showToast('Bill payment successful!', 'success');
            form.reset();
            loadAccounts();
            loadPendingPayments();
        } catch (error) {
            showToast(error.message || 'Payment failed', 'error');
        }
    }

    async function handleSchedulePayment(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            payee: parseInt(form.payee.value),
            amount: parseFloat(form.amount.value),
            schedule_date: form.schedule_date.value,
            is_recurring: form.is_recurring.checked,
            frequency: form.is_recurring.checked ? form.frequency.value : '',
        };

        try {
            await api('/bills/schedule/', {
                method: 'POST',
                body: data,
            });
            showToast('Payment scheduled successfully!', 'success');
            form.reset();
            document.getElementById('frequency-group').style.display = 'none';
            loadPendingPayments();
        } catch (error) {
            showToast(error.message || 'Failed to schedule payment', 'error');
        }
    }

    async function loadPendingPayments() {
        const tbody = document.getElementById('pending-payments-body');
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Loading...</td></tr>';

        try {
            const payments = await api('/bills/pending/');

            if (!payments || payments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No pending payments</td></tr>';
                return;
            }

            tbody.innerHTML = payments.map(payment => `
                <tr>
                    <td>Payee #${payment.payee}</td>
                    <td>${formatCurrency(payment.amount)}</td>
                    <td>${formatDateTime(payment.timestamp)}</td>
                    <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                    <td>
                        ${payment.status === 'scheduled' ? 
                            `<button class="btn btn-sm btn-secondary" onclick="window.bankApp.cancelScheduledPayment(${payment.id})">Cancel</button>` 
                            : '-'}
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to load payments</td></tr>';
        }
    }

    async function cancelScheduledPayment(paymentId) {
        try {
            await api(`/bills/schedule/${paymentId}/`, {
                method: 'DELETE',
            });
            showToast('Payment cancelled successfully!', 'success');
            loadPendingPayments();
        } catch (error) {
            showToast(error.message || 'Failed to cancel payment', 'error');
        }
    }

    // ==================== Profile ====================
    async function loadProfile() {
        try {
            const profile = await api('/profile/');
            if (profile) {
                document.getElementById('profile-first-name').value = profile.first_name || '';
                document.getElementById('profile-last-name').value = profile.last_name || '';
                document.getElementById('profile-username').value = profile.username || '';
                document.getElementById('profile-email').value = profile.email || '';
            }
        } catch (error) {
            showToast('Failed to load profile', 'error');
        }
    }

    async function handleUpdateProfile(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            first_name: form.first_name.value,
            last_name: form.last_name.value,
            username: form.username.value,
            email: form.email.value,
        };

        try {
            await api('/profile/', {
                method: 'PUT',
                body: data,
            });
            showToast('Profile updated successfully!', 'success');
            state.user = data;
            localStorage.setItem('user', JSON.stringify(data));
            document.getElementById('user-greeting').textContent = `Hi, ${data.first_name} ${data.last_name}`;
        } catch (error) {
            showToast(error.message || 'Failed to update profile', 'error');
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            old_password: form.old_password.value,
            new_password: form.new_password.value,
        };

        try {
            await api('/profile/password/', {
                method: 'POST',
                body: data,
            });
            showToast('Password changed successfully!', 'success');
            form.reset();
        } catch (error) {
            showToast(error.message || 'Failed to change password', 'error');
        }
    }

    // ==================== UI Helpers ====================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
        
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.onclick = closeSidebar;
            document.body.appendChild(overlay);
        }
        
        overlay.classList.toggle('active', sidebar.classList.contains('open'));
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ==================== Event Listeners ====================
    function initEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            login(username, password);
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            register(username, email, password);
        });

        // Navigation
        document.querySelectorAll('[data-navigate]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const page = el.dataset.navigate;
                if (page === 'login') {
                    showLogin();
                } else if (page === 'register') {
                    showRegister();
                } else {
                    navigateTo(page);
                }
            });
        });

        // Sidebar nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(item.dataset.page);
            });
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', logout);
        document.getElementById('profile-logout-btn').addEventListener('click', logout);

        // Mobile menu toggle
        document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
        document.getElementById('sidebar-close').addEventListener('click', closeSidebar);

        // Transfer forms
        document.getElementById('internal-transfer-form').addEventListener('submit', handleInternalTransfer);
        document.getElementById('external-transfer-form').addEventListener('submit', handleExternalTransfer);

        // Payee form
        document.getElementById('add-payee-form').addEventListener('submit', handleAddPayee);

        // Bill forms
        document.getElementById('pay-bill-form').addEventListener('submit', handlePayBill);
        document.getElementById('schedule-payment-form').addEventListener('submit', handleSchedulePayment);

        // Profile forms
        document.getElementById('profile-form').addEventListener('submit', handleUpdateProfile);
        document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);

        // Fund account form
        document.getElementById('fund-account-form').addEventListener('submit', handleFundAccount);

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                const parent = btn.closest('.transfer-tabs').parentElement;
                
                // Update buttons
                parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update content
                parent.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.style.display = 'block';
                    tabContent.classList.add('active');
                }
            });
        });

        // Transaction detail - back button
        const txBackBtn = document.querySelector('#transaction-detail-page .btn-back');
        if (txBackBtn) {
            txBackBtn.addEventListener('click', () => {
                hideTransactionDetail();
                navigateTo('dashboard');
            });
        }

        // Share transaction
        const shareTxBtn = document.getElementById('share-tx-btn');
        if (shareTxBtn) {
            shareTxBtn.addEventListener('click', openShareModal);
        }

        // Share modal controls
        const closeShareBtn = document.getElementById('close-share-tx-modal');
        if (closeShareBtn) {
            closeShareBtn.addEventListener('click', closeShareModal);
        }

        const copyShareBtn = document.getElementById('copy-share-btn');
        if (copyShareBtn) {
            copyShareBtn.addEventListener('click', copyReceiptToClipboard);
        }

        const downloadShareBtn = document.getElementById('download-share-btn');
        if (downloadShareBtn) {
            downloadShareBtn.addEventListener('click', downloadReceipt);
        }

        // Close modal on overlay click
        const shareModal = document.getElementById('share-tx-modal');
        if (shareModal) {
            shareModal.addEventListener('click', (e) => {
                if (e.target === shareModal) {
                    closeShareModal();
                }
            });
        }

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('share-tx-modal');
                if (modal && modal.style.display === 'flex') {
                    closeShareModal();
                }
            }
        });

        // Transaction filters
        const searchInput = document.getElementById('transaction-search');
        const dateInput = document.getElementById('transaction-date-filter');
        const clearBtn = document.getElementById('clear-filters');

        let filterTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => {
                    if (state.currentAccount) {
                        loadAccountTransactions(state.currentAccount.id, 1, searchInput.value, dateInput?.value);
                    }
                }, 300);
            });
        }

        if (dateInput) {
            dateInput.addEventListener('change', () => {
                if (state.currentAccount) {
                    loadAccountTransactions(state.currentAccount.id, 1, searchInput?.value, dateInput.value);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (dateInput) dateInput.value = '';
                if (state.currentAccount) {
                    loadAccountTransactions(state.currentAccount.id, 1);
                }
            });
        }

        // Recurring payment toggle
        const recurringCheckbox = document.getElementById('schedule-recurring');
        const frequencyGroup = document.getElementById('frequency-group');
        if (recurringCheckbox) {
            recurringCheckbox.addEventListener('change', () => {
                frequencyGroup.style.display = recurringCheckbox.checked ? 'block' : 'none';
            });
        }
    }

    // ==================== Initialize ====================
    function init() {
        initEventListeners();

        // Check if running through Django (not file://)
        if (window.location.protocol === 'file:') {
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1a237e; color: white; font-family: sans-serif;">
                    <div style="text-align: center; padding: 40px;">
                        <h1>VORD Banking</h1>
                        <p style="font-size: 1.2rem; margin: 20px 0;">This app must be accessed through Django server.</p>
                        <p>Please run:</p>
                        <code style="background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 4px; display: inline-block; margin: 10px 0;">
                            python manage.py runserver
                        </code>
                        <p>Then open: <strong>http://localhost:8000/</strong></p>
                    </div>
                </div>
            `;
            return;
        }

        // Check if token exists and is valid (not expired)
        const token = localStorage.getItem('access_token');
        if (token) {
            // Try to validate token by making a simple API call
            fetch('/accounts/', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })
            .then(response => {
                if (response.ok) {
                    state.token = token;
                    showApp();
                    navigateTo('dashboard');
                } else {
                    // Token expired or invalid, clear storage
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('user');
                    state.token = null;
                    showLogin();
                }
            })
            .catch(() => {
                // Network error or server down
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user');
                state.token = null;
                showLogin();
            });
        } else {
            showLogin();
        }
    }

    // Expose functions to global scope for inline event handlers
    window.bankApp = {
        goToPage,
        cancelScheduledPayment,
    };

    // Start the app
    init();
})();
