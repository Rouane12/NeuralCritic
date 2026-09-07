# Neural Critic — Weekly Drop Delivery

## Scope

Newsletter Acquisition V1 keeps Supabase as Neural Critic's subscriber capture record. Outbound delivery uses **Resend** with a verified newsletter sending domain, production API key, and dedicated Weekly Drop segment.

This layer does not replace `newsletter_subscribers`, Studio authentication, or the Subscriber Desk.

## Why Resend

- Supabase documents Resend as a supported Edge Function email path.
- Resend Contacts + Segments provide a dedicated Weekly Drop audience.
- Resend Broadcasts handle queueing, scheduling, unsubscribe suppression, and unsubscribe links/headers.
- Neural Critic does not need to build a second email editor or delivery queue.

## Production configuration

Sending identity:

- sending subdomain: `updates.neuralcritic.net`
- sender: `Neural Critic <weekly@updates.neuralcritic.net>`
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
3. Create/reactivate the Resend Contact and attach it to the Weekly Drop segment when provider configuration is available.
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

## Activation verification — COMPLETE 2026-09-07

The production delivery path has been activated and verified:

- `updates.neuralcritic.net` is verified in Resend and sending is enabled.
- `Neural Critic Weekly Drop` exists as the dedicated production segment.
- the production Resend API key is present and the deployed Supabase bridge is successfully calling the provider.
- all three then-current active Supabase subscribers were present in the production Weekly Drop segment.
- `public-actions` successfully synced a new homepage signup into Resend on 2026-09-06.
- the public Privacy Policy was updated on 2026-09-07 to name Resend and explain delivery-list / unsubscribe processing.
- a dedicated `Neural Critic Weekly Drop — Editor Test` segment was created so QA could run without sending to the full subscriber list.
- controlled broadcast `Weekly Drop Delivery Test — Sep 7, 2026` was sent from `Neural Critic <weekly@updates.neuralcritic.net>` to the editor test address.
- Resend recorded the broadcast as `sent` at `2026-09-07 04:11:17.505447+00`.
- the editor supplied visual confirmation that the message reached Gmail inbox, rendered correctly, showed the expected sender identity, displayed the Neural Critic link, and rendered an unsubscribe link.

This verifies the core outbound Weekly Drop delivery path end to end. A future QA pass may deliberately test the unsubscribe round-trip using a disposable/test contact before a larger production send; do not unsubscribe a real reader solely for testing.

## Compliance / trust rules

- Never send to a subscriber whose effective provider status is unsubscribed.
- A public re-subscription is an explicit reactivation and may restore provider subscription status.
- Never upload or sync unrelated email addresses into the Weekly Drop segment.
- Do not put subscriber email addresses into analytics events or application logs.
- Do not buy, scrape, or import third-party mailing lists.
- Keep editorial recommendations independent of sponsorship or affiliate arrangements.

## Current boundary

**Newsletter Delivery V1 is live for outbound delivery.** The production domain, sender identity, audience bridge, Privacy disclosure, and controlled editor delivery test are verified. Continue to use the Subscriber Desk → sync → editor test → Resend Broadcast workflow for each Weekly Drop.
