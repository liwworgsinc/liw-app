-- Prevent duplicate Stripe webhook deliveries from recording the same payment twice.
create unique index if not exists payments_provider_reference_unique_idx
on public.payments(provider_reference)
where provider_reference is not null;
