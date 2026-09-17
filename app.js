/* Общие утилиты игры «Крестики-нолики» (Supabase auth, звуки, доска, статистика) */
(function () {
'use strict';

var SUPABASE_URL = 'https://myqyylejoucdwqflqflm.supabase.co';
var SUPABASE_KEY = 'sb_publishable_Hj0qf47fgyaFEsdHDqabmA_QBMn475u';

var qs = new URLSearchParams(location.search);
var DEMO = qs.get('demo') === '1' || (typeof window.__FORCE_DEMO__ !== 'undefined' && window.__FORCE_DEMO__);

var TT = {
  sb: null,
  currentUser: null,
  displayName: 'Игрок',
  stats: { wins: 0, draws: 0, losses: 0 },
  DEMO: DEMO
};
window.TT = TT;

TT.$ = function (id) { return document.getElementById(id); };
TT.param = function (name) { return qs.get(name); };

function initSupabase() {
  if (TT.sb || DEMO) return TT.sb;
  if (!window.supabase) return null;
  TT.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return TT.sb;
}

/* ---------- авторизация ---------- */

function fakeDemoSession() {
  TT.currentUser = { id: 'demo-user', email: 'demo@example.com' };
  TT.displayName = 'Игрок';
}

function pageWithQuery() {
  var page = location.pathname.split('/').pop() || 'index.html';
  return page + location.search;
}

function nextTarget() {
  var n = qs.get('next');
  if (n && /^[a-z0-9-]+\.html(\?[a-z0-9=&%._-]*)?$/i.test(n)) return n;
  return 'menu.html';
}

TT.initAuthPage = function (opts) {
  opts = opts || {};
  if (!initSupabase()) {
    if (opts.onNoSdk) opts.onNoSdk();
    return;
  }
  if (/type=recovery/.test(location.hash)) {
    wireRecovery();
    return;
  }
  if (/error=/.test(location.hash)) {
    showMsg(TT.$('auth-msg'), 'Ссылка из письма устарела или уже использована. Войдите или запросите новую.', 'error');
  }
  wireAuth();
  TT.sb.auth.getSession().then(function (res) {
    if (res.data.session) location.replace(nextTarget());
  });
};

TT.requireSession = function (onReady) {
  if (DEMO) { fakeDemoSession(); onReady(); return; }
  if (!initSupabase()) { location.replace('index.html'); return; }
  TT.sb.auth.getSession().then(function (res) {
    if (!res.data.session) { location.replace('index.html?next=' + encodeURIComponent(pageWithQuery())); return; }
    TT.currentUser = res.data.session.user;
    TT.displayName = (TT.currentUser.user_metadata && TT.currentUser.user_metadata.display_name) || TT.currentUser.email || 'Игрок';
    onReady();
  });
};

TT.signOut = function () {
  if (!TT.sb) { location.href = 'index.html'; return; }
  TT.sb.auth.signOut().then(function () { location.href = 'index.html'; });
};

TT.renderUserChip = function () {
  var chip = TT.$('user-chip');
  if (!chip) return;
  chip.hidden = false;
  TT.$('avatar').textContent = (TT.displayName || '?').trim().charAt(0).toUpperCase() || '?';
  TT.$('user-name').textContent = TT.displayName;
  TT.$('sign-out').addEventListener('click', TT.signOut);
};

function showMsg(el, text, kind) {
  el.textContent = text;
  el.className = 'msg ' + kind;
  el.hidden = false;
}

function wireAuth() {
  TT.$('form-auth').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = TT.$('a-email').value.trim();
    var pass = TT.$('a-pass').value;
    var btn = TT.$('a-btn');
    btn.disabled = true; btn.textContent = 'Проверяем…';
    TT.sb.auth.signInWithPassword({ email: email, password: pass })
      .then(function (res) {
        if (!res.error) { location.replace(nextTarget()); return; }
        if (/invalid login credentials/i.test(res.error.message || '')) {
          btn.textContent = 'Создаём аккаунт…';
          var name = (email.split('@')[0] || 'Игрок').slice(0, 30);
          TT.sb.auth.signUp({
            email: email,
            password: pass,
            options: { data: { display_name: name } }
          }).then(function (su) {
            btn.disabled = false; btn.textContent = 'Продолжить';
            if (su.error) {
              if (/already registered|already been registered/i.test(su.error.message || '')) {
                showMsg(TT.$('auth-msg'), 'Неверный пароль. Если не помните его — нажмите «Не помню пароль».', 'error');
              } else {
                showMsg(TT.$('auth-msg'), humanAuthError(su.error), 'error');
              }
              return;
            }
            var u = su.data && su.data.user;
            if (u && Array.isArray(u.identities) && u.identities.length === 0) {
              showMsg(TT.$('auth-msg'), 'Неверный пароль. Если не помните его — нажмите «Не помню пароль».', 'error');
              return;
            }
            if (su.data.session) { location.replace(nextTarget()); return; }
            showMsg(TT.$('auth-msg'), 'Аккаунт создан! Мы отправили письмо — подтвердите email и возвращайтесь.', 'info');
          });
          return;
        }
        btn.disabled = false; btn.textContent = 'Продолжить';
        showMsg(TT.$('auth-msg'), humanAuthError(res.error), 'error');
      });
  });

  TT.$('forgot-link').addEventListener('click', function () {
    var email = TT.$('a-email').value.trim();
    if (!email) {
      showMsg(TT.$('auth-msg'), 'Сначала введите ваш email в поле выше.', 'info');
      TT.$('a-email').focus();
      return;
    }
    var btn = TT.$('forgot-link');
    btn.disabled = true; btn.textContent = 'Отправляем…';
    TT.sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://alekxaq-source.github.io/krestikinoliki/index.html' })
      .then(function (res) {
        btn.disabled = false; btn.textContent = 'Не помню пароль';
        if (res.error) { showMsg(TT.$('auth-msg'), humanAuthError(res.error), 'error'); return; }
        showMsg(TT.$('auth-msg'), 'Письмо со ссылкой на сброс пароля отправлено на ' + email + '.', 'info');
      });
  });
}

