(function initializeSupabase() {
  'use strict';

  const config = {
    supabaseUrl: 'https://svoiyvwwvrmixnqtltlu.supabase.co',
    supabasePublishableKey: 'sb_publishable_jHQGw_yLBTUoegmUtRzOIg_duGAKqwV',
    companyName: 'LIW Worgs Inc.',
    supportEmail: 'liwworgsinc@gmail.com',
    supportPhone: '929-234-2881',
    address: '873 Liberty Ave, Brooklyn, NY 11208'
  };

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase library did not load. Check the CDN script tag.');
    return;
  }

  window.LIW_CONFIG = Object.freeze(config);
  window.liwSupabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
