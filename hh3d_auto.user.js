// ==UserScript==
// @name          HH3D Auto - Edited by giachu
// @namespace     hh3d-tool-giachu
// @version       6.0.3
// @description   Auto HH3D
// @author        Cre: [Unknown] - Edited by giachu
// @include       *://hoathinh3d.*/*
// @require       https://cdn.jsdelivr.net/npm/sweetalert2@11.26.12/dist/sweetalert2.all.min.js
// @run-at        document-start
// @grant         unsafeWindow
// @connect       raw.githubusercontent.com
// @icon          😂
// ==/UserScript==

(async function() {
    'use strict';

    console.log('%c[HH3D Script] Tải thành công. Đang khởi tạo UI tùy chỉnh.',
    'background: #222; color: #bada55; padding: 2px 5px; border-radius: 3px;');

    const weburl = window.location.origin.replace(/\/+$/, '') + '/';
    const baseUrl = "https://raw.githubusercontent.com";
    const repoPath = "/shinylee1205/Anonymous";
    const branch = "/refs/heads/main";

    const ajaxUrl = weburl + 'wp-content/themes/halimmovies-child/hh3d-ajax.php';
    let questionDataCache = null;
    let isCssInjected = false;
    let userBetCount = 0;
    let userBetStones = [];
    let hData = null;

    function parseHh3dData(html, k = null, d = null) {
      try {
        let hh3dData = {};
        const hh3dMatch = html.match(/var\s+hh3dData\s*=\s*({[^}]+})/);
        if (hh3dMatch) {
          try {
            hh3dData = JSON.parse(hh3dMatch[1]);
          } catch (e) {}
        }
        
        if (!k || !d) {
          const scriptMatch = html.match(/var\s+k\s*=\s*"([^"]+)"\s*,\s*d\s*=\s*"([^"]+)"/);
          if (scriptMatch) {
            k = k || scriptMatch[1];
            d = d || scriptMatch[2];
          } else {
            return hh3dData;
          }
        }
        
        if (k && d) {
          try {
            const b64 = d.replace(/\\/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
            const b64Padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
            const decodedBytes = atob(b64Padded).split('').map(c => c.charCodeAt(0));
            
            let result = '';
            for (let i = 0; i < decodedBytes.length; i++) {
              result += String.fromCharCode(
                decodedBytes[i] ^ k.charCodeAt(i % k.length)
              );
            }
            const actData = JSON.parse(result);
            hh3dData.act = actData;
          } catch (e) {}
        }
        const m = html.match(/var\s+boss_attack_token\s*=\s*['"]([a-f0-9]+)['"]/i);
        hh3dData.attackToken = m ? m[1] : null;
        return hh3dData;
      } catch (error) {
        return {};
      }
    }

    if (location.pathname.includes('khoang-mach') || location.href.includes('khoang-mach')) {
        const fastAttack = localStorage.getItem('khoangmach_fast_attack') === 'true';
        if (fastAttack) {
            const NEW_DELAY = 50;
            const originalSetInterval = window.setInterval;
            window.setInterval = function(callback, delay, ...args) {
                let actualDelay = delay;
                if (typeof callback === 'function' && callback.toString().includes('countdown--') &&
                        callback.toString().includes('clearInterval(countdownInterval)') &&
                        callback.toString().includes('executeAttack')){
                    actualDelay = NEW_DELAY
                    showNotification('Không được đánh đến khi hết thông báo này', 'error', 5500);
                }
            return originalSetInterval(callback, actualDelay, ...args);
            };
        }
    }

    const LINK_GROUPS = [];

    function addStyle(css) {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    addStyle(`
       .km-punch-btn{
         background:#e74c3c;color:#fff;border:none;
         width:28px;height:28px;border-radius:6px;
         cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
         font-weight:700;
       }
       .km-punch-btn:hover{filter:brightness(1.05);}
    `);

    async function getSecurityToken(url) {
        let htmlContent = null;
        try {
            if (url) {
                const response = await fetch(url);
                if (!response.ok) return null;
                htmlContent = await response.text();
            } else {
                htmlContent = document.documentElement.outerHTML;
            }
            hData = parseHh3dData(htmlContent);            
            const regex = /"securityToken"\s*:\s*"([^"]+)"/;
            const match = htmlContent.match(regex);

            if (match && match[1]) {
                const token = match[1];
                const isCurrentPage = !url || (url === window.location.href);
                if (isCurrentPage) {
                    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.hh3dData) {
                        unsafeWindow.hh3dData.securityToken = token;
                    } else if (typeof window.hh3dData !== 'undefined') {
                        window.hh3dData.securityToken = token;
                    }
                    try {
                        const script = document.createElement('script');
                        script.textContent = `
                            try {
                                if (typeof hh3dData !== 'undefined') {
                                    hh3dData.securityToken = "${token}";
                                }
                            } catch(e) {}
                        `;
                        (document.head || document.body || document.documentElement).appendChild(script);
                        script.remove();
                    } catch (injectErr) {}
                }
                return token;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    async function getNonce() {       
        if (typeof restNonce !== 'undefined' && restNonce) {
            return restNonce;
        }        
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            let match = script.innerHTML.match(/"restNonce"\s*:\s*"([a-f0-9]+)"/);
            if (match) {
                return match[1];
            } else {
                match = script.innerHTML.match(/"nonce"\s*:\s*"([a-f0-9]+)"/);
                if (match) {
                    return match[1];
                }
            }
        }
        try {
            const nonce = await getSecurityNonce(weburl + '?t', "restNonce");
            if (nonce) return nonce;
        } catch (error) {}
        return null;
    }

    async function getSecurityNonce(url, actionName, maxRetries = 3, retryCount = 0) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if ((response.status === 503 || response.status === 429) && retryCount < maxRetries) {
                    const waitTime = 2000 + (retryCount * 1000);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return getSecurityNonce(url, actionName, maxRetries, retryCount + 1);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            hData = parseHh3dData(html);
            
            const tokenRegex = /"securityToken"\s*:\s*"([^"]+)"/;
            const tokenMatch = html.match(tokenRegex);
            if (tokenMatch && tokenMatch[1]) {
                const token = tokenMatch[1];
                const isCurrentPage = window.location.href.includes(url);
                if (isCurrentPage) {
                    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.hh3dData) {
                        unsafeWindow.hh3dData.securityToken = token;
                    } else if (typeof window.hh3dData !== 'undefined') {
                        window.hh3dData.securityToken = token;
                    }
                }
            }

            const actionTokens = extractActionTokens(html);
            let nonce = actionTokens[actionName];
            if (url.includes('linh-thach')) {
                nonce = extractRedeemNonce(html);
            }
            if (nonce) return nonce;
            return null;
        } catch (e) {
            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return getSecurityNonce(url, actionName, maxRetries, retryCount + 1);
            }
            return null;
        }
    }

    async function getAccountId() {
        const html = document.documentElement.innerHTML;
        const regexList = [
            /"user_id"\s*:\s*"(\d+)"/,
            /current_user_id\s*:\s*'(\d+)'/
        ];
        for (const regex of regexList) {
            const match = html.match(regex);
            if (match) {
                localStorage.setItem('hh3d_account_id', match[1]);
                return match[1];
            }
        }
        for (const regex of regexList) {
            const id = await getSecurityNonce(weburl + '?t', regex);
            if (id) {
                localStorage.setItem('hh3d_account_id', id);
                return id;
            }
        }
        return null;
    }

    class TaskTracker {
        constructor(storageKey = 'dailyTasks') {
            this.storageKey = storageKey;
            this.data = this.loadData();
            this.dothachTimeoutId = null;
        }
        loadData() {
            const storedData = localStorage.getItem(this.storageKey);
            return storedData ? JSON.parse(storedData) : {};
        }
        saveData() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        }
        getAccountData(accountId) {
            if (!this.data[accountId]) {
                this.data[accountId] = {};
                this.saveData();
            }
            const accountData = this.data[accountId];
            const today = new Date().toLocaleDateString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh' });
            const defaultTasks = {
                diemdanh: { done: false },
                thiluyen: { done: false, nextTime: null },
                bicanh: { done: false, nextTime: null },
                phucloi: { done: false, nextTime: null },
                hoangvuc: { done: false, nextTime: null },
                dothach: { betplaced: false, reward_claimed: false, turn: 1 },
                khoangmach: {done: false, nextTime: null },
                tienduyen: {last_check: null, done: false },
                hoatdongngay: {done: false },
                luotkhactranvip: {done: false },
                phaptuong: {done: false }
            };

            if (accountData.lastUpdatedDate !== today) {
                accountData.lastUpdatedDate = today;
                Object.assign(accountData, defaultTasks);
                this.saveData();
            } else {
                let updated = false;
                for (const taskName in defaultTasks) {
                    if (!accountData[taskName]) {
                        accountData[taskName] = defaultTasks[taskName];
                        updated = true;
                    }
                }
                if (updated) this.saveData();
            }

            const hourInVN = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false }), 10);
            if (accountData.dothach.turn === 1 && hourInVN >= 16) {
                accountData.dothach = { betplaced: false, reward_claimed: false, turn: 2 };
                this.saveData();
            }
            return accountData;
        }
        updateTask(accountId, taskName, key, value) {
            const accountData = this.getAccountData(accountId);
            if (accountData[taskName]) {
                accountData[taskName][key] = value;
                this.saveData();
            }
        }
        getTaskStatus(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            return accountData[taskName] || null;
        }
        isTaskDone(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            return accountData[taskName] && accountData[taskName].done;
        }
        markTaskDone(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            if (accountData[taskName]) {
                accountData[taskName].done = true;
                this.saveData();
            }
        }
        resetAllTasks(accountId) {
            const accountData = this.getAccountData(accountId);
            const taskNames = ['diemdanh', 'thiluyen', 'bicanh', 'phucloi', 'hoangvuc', 'khoangmach', 'hoatdongngay', 'tienduyen', 'luotkhactranvip', 'phaptuong'];
            let resetCount = 0;
            taskNames.forEach(taskName => {
                if (accountData[taskName] && accountData[taskName].done) {
                    accountData[taskName].done = false;
                    resetCount++;
                }
            });
            if (accountData.dothach) {
                accountData.dothach.betplaced = false;
                accountData.dothach.reward_claimed = false;
            }
            this.saveData();
            return resetCount;
        }
        adjustTaskTime(accountId, taskName, newTime) {
            const accountData = this.getAccountData(accountId);
            if (accountData[taskName]) {
                accountData[taskName].nextTime = newTime;
                this.saveData();
            }
        }
        getNextTime(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            const ts = accountData[taskName]?.nextTime;
            if (!ts || ts === "null") return null;
            const date = new Date(Number(ts));
            return isNaN(date.getTime()) ? null : date;
        }
        getLastCheckTienDuyen(accountId) {
            const accountData = this.getTaskStatus(accountId, 'tienduyen');
            return new Date(Number(accountData.last_check));
        }
        setLastCheckTienDuyen(accountId, timestamp) {
            let finalTimestamp = timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
            this.updateTask(accountId, 'tienduyen', 'last_check', finalTimestamp);
        }
    }

    function timePlus(timeString) {
        const now = new Date();
        const [minutes, seconds] = timeString.split(':').map(Number);
        return now.getTime() + (minutes * 60 + seconds) * 1000;
    }

    const QUEST_CONFIG = [
        {
            taskId: 'diemdanh',
            taskName: 'Điểm Danh, Tế Lễ, Vấn Đáp',
            taskIcon: '<i class="fas fa-calendar-check"></i>',
            autorunEnabled: true,
            autorunKey: 'autoDiemDanh',
            hasButton: true,
            buttonText: 'Thực hiện',
            async action() {
                const nonce = await getNonce();
                if (!nonce) return;
                await doDailyCheckin(nonce);
                await doClanDailyCheckin(nonce);
                await vandap.doVanDap(nonce);
            }
        },
        {
            taskId: 'thiluyen',
            taskName: 'Thí Luyện Tông Môn',
            taskIcon: '<i class="fas fa-fire-alt"></i>',
            autorunEnabled: true,
            autorunKey: 'autoThiLuyen',
            hasButton: true,
            buttonText: 'Thực hiện',
            async action() { await doThiLuyenTongMon(); }
        },
        {
            taskId: 'phucloi',
            taskName: 'Phúc Lợi Đường',
            taskIcon: '<i class="fas fa-gift"></i>',
            autorunEnabled: true,
            autorunKey: 'autoPhucLoi',
            hasButton: true,
            buttonText: 'Nhận',
            hasExtraButton: true,
            extraButtonText: '🎁',
            extraButtonTitle: 'Nhận Bonus',
            async action() { await doPhucLoiDuong(); },
            async extraAction() { await phucloiclaimbonus(); }
        },
        {
            taskId: 'hoangvuc',
            taskName: 'Hoang Vực',
            taskIcon: '<i class="fas fa-dragon"></i>',
            autorunEnabled: true,
            autorunKey: 'autoHoangVuc',
            hasButton: true,
            buttonText: 'Đánh',
            hasExtraButton: true,
            extraButtonText: '📦',
            extraButtonTitle: 'Mua 5 Rương Linh Bảo',
            hasSettings: true,
            hasDamageToggle: true,
            async action() { await hoangvuc.doHoangVuc(); },
            async extraAction() { await hvmuaruong.muaRuongLinhBao(5); }
        },        
        {
            taskId: 'mecung',
            taskName: 'Mê Cung',
            taskIcon: '<i class="fas fa-dungeon"></i>',
            hasButton: true,
            buttonText: 'Vào',
            async action() { window.location.href = '/me-cung'; }
        },
        {
            taskId: 'khoangmach',
            taskName: 'Khoáng Mạch',
            taskIcon: '<i class="fas fa-gem"></i>',
            autorunEnabled: true,
            autorunKey: 'autoKhoangMach',
            hasButton: true,
            buttonText: 'Đào',
            hasSettings: true,
            hasExtraButton: true,
            extraButtonText: 'Vào',
            extraButtonTitle: 'Vào Khoáng Mạch',
            async extraAction() { window.location.href = '/khoang-mach'; },
            async action() { await khoangmach.doKhoangMach(); }
        },
        {
            taskId: 'kmsearch',
            taskName: 'Tìm Kẻ Địch',
            taskIcon: '<i class="fas fa-search"></i>',
            hasCustomControls: true,
            hasSettings: true,
        },
        {
            taskId: 'dothach',
            taskName: 'Đổ Thạch',
            taskIcon: '<i class="fas fa-dice"></i>',
            autorunEnabled: true,
            autorunKey: 'autoDoThach',
            hasButton: true,
            buttonText: 'Cược',
            hasSelect: true,
            selectOptions: [{ value: 'tai', label: 'Tài' }, { value: 'xiu', label: 'Xỉu' }],
            async action() {
                const choice = localStorage.getItem('dice-roll-choice') || 'tai';
                await dothach.run(choice);
            }
        },
        {
            taskId: 'bicanh',
            taskName: 'Bí Cảnh',
            taskIcon: '<i class="fas fa-skull-crossbones"></i>',
            autorunEnabled: true,
            autorunKey: 'autoBiCanh',
            hasButton: true,
            buttonText: 'Đánh',
            hasInput: true,
            inputType: 'number',
            inputMin: 0,
            inputMax: 5,
            inputTitle: 'Số lượt giữ lại',
            hasToggle: true,
            toggleTitle: 'Theo dõi boss qua socket',
            async action() { await bicanh.doBiCanh(); }
        },
        {
            taskId: 'tienduyen',
            taskName: 'Tiên Duyên',
            taskIcon: '<i class="fas fa-heart"></i>',
            autorunEnabled: true,
            autorunKey: 'autoTienDuyen',
            hasButton: true,
            buttonText: 'Thực hiện',
            hasExtraButton: true,
            extraButtonText: '🙏',
            extraButtonTitle: 'Cầu Nguyện Đạo Lữ',
            hasExtra2Button: true,
            extra2ButtonText: '🌺',
            extra2ButtonTitle: 'Tặng Hoa',
            hasSelect: [
                { value: '1', label: 'tặng 1ng' },
                { value: '2', label: 'tặng 2ng' },
                { value: '3', label: 'tặng 3ng' },
                { value: '4', label: 'tặng 4ng' },
                { value: '5', label: 'tặng 5ng' }
            ],
            async action() { await tienduyen.doTienDuyen(); },
            async extraAction() {
                const accountId = await getAccountId();
                await docaunguyen(accountId);
            },
            async extra2Action() {
                const quantity = parseInt(localStorage.getItem('tienduyen-choice') || '5', 10);
                if (!tanghoa.initialized) await tanghoa.init();
                await tanghoa.run(quantity);
            }
        },
        {
            taskId: 'phaptuong',
            taskName: 'Pháp Tướng',
            taskIcon: '<i class="fas fa-fire"></i>',
            autorunEnabled: true,
            autorunKey: 'autoKhacTranVip',
            hasButton: true,
            buttonText: 'Khắc',
            hasExtraButton: true,
            extraButtonText: 'VIP',
            extraButtonTitle: 'Nhận lượt Khắc Trận VIP',
            hasExtra2Button: true,
            extra2ButtonText: 'Triệu Hồi',
            extra2ButtonTitle: 'Triệu hồi Pháp Tướng',
            async action() { await khactran.autoActivateSeal(); },
            async extraAction() {
                const accountId = await getAccountId();
                await khactran.claimDailyTurns(accountId);
            },
            async extra2Action() { await khactran.summoningPhapTuong(); }
        },
        {
            taskId: 'muadan',
            taskName: 'Mua Đan Dược',
            taskIcon: '<i class="fas fa-flask"></i>',
            hasCustomControls: true,
        },
        {
            taskId: 'hoatdongngay',
            taskName: 'Hoạt Động Ngày - Vòng Quay',
            taskIcon: '<i class="fas fa-calendar-day"></i>',
            hasButton: true,
            buttonText: 'Mở',
            hasExtraButton: true,
            extraButtonText: 'Vào',
            extraButtonTitle: 'Vào Hoạt Động Ngày',
            async action() { await hoatdongngay.doHoatDongNgay(); },
            async extraAction() { window.location.href = '/nhiem-vu-hang-ngay'; }
        }
    ];

    function createQuestSkeletonUI() {
        const questsHTML = QUEST_CONFIG.map(quest => {
            const extraControls = [];
            if (quest.hasSelect && Array.isArray(quest.selectOptions)) {
                const savedValue = localStorage.getItem(`${quest.taskId}-choice`) || quest.selectOptions[quest.selectOptions.length - 1].value;
                const optionsHTML = quest.selectOptions.map(opt => 
                    `<option value="${opt.value}" ${opt.value === savedValue ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                extraControls.push(`<select class="quest-select" data-task="${quest.taskId}">${optionsHTML}</select>`);
            }
            if (quest.hasInput) {
                const savedValue = localStorage.getItem(`reserve${quest.taskId.charAt(0).toUpperCase() + quest.taskId.slice(1)}Attacks`) || '0';
                extraControls.push(`<input type="${quest.inputType}" class="quest-input" data-task="${quest.taskId}" min="${quest.inputMin}" max="${quest.inputMax}" value="${savedValue}" title="${quest.inputTitle}" />`);
            }
            if (quest.hasToggle) {
                const savedState = localStorage.getItem(`${quest.taskId}SocketEnabled`);
                const isEnabled = savedState === '1';
                extraControls.push(`<button class="quest-toggle" data-task="${quest.taskId}" title="${quest.toggleTitle}">${isEnabled ? '🔔' : '🔕'}</button>`);
            }
            if (quest.hasSettings) {
                extraControls.push(`<button class="quest-settings-btn" data-task="${quest.taskId}" title="Cài đặt">⚙️</button>`);
            }
            if (quest.hasDamageToggle) {
                const dmgOn = localStorage.getItem('hoangvucMaximizeDamage') === 'true';
                extraControls.push(`<button class="quest-toggle hoangvuc-damage-toggle" title="Tối ưu hóa sát thương" style="background:${dmgOn ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.05)'};color:${dmgOn ? '#22c55e' : '#9ca3af'};font-size:10px;font-weight:700;min-width:34px">${dmgOn ? '+15%' : '0%'}</button>`);
            }

            let buttonHTML = '';
            if (quest.hasButton) {
                buttonHTML = `<button class="quest-action-btn" data-task="${quest.taskId}">${quest.buttonText}</button>`;
            }
            if (quest.hasCustomControls && quest.taskId === 'muadan') {
                const savedN = localStorage.getItem('mua-dan-choice') || '3';
                const tubao = localStorage.getItem('tubaoChecked') === 'true';
                const opts = [1,2,3,4,5].map(n => `<option value="${n}" ${String(n)===savedN?'selected':''}>${n}</option>`).join('');
                buttonHTML = `
                    <select class="quest-select muadan-count-select" title="Số lượng">${opts}</select>
                    <button class="quest-action-btn muadan-tong-btn" data-task="muadan" title="Mua Đan Tông Môn">🍱 Tông</button>
                    <button class="quest-action-btn muadan-tubao-btn" data-task="muadan" title="Mua Đan Tụ Bảo Các" style="background:${tubao?'linear-gradient(135deg,#f093fb,#f5576c)':'#555'}">🧄 Tụ Bảo</button>
                    <button class="quest-action-btn muadan-dancac-btn" data-task="muadan" title="Mua Đan Các (Thiên Cơ Các)" style="background:linear-gradient(135deg,#f59e0b,#d97706)">💊 Đan Các</button>
                `;
            }
            if (quest.hasCustomControls && quest.taskId === 'kmsearch') {
                const hasResults = !!sessionStorage.getItem('khoangmach_enemy_search_results');
                buttonHTML = `
                    <button class="quest-action-btn km-search-start-btn">🔍 Tìm</button>
                    <button class="quest-action-btn km-search-view-btn" ${!hasResults ? 'disabled' : ''}>📊 Kết quả</button>
                `;
            }
            if (quest.hasExtraButton) {
                buttonHTML += `<button class="quest-extra-btn" data-task="${quest.taskId}" title="${quest.extraButtonTitle}">${quest.extraButtonText}</button>`;
            }
            if (quest.hasExtra2Button) {
                buttonHTML += `<button class="quest-extra-btn quest-extra2-btn" data-task="${quest.taskId}" title="${quest.extra2ButtonTitle}">${quest.extra2ButtonText}</button>`;
            }

            let indicatorHTML = '';
            if (quest.autorunEnabled) {
                const isEnabled = localStorage.getItem(quest.autorunKey) !== '0';
                indicatorHTML = `<span class="quest-autorun-indicator ${isEnabled ? 'enabled' : 'disabled'}" data-task="${quest.taskId}"></span>`;
            }

            return `
                <div class="nv-quest-item" data-task-id="${quest.taskId}">
                    ${indicatorHTML}
                    <span class="nv-quest-icon" data-task="${quest.taskId}" style="cursor: ${quest.autorunEnabled ? 'pointer' : 'default'};" title="${quest.autorunEnabled ? 'Bấm để bật/tắt chạy tự động' : ''}">${quest.taskIcon}</span>
                    <span class="nv-quest-name">${quest.taskName}<span class="quest-progress" style="color:#9ca3af;font-size:10px;"></span></span>
                    <div class="quest-controls">
                        ${extraControls.join('')}${buttonHTML}
                    </div>
                    <div class="quest-next-time" data-task="${quest.taskId}"></div>
                </div>
            `;
        }).join('');

        return `
            <div class="nv-overview">
                <div class="nv-ov-header">
                    <h3>Nhiệm Vụ</h3>
                    <span class="quest-next-time" data-task="restart" style="font-size:10px;color:#9ca3af;flex-shrink:0;margin-right:5px"></span>
                    <span class="percent">0%</span>
                </div>
                <div class="nv-progress-bar">
                    <div class="nv-progress-fill" style="width: 0%"></div>
                </div>
                <p class="nv-ov-summary">0/5 nhiệm vụ</p>
                <div class="nv-chips"></div>
                <button class="progress-toggle-btn" onclick="
                    const details = document.querySelector('.nv-quest-details');
                    if(details) {
                        details.classList.toggle('show');
                        this.textContent = details.classList.contains('show') ? '▲ Ẩn chi tiết' : '▼ Xem chi tiết';
                    }
                ">▼ Xem chi tiết</button>
            </div>
            <div class="nv-quest-details ">${questsHTML}</div>
        `;
    }

    async function loadHH3DProfile() {
        try {
            const res = await fetch("/vip-hh3d", { credentials: "include" });
            const html = await res.text();
            const xuMatch = html.match(/id="current-coins">([\d.,]+)/);
            const xukhoaMatch = html.match(/id="current-coins-locked">([\d.,]+)/);
            const xu = xuMatch ? xuMatch[1] : "?";
            const xukhoa = xukhoaMatch ? xukhoaMatch[1] : "?";

            document.getElementById("xu-info").innerHTML = `        
                <div class="xu-display">
                    <span class="xu-left">🪙 Xu: <strong>${xu}</strong> 🔒 <strong>${xukhoa}</strong></span>
                    <span class="xu-right">
                        <span class="autorun-indicator-dot"></span>
                        <span class="autorun-icon" title="Bấm để bật/tắt tự động chạy khi tải trang"><i class="fas fa-robot"></i></span>           
                        <button id="autorun-main-btn" class="autorun-main-btn">Bắt Đầu</button>
                        <button id="profile-refresh-btn" title="Làm mới thông tin">🔄</button>
                    </span>
                </div>        
                <div id="promo-form" class="promo-form">
                    <input type="text" id="promo-code-input" placeholder="Nhập CODE" value="" />
                    <button id="promo-code-submit">💎 Hấp Thụ</button>
                    <button id="settings-btn" class="settings-btn" title="Cài đặt chung">⚙️</button>
                    <button id="guide-btn" class="settings-btn" title="Hướng dẫn sử dụng">❓</button>
                </div>
            `;

            const refreshBtn = document.getElementById('profile-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', async () => {
                    refreshBtn.textContent = '⟳';
                    refreshBtn.disabled = true;
                    await loadHH3DProfile();
                    refreshBtn.textContent = '🔄';
                    refreshBtn.disabled = false;
                    showNotification('Đã làm mới thông tin nhiệm vụ hàng ngày.', 'success', 2000);
                });
            }

            const autorunBtn = document.getElementById('autorun-main-btn');
            if (autorunBtn) {
                autorunBtn.addEventListener('click', async () => {
                    if (!window.isRunning) {
                        autorunBtn.classList.add('running');
                        autorunBtn.textContent = 'Dừng Lại';
                        if (window.hh3dAutomatic) await window.hh3dAutomatic.start();
                        window.isRunning = true;
                        showNotification('Bắt đầu chạy tự động', 'info');
                    } else {
                        autorunBtn.classList.remove('running');
                        autorunBtn.textContent = 'Bắt Đầu';
                        if (window.hh3dAutomatic) await window.hh3dAutomatic.stop();
                        window.isRunning = false;
                        showNotification('Đã dừng chạy tự động', 'info');
                    }           
                });
            }
            
            setTimeout(() => {
                const promoSubmit = document.getElementById('promo-code-submit');
                const promoInput = document.getElementById('promo-code-input');
                if (promoSubmit && promoInput) {
                    promoSubmit.addEventListener('click', async () => {
                        const code = promoInput.value.trim();
                        if (!code) { showNotification('⚠️ Vui lòng nhập mã CODE', 'warning'); return; }
                        localStorage.setItem('hh3d_promo_code', code);
                        await submitPromoCode(code);
                    });
                    promoInput.addEventListener('keypress', async (e) => {
                        if (e.key === 'Enter') {
                            const code = promoInput.value.trim();
                            if (code) {
                                localStorage.setItem('hh3d_promo_code', code);
                                await submitPromoCode(code);
                            }
                        }
                    });
                }
                
                const autorunIcon = document.querySelector('.autorun-icon');
                const autorunDot = document.querySelector('.autorun-indicator-dot');
                if (autorunIcon && autorunDot) {
                    let autorunEnabled = localStorage.getItem('autorunEnabled') !== '0';
                    autorunDot.classList.toggle('enabled', autorunEnabled);
                    autorunDot.classList.toggle('disabled', !autorunEnabled);
                    
                    autorunIcon.addEventListener('click', () => {
                        autorunEnabled = !autorunEnabled;
                        localStorage.setItem('autorunEnabled', autorunEnabled ? '1' : '0');
                        autorunDot.classList.toggle('enabled', autorunEnabled);
                        autorunDot.classList.toggle('disabled', !autorunEnabled);
                        autorunIcon.classList.toggle('enabled', autorunEnabled);
                        autorunIcon.classList.toggle('disabled', !autorunEnabled);
                        showNotification(autorunEnabled ? 'Tự động chạy khi tải trang đã được bật' : 'Tự động chạy khi tải trang đã được tắt', 'info');
                    });
                    autorunIcon.classList.toggle('enabled', autorunEnabled);
                    autorunIcon.classList.toggle('disabled', !autorunEnabled);
                    if (window.isRunning) {
                        autorunBtn.classList.add('running');
                        autorunBtn.textContent = 'Dừng Lại';
                    } else {
                        autorunBtn.classList.remove('running');
                        autorunBtn.textContent = 'Bắt Đầu';
                    }
                }
                const settingsBtn = document.getElementById('settings-btn');
                if (settingsBtn) settingsBtn.addEventListener('click', () => showQuestSettings());
                const guideBtn = document.getElementById('guide-btn');
                if (guideBtn) guideBtn.addEventListener('click', () => showGuideModal());
            }, 100);
        } catch (e) {}

        try {
            const html = await (await fetch("/nhiem-vu-hang-ngay?t=" + Date.now(), { credentials: "include" })).text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const ringLabel = doc.querySelector(".nv-ring-label");
            const percent = ringLabel ? ringLabel.textContent.trim() : "0%";
            const percentValue = parseInt(percent) || 0;
            const heading = doc.querySelector(".nv-ov-right h3");
            const summary = doc.querySelector(".nv-ov-right p");
            const headingText = heading ? heading.textContent.trim() : "Nhiệm Vụ";
            const summaryText = summary ? summary.textContent.trim() : "0/5 nhiệm vụ";
            const chips = [...doc.querySelectorAll(".nv-chip")];
            const chipsHTML = chips.map(chip => {
                const isDone = chip.classList.contains("chip-done");
                const text = chip.textContent.trim();
                return `<span class="nv-chip ${isDone ? 'chip-done' : 'chip-pend'}">${text}</span>`;
            }).join('');
            
            const isFull = percentValue >= 100;
            const progressWrap = document.getElementById("reward-progress-wrap");
            if (progressWrap) {
                const percentElem = progressWrap.querySelector('.percent');
                const progressFill = progressWrap.querySelector('.nv-progress-fill');
                const summaryElem = progressWrap.querySelector('.nv-ov-summary');
                const chipsContainer = progressWrap.querySelector('.nv-chips');
                const headingElem = progressWrap.querySelector('.nv-ov-header h3');
                
                if (percentElem) { percentElem.textContent = percent; percentElem.className = `percent ${isFull ? 'full' : ''}`; }
                if (progressFill) { progressFill.style.width = percent; progressFill.className = `nv-progress-fill ${isFull ? 'full' : ''}`; }
                if (summaryElem) summaryElem.textContent = summaryText;
                if (chipsContainer) chipsContainer.innerHTML = chipsHTML;
                if (headingElem) headingElem.textContent = headingText;
            }
            
            const quests = [...doc.querySelectorAll(".nv-quest")];
            const questNameAliases = { 'Tiên Duyên': ['Hỷ Sự Đường'] };
            const questItems = document.querySelectorAll('.nv-quest-item');
            questItems.forEach(item => {
                const nameEl = item.querySelector('.nv-quest-name');
                const progressContent = item.querySelector('.quest-progress')?.textContent || '';
                const itemName = ((nameEl?.textContent || '').replace(progressContent, '')).trim();
                const itemParts = itemName.split(',').map(s => s.trim());
                const aliases = questNameAliases[itemName] || [];
                const progressParts = [];
                let allDone = true;
                let anyMatch = false;
                
                quests.forEach(quest => {
                    const isDone = quest.classList.contains("done");
                    const name = quest.querySelector(".nv-qb h4")?.textContent.trim() || "";
                    const progress = quest.querySelector(".nv-prog-txt")?.textContent.trim() || "";
                    if (itemName.includes(name) || name.includes(itemName.split('<')[0].trim()) || itemParts.some(part => name.includes(part)) || aliases.some(alias => name.includes(alias) || alias.includes(name))) {
                        anyMatch = true;
                        if (!isDone) allDone = false;
                        if (progress) progressParts.push(progress);
                    }
                });
                
                if (anyMatch) {
                    const taskId = item.dataset.taskId;
                    const progressSpan = item.querySelector('.quest-progress');
                    let curSum = 0, maxSum = 0;
                    if (progressParts.length > 0) {
                        progressParts.forEach(p => {
                            const m = p.match(/(\d+)\s*\/\s*(\d+)/);
                            if (m) { curSum += parseInt(m[1], 10); maxSum += parseInt(m[2], 10); }
                        });
                    }
                    const isQuestCompleted = allDone || (maxSum > 0 && curSum >= maxSum);
                    if (isQuestCompleted) {
                        item.classList.add('done');
                        const syncableTasks = ['diemdanh', 'thiluyen', 'phucloi', 'hoangvuc', 'khoangmach'];
                        if (typeof accountId !== 'undefined' && accountId && syncableTasks.includes(taskId) && !taskTracker.isTaskDone(accountId, taskId)) {
                            taskTracker.markTaskDone(accountId, taskId);
                            countdownTimer.remove(taskId);
                        }
                    } else {
                        item.classList.remove('done');
                    }
                    if (progressSpan && progressParts.length > 0) {
                        let progressText = progressParts.length > 1 ? (maxSum > 0 ? ` ${curSum}/${maxSum}` : ` ${progressParts.join(' | ')}`) : ` ${progressParts[0]}`;
                        if (taskId === 'bicanh' && typeof window.bicanhBossHp === 'number') {
                            progressText += ` (${window.bicanhBossHp.toFixed(2)}% HP)`;
                        }
                        progressSpan.textContent = progressText;
                    }
                }
            });
            await updateAllQuestButtons();
        } catch (e) {}
    }

    async function updateAllQuestButtons() {
        const accountId = await getAccountId();
        if (!accountId) return;
        QUEST_CONFIG.forEach(async (quest) => {
            const button = document.querySelector(`.quest-action-btn[data-task="${quest.taskId}"]`);
            if (!button) return;
            const questItem = document.querySelector(`.nv-quest-item[data-task-id="${quest.taskId}"]`);
            switch (quest.taskId) {
                case 'diemdanh':
                case 'thiluyen':
                case 'phucloi':
                case 'hoangvuc':
                case 'khoangmach':
                case 'luotkhactranvip':
                case 'tienduyen':
                case 'phaptuong':
                case 'hoatdongngay':
                    if (taskTracker.isTaskDone(accountId, quest.taskId)) {
                        button.textContent = '✓ Xong';
                        countdownTimer.remove(quest.taskId);
                        if (questItem) questItem.classList.add('done');
                    } else {
                        button.textContent = quest.buttonText;
                        if (questItem) questItem.classList.remove('done');
                    }
                    break;
                case 'dothach':
                    const currentHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false }), 10);
                    const isBetTime = (currentHour >= 6 && currentHour < 13) || (currentHour >= 16 && currentHour < 21);
                    const status = taskTracker.getTaskStatus(accountId, 'dothach');
                    if ((status.betplaced && isBetTime) || (status.reward_claimed && !isBetTime)) {
                        button.textContent = '✓ Xong';
                    } else {
                        button.textContent = quest.buttonText;
                    }
                    break;
                case 'bicanh':
                    if (await bicanh.isDailyLimit()) {
                        button.textContent = '✓ Xong';
                        countdownTimer.remove('bicanh');
                        if (questItem) questItem.classList.add('done');
                    } else {
                        button.textContent = quest.buttonText;
                        if (questItem) questItem.classList.remove('done');
                    }
                    break;
                case 'phaptuong':
                    const isOutTurns = await khactran.checkRemainingTurns();
                    const today = new Date().toDateString();
                    const lastday = localStorage.getItem('phaptuong_lastday');
                    if (lastday !== today) {
                        button.textContent = quest.buttonText;
                        if (questItem) questItem.classList.remove('done');
                        localStorage.setItem('phaptuong_lastday', today);
                    } else {
                        if (isOutTurns) {
                            button.textContent = '✓ Xong';
                            if (questItem) questItem.classList.add('done');
                        } else {
                            button.textContent = quest.buttonText;
                            if (questItem) questItem.classList.remove('done');
                        }
                    }
                    break;
            }
        });
    }

    function attachQuestButtonHandlers() {
        document.querySelectorAll('.quest-action-btn').forEach(button => {
            const taskId = button.getAttribute('data-task');
            const questConfig = QUEST_CONFIG.find(q => q.taskId === taskId);
            if (!questConfig || !questConfig.action) return;
            button.addEventListener('click', async () => {
                const originalText = button.textContent;
                button.disabled = true;
                button.textContent = 'Đang xử lý...';
                try {
                    await questConfig.action();
                    await loadHH3DProfile();
                } catch (error) {
                    showNotification(`Lỗi khi thực hiện ${questConfig.taskName}`, 'error');
                } finally {
                    button.textContent = originalText;
                    await updateAllQuestButtons();
                    button.disabled = false;
                }
            });
        });
        
        document.querySelectorAll('.quest-extra-btn:not(.quest-extra2-btn)').forEach(button => {
            const taskId = button.getAttribute('data-task');
            const questConfig = QUEST_CONFIG.find(q => q.taskId === taskId);
            if (!questConfig || !questConfig.extraAction) return;
            button.addEventListener('click', async () => {
                button.disabled = true;
                button.textContent = '⏳';
                try {
                    await questConfig.extraAction();
                    showNotification(`${questConfig.taskName} - Extra hoàn thành`, 'success');
                } catch (error) {
                    showNotification(`Lỗi khi thực hiện extra ${questConfig.taskName}`, 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll('.quest-extra2-btn').forEach(button => {
            const taskId = button.getAttribute('data-task');
            const questConfig = QUEST_CONFIG.find(q => q.taskId === taskId);
            if (!questConfig || !questConfig.extra2Action) return;
            button.addEventListener('click', async () => {
                button.disabled = true;
                button.textContent = '⏳';
                try {
                    await questConfig.extra2Action();
                    showNotification(`${questConfig.taskName} -${questConfig.extra2ButtonTitle} hoàn thành`, 'success');
                } catch (error) {
                    showNotification(`Lỗi khi thực hiện ${questConfig.extra2ButtonTitle}`, 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });
        
        document.querySelectorAll('.quest-select').forEach(select => {
            const taskId = select.getAttribute('data-task');
            select.addEventListener('change', () => localStorage.setItem(`${taskId}-choice`, select.value));
        });
        
        document.querySelectorAll('.quest-input').forEach(input => {
            const taskId = input.getAttribute('data-task');
            input.addEventListener('input', () => {
                let value = parseInt(input.value, 10);
                if (isNaN(value)) value = 0;
                if (value < input.min) value = input.min;
                if (value > input.max) value = input.max;
                input.value = value;
                localStorage.setItem(`reserve${taskId.charAt(0).toUpperCase() + taskId.slice(1)}Attacks`, value.toString());
            });
        });
        
        document.querySelectorAll('.quest-toggle').forEach(button => {
            const taskId = button.getAttribute('data-task');
            button.addEventListener('click', () => {
                const isEnabled = button.textContent === '🔔';
                const newState = !isEnabled;
                button.textContent = newState ? '🔔' : '🔕';
                localStorage.setItem(`${taskId}SocketEnabled`, newState ? '1' : '0');
                if (taskId === 'bicanh') {
                    if (newState) {
                        if (typeof bicanhhiente !== 'undefined' && bicanhhiente.startBossSocketListener) bicanhhiente.startBossSocketListener();
                    } else {
                        if (typeof bicanhhiente !== 'undefined' && bicanhhiente.stopBossSocketListener) bicanhhiente.stopBossSocketListener();
                    }
                }
            });
        });
        
        document.querySelectorAll('.quest-settings-btn').forEach(button => {
            button.addEventListener('click', () => showQuestSettings(button.getAttribute('data-task')));
        });

        const damageToggleBtn = document.querySelector('.hoangvuc-damage-toggle');
        if (damageToggleBtn) {
            damageToggleBtn.addEventListener('click', () => {
                const current = localStorage.getItem('hoangvucMaximizeDamage') === 'true';
                const next = !current;
                localStorage.setItem('hoangvucMaximizeDamage', String(next));
                damageToggleBtn.style.background = next ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.05)';
                damageToggleBtn.style.color = next ? '#22c55e' : '#9ca3af';
                damageToggleBtn.textContent = next ? '+15%' : '0%';
                showNotification(`Tối ưu hóa sát thương: ${next ? '+15%' : '0%'}`, 'info', 1500);
            });
        }

        const muadanTongBtn = document.querySelector('.muadan-tong-btn');
        const muadanTubaoBtn = document.querySelector('.muadan-tubao-btn');
        const muadanDancacBtn = document.querySelector('.muadan-dancac-btn');
        const muadanCountSel = document.querySelector('.muadan-count-select');

        if (muadanCountSel) {
            muadanCountSel.addEventListener('change', () => localStorage.setItem('mua-dan-choice', muadanCountSel.value));
        }

        if (muadanTongBtn) {
            muadanTongBtn.addEventListener('click', async () => {
                const n = parseInt(muadanCountSel?.value || localStorage.getItem('mua-dan-choice') || '3', 10);
                muadanTongBtn.disabled = true;
                muadanTongBtn.textContent = '⏳';
                try {
                    await dantong.muaTopNDanTong(n);
                    await loadHH3DProfile();
                } catch(e) {
                    showNotification('Lỗi khi mua đan Tông Môn', 'error');
                } finally {
                    muadanTongBtn.disabled = false;
                    muadanTongBtn.textContent = '🍱 Tông';
                }
            });
        }

        if (muadanTubaoBtn) {
            muadanTubaoBtn.addEventListener('click', async () => {
                muadanTubaoBtn.disabled = true;
                muadanTubaoBtn.textContent = '⏳';
                try {
                    await dantubao.autobuyTuBao();
                    await loadHH3DProfile();
                } catch(e) {
                    showNotification('Lỗi khi mua đan Tụ Bảo Các', 'error');
                } finally {
                    muadanTubaoBtn.disabled = false;
                    muadanTubaoBtn.textContent = '🧄 Tụ Bảo';
                }
            });
        }

        if (muadanDancacBtn) {
            muadanDancacBtn.addEventListener('click', async () => {
                muadanDancacBtn.disabled = true;
                muadanDancacBtn.textContent = '⏳';
                try {
                    await dancac.autoBuyDailyBundle();
                    await loadHH3DProfile();
                } catch(e) {
                    showNotification('Lỗi khi mua Đan Các', 'error');
                } finally {
                    muadanDancacBtn.disabled = false;
                    muadanDancacBtn.textContent = '💊 Đan Các';
                }
            });
        }

        document.querySelectorAll('.nv-quest-icon[data-task]').forEach(icon => {
            const taskId = icon.getAttribute('data-task');
            const questConfig = QUEST_CONFIG.find(q => q.taskId === taskId);
            if (!questConfig || !questConfig.autorunEnabled) return;
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleQuestAutorun(taskId, questConfig.autorunKey);
            });
        });
    }

    function toggleQuestAutorun(taskId, autorunKey) {
        const indicator = document.querySelector(`.quest-autorun-indicator[data-task="${taskId}"]`);
        if (!indicator) return;
        const currentState = localStorage.getItem(autorunKey) !== '0';
        const newState = !currentState;
        localStorage.setItem(autorunKey, newState ? '1' : '0');
        indicator.classList.toggle('enabled', newState);
        indicator.classList.toggle('disabled', !newState);
        const questConfig = QUEST_CONFIG.find(q => q.taskId === taskId);
        showNotification(`${questConfig.taskName}: Đã ${newState ? 'bật' : 'tắt'} chạy tự động`, newState ? 'success' : 'info', 2000);
    }

    function showQuestSettings(taskId) {
        let modal = document.getElementById('unified-settings-modal');
        if (!modal) {
            modal = createUnifiedSettingsModal();
            document.body.appendChild(modal);
        }
        switchSettingsTab(taskId || 'general');
        modal.style.display = 'flex';
    }

    function showGuideModal() {
        let modal = document.getElementById('guide-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'guide-modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100000;';
            modal.innerHTML = `
                <div style="background:#1a1b2e;border-radius:12px;padding:20px 24px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;color:#c0caf5;font-size:13px;line-height:1.7;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid #33467C;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                        <h3 style="margin:0;color:#7aa2f7;font-size:16px;">📖 Hướng Dẫn Sử Dụng</h3>
                        <button id="guide-close-btn" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:0 4px;">&times;</button>
                    </div>
                    <div style="border-top:1px solid #33467C;padding-top:12px;">
                        <p><strong style="color:#bb9af7;">Bắt Đầu / Dừng Lại:</strong> Chạy tự động tất cả nhiệm vụ.</p>
                        <p><strong style="color:#bb9af7;">🤖:</strong> Bật/tắt chế độ tự động chạy khi load trang.</p>
                        <p><strong style="color:#bb9af7;">🔄 Nút làm mới:</strong> Tải lại thông tin xu và tiến độ nhiệm vụ.</p>
                        <p><strong style="color:#bb9af7;">⚙️ Cài đặt:</strong> Cấu hình chi tiết cho từng nhiệm vụ.</p>
                        <p><strong style="color:#bb9af7;">💎 Hấp Thụ:</strong> Nhập mã CODE để nhận thưởng.</p>
                    </div>
                </div>
            `;
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.id === 'guide-close-btn') modal.style.display = 'none';
            });
            document.body.appendChild(modal);
        } else {
            modal.style.display = 'flex';
        }
    }

    function createUnifiedSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'unified-settings-modal';
        modal.className = 'settings-modal';
        const modalContent = document.createElement('div');
        modalContent.className = 'settings-modal-content';
        modalContent.innerHTML = `
            <div class="settings-modal-header">
                <h2>⚙️ Cài đặt nhiệm vụ</h2>
                <button class="settings-close-btn" onclick="document.getElementById('unified-settings-modal').style.display='none'">&times;</button>
            </div>
            <div class="settings-tabs-container">
                <button class="settings-tab active" data-task="general" onclick="switchSettingsTab('general')">Chung</button>
                ${QUEST_CONFIG.filter(q => q.hasSettings).map(q => `<button class="settings-tab" data-task="${q.taskId}" onclick="switchSettingsTab('${q.taskId}')">${q.taskIcon} ${q.taskName}</button>`).join('')}
                <button class="settings-tab" data-task="log" onclick="switchSettingsTab('log')">Log</button>
            </div>
            <div class="settings-content-container" id="settings-content"></div>
            <div class="settings-modal-footer">
                <button class="settings-save-btn" id="settings-save-global-btn">💾 Lưu cài đặt</button>
            </div>
        `;
        modal.appendChild(modalContent);
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        setTimeout(() => {
            const svBtn = modal.querySelector('#settings-save-global-btn');
            if (svBtn) svBtn.addEventListener('click', saveAllSettings);
        }, 100);
        return modal;
    }

    function switchSettingsTab(taskId) {
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-task') === taskId);
        });
        const contentContainer = document.getElementById('settings-content');
        if (contentContainer) {
            contentContainer.innerHTML = getSettingsContentForTask(taskId);
            setTimeout(() => bindSettingsEventsForTask(taskId), 50);
        }
    }

    function getSettingsContentForTask(taskId) {
        const accountId = localStorage.getItem('hh3d_account_id') || '';
        switch(taskId) {
            case 'general':
                return `
                    <div class="settings-section">
                        <h3>Chung</h3>
                        <div class="settings-option">
                            <label>Giờ tự khởi động lại hàng ngày:</label>
                            <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
                                <input type="number" id="general-restart-hour" min="0" max="23" value="${parseInt(localStorage.getItem('selfSchedule_h') ?? '0', 10) || 0}" style="width:55px;padding:4px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:#d0d8f0;text-align:center">
                                <span>giờ</span>
                                <input type="number" id="general-restart-minute" min="0" max="59" value="${parseInt(localStorage.getItem('selfSchedule_m') ?? '30', 10)}" style="width:55px;padding:4px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:#d0d8f0;text-align:center">
                                <span>phút</span>
                            </div>
                        </div>
                        <div class="settings-option">
                            <button id="general-reset-tasks-btn" class="settings-save-btn" style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid rgba(239,68,68,0.3);width:100%">🔄 Reset trạng thái hoàn thành</button>
                        </div>
                    </div>
                `;
            case 'hoangvuc':
                return `
                    <div class="settings-section">
                        <h3>Cài đặt Hoang Vực</h3>
                        <div class="settings-option">
                            <label class="settings-checkbox-label">
                                <input type="checkbox" id="hoangvuc-maximize-damage" ${localStorage.getItem('hoangvucMaximizeDamage') === 'true' ? 'checked' : ''}>
                                <span>Tối đa hóa sát thương (buff ngũ hành)</span>
                            </label>
                        </div>
                    </div>
                `;
            case 'khoangmach':
                return `
                    <div class="settings-section">
                        <h3>Cài đặt Khoáng Mạch</h3>
                        <div class="settings-option">
                            <label class="settings-checkbox-label">
                                <input type="checkbox" id="khoangmach-fast-attack" ${localStorage.getItem('khoangmach_fast_attack') === 'true' ? 'checked' : ''}>
                                <span>Bỏ qua thời gian chờ khi tấn công</span>
                            </label>
                        </div>
                    </div>
                `;
            default:
                return `<div class="settings-section"><p>Không có cài đặt</p></div>`;
        }
    }

    function bindSettingsEventsForTask(taskId) {
        if (taskId === 'general') {
            const resetBtn = document.getElementById('general-reset-tasks-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    const accId = localStorage.getItem('hh3d_account_id') || accountId;
                    const count = taskTracker.resetAllTasks(accId);
                    showNotification(`✅ Đã reset ${count} nhiệm vụ`, 'success', 2000);
                    updateAllQuestButtons();
                });
            }
        }
    }

    function saveAllSettings() {
        const activeTab = document.querySelector('.settings-tab.active');
        if (!activeTab) return;
        const taskId = activeTab.getAttribute('data-task');
        if (taskId === 'general') {
            const h = parseInt(document.getElementById('general-restart-hour')?.value ?? '0', 10) || 0;
            const m = parseInt(document.getElementById('general-restart-minute')?.value ?? '30', 10);
            localStorage.setItem('selfSchedule_h', String(h));
            localStorage.setItem('selfSchedule_m', String(m));
            showNotification('✅ Đã lưu cài đặt!', 'success', 2000);
            setTimeout(() => document.getElementById('unified-settings-modal').style.display = 'none', 500);
        } else if (taskId === 'hoangvuc') {
            const maximizeDamage = document.getElementById('hoangvuc-maximize-damage')?.checked || false;
            localStorage.setItem('hoangvucMaximizeDamage', maximizeDamage.toString());
            showNotification('✅ Đã lưu cài đặt!', 'success', 2000);
            setTimeout(() => document.getElementById('unified-settings-modal').style.display = 'none', 500);
        }
    }

    async function submitPromoCode(promoCode) {
        try {
            const nonce = await getSecurityNonce(weburl + "linh-thach?t", "redeem_linh_thach");
            if (!nonce) return;
            const response = await fetch(ajaxUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `action=redeem_linh_thach&code=${encodeURIComponent(promoCode)}&nonce=${nonce}&lt_token=${securityToken}&hold_timestamp=${Math.floor(Date.now() / 1000)}`,
                credentials: "include"
            });
            const data = await response.json();
            if (data.success) {
                showNotification(`✅ ${data.data.message}`, 'success');
            } else {
                showNotification(`❌ ${data.data?.message || data.message}`, 'error');
            }
        } catch (e) {}
    }

    class VanDap {
        constructor() {
            this.ajaxUrl = ajaxUrl;
            this.QUESTION_DATA_URL = baseUrl + repoPath + branch + "/VanDap.json";
        }
        normalizeText(str) {
            return str.normalize("NFC").toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\s]/g, '');
        }
        async loadAnswersFromHub() {
            const res = await fetch(this.QUESTION_DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
            this.questionDataCache = await res.json();
        }
        async doVanDap(nonce) {
            const securityToken = await getSecurityToken(weburl + 'van-dap-tong-mon?t');
            try {
                await this.loadAnswersFromHub();
                const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Wp-Nonce': nonce };
                const payload = new URLSearchParams({ action: 'load_quiz_data', security_token: securityToken });
                const res = await fetch(this.ajaxUrl, { method: 'POST', headers, body: payload, credentials: 'include' });
                const data = await res.json();
                if (data.success && data.data?.completed) {
                    taskTracker.markTaskDone(accountId, 'diemdanh');
                    return;
                }
            } catch (e) {}
        }
    }

    async function doDailyCheckin(nonce) {
        try {
            await fetch(weburl + 'wp-json/hh3d/v1/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Wp-Nonce': nonce },
                body: JSON.stringify({ action: 'daily_check_in' }),
                credentials: 'include'
            });
        } catch (e) {}
    }

    async function doClanDailyCheckin(nonce) {
        try {
            const securityToken = await getSecurityToken(weburl + 'danh-sach-thanh-vien-tong-mon?t');
            await fetch(weburl + "wp-json/tong-mon/v1/te-le-tong-mon", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-WP-Nonce": nonce, "security_token": securityToken },
                body: JSON.stringify({ action: "te_le_tong_mon", security_token: securityToken }),
                credentials: "include"
            });
        } catch (e) {}
    }

    class DoThach {
        constructor() {
            this.ajaxUrl = ajaxUrl;
            this.doThachUrl = weburl + 'do-thach-hh3d?t';
        }
        async run(stoneType) {
            const securityToken = await getSecurityToken(this.doThachUrl);
            const payload = new URLSearchParams({ action: 'load_do_thach_data', security_token: securityToken });
            const res = await fetch(this.ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload, credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data.winning_stone_id) {
                const claimPayload = new URLSearchParams({ action: 'claim_do_thach_reward', security_token: securityToken });
                await fetch(this.ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: claimPayload, credentials: 'include' });
                taskTracker.updateTask(accountId, 'dothach', 'reward_claimed', true);
            }
        }
    }

    class TienDuyen {
        constructor() { this.apiUrl = weburl + "wp-json/hh3d/v1/action"; }
        async doTienDuyen() {}
    }

    class TangHoa {
        async run() {}
    }

    async function docaunguyen(accountId) {
        try {
            const nonce = await getNonce();
            await fetch(weburl + "wp-json/hh3d/v1/action", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Wp-Nonce": nonce },
                body: JSON.stringify({ action: "make_wish_tree" }),
                credentials: "include"
            });
            taskTracker.markTaskDone(accountId, "tienduyen");
        } catch (e) {}
    }

    async function doThiLuyenTongMon() {
        try {
            const securityToken = await getSecurityToken(weburl + 'thi-luyen-tong-mon-hh3d?t');
            const payload = new URLSearchParams({ action: 'open_chest_tltm', security_token: securityToken });
            const res = await fetch(ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload, credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data?.message?.includes("Đã hoàn thành")) {
                taskTracker.markTaskDone(accountId, 'thiluyen');
            }
        } catch (e) {}
    }

    async function doPhucLoiDuong() {
        try {
            const securityToken = await getSecurityToken(weburl + 'phuc-loi-duong?t');
            const payloadTime = new URLSearchParams({ action: 'get_next_time_pl', security_token: securityToken });
            const res = await fetch(ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payloadTime, credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data.chest_level >= 4) {
                taskTracker.markTaskDone(accountId, 'phucloi');
            }
        } catch (e) {}
    }

    async function phucloiclaimbonus() {}

    class BiCanh {
        constructor() { this.weburl = weburl; }
        async doBiCanh() {}
        async isDailyLimit() { return false; }
    }

    class BiCanhHienTe {
        startBossSocketListener() {}
        stopBossSocketListener() {}
    }

    class HoangVuc {
        constructor() {
            this.ajaxUrl = `${weburl}wp-content/themes/halimmovies-child/hh3d-ajax.php`;
            this.adminAjaxUrl = `${weburl}wp-admin/admin-ajax.php`;
            this.logPrefix = "[HH3D Hoang Vực]";
            this.headers = { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" };
        }
        extractAttackToken(html) {
            const m = html.match(/(?:var|let|const)\s+boss_attack_token\s*=\s*['"]([a-f0-9]+)['"]/i);
            return m ? m[1] : null;
        }
        extractElementFromHtml(html) {
            if (!html) return null;
            const elementsList = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
            for (const el of elementsList) {
                if (new RegExp(`ngu-hanh-${el}\\.(?:gif|png|webp|jpg)`, 'i').test(html)) return el;
            }
            return 'hoa';
        }
        async getMyElement(cachedHtml = null) {
            let text = cachedHtml || await (await fetch(`${weburl}hoang-vuc?t=${Date.now()}`, { credentials: 'include' })).text();
            return { element: this.extractElementFromHtml(text) || 'hoa', attackToken: this.extractAttackToken(text) };
        }
        async doHoangVuc() {
            if (taskTracker.isTaskDone(accountId, 'hoangvuc')) return true;
            const hoangVucUrl = `${weburl}hoang-vuc?t=${Date.now()}`;
            const res = await fetch(hoangVucUrl, { credentials: 'include' });
            const html = await res.text();
            const nonceMatch = html.match(/ajax_boss_nonce\s*=\s*['"]([a-f0-9]+)['"]/i);
            const nonce = nonceMatch ? nonceMatch[1] : null;
            if (!nonce) {
                taskTracker.markTaskDone(accountId, 'hoangvuc');
                return true;
            }
            const payload = new URLSearchParams({ action: 'get_boss', nonce });
            const bossRes = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
            const bossData = await bossRes.json();
            if (bossData.success && bossData.data) {
                const attackPayload = new URLSearchParams({ action: 'attack_boss', boss_id: bossData.data.id, nonce });
                await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: attackPayload, credentials: 'include' });
            }
        }
    }

    class HoangVucShop {
        async muaRuongLinhBao() {}
    }

    class DanTongShop {
        async muaTopNDanTong() {}
    }

    class DanTuBaoShop {
        async autobuyTuBao() {}
    }

    class DanCacShop {
        constructor() { this.weburl = weburl; }
        async autoBuyDailyBundle() {
            try {
                const res = await fetch(this.weburl + "wp-json/thien-co-cac/v1/get-data", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({})
                });
                const data = await res.json();
                const dailyBundleKey = data?.data?.daily_featured?.bundle_key;
                if (dailyBundleKey) {
                    await fetch(this.weburl + "wp-json/thien-co-cac/v1/buy-bundle", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ bundle_key: dailyBundleKey })
                    });
                    showNotification("✅ Mua Đan Các thành công!", "success");
                }
            } catch (e) {
                showNotification("❌ Lỗi mua Đan Các", "error");
            }
        }
    }
    const dancac = new DanCacShop();

    class KhacTranVan {
        async claimDailyTurns() { taskTracker.markTaskDone(accountId, 'luotkhactranvip'); return true; }
        async autoActivateSeal() {}
        async summoningPhapTuong() {}
        async checkRemainingTurns() { return true; }
    }

    class LuanVo {}

    function extractActionTokens(html) { return {}; }
    function extractRedeemNonce(html) { return null; }

    class KhoangMach {
        async doKhoangMach() {}
        async getAllMines() { return { optionsHtml: '', minesData: [] }; }
        async getUsersInMine() { return { users: [] }; }
        async getListTongMon() { return []; }
        async searchEnemiesInMines() { return []; }
        async showEnemySearchResults() {}
    }

    class hienTuviKhoangMach {
        async startUp() {}
        async getProfileTier() { return ''; }
    }

    class HoatDongNgay {
        async doHoatDongNgay() { taskTracker.markTaskDone(accountId, 'hoatdongngay'); }
    }

    class UIMenuStyles {
        addStyles() {
            addStyle(`
                .custom-script-menu {
                    display: flex !important; flex-direction: column !important;
                    position: absolute; background-color: #242323ff; min-width: 350px !important;
                    z-index: 99999 !important; border-radius: 5px; top: calc(100% + 6px); right: 0; padding: 8px; gap: 6px;
                }
                .custom-script-menu.hidden { visibility: hidden; opacity: 0; pointer-events: none; }
                .settings-modal { display: none; position: fixed; z-index: 999999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); justify-content: center; align-items: center; }
                .settings-modal-content { background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%); border-radius: 10px; width: 92%; max-width: 520px; max-height: 80vh; display: flex; flex-direction: column; }
                .settings-modal-header { padding: 10px 14px; border-bottom: 1px solid #3a3a4e; display: flex; justify-content: space-between; align-items: center; }
                .settings-tabs-container { display: flex; gap: 4px; padding: 7px 10px; background: #16161e; overflow-x: auto; border-bottom: 1px solid #3a3a4e; }
                .settings-tab { padding: 5px 10px; background: #2a2a3e; border: none; border-radius: 5px; color: #aaa; cursor: pointer; font-size: 12px; }
                .settings-tab.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
                .settings-content-container { flex: 1; overflow-y: auto; padding: 10px 12px; }
                .settings-modal-footer { padding: 8px 12px; border-top: 1px solid #3a3a4e; display: flex; justify-content: flex-end; }
                .settings-save-btn { padding: 7px 18px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 5px; cursor: pointer; }
                #hh3d-notification-container { position: fixed; top: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 1000000; pointer-events: none; }
                .hh3d-notification-item { padding: 10px 20px; border-radius: 5px; color: white; min-width: 250px; pointer-events: auto; }
                .hh3d-notification-item.success { background-color: #4caf50; }
                .hh3d-notification-item.warn { background-color: #ff9800; }
                .hh3d-notification-item.error { background-color: #c31004; }
                .hh3d-notification-item.info { background-color: #0066ff; }
                .nv-quest-item { position: relative; display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 4px; background: rgba(255,255,255,0.02); border-radius: 6px; }
                .nv-quest-item.done { background: rgba(34,211,160,0.12); color: #22d3a0; }
                .quest-controls { display: flex; gap: 4px; align-items: center; }
                .quest-action-btn { padding: 4px 8px; font-size: 11px; border-radius: 4px; border: none; background: linear-gradient(135deg, #667eea, #764ba2); color: white; cursor: pointer; }
                .quest-extra-btn { padding: 4px 8px; font-size: 11px; border-radius: 4px; border: none; background: linear-gradient(135deg, #f093fb, #f5576c); color: white; cursor: pointer; }
            `);
        }
    }

    class UIInitializer {
        constructor(selector, linkGroups, accountId) {
            this.selector = selector;
            this.linkGroups = linkGroups;
            this.accountId = accountId;
            this.retryInterval = 500;
            this.timeout = 15000;
            this.elapsedTime = 0;
        }
        start() {
            this.intervalId = setInterval(() => this.checkAndInsert(), this.retryInterval);
        }
        checkAndInsert() {
            const notificationsDiv = document.querySelector(this.selector);
            if (notificationsDiv) {
                clearInterval(this.intervalId);
                this.createAndInjectMenu(notificationsDiv);
            } else {
                this.elapsedTime += this.retryInterval;
                if (this.elapsedTime >= this.timeout) {
                    clearInterval(this.intervalId);
                }
            }
        }
        createAndInjectMenu(notificationsDiv) {
            const parentNavItems = notificationsDiv.parentNode;
            if (parentNavItems && parentNavItems.classList.contains("nav-items")) {
                if (document.querySelector(".custom-script-item-wrapper")) return;

                const customMenuWrapper = document.createElement("div");
                customMenuWrapper.classList.add("load-notification", "relative", "custom-script-item-wrapper");

                const newMenuButton = document.createElement("a");
                newMenuButton.href = "#";
                newMenuButton.setAttribute("data-view", "hide");

                const statusIcon = document.createElement("div");
                statusIcon.classList.add("custom-script-status-icon");
                newMenuButton.appendChild(statusIcon);

                const iconDiv = document.createElement("div");
                const iconSpan = document.createElement("span");
                iconSpan.classList.add("material-icons-round1", "material-icons-menu");
                iconSpan.textContent = "task";
                iconDiv.appendChild(iconSpan);

                const label = document.createElement('span');
                label.classList.add('nav-label');
                label.textContent = 'Auto';
                newMenuButton.appendChild(iconDiv);
                newMenuButton.appendChild(label);

                const dropdownMenu = document.createElement("div");
                dropdownMenu.className = "custom-script-menu hidden";

                const infoBox = document.createElement("div");
                infoBox.id = "autoProfileInfo";
                infoBox.innerHTML = `                
                    <div id="xu-info" class="xu-info-container"></div>
                    <div id="reward-progress-wrap" style="margin-top:6px;">${createQuestSkeletonUI()}</div>
                `;
                dropdownMenu.appendChild(infoBox);

                const statusBar = document.createElement("div");
                statusBar.className = "custom-script-status-bar";
                dropdownMenu.appendChild(statusBar);

                const footer = document.createElement("div");
                footer.className = "custom-script-footer";
                footer.innerHTML = `
                    <span class="custom-script-footer-guild">${localStorage.getItem('tm_name') || 'Tông Môn'}</span>
                    <span class="custom-script-footer-text">ㅤㅤEdited</span>
                    <span class="custom-script-footer-heart">❤</span>
                    <span class="custom-script-footer-text">by</span>
                    <span class="custom-script-footer-name">giachu</span>
                `;
                dropdownMenu.appendChild(footer);

                customMenuWrapper.appendChild(newMenuButton);
                customMenuWrapper.appendChild(dropdownMenu);
                parentNavItems.insertBefore(customMenuWrapper, notificationsDiv.nextSibling);

                newMenuButton.addEventListener("click", e => {
                    e.preventDefault();
                    dropdownMenu.classList.toggle("hidden");
                    iconSpan.textContent = dropdownMenu.classList.contains("hidden") ? "task" : "highlight_off";
                });

                setTimeout(() => {
                    attachQuestButtonHandlers();
                    loadHH3DProfile();
                }, 100);
            }
        }
        clearStatusBar() {}
    }

    class CountdownTimer {
        constructor() { this.tasks = {}; }
        set(taskName, delayMs) { this.tasks[taskName] = Date.now() + delayMs; }
        remove(taskName) { delete this.tasks[taskName]; }
        clear() { this.tasks = {}; }
    }
    const countdownTimer = new CountdownTimer();

    class AutomationManager {
        constructor() {
            this.accountId = accountId;
            this.isRunning = false;
        }
        async start() {
            this.isRunning = true;
            window.isRunning = true;
            await doDailyCheckin(await getNonce());
        }
        async stop() {
            this.isRunning = false;
            window.isRunning = false;
        }
        checkAndStart() {
            if (localStorage.getItem('autorunEnabled') === '1') {
                this.start();
            }
        }
    }

    function showNotification(message, type = 'success', duration = 3000) {
        let container = document.getElementById('hh3d-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hh3d-notification-container';
            document.body.appendChild(container);
        }
        const notification = document.createElement('div');
        notification.className = `hh3d-notification-item ${type}`;
        notification.innerHTML = message;
        container.appendChild(notification);
        setTimeout(() => notification.remove(), duration);
    }

    async function getTongMonId(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const link = doc.querySelector('.tm-guild-avatar-link');
            if (link) {
                const img = link.querySelector('img');
                if (img && img.alt) localStorage.setItem('tm_name', img.alt.trim());
            }
        } catch (e) {}
    }

    await getTongMonId(weburl + 'danh-sach-thanh-vien-tong-mon?t=' + Date.now());

    const taskTracker = new TaskTracker();
    const accountId = await getAccountId();
    const securityToken = await getSecurityToken();

    const vandap = new VanDap();
    const dothach = new DoThach();
    const hoangvuc = new HoangVuc();
    const bicanh = new BiCanh();
    const bicanhhiente = new BiCanhHienTe();
    const khoangmach = new KhoangMach();
    const hienTuviKM = new hienTuviKhoangMach();
    const hoatdongngay = new HoatDongNgay();
    const tanghoa = new TangHoa();
    const hvmuaruong = new HoangVucShop();
    const khactran = new KhacTranVan();
    const dantong = new DanTongShop();
    const dantubao = new DanTuBaoShop();
    const tienduyen = new TienDuyen();

    const uiStyles = new UIMenuStyles();
    uiStyles.addStyles();

    const possibleSelectors = [
        ".load-notification.relative",
        ".nav-items > div:last-child",
        ".nav-items",
        "header .nav-items"
    ];
    
    let targetSelector = possibleSelectors[0];
    for (const sel of possibleSelectors) {
        if (document.querySelector(sel)) {
            targetSelector = sel;
            break;
        }
    }

    const createUI = new UIInitializer(targetSelector, LINK_GROUPS, accountId);
    createUI.start();

    const automatic = new AutomationManager();
    window.hh3dAutomatic = automatic;
    window.isRunning = null;

    await new Promise(resolve => setTimeout(resolve, 1000));
    automatic.checkAndStart();
})();
