(function resetPasswordPage() {
  'use strict';

  const LIW = window.LIW;

  async function init() {
    const form = document.getElementById('resetPasswordForm');
    const { data } = await LIW.db.auth.getSession();
    if (!data.session) {
      document.getElementById('resetMessage').innerHTML = '<div class="alert alert-warning">This reset link is invalid or has expired. Request a new link from the sign-in page.</div>';
      form.querySelector('button').disabled = true;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.password.value !== form.confirmPassword.value) {
        return LIW.notify('warning', 'Passwords do not match', 'Enter the same password twice.');
      }
      LIW.setLoading(true, 'Updating password…');
      const { error } = await LIW.db.auth.updateUser({ password: form.password.value });
      LIW.setLoading(false);
      if (error) return LIW.notify('error', 'Unable to update password', error.message);
      await LIW.notify('success', 'Password updated', 'You can now use your new password.');
      window.location.replace('portal.html');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