function wireRecovery() {
  TT.$('form-auth').hidden = true;
  TT.$('form-recovery').hidden = false;
  document.title = 'Новый пароль — Крестики-нолики';
  var h1 = document.querySelector('.auth-card h1');
  if (h1) h1.textContent = 'Новый пароль';
  var sub = document.querySelector('.auth-card > .muted');
  if (sub) sub.textContent = 'Придумайте новый пароль для вашего аккаунта.';
  TT.$('form-recovery').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = TT.$('r-btn');
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    TT.sb.auth.updateUser({ password: TT.$('r-pass').value }).then(function (res) {
      if (res.error) {
        btn.disabled = false; btn.textContent = 'Сохранить пароль';
        showMsg(TT.$('auth-msg'), humanAuthError(res.error), 'error');
        return;
      }
      showMsg(TT.$('auth-msg'), 'Пароль обновлён! Заходим…', 'info');
      setTimeout(function () { location.replace('menu.html'); }, 800);
    });
  });
}

function humanAuthError(err) {
  var m = (err && err.message) || '';
  if (/invalid login credentials/i.test(m)) return 'Неверный email или пароль.';
  if (/already registered|already been registered/i.test(m)) return 'Такой email уже зарегистрирован — попробуйте войти.';
  if (/at least 6/i.test(m)) return 'Пароль должен быть не короче 6 символов.';
  if (/valid email|invalid email/i.test(m)) return 'Похоже, email введён с ошибкой.';
  if (/email not confirmed/i.test(m)) return 'Email ещё не подтверждён — загляните в почту.';
  if (/too many requests|rate limit|security purposes/i.test(m)) return 'Слишком много попыток — подождите минуту.';
  return 'Ошибка: ' + m;
}

/* ---------- звуки (WebAudio) ---------- */
var audioCtx = null;
var SOUND_KEY = 'ttt_sound';

function isMuted() {
  try { return localStorage.getItem(SOUND_KEY) === '0'; } catch (e) { return false; }
}
function tone(freq, dur, delay, type, peak) {
  var t = audioCtx.currentTime + (delay || 0);
  var o = audioCtx.createOscillator();
  var g = audioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak || 0.12, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
TT.playSound = function (name) {
  if (isMuted()) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (name === 'x') tone(620, 0.09, 0, 'triangle', 0.1);
    else if (name === 'o') tone(430, 0.09, 0, 'triangle', 0.1);
    else if (name === 'win') { tone(523.25, 0.14, 0); tone(659.25, 0.14, 0.13); tone(783.99, 0.3, 0.26); }
    else if (name === 'lose') { tone(392, 0.16, 0); tone(311.13, 0.16, 0.15); tone(233.08, 0.34, 0.3); }
    else if (name === 'draw') tone(440, 0.28, 0, 'sine', 0.09);
  } catch (e) { /* звук недоступен */ }
};
TT.wireSoundToggle = function (btn) {
  if (!btn) return;
  var paint = function () { btn.textContent = isMuted() ? '🔇' : '🔊'; };
  btn.addEventListener('click', function () {
    try { localStorage.setItem(SOUND_KEY, isMuted() ? '1' : '0'); } catch (e) {}
    paint();
    if (!isMuted()) TT.playSound('x');
  });
  paint();
};

