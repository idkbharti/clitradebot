document.addEventListener('DOMContentLoaded', () => {
    // ─── STATE ───────────────────────────────────────────────────────
    let currentDateFilter = { from: '', to: '' };
    let currentTab = 'FIB';
    let currentActiveSector = 1;
    let lastData = null;

    // ─── SOCKET ──────────────────────────────────────────────────────
    const socket = io();

    // ─── DOM ELEMENTS ────────────────────────────────────────────────
    const statTotalPnl    = document.getElementById('stat-total-pnl');
    const statWinRate     = document.getElementById('stat-win-rate');
    const statAvgRr       = document.getElementById('stat-avg-rr');
    const statTotalTp     = document.getElementById('stat-total-tp');
    const statTotalSl     = document.getElementById('stat-total-sl');
    const statTotalTrades = document.getElementById('stat-total-trades');

    const activeTableTitle  = document.getElementById('active-table-title');
    const activeTableBody   = document.querySelector('#active-table tbody');
    const historyTableTitle = document.getElementById('history-table-title');
    const historyTableBody  = document.querySelector('#history-table tbody');

    const healthScanners  = document.getElementById('health-scanners');
    const healthExecution = document.getElementById('health-execution');
    const healthRisk      = document.getElementById('health-risk');
    const healthLastScan  = document.getElementById('health-last-scan');
    const dotScanner      = document.getElementById('dot-scanner');
    const dotExecution    = document.getElementById('dot-execution');
    const dotRisk         = document.getElementById('dot-risk');
    const dotAuth         = document.getElementById('dot-auth');
    const healthAuth      = document.getElementById('health-auth');
    const healthAuthTime  = document.getElementById('health-auth-time');

    const heatmapContainer       = document.getElementById('heatmap-container');
    const heatmapGrid            = document.getElementById('heatmap-grid');
    const sectorGainersContainer = document.getElementById('sector-gainers-container');
    const sectorGainersList      = document.getElementById('sector-gainers-list');
    const gainersContainer       = document.getElementById('gainers-container');
    const topGainersList         = document.getElementById('top-gainers-list');

    const tooltipLogic   = document.querySelector('#tooltip-logic .tooltip-text');
    const tabBtns        = document.querySelectorAll('.tab-btn');
    const toggleSector1  = document.getElementById('toggle-sector-1');
    const toggleSector2  = document.getElementById('toggle-sector-2');
    const filterBtns     = document.querySelectorAll('.filter-btn');
    const settingsModal  = document.getElementById('settings-modal');
    const settingsBtn    = document.getElementById('settings-btn');
    const closeSettings  = document.getElementById('close-settings');
    const saveSettings   = document.getElementById('save-settings');
    const settingRisk    = document.getElementById('setting-risk');
    const settingRr      = document.getElementById('setting-rr');
    const dateFrom       = document.getElementById('date-from');
    const dateTo         = document.getElementById('date-to');
    const applyDates     = document.getElementById('apply-dates');
    const liveClock      = document.getElementById('live-clock');

    // ─── LIVE CLOCK ──────────────────────────────────────────────────
    function updateClock() {
        const now = new Date();
        liveClock.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ─── FORMATTERS ──────────────────────────────────────────────────
    const formatCurrency = (val) => {
        const n = Number(val) || 0;
        const abs = Math.abs(n);
        const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (n < 0 ? '-₹' : '₹') + formatted;
    };
    const formatNum  = (val) => Number(val).toFixed(2);
    const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour12: false });
    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN');
    const getPnlClass = (val) => val > 0 ? 'pnl-positive' : val < 0 ? 'pnl-negative' : 'pnl-neutral';

    // Status badge for the table "Result" column
    function statusBadge(status) {
        const map = { TP: 'badge-tp', SL: 'badge-sl', ACTIVE: 'badge-active', CLOSED_EOD: 'badge-eod' };
        const cls = map[status] || 'badge-eod';
        return `<span class="badge ${cls}">${status}</span>`;
    }

    // ─── INIT ────────────────────────────────────────────────────────
    setDateRange(0);
    fetchData();
    fetchSettings();

    // ─── DATA FETCH ──────────────────────────────────────────────────
    async function fetchData() {
        try {
            const q = new URLSearchParams({ from: currentDateFilter.from, to: currentDateFilter.to, strategy: currentTab });
            const res  = await fetch(`/api/data?${q}`);
            const data = await res.json();
            if (data.success) { lastData = data; updateDashboard(); }
        } catch (e) { console.error('Fetch error:', e); }
    }

    async function fetchSettings() {
        try {
            const res  = await fetch('/api/settings');
            const data = await res.json();
            if (data.success) { settingRisk.value = data.risk_per_trade; settingRr.value = data.rr_target; }
        } catch(e) {}
    }

    // ─── DASHBOARD UPDATE ─────────────────────────────────────────────
    function updateDashboard() {
        if (!lastData) return;
        const data = lastData;

        // ── System Health ──
        const stType  = data.statusType;
        const stColor = stType === 'online'  ? 'var(--green)'
                      : stType === 'waiting' ? 'var(--amber)'
                      : 'var(--red)';
        const stLabel = data.status;

        [healthScanners, healthExecution, healthRisk].forEach(el => {
            el.textContent  = stLabel;
            el.style.color  = stColor;
        });
        [dotScanner, dotExecution, dotRisk].forEach(el => {
            el.className = `dot ${stType}`;
        });
        healthLastScan.textContent = data.lastUpdate || '—';

        // ── Fyers Auth Status ──
        if (data.authStatus) {
            const auth = data.authStatus;
            if (auth.ok) {
                dotAuth.className      = 'dot online';
                healthAuth.textContent = 'Connected';
                healthAuth.style.color = 'var(--green)';
                healthAuthTime.textContent = auth.lastAuth || '—';
            } else {
                dotAuth.className      = 'dot offline';
                healthAuth.textContent = 'Auth Error';
                healthAuth.style.color = 'var(--red)';
                healthAuthTime.textContent = 'Failed';
            }
        }

        // ── Tooltip ──
        if (data.logicHelpers && tooltipLogic) {
            tooltipLogic.textContent = currentTab === 'FIB'
                ? data.logicHelpers.scanner.FIB
                : data.logicHelpers.scanner.PDH;
        }

        // ── Titles ──
        activeTableTitle.textContent  = currentTab === 'FIB' ? 'FIB Pullback' : 'PDH Rejection';
        historyTableTitle.textContent = currentTab;

        // ── Stats ──
        const history = data.history;
        const stats   = currentTab === 'FIB' ? history.fibStats : history.pdhStats;
        const trades  = currentTab === 'FIB' ? history.fib : history.pdh;

        // ── Active Trades Table ──
        const activeTrades = currentTab === 'FIB' ? data.fibTracker : data.pdhTracker;

        // PnL — large number with class-based color
        const livePnl = activeTrades ? activeTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) : 0;
        statTotalPnl.textContent = formatCurrency(livePnl);
        statTotalPnl.className   = `pnl-value ${getPnlClass(livePnl)}`;

        // Today's Closed PnL
        const closedPnl = stats.totalPnl || 0;
        const statClosedPnl = document.getElementById('stat-closed-pnl');
        if (statClosedPnl) {
            statClosedPnl.textContent = formatCurrency(closedPnl);
            statClosedPnl.className = getPnlClass(closedPnl);
        }

        statWinRate.textContent     = `${(stats.winRate || 0).toFixed(1)}%`;
        statAvgRr.textContent       = (stats.avgRr || 0).toFixed(2);
        statTotalTp.textContent     = stats.tpCount  || 0;
        statTotalSl.textContent     = stats.slCount  || 0;
        statTotalTrades.textContent = trades ? trades.length : 0;

        renderActiveTable(activeTrades);

        // ── History Table ──
        renderHistoryTable(trades);

        // ── Right Sidebar (FIB → Heatmap+Gainers / PDH → F&O Gainers) ──
        if (currentTab === 'FIB') {
            gainersContainer.classList.add('hidden');
            heatmapContainer.classList.remove('hidden');
            sectorGainersContainer.classList.remove('hidden');
            renderHeatmap(data.sectorPerformance);
            
            if (data.sector1 && data.sector1.name) {
                toggleSector1.textContent = data.sector1.name;
                toggleSector2.textContent = data.sector2.name;
                
                toggleSector1.className = currentActiveSector === 1 ? 'sector-btn active' : 'sector-btn';
                toggleSector2.className = currentActiveSector === 2 ? 'sector-btn active' : 'sector-btn';
                
                const currentSectorData = currentActiveSector === 1 ? data.sector1.stocks : data.sector2.stocks;
                renderSectorGainers(currentSectorData);
            } else {
                toggleSector1.textContent = 'Sector 1';
                toggleSector2.textContent = 'Sector 2';
                renderSectorGainers([]);
            }
        } else {
            heatmapContainer.classList.add('hidden');
            sectorGainersContainer.classList.add('hidden');
            gainersContainer.classList.remove('hidden');
            renderGainers(data.topGainers);
        }
    }

    // ─── ACTIVE TABLE ─────────────────────────────────────────────────
    function renderActiveTable(trades) {
        if (!trades || trades.length === 0) {
            activeTableBody.innerHTML = '<tr class="empty-row"><td colspan="6">No active positions</td></tr>';
            return;
        }

        // Remove empty placeholder
        const emptyRow = activeTableBody.querySelector('.empty-row');
        if (emptyRow) emptyRow.remove();

        trades.forEach(t => {
            const rowId = `trade-${t.symbol}`;
            let tr = document.getElementById(rowId);
            const ltp  = t.exitPrice || t.entryPrice;
            const dirClass = t.direction === 'LONG' ? 'dir-long' : 'dir-short';

            if (!tr) {
                tr = document.createElement('tr');
                tr.id = rowId;
                tr.innerHTML = `
                    <td><strong>${t.symbol}</strong></td>
                    <td class="${dirClass}">${t.direction}</td>
                    <td>${formatNum(t.entryPrice)}<br><small style="color:var(--text-3); font-size: 0.65rem;">${formatTime(t.entryTime)}</small></td>
                    <td class="ltp-cell">${formatNum(ltp)}</td>
                    <td class="pnl-cell ${getPnlClass(t.pnl)}">${formatCurrency(t.pnl)}</td>
                    <td><a href="https://trade.fyers.in/?sym=${t.symbol}" target="_blank" title="Chart" style="color:var(--blue); display: flex; align-items: center; justify-content: center;"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/><path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/></svg></a></td>
                `;
                activeTableBody.appendChild(tr);
            } else {
                tr.querySelector('.ltp-cell').textContent = formatNum(ltp);
                const pnlCell = tr.querySelector('.pnl-cell');
                pnlCell.textContent = formatCurrency(t.pnl);
                pnlCell.className   = `pnl-cell ${getPnlClass(t.pnl)}`;
            }
        });

        // Clean up rows for closed trades
        Array.from(activeTableBody.children).forEach(tr => {
            if (tr.classList.contains('empty-row')) return;
            const sym = tr.id.replace('trade-', '');
            if (sym && !trades.find(t => t.symbol === sym)) tr.remove();
        });
    }

    // ─── HISTORY TABLE ────────────────────────────────────────────────
    function renderHistoryTable(trades) {
        historyTableBody.innerHTML = '';
        if (!trades || trades.length === 0) {
            historyTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">No trades in this period</td></tr>';
            return;
        }

        trades.forEach(t => {
            const tr = document.createElement('tr');
            const dirClass = t.direction === 'LONG' ? 'dir-long' : 'dir-short';
            tr.innerHTML = `
                <td><strong>${t.symbol}</strong></td>
                <td class="${dirClass}">${t.direction}</td>
                <td>${formatNum(t.entryPrice)}<br><small style="color:var(--text-3); font-size: 0.65rem;">${formatTime(t.entryTime)}</small></td>
                <td>${t.exitPrice ? formatNum(t.exitPrice) : '—'}<br><small style="color:var(--text-3); font-size: 0.65rem;">${t.exitTime ? formatTime(t.exitTime) : ''}</small></td>
                <td>${t.rr ? formatNum(t.rr) : '0.00'}</td>
                <td class="${getPnlClass(t.pnl)}">${formatCurrency(t.pnl || 0)}</td>
                <td>${statusBadge(t.status)}</td>
                <td><a href="https://trade.fyers.in/?sym=${t.symbol}" target="_blank" title="Chart" style="color:var(--blue); display: flex; align-items: center; justify-content: center;"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/><path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/></svg></a></td>
            `;
            historyTableBody.appendChild(tr);
        });
    }

    // ─── HEATMAP ──────────────────────────────────────────────────────
    function getHeatClass(chp) {
        if (chp <= -2)            return 'heat-very-red';
        if (chp < 0)              return 'heat-red';
        if (chp === 0)            return 'heat-neutral';
        if (chp > 0 && chp < 1.5) return 'heat-green';
        return 'heat-very-green';
    }

    function renderHeatmap(sectors) {
        heatmapGrid.innerHTML = '';
        if (!sectors || sectors.length === 0) {
            heatmapGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-3);font-size:0.75rem;padding:1rem;">Waiting for market open (9:15 AM)</div>';
            return;
        }
        sectors.forEach(s => {
            const sign = s.chp > 0 ? '+' : '';
            heatmapGrid.innerHTML += `
                <div class="heat-tile ${getHeatClass(s.chp)}">
                    <span class="heat-name">${s.name.replace('NIFTY ', '')}</span>
                    <span class="heat-val">${sign}${formatNum(s.chp)}%</span>
                </div>`;
        });
    }

    function renderSectorGainers(gainers) {
        sectorGainersList.innerHTML = '';
        if (!gainers || gainers.length === 0) {
            sectorGainersList.innerHTML = '<li style="color:var(--text-3);font-size:0.75rem;">Waiting for scanner data…</li>';
            return;
        }
        gainers.forEach(s => {
            const cls  = s.chp > 0 ? 'c-green' : 'c-red';
            const sign = s.chp > 0 ? '+' : '';
            sectorGainersList.innerHTML += `
                <li style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="market-name">${s.name}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="market-val ${cls}">${sign}${formatNum(s.chp)}%</span>
                        <a href="https://trade.fyers.in/?sym=${s.symbol}" target="_blank" title="Chart" style="color:var(--blue); display: flex;"><svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/><path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/></svg></a>
                    </div>
                </li>`;
        });
    }

    function renderGainers(gainers) {
        topGainersList.innerHTML = '';
        if (!gainers) return;
        gainers.forEach(g => {
            topGainersList.innerHTML += `
                <li style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="market-name">${g.name}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="market-val c-green">+${formatNum(g.chp)}%</span>
                        <a href="https://trade.fyers.in/?sym=${g.symbol}" target="_blank" title="Chart" style="color:var(--blue); display: flex;"><svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/><path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/></svg></a>
                    </div>
                </li>`;
        });
    }

    // ─── FLASH ANIMATION ──────────────────────────────────────────────
    function triggerFlash(el, isUp) {
        if (!el) return;
        el.classList.remove('animate-pnl-up', 'animate-pnl-down');
        void el.offsetWidth;
        el.classList.add(isUp ? 'animate-pnl-up' : 'animate-pnl-down');
    }

    // ─── SOCKETS ─────────────────────────────────────────────────────
    socket.on('trade_tick', (data) => {
        if (data.strategy !== currentTab) return;
        const tr = document.getElementById(`trade-${data.symbol}`);
        if (!tr) return;

        const ltpCell = tr.querySelector('.ltp-cell');
        const pnlCell = tr.querySelector('.pnl-cell');
        if (!ltpCell || !pnlCell) return;

        const oldPnl = parseFloat(pnlCell.textContent.replace(/[^0-9.-]+/g, ''));
        ltpCell.textContent = formatNum(data.ltp);

        if (oldPnl !== data.pnl) {
            pnlCell.textContent = formatCurrency(data.pnl);
            pnlCell.className   = `pnl-cell ${getPnlClass(data.pnl)}`;
            triggerFlash(pnlCell, data.pnl > oldPnl);
        }
    });

    socket.on('trade', (msg) => {
        if (msg.type === 'EXECUTED' || msg.type === 'CLOSED') fetchData();
    });

    socket.on('signal', () => {});

    // ─── UI EVENTS ───────────────────────────────────────────────────

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            fetchData();
        });
    });

    // Toggle Sectors
    if (toggleSector1) {
        toggleSector1.addEventListener('click', () => {
            currentActiveSector = 1;
            updateDashboard();
        });
    }
    if (toggleSector2) {
        toggleSector2.addEventListener('click', () => {
            currentActiveSector = 2;
            updateDashboard();
        });
    }

    // Settings modal
    settingsBtn.addEventListener('click',   () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

    saveSettings.addEventListener('click', async () => {
        try {
            await fetch('/api/settings', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ risk_per_trade: settingRisk.value, rr_target: settingRr.value })
            });
            settingsModal.classList.add('hidden');
        } catch(e) { console.error(e); }
    });

    // Timeframe filters
    function setDateRange(days) {
        const today = new Date().toISOString().split('T')[0];
        if (days === 0) {
            currentDateFilter = { from: today, to: today };
        } else {
            const past = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
            currentDateFilter = { from: past, to: today };
        }
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const range = btn.dataset.range;
            if (range === 'today') setDateRange(0);
            else if (range === 'week')  setDateRange(7);
            else if (range === 'month') setDateRange(30);
            else if (range === 'year')  setDateRange(365);
            fetchData();
        });
    });

    applyDates.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        currentDateFilter = { from: dateFrom.value, to: dateTo.value };
        fetchData();
    });

    // Refresh bulk data every 30s (ticks handle live pricing)
    setInterval(fetchData, 30000);
});
