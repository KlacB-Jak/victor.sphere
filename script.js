/* ==========================================================
   НИИ «СФЕРА» · Досье
   v4 · добавлена вкладка «Общие цели»
   ========================================================== */
(() => {
'use strict';

const Device = {
    isMobile: false,
    isTouch: false,
    isLowPower: false,
    reducedMotion: false,

    detect() {
        const ua = navigator.userAgent || '';
        this.isTouch = ('ontouchstart' in window)
            || (navigator.maxTouchPoints > 0)
            || (navigator.msMaxTouchPoints > 0);

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua)
            || (this.isTouch && Math.min(window.innerWidth, window.innerHeight) < 820);

        this.isLowPower = this.isMobile
            || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.reducedMotion = mq.matches;
        if (mq.addEventListener) mq.addEventListener('change', e => { this.reducedMotion = e.matches; });
    }
};
Device.detect();

/* ==========================================================
   АУДИО
   ========================================================== */
const Audio_ = {
    sounds: {},
    volume: 0.5,
    muted: false,
    ambientStarted: false,
    randomTimer: null,
    wctx: null,
    wmaster: null,
    unlocked: false,
    watchdog: null,
    lastTypeTime: 0,

    files: {
        ambient_drone:  { file: 'ambient_drone.ogg',  loop: true,  base: 0.55 },
        ambient_wind:   { file: 'ambient_wind.ogg',   loop: true,  base: 0.35 },
        sfx_heartbeat:  { file: 'sfx_heartbeat.ogg',  loop: false, base: 0.7 },
        sfx_whisper:    { file: 'sfx_whisper.ogg',    loop: false, base: 0.55 },
        sfx_static:     { file: 'sfx_static.ogg',     loop: false, base: 0.45 },
        sfx_footsteps:  { file: 'sfx_footsteps.ogg',  loop: false, base: 0.55 },
        sfx_breath:     { file: 'sfx_breath.ogg',     loop: false, base: 0.55 },
        ui_click:       { file: 'ui_click.ogg',       loop: false, base: 0.55 },
        ui_transition:  { file: 'ui_transition.ogg',  loop: false, base: 0.75 }
    },

    init() {
        if (this.ready) return;
        this.ready = true;

        for (const key in this.files) {
            const cfg = this.files[key];
            const a = new window.Audio();
            a.src = 'audio/' + cfg.file;
            a.loop = cfg.loop;
            a.preload = 'auto';
            a._base = cfg.base;
            a.setAttribute('playsinline', '');
            a.addEventListener('error', () => {});
            this.sounds[key] = a;
        }

        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) {
                this.wctx = new Ctx();
                this.wmaster = this.wctx.createGain();
                this.wmaster.gain.value = this.muted ? 0 : this.volume;
                this.wmaster.connect(this.wctx.destination);
            }
        } catch (e) {}

        this._apply();
        this._startWatchdog();
        this._setupVisibility();
    },

    setVol(v) { this.volume = Math.max(0, Math.min(1, v)); this._apply(); },
    toggleMute() { this.muted = !this.muted; this._apply(); return this.muted; },

    _apply() {
        const m = this.muted ? 0 : this.volume;
        for (const k in this.sounds) {
            const a = this.sounds[k];
            a.volume = Math.max(0, Math.min(1, (a._base || 1) * m));
        }
        if (this.wmaster) this.wmaster.gain.value = m;
    },

    play(name) {
        const a = this.sounds[name];
        if (!a) return;
        try {
            a.currentTime = 0;
            const p = a.play();
            if (p && p.catch) p.catch(() => {});
        } catch (e) {}
    },

    startAmbient() {
        if (this.ambientStarted) return;
        this.ambientStarted = true;
        this.play('ambient_drone');
        this.play('ambient_wind');
        this._scheduleRandom();
    },

    _startWatchdog() {
        if (this.watchdog) return;
        this.watchdog = setInterval(() => {
            if (!this.ambientStarted) return;
            if (this.muted) return;
            if (Device.isTouch && document.hidden) return;
            ['ambient_drone', 'ambient_wind'].forEach(k => {
                const a = this.sounds[k];
                if (!a) return;
                if (a.paused) {
                    try {
                        const p = a.play();
                        if (p && p.catch) p.catch(() => {});
                    } catch (e) {}
                }
            });
        }, 2500);
    },

    _setupVisibility() {
        const handler = () => {
            if (!Device.isTouch) return;
            if (document.hidden) {
                this._pauseAll();
            } else if (this.ambientStarted) {
                ['ambient_drone', 'ambient_wind'].forEach(k => {
                    const a = this.sounds[k];
                    if (a) {
                        try {
                            const p = a.play();
                            if (p && p.catch) p.catch(() => {});
                        } catch (e) {}
                    }
                });
            }
        };

        document.addEventListener('visibilitychange', handler);
        window.addEventListener('pagehide', () => { if (Device.isTouch) this._pauseAll(); });
        window.addEventListener('pageshow', handler);
        window.addEventListener('blur', () => { if (Device.isTouch) this._pauseAll(); });
        window.addEventListener('focus', handler);
    },

    _pauseAll() {
        for (const k in this.sounds) {
            try { this.sounds[k].pause(); } catch (e) {}
        }
    },

    _scheduleRandom() {
        const pool = ['sfx_heartbeat', 'sfx_whisper', 'sfx_static', 'sfx_footsteps', 'sfx_breath'];
        const fire = () => {
            if (!this.ambientStarted) return;
            if (Device.isTouch && document.hidden) {
                this.randomTimer = setTimeout(fire, 30000);
                return;
            }
            const name = pool[Math.floor(Math.random() * pool.length)];
            this.play(name);
            this.randomTimer = setTimeout(fire, 35000 + Math.random() * 40000);
        };
        this.randomTimer = setTimeout(fire, 30000 + Math.random() * 25000);
    },

    unlock() {
        if (this.unlocked) return;
        this.unlocked = true;
        if (this.wctx && this.wctx.state === 'suspended') {
            try { this.wctx.resume(); } catch (e) {}
        }
    },

    typeTick() {
        if (!this.wctx || this.muted) return;
        const now = this.wctx.currentTime;
        if (now - this.lastTypeTime < 0.012) return;
        this.lastTypeTime = now;

        const o = this.wctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(1400 + Math.random() * 400, now);
        o.frequency.exponentialRampToValueAtTime(400, now + 0.025);

        const g = this.wctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.015, now + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

        const f = this.wctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1200 + Math.random() * 600;
        f.Q.value = 3;

        o.connect(f).connect(g).connect(this.wmaster);
        o.start(now);
        o.stop(now + 0.05);
    },

    lineTick() {
        if (!this.wctx || this.muted) return;
        const now = this.wctx.currentTime;

        const o = this.wctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(700, now);
        o.frequency.exponentialRampToValueAtTime(180, now + 0.08);

        const g = this.wctx.createGain();
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        o.connect(g).connect(this.wmaster);
        o.start(now);
        o.stop(now + 0.15);

        const n = this.wctx.createBufferSource();
        const buf = this.wctx.createBuffer(1, Math.floor(this.wctx.sampleRate * 0.05), this.wctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        n.buffer = buf;
        const nf = this.wctx.createBiquadFilter();
        nf.type = 'highpass';
        nf.frequency.value = 3000;
        const ng = this.wctx.createGain();
        ng.gain.setValueAtTime(0.025, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        n.connect(nf).connect(ng).connect(this.wmaster);
        n.start(now);
        n.stop(now + 0.08);
    }
};

/* ==========================================================
   ПЕЧАТАЮЩИЙСЯ ТЕКСТ
   ========================================================== */
const Typewriter = {
    activeBlock: null,
    activeQueue: [],
    activeIndex: 0,
    activeChar: 0,
    activeLine: null,
    typing: false,
    timer: null,

    collectBlocks(root) {
        const list = [];
        root.querySelectorAll('.print').forEach(el => {
            if (el.dataset.lines) list.push(el);
        });
        list.sort((a, b) => {
            const pos = a.compareDocumentPosition(b);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });
        return list;
    },

    findNext(blocks) {
        for (const el of blocks) {
            if (!el.classList.contains('started')) return el;
        }
        return null;
    },

    start(el) {
        if (this.typing || !el) return;

        let lines;
        try { lines = JSON.parse(el.dataset.lines); }
        catch (e) { return; }
        if (!Array.isArray(lines) || !lines.length) return;

        el.classList.add('started', 'typing');
        el.textContent = '';

        this.activeBlock = el;
        this.activeQueue = lines;
        this.activeIndex = 0;
        this.activeChar = 0;
        this.typing = true;

        this.nextLine();
    },

    nextLine() {
        if (this.activeIndex >= this.activeQueue.length) { this.finish(); return; }

        const line = this.activeQueue[this.activeIndex];
        if (line === '') {
            this.activeBlock.appendChild(document.createElement('br'));
            this.activeIndex++;
            setTimeout(() => this.nextLine(), 60);
            return;
        }

        const span = document.createElement('span');
        span.className = 'typing-line';
        this.activeBlock.appendChild(span);

        if (this.activeIndex > 0) {
            const br = document.createElement('br');
            this.activeBlock.insertBefore(br, span);
        }

        this.activeLine = span;
        this.activeChar = 0;
        Audio_.lineTick();
        this.typeChar();
    },

    typeChar() {
        const line = this.activeQueue[this.activeIndex];

        if (this.activeChar >= line.length) {
            this.activeIndex++;
            this.activeChar = 0;
            setTimeout(() => this.nextLine(), 200);
            return;
        }

        const ch = line[this.activeChar];
        this.activeLine.textContent += ch;
        this.activeChar++;

        Audio_.typeTick();

        let speed = 14 + Math.random() * 14;
        if (ch === ',' || ch === ';' || ch === ':') speed += 80;
        if (ch === '.' || ch === '!' || ch === '?') speed += 160;
        if (ch === '—') speed += 60;
        if (ch === '«' || ch === '»') speed += 30;

        this.timer = setTimeout(() => this.typeChar(), speed);
    },

    finish() {
        if (this.activeBlock) {
            this.activeBlock.classList.remove('typing');
            this.activeBlock.classList.add('done');
        }
        this.activeBlock = null;
        this.activeQueue = [];
        this.activeIndex = 0;
        this.activeChar = 0;
        this.activeLine = null;
        this.typing = false;
        this.timer = null;
        Hint.update();
    },

    skipCurrent() {
        if (!this.typing || !this.activeBlock) return;
        clearTimeout(this.timer);

        this.activeBlock.innerHTML = '';
        const all = this.activeQueue;
        for (let i = 0; i < all.length; i++) {
            if (i > 0) this.activeBlock.appendChild(document.createElement('br'));
            const span = document.createElement('span');
            span.textContent = all[i];
            this.activeBlock.appendChild(span);
        }

        this.activeBlock.classList.remove('typing');
        this.activeBlock.classList.add('done');

        this.activeBlock = null;
        this.activeQueue = [];
        this.activeIndex = 0;
        this.activeChar = 0;
        this.activeLine = null;
        this.typing = false;
        this.timer = null;
        Hint.update();
    }
};

/* ==========================================================
   ПОДСКАЗКА
   ========================================================== */
const Hint = {
    el: null,
    currentPage: null,

    init() { this.el = document.getElementById('hintBar'); },
    setPage(page) { this.currentPage = page; this.update(); },

    update() {
        if (!this.el) return;
        if (this.currentPage !== 'dialog') {
            this.el.classList.remove('show');
            return;
        }
        const content = document.getElementById('content');
        if (!content) return;
        const blocks = Typewriter.collectBlocks(content);
        const next = Typewriter.findNext(blocks);
        if (next) this.el.classList.add('show');
        else this.el.classList.remove('show');
    }
};

/* ==========================================================
   СТРАНИЦЫ
   ========================================================== */
const Pages = {
    render(page) {
        const tpl = document.getElementById('tpl-' + page);
        const content = document.getElementById('content');
        if (!tpl || !content) return;

        content.innerHTML = tpl.innerHTML;

        Typewriter.activeBlock = null;
        Typewriter.activeQueue = [];
        Typewriter.typing = false;
        clearTimeout(Typewriter.timer);

        Hint.setPage(page);
    }
};

/* ==========================================================
   НАВИГАЦИЯ
   ========================================================== */
const Nav = {
    busy: false,
    current: null,
    scrollLockY: 0,
    validPages: ['dossier', 'dialog', 'motivation', 'goals', 'goals-shared'],

    init() {
        const initial = this._pageFromHash() || 'dossier';
        this.current = initial;
        this._paint(initial);
        Pages.render(initial);

        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-nav]');
            if (!link) return;
            e.preventDefault();
            let page = link.getAttribute('data-page');
            if (!page) {
                const href = link.getAttribute('href') || '';
                const m = href.match(/#([a-z-]+)/i);
                if (m) page = m[1];
            }
            if (!page) return;
            this.go(page);
        });

        window.addEventListener('hashchange', () => {
            const page = this._pageFromHash() || 'dossier';
            if (page !== this.current) this.load(page, false);
        });
    },

    _pageFromHash() {
        const h = (location.hash || '').replace(/^#/, '').toLowerCase();
        return this.validPages.includes(h) ? h : null;
    },

    _paint(page) {
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('is-on', t.getAttribute('data-page') === page);
        });
    },

    _lockScroll() {
        this.scrollLockY = window.scrollY || window.pageYOffset || 0;
        document.documentElement.classList.add('is-locked');
        document.body.classList.add('is-locked');
        document.body.style.top = '-' + this.scrollLockY + 'px';
    },

    _unlockScroll() {
        document.documentElement.classList.remove('is-locked');
        document.body.classList.remove('is-locked');
        document.body.style.top = '';
        window.scrollTo(0, 0);
    },

    async go(page) {
        if (this.busy) return;
        if (page === this.current) return;
        if (!this.validPages.includes(page)) return;
        this.busy = true;

        Audio_.play('ui_click');
        this._lockScroll();

        const glitch = document.getElementById('fxGlitch');
        glitch.classList.add('on');
        await new Promise(r => setTimeout(r, 180));
        glitch.classList.remove('on');

        Audio_.play('ui_transition');

        await this.load(page, true);

        window.scrollTo(0, 0);
        this._unlockScroll();

        if (page === 'dialog') {
            setTimeout(() => autoStartFirst(), 500);
        }

        this.busy = false;
    },

    async load(page, pushHash) {
        Pages.render(page);
        this.current = page;
        this._paint(page);
        if (pushHash) {
            try { history.pushState({ page }, '', '#' + page); }
            catch (e) { location.hash = '#' + page; }
        }
    }
};

