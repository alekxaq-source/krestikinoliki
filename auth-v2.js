/* Исправленная авторизация: явный вход/регистрация и надёжное восстановление */
(function () {
'use strict';
var URL_ = 'https://myqyylejoucdwqflqflm.supabase.co';
var KEY_ = 'sb_publishable_Hj0qf47fgyaFEsdHDqabmA_QBMn475u';
var recoveryMode = /type=recovery/.test(location.hash);
var recoveryWired = false;

function msg(text, kind) {
  var el = TT.$('auth-msg');
  el.textContent = text; el.className = 'msg ' + kind; el.hidden = false;
}
function target() {
  var q = new URLSearchParams(location.search), n = q.get('next');
  return n && /^[a-z0-9-]+\.html(\?[a-z0-9=&%._-]*)?$/i.test(n) ? n : 'menu.html';
}
function readable(error) {
  var m = (error && error.message) || '';
  if (/invalid login credentials/i.test(m)) return 'Неверный email или пароль. Если забыли пароль — нажмите «Не помню пароль».';
  if (/already registered|already been registered|user already registered/i.test(m)) return 'Этот email уже зарегистрирован. Нажмите «Войти» или восстановите пароль.';
  if (/at least 6/i.test(m)) return 'Пароль должен быть не короче 6 символов.';
  if (/valid email|invalid email/i.test(m)) return 'Проверьте правильность email.';
  if (/email not confirmed/i.test(m)) return 'Email ещё не подтверждён — проверьте входящие и папку «Спам».';
  if (/too many requests|rate limit|security purposes/i.test(m)) return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  return 'Ошибка: ' + m;
}
function setBusy(button, busy, busyText, normalText) {
  button.disabled = busy; button.textContent = busy ? busyText : normalText;
}
function showRecovery() {
  if (recoveryWired) return;
  recoveryWired = true; recoveryMode = true;
  TT.$('form-auth').hidden = true; TT.$('form-recovery').hidden = false;
  document.title = 'Новый пароль — Крестики-нолики';
  var h1 = document.querySelector('.auth-card h1'); if (h1) h1.textContent = 'Новый пароль';
  var sub = document.querySelector('.auth-card > .muted'); if (sub) sub.textContent = 'Придумайте новый пароль для аккаунта.';
  TT.$('form-recovery').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = TT.$('r-btn'); setBusy(btn, true, 'Сохраняем…', 'Сохранить пароль');
    TT.sb.auth.updateUser({ password: TT.$('r-pass').value }).then(function (res) {
      if (res.error) { setBusy(btn, false, '', 'Сохранить пароль'); msg(readable(res.error), 'error'); return; }
      msg('Пароль обновлён. Открываем меню…', 'info');
      setTimeout(function () { location.replace('menu.html'); }, 700);
    });
  });
}
function values() {
  var form = TT.$('form-auth');
  if (!form.reportValidity()) return null;
  return { email: TT.$('a-email').value.trim().toLowerCase(), password: TT.$('a-pass').value };
}
function wireAuth() {
  TT.$('form-auth').addEventListener('submit', function (e) {
    e.preventDefault(); var v = values(); if (!v) return;
    var btn = TT.$('a-btn'); setBusy(btn, true, 'Входим…', 'Войти');
    TT.sb.auth.signInWithPassword(v).then(function (res) {
      setBusy(btn, false, '', 'Войти');
      if (res.error) { msg(readable(res.error), 'error'); return; }
      location.replace(target());
    });
  });
  TT.$('signup-btn').addEventListener('click', function () {
    var v = values(); if (!v) return;
    var btn = TT.$('signup-btn'); setBusy(btn, true, 'Создаём…', 'Создать аккаунт');
    var name = (v.email.split('@')[0] || 'Игрок').slice(0, 30);
    TT.sb.auth.signUp({ email: v.email, password: v.password, options: { data: { display_name: name } } }).then(function (res) {
      setBusy(btn, false, '', 'Создать аккаунт');
      if (res.error) { msg(readable(res.error), 'error'); return; }
      var u = res.data && res.data.user;
      if (u && Array.isArray(u.identities) && u.identities.length === 0) {
        msg('Этот email уже зарегистрирован. Нажмите «Войти» или восстановите пароль.', 'error'); return;
      }
      if (res.data.session) { location.replace(target()); return; }
      msg('Письмо для подтверждения отправлено. Проверьте «Входящие» и «Спам».', 'info');
    });
  });
  TT.$('forgot-link').addEventListener('click', function () {
    var emailInput = TT.$('a-email');
    if (!emailInput.value.trim() || !emailInput.checkValidity()) {
      msg('Введите правильный email в поле выше.', 'info'); emailInput.focus(); return;
    }
    var email = emailInput.value.trim().toLowerCase();
    var btn = TT.$('forgot-link'); setBusy(btn, true, 'Отправляем…', 'Не помню пароль');
    TT.sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://alekxaq-source.github.io/krestikinoliki/index.html' }).then(function (res) {
      if (res.error) { setBusy(btn, false, '', 'Не помню пароль'); msg(readable(res.error), 'error'); return; }
      msg('Запрос принят. Если аккаунт существует, письмо придёт на ' + email + '. Проверьте также «Спам» и «Промоакции». Повторная отправка доступна через минуту.', 'info');
      var left = 60;
      var timer = setInterval(function () {
        left--; btn.textContent = left > 0 ? 'Повторить через ' + left + ' сек.' : 'Не помню пароль';
        if (left <= 0) { clearInterval(timer); btn.disabled = false; }
      }, 1000);
    });
  });
}

TT.initAuthPage = function (opts) {
  opts = opts || {};
  if (!window.supabase) { if (opts.onNoSdk) opts.onNoSdk(); return; }
  TT.sb = window.supabase.createClient(URL_, KEY_);
  TT.sb.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') showRecovery(); });
  if (recoveryMode) showRecovery(); else wireAuth();
  if (/error=/.test(location.hash)) msg('Ссылка устарела или уже использована. Запросите новое письмо.', 'error');
  TT.sb.auth.getSession().then(function (res) {
    if (res.data.session && !recoveryMode) location.replace(target());
  });
};
})();
