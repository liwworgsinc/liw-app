import Stripe from 'npm:stripe@22';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const signature = req.headers.get('stripe-signature') || '';
  if (!stripeSecret || !webhookSecret || !signature) return new Response('Webhook configuration missing', { status: 400 });

  const stripe = new Stripe(stripeSecret);
  const cryptoProvider = Stripe.createSubtleCryptoProvider();
  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret, undefined, cryptoProvider);
  } catch (error) {
    console.error('Stripe signature verification failed', error);
    return new Response('Invalid Stripe signature', { status: 400 });
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return Response.json({ received: true, pending: true });

    const invoiceId = session.metadata?.invoice_id || session.client_reference_id || '';
    if (!invoiceId) return new Response('Invoice metadata missing', { status: 400 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const secretKey = readManagedKey('SUPABASE_SECRET_KEYS', ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']);
    if (!supabaseUrl || !secretKey) return new Response('Supabase admin configuration missing', { status: 500 });
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .select('id,invoice_number,user_id,request_id,total_cents,status')
      .eq('id', invoiceId)
      .single();
    if (invoiceError || !invoice) return new Response('Invoice not found', { status: 404 });

    const providerReference = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;
    const { data: existing } = await admin.from('payments').select('id').eq('provider_reference', providerReference).maybeSingle();
    if (existing) return Response.json({ received: true, duplicate: true });

    const amountCents = Number(session.amount_total || 0);
    const { error: insertError } = await admin.from('payments').insert({
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      amount_cents: amountCents,
      method: 'card',
      status: 'succeeded',
      provider_reference: providerReference,
      paid_at: new Date().toISOString()
    });
    if (insertError && insertError.code !== '23505') throw insertError;

    const { data: successfulPayments, error: paymentError } = await admin
      .from('payments')
      .select('amount_cents')
      .eq('invoice_id', invoice.id)
      .eq('status', 'succeeded');
    if (paymentError) throw paymentError;
    const paidTotal = (successfulPayments || []).reduce((sum, payment) => sum + Number(payment.amount_cents || 0), 0);
    const invoiceStatus = paidTotal >= Number(invoice.total_cents || 0) ? 'paid' : 'partial';

    await admin.from('invoices').update({ status: invoiceStatus, updated_at: new Date().toISOString() }).eq('id', invoice.id);
    if (invoice.request_id && invoiceStatus === 'paid') {
      await admin.from('service_requests').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', invoice.request_id).eq('status', 'payment_due');
    }

    await admin.from('activity_logs').insert({
      actor_id: null,
      request_id: invoice.request_id,
      action: 'stripe_payment_succeeded',
      metadata: { invoice_id: invoice.id, amount_cents: amountCents, provider_reference: providerReference, checkout_session_id: session.id }
    });

    if (invoiceStatus === 'paid') {
      const { data: ownerRole } = await admin.from('user_roles').select('user_id').eq('role', 'owner').limit(1).maybeSingle();
      if (ownerRole?.user_id) {
        await admin.from('portal_messages').insert({
          request_id: invoice.request_id,
          user_id: invoice.user_id,
          sender_id: ownerRole.user_id,
          direction: 'staff_to_customer',
          subject: 'Payment received',
          body: `Thank you. Your payment of $${(amountCents / 100).toFixed(2)} for INV-${String(invoice.invoice_number || 0).padStart(6, '0')} has been received.`
        });
      }
    }

    return Response.json({ received: true, invoice_id: invoice.id, invoice_status: invoiceStatus });
  } catch (error) {
    console.error('stripe-invoice-webhook', error);
    return new Response(error instanceof Error ? error.message : 'Webhook processing failed', { status: 500 });
  }
});
