// ===================================================
// TRADING SCANNER DASHBOARD — Frontend Logic v2
// ===================================================

const REFRESH_RATE = 5000;
let currentStrategy = 'fib'; // 'fib' or 'pdh'
let cachedData = null;

// ===== Strategy Toggle =====
function switchStrategy(strategy) {
    currentStrategy = strategy;
    document.querySelectorAll('.strategy-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-strategy="${strategy}"]`).classList.add('active');

    // Update section titles
    const label = strategy === 'fib' ? 'FIB' : 'PDH';
    document.getElementById('active-title').textContent = `${label} Active Trades`;
    document.getElementById('history-title').textContent = `${label} Trade History`;

    // Re-render with cached data
    if (cachedData) {
        renderForStrategy(cachedData);
    }

    // If on history tab, re-fetch with new strategy
    if (document.getElementById('tab-history').classList.contains('active')) {
        fetchHistoryData();
    }
}

// ===== Tab Switching =====
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'history') {
        fetchHistoryData();
    }
}

// ===== Helpers =====
function getChartUrl(symbol) {
    return `https://trade.fyers.in/popout/index.html?symbol=${encodeURIComponent(symbol)}&resolution=5&theme=dark`;
}

function chartBtn(symbol) {
    return `<a href="${getChartUrl(symbol)}" target="_blank" class="btn-chart">Chart</a>`;
}

function formatPnL(val) {
    if (val === undefined || val === null) return '<span class="neutral">—</span>';
    const cls = val >= 0 ? 'positive' : 'negative';
    const sign = val >= 0 ? '+' : '';
    return `<span class="${cls}">${sign}₹${val.toFixed(2)}</span>`;
}

function formatRR(val) {
    if (val === undefined || val === null) return '<span class="neutral">—</span>';
    const cls = val >= 0 ? 'positive' : 'negative';
    const sign = val >= 0 ? '+' : '';
    return `<span class="${cls}">${sign}${val.toFixed(2)}</span>`;
}

function getRankDisplay(i) {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `${i + 1}`;
}

function getStatusBadge(status) {
    const cls = status.toLowerCase();
    const labels = { 'TP': '✓ TP', 'SL': '✗ SL', 'ACTIVE': 'Active', 'CLOSED_EOD': 'EOD' };
    return `<span class="badge ${cls}">${labels[status] || status}</span>`;
}

function getMaxChange(gainers) {
    if (!gainers || gainers.length === 0) return 1;
    return Math.max(...gainers.map(s => Math.abs(s.chp)), 1);
}

function computeTradePnL(trade, isFib) {
    const entry = trade.entryPrice || 0;
    const exit = trade.exitPrice || trade.currentPrice || entry;
    const high = trade.dayHigh || 0;
    const low = trade.dayLow || 0;

    if (isFib) {
        const risk = entry - low;
        const qty = risk > 0 ? Math.floor(1000 / risk) : 0;
        const diff = exit - entry;
        return { pnl: diff * qty, rr: risk > 0 ? diff / risk : 0, qty };
    } else {
        const risk = high - entry;
        const qty = risk > 0 ? Math.floor(1000 / risk) : 0;
        const diff = entry - exit;
        return { pnl: diff * qty, rr: risk > 0 ? diff / risk : 0, qty };
    }
}

// ===== Status Banner =====
function updateStatus(data) {
    const banner = document.getElementById('status-banner');
    const text = document.getElementById('status-text');
    const lastUpdate = document.getElementById('last-update');
    const holidayBanner = document.getElementById('holiday-banner');

    const statusType = data.statusType || 'offline';
    banner.className = `status-banner ${statusType}`;

    const icons = { online: '🟢', waiting: '🟡', holiday: '🔴', offline: '🔴' };
    text.textContent = `${icons[statusType] || '🔴'} ${data.status || 'Offline'}`;

    lastUpdate.textContent = data.lastUpdate ? `Last scan: ${data.lastUpdate}` : '';

    // Holiday banner
    holidayBanner.style.display = data.isHoliday ? 'flex' : 'none';
}