/* ==========================================================
   КЛИК ПО КОНТЕНТУ
   ========================================================== */
function setupContentClick() {
    const content = document.getElementById('content');
    if (!content) return;

    content.addEventListener('click', () => {
        const blocks = Typewriter.collectBlocks(content);
        if (!blocks.length) return;

        if (Typewriter.typing) {
            Typewriter.skipCurrent();
            return;
        }
        const next = Typewriter.findNext(blocks);
        if (next) Typewriter.start(next);
    });
}

/* ==========================================================
   АВТО-СТАРТ
   ========================================================== */
function autoStartFirst() {
    if (Typewriter.typing) return;
    const content = document.getElementById('content');
    if (!content) return;
    const blocks = Typewriter.collectBlocks(content);
    if (!blocks.length) return;
    const next = Typewriter.findNext(blocks);
    if (next) Typewriter.start(next);
}

/* ==========================================================
   BOOT
   ========================================================== */
async function runBoot() {
    const log = document.getElementById('bootLog');
    const boot = document.getElementById('boot');
    if (!log || !boot) return;

    const lines = [
        'NIH-SFERA · терминал администратора',
        'инициализация сеанса...',
        'проверка целостности архива ......... OK',
        'монтирование раздела /архив ......... OK',
        'загрузка индекса дел ................ 1 200 записей',
        'проверка допуска гостя .............. разрешено',
        'дешифровка .......................... OK',
        'сигнал: слабый',
        'готово.'
    ];

    const speed = Device.isLowPower ? 80 : 140;
    for (const line of lines) {
        log.textContent += line + '\n';
        await new Promise(r => setTimeout(r, speed + Math.random() * speed * 1.3));
    }
    await new Promise(r => setTimeout(r, 700));

    boot.classList.add('done');
    setTimeout(() => boot.classList.add('hidden'), 900);
}

