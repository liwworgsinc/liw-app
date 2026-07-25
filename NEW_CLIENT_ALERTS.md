# LIW New Client Alerts

## Live now

- Every new service request creates a staff notification in the LIW Command Center.
- The notification bell updates in real time.
- Clicking an alert opens the matching client workspace.
- Alert delivery attempts are recorded in `alert_deliveries`.

## Staff SMS destinations

- +1 347-423-9364
- +1 917-651-6823

## Supabase Edge Function

`new-client-alert` is deployed and requires an authenticated request owner or LIW staff member.

## Secrets required for SMS

Add these under Supabase **Project Settings → Edge Functions → Secrets**:

```text
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
LIW_ALERT_PHONE_NUMBERS=+13474239364,+19176516823
```

Twilio must provide the sending number in `TWILIO_FROM_NUMBER`.

## Optional email alert

```text
RESEND_API_KEY=...
LIW_ALERT_FROM_EMAIL=LIW Worgs Inc. <alerts@your-verified-domain.com>
LIW_ALERT_EMAIL=liwworgsinc@gmail.com
```

Do not commit provider secret keys to GitHub.
