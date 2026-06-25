const REFRESH_RATE = 5000; // 5 seconds

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function getChartUrl(symbol) {
    return `https://trade.fyers.in/popout/index.html?symbol=${encodeURIComponent(symbol)}&resolution=5&theme=dark`;
}

function createChartButton(symbol) {
    return `<a href="${getChartUrl(symbol)}" target="_blank" class="btn-chart">Open Chart</a>`;
}

function updateGainers(gainers, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!gainers || gainers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="neutral text-center">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = gainers.map(stock => `
        <tr>
            <td class="symbol">${stock.name}</td>
            <td class="${stock.chp >= 0 ? 'positive' : 'negative'}">${stock.chp.toFixed(2)}%</td>
            <td>₹${stock.ltp.toFixed(2)}</td>
            <td>${createChartButton(stock.symbol)}</td>
        </tr>
    `).join('');
}

function formatPnL(pnl) {
    if (pnl === undefined || pnl === null) return '-';
    return `<span class="${pnl >= 0 ? 'positive' : 'negative'}">₹${pnl.toFixed(2)}</span>`;
}

function updateActiveTrades(trades, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    const activeTrades = trades.filter(t => t.status === 'ACTIVE');
    
    if (activeTrades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="neutral text-center">No active trades</td></tr>';
        return;
    }

    tbody.innerHTML = activeTrades.map(trade => `
        <tr>
            <td class="symbol">${trade.name}</td>
            <td>₹${trade.entryPrice.toFixed(2)}</td>
            <td>₹${trade.currentPrice.toFixed(2)}</td>
            <td>${trade.qty || 0}</td>
            <td>${formatPnL(trade.pnl)}</td>
            <td>${trade.rr !== undefined ? trade.rr.toFixed(2) : '-'}</td>
            <td>${createChartButton(trade.symbol)}</td>
        </tr>
    `).join('');
}

function updateHistory(history, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="neutral text-center">No history available</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(trade => {
        let statusClass = trade.status.toLowerCase();
        let statusText = trade.status;
        
        return `
        <tr>
            <td class="symbol">${trade.symbol.split(':')[1] ? trade.symbol.split(':')[1].split('-')[0] : trade.symbol}</td>
            <td class="neutral">${new Date(trade.entryTime).toLocaleDateString()}</td>
            <td>₹${trade.entryPrice.toFixed(2)}</td>
            <td>${trade.exitPrice ? '₹'+trade.exitPrice.toFixed(2) : '-'}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>${createChartButton(trade.symbol)}</td>
        </tr>
    `}).join('');
}

async function fetchDashboardData() {
    try {
        const response = await fetch('/api/dashboard/data');
        const data = await response.json();

        if (data.success) {
            // Update Headers
            document.getElementById('server-status').textContent = data.status || 'Active';
            if (data.status === 'Offline') {
                document.getElementById('status-pulse').style.backgroundColor = 'var(--danger)';
            } else if (data.status.includes('Waiting')) {
                document.getElementById('status-pulse').style.backgroundColor = '#f59e0b'; // warning/orange
            } else {
                document.getElementById('status-pulse').style.backgroundColor = 'var(--success)';
            }
            
            document.getElementById('last-update').textContent = `Last scan: ${data.lastUpdate || '-'}`;

            // FIB Updates
            updateGainers(data.topGainers, 'fib-gainers-body'); // Shared for now until Fin scanner is separate
            updateActiveTrades(data.fibTracker, 'fib-active-body');
            
            // PDH Updates
            updateGainers(data.topGainers, 'pdh-gainers-body');
            updateActiveTrades(data.pdhTracker, 'pdh-active-body');
            
            // History
            if (data.history) {
                updateHistory(data.history.fib, 'fib-history-body');
                updateHistory(data.history.pdh, 'pdh-history-body');
                
                document.getElementById('fib-win-rate').textContent = `Win Rate: ${data.history.fibWinRate.toFixed(1)}%`;
                document.getElementById('pdh-win-rate').textContent = `Win Rate: ${data.history.pdhWinRate.toFixed(1)}%`;
            }
        }
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        document.getElementById('server-status').textContent = 'Connection Error';
        document.getElementById('status-pulse').style.backgroundColor = 'var(--danger)';
    }
}

// Initial fetch
fetchDashboardData();

// Set interval for live updates
setInterval(fetchDashboardData, REFRESH_RATE);
