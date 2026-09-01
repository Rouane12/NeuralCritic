# Neural Critic — Weekly Drop Delivery

## Scope

Newsletter Acquisition V1 keeps Supabase as Neural Critic's subscriber capture record. Outbound delivery uses **Resend** only after a sending domain, API key, and dedicated Weekly Drop segment are verified.

This layer does not replace `newsletter_subscribers`, Studio authentication, or the Subscriber Desk.

## Why Resend

- Supabase documents Resend as a supported Edge Function email path.
- Resend Contacts + Segments provide a dedicated Weekly Drop audience.
- Resend Broadcasts handle queueing, scheduling, unsubscribe suppression, and unsubscribe links/headers.
- Neural Critic does not need to build a second email editor or delivery queue.

## Required provider configuration

Recommended sending identity:

- sending subdomain: `updates.neuralcritic.net`
- sender example: `Neural Critic <weekly@updates.neuralcritic.net>`
- Resend segment: `Neural Critic Weekly Drop`

Required Supabase Edge Function secrets:

- `RESEND_API_KEY`
- `RESEND_NEWSLETTER_SEGMENT_ID`

The Resend API key needs **Full access** because the bridge manages Contacts and Segments as well as delivery. A sending-only key is insufficient for the reconciliation workflow.

Never expose either value to public JavaScript or commit either value to GitHub.

## Runtime contract

### Public signup

`public-actions` remains the public, origin-restricted signup gateway.

1. Validate/rate-limit the signup.
2. Save/reactivate the subscriber in Supabase.
3. If Resend is configured, create/reactivate the Resend Contact and attach it to the Weekly Drop segment.
4. A provider failure must not lose the Supabase signup. The next admin sync repairs delivery membership.

### Subscriber Desk

The private Subscriber Desk calls the `newsletter-admin` Edge Function.

Supabase's legacy platform `verify_jwt` gate is disabled for this function because the project uses current publishable keys and the handler performs its own authorization. The handler still requires a bearer user session, validates that session through `/auth/v1/user`, and then requires `editor_profiles.role = 'admin'` before any provider or subscriber operation runs.

- `status`: verifies whether the provider is configured and the Weekly Drop segment is reachable.
- `sync`: reconciles Resend opt-outs into Supabase, removes provider-only records from the dedicated segment, then ensures every Supabase subscriber has the correct provider status.
- `set_status`: changes a subscriber status in Supabase and immediately propagates that deliberate admin action to Resend when configured.

Only approved `editor_profiles.role = 'admin'` users may use `newsletter-admin`.

## Sending workflow

Before each Weekly Drop:

1. Open Subscriber Desk.
2. Confirm provider status is **READY**.
3. Click **SYNC DELIVERY LIST**.
4. Review active/unsubscribed totals.
5. Compose the edition in Resend Broadcasts for the dedicated Weekly Drop segment.
6. Include Resend's unsubscribe footer/link in every edition.
7. Send a test to the editor first.
8. Send or schedule the Broadcast only after editorial QA.
9. After delivery, sync again before the next edition so Resend opt-outs are reflected in Supabase.

Do not send a Broadcast while provider readiness is blocked or before the sending domain is verified.

## Activation checklist

1. Create the Resend account.
2. Add `updates.neuralcritic.net` (or another newsletter-only subdomain).
3. Add the required SPF/DKIM DNS records and wait for Resend verification.
4. Add DMARC where appropriate for the sending domain.
5. Create the `Neural Critic Weekly Drop` segment.
6. Create a **Full access** Resend API key for the production bridge; domain scoping is only available for sending-only keys and does not cover Contacts/Segments operations.
7. Store `RESEND_API_KEY` and `RESEND_NEWSLETTER_SEGMENT_ID` as Supabase Edge Function secrets.
8. Deploy tracked `public-actions` and `newsletter-admin` functions with the repository's `supabase/config.toml` auth settings.
9. Update the public Privacy Policy to name Resend as the active newsletter delivery processor.
10. Open Subscriber Desk and run the first sync. Existing Supabase subscribers must appear in the Weekly Drop segment.
11. Send a real test email to the editor and verify From, SPF/DKIM, links, mobile rendering, and unsubscribe behavior.
12. Only after that verification is the Weekly Drop considered live for outbound delivery.

## Compliance / trust rules

- Never send to a subscriber whose effective provider status is unsubscribed.
- A public re-subscription is an explicit reactivation and may restore provider subscription status.
- Never upload or sync unrelated email addresses into the Weekly Drop segment.
- Do not put subscriber email addresses into analytics events or application logs.
- Do not buy, scrape, or import third-party mailing lists.
- Keep editorial recommendations independent of sponsorship or affiliate arrangements.

## Current boundary

The repository can provide the bridge and admin controls before provider credentials exist, but **outbound sending remains disabled until the external Resend account/domain/API setup is actually verified**.