/* ---------- логика доски ---------- */
var WIN_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

TT.winnerOf = function (b) {
  for (var k = 0; k < WIN_LINES.length; k++) {
    var L = WIN_LINES[k], a = L[0], c = L[1], d = L[2];
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line: [a, c, d] };
  }
  return null;
};

var X_SVG = '<svg class="mark mark-x" viewBox="0 0 100 100" aria-hidden="true"><line x1="25" y1="25" x2="75" y2="75"></line><line x1="75" y1="25" x2="25" y2="75"></line></svg>';
var O_SVG = '<svg class="mark mark-o" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="27"></circle></svg>';

TT.createBoard = function (container, onCell) {
  var cells = [];
  for (var i = 0; i < 9; i++) {
    (function (idx) {
      var c = document.createElement('button');
      c.className = 'cell';
      c.type = 'button';
      c.setAttribute('role', 'gridcell');
      c.addEventListener('click', function () { onCell(idx); });
      container.appendChild(c);
      cells.push(c);
    })(i);
  }
  return {
    place: function (i, mark, instant) {
      var cell = cells[i];
      cell.innerHTML = mark === 'X' ? X_SVG : O_SVG;
      cell.classList.add('filled');
      cell.disabled = true;
      if (instant) {
        var m = cell.firstChild;
        if (m) m.style.animation = 'none';
      }
      TT.playSound(mark === 'X' ? 'x' : 'o');
    },
    highlight: function (line, player) {
      line.forEach(function (i) { cells[i].classList.add(player === 'X' ? 'win-x' : 'win-o'); });
    },
    disableAll: function () { cells.forEach(function (c) { c.disabled = true; }); },
    clear: function () {
      cells.forEach(function (c) {
        c.innerHTML = '';
        c.disabled = false;
        c.classList.remove('filled', 'win-x', 'win-o');
      });
    }
  };
};

/* ---------- статистика и лидеры ---------- */
TT.renderStats = function () {
  TT.$('st-wins').textContent = TT.stats.wins;
  TT.$('st-draws').textContent = TT.stats.draws;
  TT.$('st-losses').textContent = TT.stats.losses;
};

TT.loadStats = function () {
  if (DEMO) { TT.stats = { wins: 7, draws: 2, losses: 3 }; TT.renderStats(); return; }
  TT.sb.from('game_stats').select('*').eq('user_id', TT.currentUser.id).maybeSingle()
    .then(function (res) {
      if (res.data) TT.stats = { wins: res.data.wins, draws: res.data.draws, losses: res.data.losses };
      TT.renderStats();
    });
};

TT.recordResult = function (field) {
  if (DEMO) { TT.stats[field]++; TT.renderStats(); return; }
  TT.stats[field]++;
  TT.renderStats();
  TT.sb.from('game_stats').upsert({
    user_id: TT.currentUser.id,
    display_name: TT.displayName,
    wins: TT.stats.wins,
    draws: TT.stats.draws,
    losses: TT.stats.losses,
    updated_at: new Date().toISOString()
  }).then(function () {});
};

TT.loadLeaderboard = function (listEl, emptyEl, limit) {
  if (DEMO) {
    var demoRows = [
      { display_name: 'Аня', wins: 12, draws: 3, losses: 4 },
      { display_name: 'Игрок', wins: 7, draws: 2, losses: 3, me: true },
      { display_name: 'Макс', wins: 5, draws: 1, losses: 6 }
    ];
    paintLeaderboard(demoRows, listEl, emptyEl);
    return;
  }
  TT.sb.from('game_stats').select('display_name,wins,draws,losses,user_id')
    .order('wins', { ascending: false }).order('losses', { ascending: true }).limit(limit || 20)
    .then(function (res) {
      var rows = res.data || [];
      rows.forEach(function (r) { if (TT.currentUser && r.user_id === TT.currentUser.id) r.me = true; });
      paintLeaderboard(rows, listEl, emptyEl);
    });
};

function paintLeaderboard(rows, listEl, emptyEl) {
  listEl.innerHTML = '';
  if (!rows.length) { emptyEl.hidden = false; return; }
  emptyEl.hidden = true;
  rows.forEach(function (r, i) {
    var li = document.createElement('li');
    if (r.me) li.className = 'me';
    var rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = i + 1;
    var name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = r.display_name || 'Игрок';
    var wins = document.createElement('span');
    wins.className = 'lb-wins';
    wins.textContent = r.wins + ' 🏆';
    var sub = document.createElement('small');
    sub.textContent = ' · ничьих ' + r.draws;
    wins.appendChild(sub);
    li.appendChild(rank); li.appendChild(name); li.appendChild(wins);
    listEl.appendChild(li);
  });
}

})();
