/* Крестики-нолики — общий модуль: Supabase, звук, доска, статистика */
(function () {
'use strict';

var SUPABASE_URL = 'https://myqyylejoucdwqflqflm.supabase.co';
var SUPABASE_KEY = 'sb_publishable_Hj0qf47fgyaFEsdHDqabmA_QBMn475u';

window.__FORCE_DEMO__ = false;
var qs = new URLSearchParams(location.search);
var DEMO = window.__FORCE_DEMO__ || qs.has('demo');

var TT = window.TT = {};
TT.DEMO = DEMO;
TT.param = function (name) { return qs.get(name); };
TT.sb = null;
TT.currentUser = null;
TT.displayName = 'Игрок';
TT.stats = { wins: 0, draws: 0, losses: 0 };

var $ = function (id) { return document.getElementById(id); };
TT.$ = $;

TT.escapeHtml = function (s) {
  return String(s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
};

/* ---------------- sound ---------------- */
var soundOn = true;
try { soundOn = localStorage.getItem('ttt_sound') !== 'off'; } catch (e) {}
var audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq, delay, dur, type, vol) {
  if (!audioCtx) return;
  var t = audioCtx.currentTime + delay;
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol || 0.15, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

TT.playSound = function (name) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  if (name === 'x') beep(640, 0, 0.09, 'triangle', 0.18);
  else if (name === 'o') beep(430, 0, 0.09, 'triangle', 0.18);
  else if (name === 'win') { beep(523, 0, 0.12, 'sine', 0.2); beep(659, 0.12, 0.12, 'sine', 0.2); beep(784, 0.24, 0.22, 'sine', 0.22); }
  else if (name === 'lose') { beep(392, 0, 0.14, 'sine', 0.16); beep(311, 0.14, 0.14, 'sine', 0.16); beep(233, 0.28, 0.26, 'sine', 0.16); }
  else if (name === 'draw') { beep(440, 0, 0.12, 'sine', 0.15); beep(440, 0.16, 0.2, 'sine', 0.15); }
};

TT.wireSoundToggle = function (btn) {
  function render() { btn.textContent = soundOn ? '🔊' : '🔇'; }
  btn.addEventListener('click', function () {
    soundOn = !soundOn;
    try { localStorage.setItem('ttt_sound', soundOn ? 'on' : 'off'); } catch (e) {}
    render();
    if (soundOn) TT.playSound('x');
  });
  render();
};

/* ---------------- supabase & auth ---------------- */
TT.initSupabase = function () {
  if (TT.sb) return true;
  if (!window.supabase) return false;
  TT.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
};

function fillUser(session) {
  TT.currentUser = session.user;
  var meta = TT.currentUser.user_metadata || {};
  TT.displayName = meta.display_name || String(TT.currentUser.email || 'Игрок').split('@')[0];
}

TT.mapError = function (message) {
  var m = String(message || '').toLowerCase();
  if (m.indexOf('invalid login') >= 0) return 'Неверный email или пароль.';
  if (m.indexOf('already registered') >= 0 || m.indexOf('already been registered') >= 0) return 'Этот email уже зарегистрирован — попробуйте войти.';
  if (m.indexOf('at least 6') >= 0) return 'Пароль должен быть не короче 6 символов.';
  if (m.indexOf('invalid email') >= 0 || m.indexOf('unable to validate') >= 0) return 'Проверьте правильность email.';
  if (m.indexOf('email not confirmed') >= 0) return 'Email ещё не подтверждён — загляните в почту.';
  if (m.indexOf('rate limit') >= 0) return 'Слишком много попыток. Подождите минуту и повторите.';
  return 'Ошибка: ' + message;
};

/* Логика страницы входа: вкладки, формы, редирект в меню при сессии */
TT.initAuthPage = function (hooks) {
  hooks = hooks || {};
  var msgEl = $('auth-msg');
  function showMsg(t, k) { msgEl.textContent = t; msgEl.className = 'msg ' + k; msgEl.hidden = false; }
  function hideMsg() { msgEl.hidden = true; }

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.getAttribute('data-tab');
      $('form-signin').hidden = target !== 'signin';
      $('form-signup').hidden = target !== 'signup';
      hideMsg();
    });
  });

  if (DEMO) return;
  if (!TT.initSupabase()) {
    if (hooks.onNoSdk) hooks.onNoSdk();
    return;
  }

  TT.sb.auth.getSession().then(function (res) {
    if (res.data && res.data.session) location.replace('menu.html');
  });
  TT.sb.auth.onAuthStateChange(function (event, session) {
    if (session) location.replace('menu.html');
  });

  $('form-signin').addEventListener('submit', function (e) {
    e.preventDefault();
    hideMsg();
    var btn = $('si-btn');
    btn.disabled = true; btn.textContent = 'Входим…';
    TT.sb.auth.signInWithPassword({ email: $('si-email').value.trim(), password: $('si-pass').value })
      .then(function (res) {
        btn.disabled = false; btn.textContent = 'Войти';
        if (res.error) showMsg(TT.mapError(res.error.message), 'error');
      });
  });

  $('form-signup').addEventListener('submit', function (e) {
    e.preventDefault();
    hideMsg();
    var name = $('su-name').value.trim() || 'Игрок';
    var email = $('su-email').value.trim();
    var btn = $('su-btn');
    btn.disabled = true; btn.textContent = 'Создаём…';
    TT.sb.auth.signUp({
      email: email,
      password: $('su-pass').value,
      options: { data: { display_name: name } }
    }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Создать аккаунт';
      if (res.error) {
        showMsg(TT.mapError(res.error.message), 'error');
      } else if (res.data && res.data.session) {
        // вход произойдёт автоматически через onAuthStateChange
      } else {
        showMsg('Аккаунт создан! Мы отправили письмо на ' + email + ' — подтвердите адрес и войдите.', 'info');
      }
    });
  });
};

