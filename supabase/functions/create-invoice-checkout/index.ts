import Stripe from 'npm:stripe@22';
import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin = 'https://liwworgsinc.github.io';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function readManagedKey(jsonName: string, legacyNames: string[]): string {
  const raw = Deno.env.get(jsonName);
  if (raw) {
    try {
      const values = Object.values(JSON.parse(raw));
      if (values.length && values[0]) return String(values[0]);
    } catch (_) {
      // Fall through to legacy environment variables.
    }
  }
  for (const name of legacyNames) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return '';
}

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Sign in to pay this invoice.' });

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || '';
    if (!stripeSecret) return json(503, { error: 'Stripe is not configured yet. Please contact LIW Worgs Inc.' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const publishableKey = readManagedKey('SUPABASE_PUBLISHABLE_KEYS', ['SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY']);
    if (!supabaseUrl || !publishableKey) return json(500, { error: 'Payment service configuration is incomplete.' });

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user) return json(401, { error: 'Your session has expired. Please sign in again.' });

    const body = await req.json().catch(() => ({}));
    const invoiceId = typeof body.invoice_id === 'string' ? body.invoice_id : '';
    if (!invoiceId) return json(400, { error: 'Invoice ID is required.' });

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id,invoice_number,user_id,request_id,status,total_cents,updated_at')
      .eq('id', invoiceId)
      .single();
    if (invoiceError || !invoice) return json(404, { error: 'Invoice not found.' });
    if (invoice.user_id !== user.id) return json(403, { error: 'You cannot pay this invoice.' });
    if (invoice.status === 'paid') return json(409, { error: 'This invoice is already paid.' });
    if (invoice.status === 'void') return json(409, { error: 'This invoice has been voided.' });
    if (!['sent', 'partial', 'overdue'].includes(invoice.status)) return json(409, { error: 'This invoice is not ready for online payment.' });

    const { data: paymentRows, error: paymentsError } = await supabase
      .from('payments')
      .select('amount_cents,status')
      .eq('invoice_id', invoice.id)
      .eq('status', 'succeeded');
    if (paymentsError) return json(500, { error: 'Unable to calculate the invoice balance.' });

    const paidCents = (paymentRows || []).reduce((sum, payment) => sum + Number(payment.amount_cents || 0), 0);
    const balanceCents = Math.max(Number(invoice.total_cents || 0) - paidCents, 0);
    if (balanceCents <= 0) return json(409, { error: 'No payment is due on this invoice.' });
    if (balanceCents < 50) return json(409, { error: 'The remaining balance is below Stripe’s minimum online payment amount.' });

    const { data: profile } = await supabase.from('profiles').select('email,full_name').eq('id', user.id).maybeSingle();
    const stripe = new Stripe(stripeSecret);
    const siteUrl = (Deno.env.get('LIW_SITE_URL') || 'https://liwworgsinc.github.io/liw-app/').replace(/\/?$/, '/');
    const invoiceLabel = `INV-${String(invoice.invoice_number || 0).padStart(6, '0')}`;
    const bucket = Math.floor(Date.now() / (30 * 60 * 1000));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: profile?.email || user.email || undefined,
      client_reference_id: invoice.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: balanceCents,
          product_data: {
            name: `LIW Worgs Inc. Invoice ${invoiceLabel}`,
            description: 'Secure payment toward your LIW client invoice.'
          }
        }
      }],
      metadata: {
        invoice_id: invoice.id,
        invoice_number: String(invoice.invoice_number || ''),
        user_id: user.id,
        request_id: invoice.request_id || ''
      },
      payment_intent_data: {
        metadata: {
          invoice_id: invoice.id,
          invoice_number: String(invoice.invoice_number || ''),
          user_id: user.id
        }
      },
      success_url: `${siteUrl}portal.html?payment=success&invoice=${encodeURIComponent(invoice.id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}portal.html?payment=cancelled&invoice=${encodeURIComponent(invoice.id)}`,
      billing_address_collection: 'auto',
      submit_type: 'pay'
    }, {
      idempotencyKey: `liw-${invoice.id}-${new Date(invoice.updated_at).getTime()}-${balanceCents}-${bucket}`
    });

    return json(200, { url: session.url, checkout_session_id: session.id, balance_cents: balanceCents });
  } catch (error) {
    console.error('create-invoice-checkout', error);
    return json(500, { error: error instanceof Error ? error.message : 'Unable to create Stripe Checkout.' });
  }
});