/* ==========================================================
   ГРОМКОСТЬ
   ========================================================== */
function setupVolume() {
    const vol = document.getElementById('vol');
    const mute = document.getElementById('muteBtn');
    if (vol) {
        const updatePct = () => vol.style.setProperty('--vol-pct', vol.value + '%');
        const handler = () => {
            Audio_.setVol(parseInt(vol.value, 10) / 100);
            updatePct();
        };
        vol.addEventListener('input', handler);
        vol.addEventListener('change', handler);
        updatePct();
        Audio_.setVol(parseInt(vol.value, 10) / 100);
    }
    if (mute) {
        mute.addEventListener('click', () => {
            const m = Audio_.toggleMute();
            mute.textContent = m ? 'unmute' : 'mute';
        });
    }
}

/* ==========================================================
   РАЗБЛОКИРОВКА АУДИО
   ========================================================== */
function setupAudioUnlock() {
    const unlock = () => {
        Audio_.init();
        Audio_.unlock();
        Audio_.startAmbient();
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('click', unlock);
    };
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('click', unlock);
}

/* ==========================================================
   ГЛАВНЫЙ ЦИКЛ
   ========================================================== */
window.addEventListener('DOMContentLoaded', async () => {
    Hint.init();
    Nav.init();
    setupVolume();
    setupContentClick();
    setupAudioUnlock();

    await runBoot();

    const shell = document.getElementById('shell');
    if (shell) shell.hidden = false;

    Hint.update();
});
})();