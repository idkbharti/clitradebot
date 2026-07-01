document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentDateFilter = { from: '', to: '' };
    let currentTab = 'FIB'; // Default active tab
    let lastData = null; // Cache for rerendering on tab switch

    // Socket.io
    const socket = io();

    // DOM Elements
    const statTotalPnl = document.getElementById('stat-total-pnl');
    const statWinRate = document.getElementById('stat-win-rate');
    const statAvgRr = document.getElementById('stat-avg-rr');
    const statTotalTp = document.getElementById('stat-total-tp');
    const statTotalSl = document.getElementById('stat-total-sl');
    const statTotalTrades = document.getElementById('stat-total-trades');
    const statStrategyName = document.getElementById('stat-strategy-name');
    
    const activeTableTitle = document.getElementById('active-table-title');
    const activeBadge = document.getElementById('active-badge');
    const activeTableBody = document.querySelector('#active-table tbody');
    const historyTableTitle = document.getElementById('history-table-title');
    const historyTableBody = document.querySelector('#history-table tbody');
    
    const healthScanners = document.getElementById('health-scanners');
    const healthExecution = document.getElementById('health-execution');
    const healthRisk = document.getElementById('health-risk');
    const healthLastScan = document.getElementById('health-last-scan');
    
    const dotScanner = document.getElementById('dot-scanner');
    const dotExecution = document.getElementById('dot-execution');
    const dotRisk = document.getElementById('dot-risk');

    const heatmapContainer = document.getElementById('heatmap-container');
    const heatmapGrid = document.getElementById('heatmap-grid');
    const sectorGainersList = document.getElementById('sector-gainers-list');
    
    const gainersContainer = document.getElementById('gainers-container');
    const topGainersList = document.getElementById('top-gainers-list');

    // Tooltips
    const tooltipLogic = document.querySelector('#tooltip-logic .tooltip-text');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');

    // Modals & Inputs
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');
    const settingRisk = document.getElementById('setting-risk');
    const settingRr = document.getElementById('setting-rr');

    // Filters
    const filterBtns = document.querySelectorAll('.filter-btn');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const applyDates = document.getElementById('apply-dates');

    // Formatting utilities
    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
    const formatNum = (val) => Number(val).toFixed(2);
    const formatTime = (isoString) => new Date(isoString).toLocaleTimeString();
    const formatDate = (isoString) => new Date(isoString).toLocaleDateString();
    const getPnlClass = (val) => val > 0 ? 'pnl-positive' : val < 0 ? 'pnl-negative' : 'pnl-neutral';

    // Initial Load
    setDateRange(0);
    fetchData();
    fetchSettings();

    // Fetch API Data
    async function fetchData() {
        try {
            const query = new URLSearchParams({
                from: currentDateFilter.from,
                to: currentDateFilter.to,
                strategy: currentTab // Only fetch history for active tab
            });
            const res = await fetch(`/api/data?${query}`);
            const data = await res.json();

            if (data.success) {
                lastData = data;
                updateDashboard();
            }
        } catch (e) {
            console.error("Failed to fetch dashboard data", e);
        }
    }

    async function fetchSettings() {
        try {
            const res = await fetch(`/api/settings`);
            const data = await res.json();
            if (data.success) {
                settingRisk.value = data.risk_per_trade;
                settingRr.value = data.rr_target;
            }
        } catch(e) {}
    }

    function updateDashboard() {
        if (!lastData) return;
        const data = lastData;

        // Status
        const st = data.status;
        const stType = data.statusType;
        const stColor = stType === 'online' ? 'var(--neon-green)' : stType === 'waiting' ? 'var(--neon-blue)' : 'var(--neon-red)';
        
        healthScanners.textContent = st;
        healthScanners.style.color = stColor;
        dotScanner.className = `dot ${stType}`;
        
        healthExecution.textContent = st;
        healthExecution.style.color = stColor;
        dotExecution.className = `dot ${stType}`;
        
        healthRisk.textContent = st;
        healthRisk.style.color = stColor;
        dotRisk.className = `dot ${stType}`;

        healthLastScan.textContent = data.lastUpdate || 'Waiting for 9:15 AM';

        // Tooltips & Titles
        if (data.logicHelpers) {
            tooltipLogic.textContent = currentTab === 'FIB' ? data.logicHelpers.scanner.FIB : data.logicHelpers.scanner.PDH;
        }
        
        statStrategyName.textContent = currentTab;
        activeTableTitle.textContent = currentTab === 'FIB' ? 'FIB Pullback' : 'PDH Rejection';
        historyTableTitle.textContent = currentTab;
        activeBadge.className = `badge ${currentTab === 'FIB' ? 'neon-green' : 'neon-red'}`;

        // Stats (Filtered by Tab)
        const history = data.history;
        const stats = currentTab === 'FIB' ? history.fibStats : history.pdhStats;
        const winRate = stats.winRate; // Now taken straight from stats object
        const totalTrades = currentTab === 'FIB' ? history.fib.length : history.pdh.length;
        
        statTotalPnl.textContent = formatCurrency(stats.totalPnl);
        statTotalPnl.className = `stat-value pnl-massive pnl-total ${getPnlClass(stats.totalPnl)}`;
        statWinRate.textContent = `${winRate.toFixed(1)}%`;
        statAvgRr.textContent = stats.avgRr;
        statTotalTp.textContent = stats.tpCount;
        statTotalSl.textContent = stats.slCount;
        statTotalTrades.textContent = totalTrades;

        // Tables
        const activeTrades = currentTab === 'FIB' ? data.fibTracker : data.pdhTracker;
        const historyTrades = currentTab === 'FIB' ? history.fib : history.pdh;
        
        renderActiveTable(activeTableBody, activeTrades);
        renderHistoryTable(historyTrades);

        // Sidebar Overview (Heatmap vs Gainers)
        if (currentTab === 'FIB') {
            gainersContainer.classList.add('hidden');
            heatmapContainer.classList.remove('hidden');
            renderHeatmap(data.sectorPerformance);
            renderSectorGainers(data.sectorPerformance);
        } else {
            heatmapContainer.classList.add('hidden');
            gainersContainer.classList.remove('hidden');
            renderGainers(data.topGainers);
        }
    }

    function renderActiveTable(tbody, trades) {
        if (!trades || trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">No active trades</td></tr>';
            return;
        }

        if (tbody.querySelector('td[colspan="5"]')) {
            tbody.innerHTML = '';
        }

        trades.forEach(t => {
            const rowId = `trade-${t.symbol}`;
            let tr = document.getElementById(rowId);
            const currentPrice = t.status === 'ACTIVE' ? (t.exitPrice || t.entryPrice) : t.exitPrice;
            
            if (!tr) {
                tr = document.createElement('tr');
                tr.id = rowId;
                tr.innerHTML = `
                    <td><strong>${t.symbol}</strong></td>
                    <td class="${t.direction === 'LONG' ? 'neon-green' : 'neon-red'}">${t.direction}</td>
                    <td>${formatNum(t.entryPrice)}</td>
                    <td class="ltp-cell">${formatNum(currentPrice)}</td>
                    <td class="pnl-cell ${getPnlClass(t.pnl)}">${formatCurrency(t.pnl)}</td>
                `;
                tbody.appendChild(tr);
            } else {
                tr.querySelector('.ltp-cell').textContent = formatNum(currentPrice);
                const pnlCell = tr.querySelector('.pnl-cell');
                pnlCell.textContent = formatCurrency(t.pnl);
                pnlCell.className = `pnl-cell ${getPnlClass(t.pnl)}`;
            }
        });

        // Clean up closed trades from active table
        Array.from(tbody.children).forEach(tr => {
            const symbol = tr.id.replace('trade-', '');
            if (symbol && !trades.find(t => t.symbol === symbol)) tr.remove();
        });
    }

    function renderHistoryTable(trades) {
        historyTableBody.innerHTML = '';
        if (!trades || trades.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-secondary);">No history found</td></tr>';
            return;
        }

        trades.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(t.entryTime)} ${formatTime(t.entryTime)}</td>
                <td><strong>${t.symbol}</strong></td>
                <td class="${t.direction === 'LONG' ? 'neon-green' : 'neon-red'}">${t.direction}</td>
                <td>${formatNum(t.entryPrice)}</td>
                <td>${t.exitPrice ? formatNum(t.exitPrice) : '-'}</td>
                <td>${t.rr ? formatNum(t.rr) : '0.00'}</td>
                <td class="${getPnlClass(t.pnl)}">${formatCurrency(t.pnl || 0)}</td>
                <td>${t.status}</td>
            `;
            historyTableBody.appendChild(tr);
        });
    }

    function getHeatmapClass(chp) {
        if (chp <= -2) return 'heat-very-red';
        if (chp < 0) return 'heat-red';
        if (chp === 0) return 'heat-neutral';
        if (chp > 0 && chp < 1.5) return 'heat-green';
        return 'heat-very-green';
    }

    function renderHeatmap(sectors) {
        heatmapGrid.innerHTML = '';
        if (!sectors) return;
        
        sectors.forEach(s => {
            const heatClass = getHeatmapClass(s.chp);
            const sign = s.chp > 0 ? '+' : '';
            heatmapGrid.innerHTML += `
                <div class="heat-tile ${heatClass}">
                    <span class="heat-name">${s.name.replace('NIFTY ', '')}</span>
                    <span class="heat-val">${sign}${formatNum(s.chp)}%</span>
                </div>
            `;
        });
    }

    function renderSectorGainers(sectors) {
        sectorGainersList.innerHTML = '';
        if (!sectors) return;
        
        // Sort highest chp first
        const sorted = [...sectors].sort((a, b) => b.chp - a.chp);
        
        sorted.forEach(s => {
            const colorClass = s.chp > 0 ? 'neon-green' : 'neon-red';
            const sign = s.chp > 0 ? '+' : '';
            sectorGainersList.innerHTML += `<li><span>${s.name.replace('NIFTY ', '')}</span> <span class="${colorClass}">${sign}${formatNum(s.chp)}%</span></li>`;
        });
    }

    function renderGainers(gainers) {
        topGainersList.innerHTML = '';
        if (!gainers) return;
        gainers.forEach(g => {
            topGainersList.innerHTML += `<li><span>${g.name}</span> <span class="neon-green">+${formatNum(g.chp)}%</span></li>`;
        });
    }

    function triggerFlashAnimation(el, isUp) {
        if (!el) return;
        el.classList.remove('animate-pnl-up', 'animate-pnl-down');
        void el.offsetWidth; // Force reflow
        el.classList.add(isUp ? 'animate-pnl-up' : 'animate-pnl-down');
    }

    // ----------------------------------------------------
    // Socket Listeners
    // ----------------------------------------------------
    
    // Fast TICK updates (3s) for active trades!
    socket.on('trade_tick', (data) => {
        // Only process tick if we are looking at the relevant tab
        if (data.strategy !== currentTab) return;
        
        const rowId = `trade-${data.symbol}`;
        const tr = document.getElementById(rowId);
        if (!tr) return; // Row doesn't exist yet, wait for main fetch

        const ltpCell = tr.querySelector('.ltp-cell');
        const pnlCell = tr.querySelector('.pnl-cell');
        if (!ltpCell || !pnlCell) return;

        const oldPnlStr = pnlCell.textContent;
        const oldPnl = parseFloat(oldPnlStr.replace(/[^0-9.-]+/g,""));
        
        ltpCell.textContent = formatNum(data.ltp);
        
        if (oldPnl !== data.pnl) {
            pnlCell.textContent = formatCurrency(data.pnl);
            pnlCell.className = `pnl-cell ${getPnlClass(data.pnl)}`;
            triggerFlashAnimation(pnlCell, data.pnl > oldPnl);
        }
    });

    socket.on('trade', (msg) => {
        const { type, data } = msg;
        
        if (type === 'EXECUTED') {
            fetchData();
        } 
        else if (type === 'CLOSED') {
            fetchData();
        }
    });

    socket.on('signal', (msg) => {
        // Signals are logged to backend console now
    });

    // ----------------------------------------------------
    // UI Event Listeners
    // ----------------------------------------------------

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            fetchData(); // Immediately refetch data for new tab
        });
    });

    // Settings Modal
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    
    saveSettings.addEventListener('click', async () => {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    risk_per_trade: settingRisk.value,
                    rr_target: settingRr.value
                })
            });
            settingsModal.classList.add('hidden');
        } catch (e) {
            console.error(e);
        }
    });

    // Timeframe Filters
    function setDateRange(days) {
        if (days === 0) {
            const today = new Date().toISOString().split('T')[0];
            currentDateFilter = { from: today, to: today };
        } else {
            const today = new Date();
            const pastDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
            currentDateFilter = { from: pastDate.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
        }
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const range = btn.dataset.range;
            if (range === 'today') setDateRange(0);
            else if (range === 'week') setDateRange(7);
            else if (range === 'month') setDateRange(30);
            else if (range === 'year') setDateRange(365);

            fetchData();
        });
    });

    applyDates.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        currentDateFilter = { from: dateFrom.value, to: dateTo.value };
        fetchData();
    });

    // Interval to refresh main bulk data every 30s (Ticks handle live pricing now)
    setInterval(() => {
        fetchData();
    }, 30000);

});