// ===== Stats Cards (strategy-specific) =====
function updateStats(data) {
    const history = data.history;
    if (!history) return;

    const isFib = currentStrategy === 'fib';
    const trades = isFib ? (history.fib || []) : (history.pdh || []);
    const stats = isFib ? history.fibStats : history.pdhStats;
    const winRate = isFib ? history.fibWinRate : history.pdhWinRate;

    const activeTrades = trades.filter(t => t.status === 'ACTIVE');
    const closedTrades = trades.filter(t => t.status === 'TP' || t.status === 'SL' || t.status === 'CLOSED_EOD');
    const tpCount = trades.filter(t => t.status === 'TP').length;
    const slCount = trades.filter(t => t.status === 'SL').length;

    // Total
    document.getElementById('stat-total').textContent = trades.length;
    document.getElementById('stat-total-sub').innerHTML = `Active: ${activeTrades.length} | Closed: ${closedTrades.length}`;

    // Win Rate
    const wr = winRate || 0;
    const wrEl = document.getElementById('stat-winrate');
    wrEl.textContent = `${wr.toFixed(1)}%`;
    wrEl.className = `stat-value ${wr >= 50 ? 'positive' : wr > 0 ? 'negative' : ''}`;
    document.getElementById('stat-winrate-sub').innerHTML = `TP: ${tpCount} | SL: ${slCount}`;

    // PnL
    const pnl = stats?.totalPnl || 0;
    const pnlEl = document.getElementById('stat-pnl');
    pnlEl.textContent = `₹${pnl.toFixed(0)}`;
    pnlEl.className = `stat-value ${pnl >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('stat-pnl-sub').textContent = 'Based on ₹1000 risk';

    // Avg RR
    const rr = stats?.avgRr || 0;
    const rrEl = document.getElementById('stat-rr');
    rrEl.textContent = rr.toFixed(2);
    rrEl.className = `stat-value ${rr >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('stat-rr-sub').textContent = 'Per closed trade';
}

// ===== Top Gainers with Signal =====
function updateGainers(data) {
    const tbody = document.getElementById('gainers-body');
    const gainers = data.topGainers;
    const isFib = currentStrategy === 'fib';
    const tracker = isFib ? (data.fibTracker || []) : (data.pdhTracker || []);

    if (!gainers || gainers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">📊</div>No data available</td></tr>';
        return;
    }

    const maxChp = getMaxChange(gainers);

    tbody.innerHTML = gainers.map((stock, i) => {
        const cls = stock.chp >= 0 ? 'positive' : 'negative';
        const barWidth = Math.min((Math.abs(stock.chp) / maxChp) * 100, 100);
        const tracked = tracker.find(t => t.symbol === stock.symbol);
        let signal = '<span class="neutral">—</span>';
        if (tracked) signal = getStatusBadge(tracked.status);

        return `
        <tr>
            <td class="rank-cell">${getRankDisplay(i)}</td>
            <td class="symbol">${stock.name}</td>
            <td>
                <div class="change-cell">
                    <span class="${cls}">${stock.chp >= 0 ? '+' : ''}${stock.chp.toFixed(2)}%</span>
                    <div class="change-bar"><div class="change-bar-fill ${cls}" style="width:${barWidth}%"></div></div>
                </div>
            </td>
            <td>₹${stock.ltp.toFixed(2)}</td>
            <td>${signal}</td>
            <td>${chartBtn(stock.symbol)}</td>
        </tr>`;
    }).join('');
}

// ===== Active Trades (strategy-specific) =====
function updateActiveTrades(data) {
    const tbody = document.getElementById('active-trades-body');
    const isFib = currentStrategy === 'fib';
    const allTrades = isFib ? (data.fibTracker || []) : (data.pdhTracker || []);

    const activeTrades = allTrades.filter(t => t.status === 'ACTIVE');
    document.getElementById('active-count').textContent = `${activeTrades.length} Active`;

    if (allTrades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><div class="empty-state-icon">🎯</div>No trades yet</td></tr>';
        return;
    }

    tbody.innerHTML = allTrades.map(trade => {
        const pnl = trade.pnl !== undefined ? trade.pnl : 0;
        const rr = trade.rr !== undefined ? trade.rr : 0;

        return `
        <tr>
            <td class="symbol">${trade.name}</td>
            <td>₹${trade.entryPrice.toFixed(2)}</td>
            <td>₹${trade.currentPrice.toFixed(2)}</td>
            <td>₹${trade.targetPrice.toFixed(2)}</td>
            <td>₹${trade.stopPrice.toFixed(2)}</td>
            <td>${trade.qty || 0}</td>
            <td>${formatPnL(pnl)}</td>
            <td>${formatRR(rr)}</td>
            <td>${getStatusBadge(trade.status)}</td>
            <td>${chartBtn(trade.symbol)}</td>
        </tr>`;
    }).join('');
}

// ===== Today's Completed =====
function updateCompleted(data) {
    const tbody = document.getElementById('completed-body');
    const isFib = currentStrategy === 'fib';
    const allTrades = isFib ? (data.fibTracker || []) : (data.pdhTracker || []);
    const completed = allTrades.filter(t => t.status !== 'ACTIVE');

    // Win rate
    const closed = completed.filter(t => t.status === 'TP' || t.status === 'SL');
    const wr = closed.length > 0 ? ((closed.filter(t => t.status === 'TP').length / closed.length) * 100).toFixed(1) : '—';
    document.getElementById('today-win-rate').textContent = `Win Rate: ${wr}%`;

    if (completed.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">📊</div>No completed trades today</td></tr>';
        return;
    }

    tbody.innerHTML = completed.map(trade => {
        const computed = computeTradePnL(trade, isFib);
        return `
        <tr>
            <td class="symbol">${trade.name}</td>
            <td>₹${trade.entryPrice.toFixed(2)}</td>
            <td>${trade.exitPrice ? '₹' + trade.exitPrice.toFixed(2) : '—'}</td>
            <td>${computed.qty}</td>
            <td>${formatPnL(computed.pnl)}</td>
            <td>${formatRR(computed.rr)}</td>
            <td>${getStatusBadge(trade.status)}</td>
            <td>${chartBtn(trade.symbol)}</td>
        </tr>`;
    }).join('');
}

// ===== Render all for current strategy =====
function renderForStrategy(data) {
    updateStats(data);
    updateSectorHeatmap(data);
    updateGainers(data);
    updateActiveTrades(data);
    updateCompleted(data);
}

function updateSectorHeatmap(data) {
    const section = document.getElementById('sector-heatmap-section');
    const heatmap = document.getElementById('sector-heatmap');
    
    // Only show on FIB strategy
    if (currentStrategy !== 'fib') {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    if (!data.sectorPerformance || data.sectorPerformance.length === 0) {
        heatmap.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; padding: 20px;"><div class="empty-state-icon">🌴</div>Market closed. No sector data available.</div>';
        return;
    }
    
    heatmap.innerHTML = data.sectorPerformance.map(sector => {
        const isPositive = sector.chp >= 0;
        const cls = isPositive ? 'positive' : 'negative';
        const sign = isPositive ? '+' : '';
        
        return `
            <div class="heatmap-cell ${cls}">
                <div class="heatmap-name">${sector.name}</div>
                <div class="heatmap-chp">${sign}${sector.chp.toFixed(2)}%</div>
            </div>
        `;
    }).join('');
}

// ===== Fetch Dashboard =====
async function fetchDashboardData() {
    try {
        const response = await fetch('/api/dashboard/data?_t=' + Date.now());
        const data = await response.json();

        if (data.success) {
            cachedData = data;
            updateStatus(data);
            renderForStrategy(data);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        document.getElementById('status-banner').className = 'status-banner offline';
        document.getElementById('status-text').textContent = '🔴 Connection Error';
    }
}

// ===== Fetch History (strategy-specific) =====
async function fetchHistoryData() {
    const from = document.getElementById('filter-from').value;
    const to = document.getElementById('filter-to').value;
    const status = document.getElementById('filter-status').value;

    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('strategy', currentStrategy); // auto from toggle
    if (status !== 'all') params.set('status', status);

    try {
        const response = await fetch(`/api/dashboard/data?${params.toString()}`);
        const data = await response.json();

        if (data.success && data.history) {
            updateHistoryStats(data.history);
            renderHistoryTable(data.history);
        }
    } catch (error) {
        console.error('History fetch error:', error);
    }
}

function updateHistoryStats(history) {
    const isFib = currentStrategy === 'fib';
    const trades = isFib ? (history.fib || []) : (history.pdh || []);
    const stats = isFib ? history.fibStats : history.pdhStats;
    const winRate = isFib ? history.fibWinRate : history.pdhWinRate;

    const tpCount = trades.filter(t => t.status === 'TP').length;
    const slCount = trades.filter(t => t.status === 'SL').length;

    document.getElementById('hist-total').textContent = trades.length;
    document.getElementById('hist-tp').textContent = tpCount;
    document.getElementById('hist-sl').textContent = slCount;

    const wr = winRate || 0;
    const wrEl = document.getElementById('hist-winrate');
    wrEl.textContent = `${wr.toFixed(1)}%`;
    wrEl.className = `history-stat-value ${wr >= 50 ? 'positive' : wr > 0 ? 'negative' : ''}`;

    const pnl = stats?.totalPnl || 0;
    const pnlEl = document.getElementById('hist-pnl');
    pnlEl.textContent = `₹${pnl.toFixed(0)}`;
    pnlEl.className = `history-stat-value ${pnl >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('hist-rr').textContent = (stats?.avgRr || 0).toFixed(2);
    document.getElementById('hist-count').textContent = `${trades.length} trades`;
}

function renderHistoryTable(history) {
    const tbody = document.getElementById('history-body');
    const isFib = currentStrategy === 'fib';
    const trades = isFib ? (history.fib || []) : (history.pdh || []);

    if (trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">📜</div>No trades found</td></tr>';
        return;
    }

    tbody.innerHTML = trades.map(trade => {
        const computed = computeTradePnL(trade, isFib);
        const symbolClean = trade.symbol?.split(':')[1] ? trade.symbol.split(':')[1].split('-')[0] : (trade.name || trade.symbol);
        const dateStr = trade.tradeDate || new Date(trade.entryTime).toISOString().split('T')[0];

        return `
        <tr>
            <td class="neutral">${dateStr}</td>
            <td class="symbol">${symbolClean}</td>
            <td>₹${trade.entryPrice.toFixed(2)}</td>
            <td>${trade.exitPrice ? '₹' + trade.exitPrice.toFixed(2) : '—'}</td>
            <td>${formatPnL(computed.pnl)}</td>
            <td>${formatRR(computed.rr)}</td>
            <td>${getStatusBadge(trade.status)}</td>
            <td>${chartBtn(trade.symbol)}</td>
        </tr>`;
    }).join('');
}

// ===== Filter Actions =====
function applyFilters() { fetchHistoryData(); }

function resetFilters() {
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    document.getElementById('filter-status').value = 'all';
    fetchHistoryData();
}

// ===== Init =====
fetchDashboardData();
setInterval(fetchDashboardData, REFRESH_RATE);