/* Внутренние страницы: без сессии уходим на вход */
TT.requireSession = function (onReady) {
  if (DEMO) {
    TT.currentUser = { id: 'demo-user' };
    TT.displayName = 'Игрок';
    onReady(TT.currentUser);
    return;
  }
  if (!TT.initSupabase()) { location.replace('index.html'); return; }
  TT.sb.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (!session) { location.replace('index.html'); return; }
    fillUser(session);
    onReady(TT.currentUser);
  });
};

TT.signOut = function () {
  if (!TT.sb) { location.href = 'index.html'; return; }
  TT.sb.auth.signOut().then(function () { location.href = 'index.html'; });
};

TT.renderUserChip = function () {
  var chip = $('user-chip');
  if (!chip) return;
  chip.hidden = false;
  $('user-name').textContent = TT.displayName;
  $('avatar').textContent = TT.displayName.trim().charAt(0).toUpperCase() || 'И';
  if (DEMO) $('sign-out').hidden = true;
  $('sign-out').addEventListener('click', TT.signOut);
};

/* ---------------- доска ---------------- */
var LINES = TT.LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

TT.winnerOf = function (b) {
  for (var k = 0; k < LINES.length; k++) {
    var a = LINES[k][0], c = LINES[k][1], d = LINES[k][2];
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line: LINES[k] };
  }
  return null;
};

function markSVG(mark) {
  if (mark === 'X') {
    return '<svg class="mark mark-x" viewBox="0 0 100 100" aria-hidden="true"><line x1="24" y1="24" x2="76" y2="76"/><line x1="76" y1="24" x2="24" y2="76"/></svg>';
  }
  return '<svg class="mark mark-o" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="28"/></svg>';
}

TT.createBoard = function (container, onCell) {
  var cells = [];
  for (var i = 0; i < 9; i++) {
    (function (idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell';
      b.setAttribute('aria-label', 'Клетка ' + (idx + 1));
      b.addEventListener('click', function () { onCell(idx); });
      container.appendChild(b);
      cells.push(b);
    })(i);
  }
  return {
    cells: cells,
    place: function (i, mark, silent) {
      cells[i].innerHTML = markSVG(mark);
      cells[i].classList.add('filled');
      cells[i].disabled = true;
      if (!silent) TT.playSound(mark === 'X' ? 'x' : 'o');
    },
    clear: function () {
      cells.forEach(function (c) { c.innerHTML = ''; c.disabled = false; c.className = 'cell'; });
    },
    highlight: function (line, mark) {
      line.forEach(function (idx) { cells[idx].classList.add(mark === 'X' ? 'win-x' : 'win-o'); });
    }
  };
};

/* ---------------- статистика и лидеры ---------------- */
TT.renderStats = function () {
  if ($('st-wins')) $('st-wins').textContent = TT.stats.wins;
  if ($('st-draws')) $('st-draws').textContent = TT.stats.draws;
  if ($('st-losses')) $('st-losses').textContent = TT.stats.losses;
};

TT.loadStats = function () {
  if (DEMO) { TT.stats = { wins: 7, draws: 2, losses: 3 }; TT.renderStats(); return; }
  if (!TT.sb || !TT.currentUser) return;
  TT.sb.from('game_stats').select('*').eq('user_id', TT.currentUser.id).maybeSingle()
    .then(function (res) {
      if (res.data) {
        TT.stats = { wins: res.data.wins, draws: res.data.draws, losses: res.data.losses };
        TT.renderStats();
      } else if (!res.error) {
        return TT.sb.from('game_stats').insert({ user_id: TT.currentUser.id, display_name: TT.displayName });
      }
    });
};

TT.recordResult = function (key) {
  TT.stats[key]++;
  TT.renderStats();
  if (DEMO || !TT.sb || !TT.currentUser) return;
  TT.sb.from('game_stats').upsert({
    user_id: TT.currentUser.id,
    display_name: TT.displayName,
    wins: TT.stats.wins,
    draws: TT.stats.draws,
    losses: TT.stats.losses,
    updated_at: new Date().toISOString()
  }).then(function () {});
};

function renderRows(olEl, emptyEl, rows) {
  olEl.innerHTML = '';
  if (emptyEl) emptyEl.hidden = rows.length > 0;
  rows.forEach(function (r, idx) {
    var li = document.createElement('li');
    if (r.me) li.className = 'me';
    li.innerHTML = '<span class="rank">' + (idx + 1) + '</span>' +
      '<span class="lb-name">' + TT.escapeHtml(r.name) + '</span>' +
      '<span class="lb-wins">' + r.wins + ' <small>побед</small></span>';
    olEl.appendChild(li);
  });
}

TT.loadLeaderboard = function (olEl, emptyEl, limit) {
  if (DEMO) {
    renderRows(olEl, emptyEl, [
      { name: 'Игрок', wins: 7, me: true },
      { name: 'Аня', wins: 5 },
      { name: 'Макс', wins: 4 },
      { name: 'София', wins: 2 },
      { name: 'Bot', wins: 1 }
    ]);
    return;
  }
  if (!TT.sb) return;
  TT.sb.from('game_stats').select('user_id, display_name, wins').order('wins', { ascending: false }).limit(limit || 10)
    .then(function (res) {
      if (res.error || !res.data) return;
      renderRows(olEl, emptyEl, res.data.map(function (r) {
        return { name: r.display_name, wins: r.wins, me: TT.currentUser && r.user_id === TT.currentUser.id };
      }));
    });
};

})();
