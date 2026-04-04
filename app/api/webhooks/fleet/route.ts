import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyFleetWebhookSignature } from '@/lib/fleet/utils/stripe-connect'
import { handleKycWebhook, syncStripeStatus } from '@/lib/fleet/services/owner.service'
import { handleTransferWebhook } from '@/lib/fleet/services/payout.service'
import { createServiceClient } from '@/lib/supabase/service'

// POST — Handle Stripe webhook events for Fleet
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    console.error('[Fleet Webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Record<string, unknown>

  try {
    const payload = await request.text()
    event = await verifyFleetWebhookSignature(payload, signature)
  } catch (error) {
    console.error('[Fleet Webhook] Signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const eventType = event.type as string
    const dataObject = (event.data as { object: Record<string, unknown> }).object

    console.log(`[Fleet Webhook] Received event: ${eventType}`)

    switch (eventType) {
      case 'identity.verification_session.verified': {
        const sessionId = dataObject.id as string
        await handleKycWebhook(sessionId, 'verified')
        console.log(`[Fleet Webhook] KYC verified for session ${sessionId}`)
        break
      }

      case 'identity.verification_session.requires_input': {
        const sessionId = dataObject.id as string
        await handleKycWebhook(sessionId, 'requires_input')
        console.log(`[Fleet Webhook] KYC requires input for session ${sessionId}`)
        break
      }

      case 'account.updated': {
        const accountId = dataObject.id as string
        const svc = createServiceClient()
        const { data: profile } = await svc
          .from('fleet_owner_profiles')
          .select('owner_id')
          .eq('stripe_account_id', accountId)
          .single()

        if (profile) {
          await syncStripeStatus(profile.owner_id)
          console.log(`[Fleet Webhook] Synced Stripe status for owner ${profile.owner_id}`)
        } else {
          console.log(`[Fleet Webhook] No owner found for Stripe account ${accountId}`)
        }
        break
      }

      case 'payment_intent.succeeded': {
        const pi = dataObject
        const metadata = pi.metadata as Record<string, string> | undefined
        if (metadata?.type === 'fleet_rental') {
          const svc = createServiceClient()
          const piId = pi.id as string

          const { data: payment } = await svc
            .from('fleet_payments')
            .select('id, booking_id, payment_type')
            .eq('stripe_payment_intent_id', piId)
            .single()

          if (payment) {
            await svc
              .from('fleet_payments')
              .update({ status: 'succeeded', succeeded_at: new Date().toISOString() })
              .eq('id', payment.id)

            if (payment.payment_type === 'booking_charge') {
              await svc
                .from('rental_bookings')
                .update({ status: 'confirmed' })
                .eq('id', payment.booking_id)
            }

            console.log(`[Fleet Webhook] Payment ${payment.id} succeeded for booking ${payment.booking_id}`)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = dataObject
        const metadata = pi.metadata as Record<string, string> | undefined
        if (metadata?.type === 'fleet_rental') {
          const svc = createServiceClient()
          const piId = pi.id as string
          const lastError = (pi.last_payment_error as Record<string, string> | undefined)

          const { data: payment } = await svc
            .from('fleet_payments')
            .select('id, booking_id')
            .eq('stripe_payment_intent_id', piId)
            .single()

          if (payment) {
            await svc
              .from('fleet_payments')
              .update({
                status: 'failed',
                failure_code: lastError?.code ?? null,
                failure_message: lastError?.message ?? null,
              })
              .eq('id', payment.id)

            await svc
              .from('rental_bookings')
              .update({ status: 'failed' })
              .eq('id', payment.booking_id)

            console.log(`[Fleet Webhook] Payment ${payment.id} failed for booking ${payment.booking_id}`)
          }
        }
        break
      }

      case 'transfer.paid': {
        const transferId = dataObject.id as string
        await handleTransferWebhook(transferId, 'paid')
        console.log(`[Fleet Webhook] Transfer ${transferId} paid`)
        break
      }

      case 'transfer.failed': {
        const transferId = dataObject.id as string
        const failureCode = (dataObject.failure_code as string) ?? undefined
        await handleTransferWebhook(transferId, 'failed', failureCode)
        console.log(`[Fleet Webhook] Transfer ${transferId} failed (code: ${failureCode})`)
        break
      }

      default:
        console.log(`[Fleet Webhook] Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[Fleet Webhook] Processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
