/* ==========================================================================
   auth.js — login and registration forms.
   ========================================================================== */

(() => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (!loginForm && !registerForm) return;

  const nextTarget = safeNext(new URLSearchParams(window.location.search).get('next'), '/');

  function slot(form, name) {
    return form.querySelector(`[data-error="${name}"]`);
  }

  function setError(form, name, message) {
    const target = slot(form, name);
    if (target) target.textContent = message || '';
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.classList.toggle('is-invalid', Boolean(message));
  }

  function clearErrors(form) {
    form.querySelectorAll('[data-error]').forEach((node) => (node.textContent = ''));
    form.querySelectorAll('.is-invalid').forEach((node) => node.classList.remove('is-invalid'));
    const banner = form.querySelector('[data-banner]');
    if (banner) banner.hidden = true;
  }

  function showBanner(form, message) {
    const banner = form.querySelector('[data-banner]');
    if (!banner) return;
    banner.textContent = message;
    banner.hidden = false;
  }

  function busy(button, label) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.textContent = label;
  }

  function idle(button) {
    button.disabled = false;
    button.textContent = button.dataset.label || 'Submit';
  }

  /* --------------------------------------------------------------- login -- */

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(loginForm);

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;
      const button = loginForm.querySelector('button[type="submit"]');

      if (!email) {
        setError(loginForm, 'email', 'Enter your email address.');
        return;
      }
      if (!password) {
        setError(loginForm, 'password', 'Enter your password.');
        return;
      }

      busy(button, 'Logging in…');

      try {
        const payload = await API.post('/api/auth/login', { email, password });
        App.toast(`Welcome back, ${payload.user.fullName.split(' ')[0]}!`);
        window.location.href = nextTarget;
      } catch (error) {
        showBanner(loginForm, error.message);
        idle(button);
      }
    });
  }

  /* ------------------------------------------------------------ register -- */

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(registerForm);

      const form = registerForm;
      const values = {
        studentId: form.studentId.value.trim(),
        fullName: form.fullName.value.trim(),
        email: form.email.value.trim(),
        program: form.program.value.trim(),
        yearLevel: form.yearLevel.value,
        password: form.password.value,
      };
      const confirm = form.confirmPassword.value;
      const button = form.querySelector('button[type="submit"]');

      let valid = true;

      if (!values.studentId) {
        setError(form, 'studentId', 'Student ID is required.');
        valid = false;
      }
      if (values.fullName.length < 2) {
        setError(form, 'fullName', 'Enter your full name.');
        valid = false;
      }
      if (!values.email) {
        setError(form, 'email', 'Email is required.');
        valid = false;
      } else if (!values.email.toLowerCase().endsWith('@' + (form.dataset.domain || 'batstate-u.edu.ph'))) {
        setError(form, 'email', `Use your @${form.dataset.domain || 'batstate-u.edu.ph'} email.`);
        valid = false;
      }
      if (values.password.length < 8) {
        setError(form, 'password', 'Password must be at least 8 characters.');
        valid = false;
      }
      if (confirm !== values.password) {
        setError(form, 'confirmPassword', 'Passwords do not match.');
        valid = false;
      }

      if (!valid) return;

      busy(button, 'Creating account…');

      try {
        const payload = await API.post('/api/auth/register', values);
        App.toast(`Account created. Welcome, ${payload.user.fullName.split(' ')[0]}!`);
        window.location.href = nextTarget;
      } catch (error) {
        showBanner(form, error.message);
        idle(button);
      }
    });
  }
})();
