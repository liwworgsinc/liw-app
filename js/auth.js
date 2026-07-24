(function authPages() {
  'use strict';

  const LIW = window.LIW;
  const db = LIW?.db;

  async function redirectSignedInUser() {
    const user = await LIW.getUser();
    if (!user) return;
    const role = await LIW.getRole(user.id);
    const fallback = ['staff', 'admin', 'owner'].includes(role) ? 'admin.html' : 'portal.html';
    window.location.replace(LIW.safeRedirectTarget(fallback));
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    submit.disabled = true;
    LIW.setLoading(true, 'Signing you in…');

    try {
      const email = form.email.value.trim();
      const password = form.password.value;
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const role = await LIW.getRole(data.user.id);
      const fallback = ['staff', 'admin', 'owner'].includes(role) ? 'admin.html' : 'portal.html';
      window.location.replace(LIW.safeRedirectTarget(fallback));
    } catch (error) {
      console.error(error);
      LIW.setLoading(false);
      await LIW.notify('error', 'Unable to sign in', error.message || 'Check your email and password.');
    } finally {
      submit.disabled = false;
      LIW.setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!form.querySelector('#termsAccepted')?.checked) {
      await LIW.notify('warning', 'Agreement required', 'Please accept the Terms of Use and Privacy Policy to continue.');
      return;
    }
    if (form.password.value !== form.confirmPassword.value) {
      await LIW.notify('warning', 'Passwords do not match', 'Please enter the same password twice.');
      return;
    }

    submit.disabled = true;
    LIW.setLoading(true, 'Creating your account…');
    try {
      const email = form.email.value.trim();
      const password = form.password.value;
      const fullName = form.fullName.value.trim();
      const phone = form.phone.value.trim();
      const redirectTo = new URL('portal.html', window.location.href).href;

      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: fullName, phone }
        }
      });
      if (error) throw error;

      if (data.session) {
        window.location.replace('intake.html');
        return;
      }

      form.reset();
      LIW.setLoading(false);
      await LIW.notify('success', 'Check your email', 'We sent a confirmation link. Open it to activate your LIW account.');
      window.location.replace('login.html');
    } catch (error) {
      console.error(error);
      LIW.setLoading(false);
      await LIW.notify('error', 'Unable to create account', error.message || 'Please try again.');
    } finally {
      submit.disabled = false;
      LIW.setLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    const result = await window.Swal.fire({
      title: 'Reset password',
      input: 'email',
      inputLabel: 'Email address',
      inputPlaceholder: 'you@example.com',
      showCancelButton: true,
      confirmButtonText: 'Send reset link',
      confirmButtonColor: '#2b3f9f',
      inputValidator: (value) => !value ? 'Enter your email address.' : undefined
    });
    if (!result.isConfirmed) return;
    LIW.setLoading(true, 'Sending reset link…');
    const redirectTo = new URL('reset-password.html', window.location.href).href;
    const { error } = await db.auth.resetPasswordForEmail(result.value, { redirectTo });
    LIW.setLoading(false);
    if (error) return LIW.notify('error', 'Unable to send link', error.message);
    return LIW.notify('success', 'Reset link sent', 'Check your inbox and spam folder.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!db) return;
    redirectSignedInUser();
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('forgotPassword')?.addEventListener('click', handleForgotPassword);
  });
})();
