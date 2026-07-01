document.addEventListener('DOMContentLoaded', () => {
    // ─── STATE ───────────────────────────────────────────────────────
    let currentDateFilter = { from: '', to: '' };
    let currentTab = 'FIB';
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

    const heatmapContainer       = document.getElementById('heatmap-container');
    const heatmapGrid            = document.getElementById('heatmap-grid');
    const sectorGainersContainer = document.getElementById('sector-gainers-container');
    const sectorGainersList      = document.getElementById('sector-gainers-list');
    const gainersContainer       = document.getElementById('gainers-container');
    const topGainersList         = document.getElementById('top-gainers-list');

    const tooltipLogic   = document.querySelector('#tooltip-logic .tooltip-text');
    const tabBtns        = document.querySelectorAll('.tab-btn');
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

        // PnL — large number with class-based color
        const pnlVal = stats.totalPnl;
        statTotalPnl.textContent = formatCurrency(pnlVal);
        statTotalPnl.className   = `pnl-value ${getPnlClass(pnlVal)}`;

        statWinRate.textContent     = `${(stats.winRate || 0).toFixed(1)}%`;
        statAvgRr.textContent       = (stats.avgRr || 0).toFixed(2);
        statTotalTp.textContent     = stats.tpCount  || 0;
        statTotalSl.textContent     = stats.slCount  || 0;
        statTotalTrades.textContent = trades ? trades.length : 0;

        // ── Active Trades Table ──
        const activeTrades = currentTab === 'FIB' ? data.fibTracker : data.pdhTracker;
        renderActiveTable(activeTrades);

        // ── History Table ──
        renderHistoryTable(trades);

        // ── Right Sidebar (FIB → Heatmap+Gainers / PDH → F&O Gainers) ──
        if (currentTab === 'FIB') {
            gainersContainer.classList.add('hidden');
            heatmapContainer.classList.remove('hidden');
            sectorGainersContainer.classList.remove('hidden');
            renderHeatmap(data.sectorPerformance);
            renderSectorGainers(data.sectorPerformance);
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
            activeTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">No active positions</td></tr>';
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
                    <td>${formatNum(t.entryPrice)}</td>
                    <td class="ltp-cell">${formatNum(ltp)}</td>
                    <td class="pnl-cell ${getPnlClass(t.pnl)}">${formatCurrency(t.pnl)}</td>
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
                <td style="color:var(--text-2);font-size:0.75rem;">${formatDate(t.entryTime)}<br>${formatTime(t.entryTime)}</td>
                <td><strong>${t.symbol}</strong></td>
                <td class="${dirClass}">${t.direction}</td>
                <td>${formatNum(t.entryPrice)}</td>
                <td>${t.exitPrice ? formatNum(t.exitPrice) : '—'}</td>
                <td>${t.rr ? formatNum(t.rr) : '0.00'}</td>
                <td class="${getPnlClass(t.pnl)}">${formatCurrency(t.pnl || 0)}</td>
                <td>${statusBadge(t.status)}</td>
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
        if (!sectors) return;
        sectors.forEach(s => {
            const sign = s.chp > 0 ? '+' : '';
            heatmapGrid.innerHTML += `
                <div class="heat-tile ${getHeatClass(s.chp)}">
                    <span class="heat-name">${s.name.replace('NIFTY ', '')}</span>
                    <span class="heat-val">${sign}${formatNum(s.chp)}%</span>
                </div>`;
        });
    }

    function renderSectorGainers(sectors) {
        sectorGainersList.innerHTML = '';
        if (!sectors) return;
        const sorted = [...sectors].sort((a, b) => b.chp - a.chp);
        sorted.forEach(s => {
            const cls  = s.chp > 0 ? 'c-green' : 'c-red';
            const sign = s.chp > 0 ? '+' : '';
            sectorGainersList.innerHTML += `
                <li>
                    <span>${s.name.replace('NIFTY ', '')}</span>
                    <span class="${cls}">${sign}${formatNum(s.chp)}%</span>
                </li>`;
        });
    }

    function renderGainers(gainers) {
        topGainersList.innerHTML = '';
        if (!gainers) return;
        gainers.forEach(g => {
            topGainersList.innerHTML += `
                <li>
                    <span>${g.name}</span>
                    <span class="c-green">+${formatNum(g.chp)}%</span>
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
