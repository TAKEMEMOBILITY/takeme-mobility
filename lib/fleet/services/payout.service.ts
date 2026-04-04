import { createServiceClient } from '@/lib/supabase/service'
import { FleetError, FleetErrorCode } from '@/lib/fleet/errors'
import { createTransfer } from '@/lib/fleet/utils/stripe-connect'
import { logFleetAudit } from '@/lib/fleet/services/audit.service'

// ═══════════════════════════════════════════════════════════════════════════
// TakeMe Fleet — Payout Service
// ═══════════════════════════════════════════════════════════════════════════

// ── queuePayout ────────────────────────────────────────────────────────────

export async function queuePayout(bookingId: string) {
  const svc = createServiceClient()

  // Get booking
  const { data: booking, error: bookingErr } = await svc
    .from('rental_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (bookingErr || !booking) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Booking ${bookingId} not found`)
  }

  if (booking.status !== 'completed') {
    throw new FleetError(FleetErrorCode.INVALID_STATUS, `Booking must be completed to queue payout, current status: "${booking.status}"`)
  }

  // Idempotency — check if payout already exists
  const { data: existingPayout } = await svc
    .from('fleet_payouts')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (existingPayout) {
    return existingPayout
  }

  // Get owner profile with stripe account
  const { data: ownerProfile, error: profileErr } = await svc
    .from('fleet_owner_profiles')
    .select('owner_id, stripe_account_id, stripe_payouts_enabled')
    .eq('owner_id', booking.owner_id)
    .single()

  if (profileErr || !ownerProfile) {
    console.error('[PayoutService] Owner profile not found for owner:', booking.owner_id)
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Owner profile not found for owner ${booking.owner_id}`)
  }

  if (!ownerProfile.stripe_account_id) {
    throw new FleetError(FleetErrorCode.VALIDATION_ERROR, 'Owner does not have a Stripe account configured')
  }

  // Create commission record
  const { error: commissionErr } = await svc.from('fleet_commissions').insert({
    booking_id: bookingId,
    gross_amount_cents: booking.total_rental_cents,
    commission_rate: 0.20,
    commission_cents: booking.commission_cents,
    owner_net_cents: booking.owner_payout_cents,
  })

  if (commissionErr) {
    // Could be a unique constraint violation if already exists — log but don't fail
    console.error('[PayoutService] Failed to create commission record:', commissionErr.message)
  }

  // Create payout record
  const holdUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: payout, error: payoutErr } = await svc
    .from('fleet_payouts')
    .insert({
      owner_id: booking.owner_id,
      booking_id: bookingId,
      total_cents: booking.owner_payout_cents,
      gross_cents: booking.total_rental_cents,
      takeme_fee_cents: booking.commission_cents,
      net_cents: booking.owner_payout_cents,
      status: 'pending',
      hold_until: holdUntil,
      stripe_account_id: ownerProfile.stripe_account_id,
      stripe_transfer_group: `fleet_booking_${bookingId}`,
      retry_count: 0,
      line_items: [
        {
          booking_id: bookingId,
          gross: booking.total_rental_cents,
          fee: booking.commission_cents,
          net: booking.owner_payout_cents,
        },
      ],
    })
    .select('*')
    .single()

  if (payoutErr || !payout) {
    console.error('[PayoutService] Failed to create payout:', payoutErr?.message)
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to create payout: ${payoutErr?.message}`)
  }

  return payout
}

// ── releasePayout ──────────────────────────────────────────────────────────

export async function releasePayout(payoutId: string, adminId: string) {
  const svc = createServiceClient()

  const { data: payout, error: payoutErr } = await svc
    .from('fleet_payouts')
    .select('*')
    .eq('id', payoutId)
    .single()

  if (payoutErr || !payout) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Payout ${payoutId} not found`)
  }

  if (payout.status !== 'pending' && payout.status !== 'held') {
    throw new FleetError(FleetErrorCode.INVALID_STATUS, `Cannot release payout with status "${payout.status}"`)
  }

  // Update to processing
  await svc
    .from('fleet_payouts')
    .update({ status: 'processing', released_at: new Date().toISOString() })
    .eq('id', payoutId)

  try {
    // Execute transfer
    const transferResult = await createTransfer({
      amount: payout.net_cents,
      destinationAccountId: payout.stripe_account_id,
      transferGroup: payout.stripe_transfer_group || `fleet_booking_${payout.booking_id}`,
      bookingId: payout.booking_id,
      description: `TakeMe Fleet payout for booking ${payout.booking_id}`,
    })

    // Update payout as paid
    const { data: updated, error: updateErr } = await svc
      .from('fleet_payouts')
      .update({
        stripe_transfer_id: transferResult.transferId,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payoutId)
      .select('*')
      .single()

    if (updateErr) {
      console.error('[PayoutService] Failed to update payout after transfer:', updateErr.message)
    }

    await logFleetAudit({
      entityType: 'booking',
      entityId: payout.booking_id,
      actorId: adminId,
      actorRole: 'admin',
      event: 'completed',
      metadata: {
        reason: 'Payout released to owner',
        payoutId,
        transferId: transferResult.transferId,
        amount: payout.net_cents,
      },
    })

    return updated ?? { ...payout, status: 'paid', stripe_transfer_id: transferResult.transferId }
  } catch (err) {
    const failureMessage = err instanceof Error ? err.message : String(err)
    console.error('[PayoutService] Transfer failed for payout', payoutId, ':', failureMessage)

    const { data: failed } = await svc
      .from('fleet_payouts')
      .update({
        status: 'failed',
        failure_message: failureMessage,
        retry_count: (payout.retry_count || 0) + 1,
        next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .eq('id', payoutId)
      .select('*')
      .single()

    return failed ?? { ...payout, status: 'failed', failure_message: failureMessage }
  }
}

// ── processReadyPayouts ────────────────────────────────────────────────────

export async function processReadyPayouts() {
  const svc = createServiceClient()

  const { data: readyPayouts, error } = await svc
    .from('fleet_payouts')
    .select('*')
    .eq('status', 'pending')
    .lt('hold_until', new Date().toISOString())

  if (error) {
    console.error('[PayoutService] Failed to query ready payouts:', error.message)
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to query ready payouts: ${error.message}`)
  }

  const payouts = readyPayouts ?? []
  let processed = 0
  let failed = 0

  for (const payout of payouts) {
    try {
      // Update to processing
      await svc
        .from('fleet_payouts')
        .update({ status: 'processing', released_at: new Date().toISOString() })
        .eq('id', payout.id)

      const transferResult = await createTransfer({
        amount: payout.net_cents,
        destinationAccountId: payout.stripe_account_id,
        transferGroup: payout.stripe_transfer_group || `fleet_booking_${payout.booking_id}`,
        bookingId: payout.booking_id,
        description: `TakeMe Fleet payout for booking ${payout.booking_id}`,
      })

      await svc
        .from('fleet_payouts')
        .update({
          stripe_transfer_id: transferResult.transferId,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', payout.id)

      processed++
    } catch (err) {
      const failureMessage = err instanceof Error ? err.message : String(err)
      console.error('[PayoutService] Failed to process payout', payout.id, ':', failureMessage)

      await svc
        .from('fleet_payouts')
        .update({
          status: 'failed',
          failure_message: failureMessage,
          retry_count: (payout.retry_count || 0) + 1,
          next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq('id', payout.id)

      failed++
    }
  }

  return { processed, failed, total: payouts.length }
}

// ── handleTransferWebhook ──────────────────────────────────────────────────

export async function handleTransferWebhook(
  transferId: string,
  status: 'paid' | 'failed',
  failureCode?: string,
) {
  const svc = createServiceClient()

  const { data: payout, error } = await svc
    .from('fleet_payouts')
    .select('*')
    .eq('stripe_transfer_id', transferId)
    .single()

  if (error || !payout) {
    console.error('[PayoutService] Payout not found for transfer:', transferId)
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Payout not found for transfer ${transferId}`)
  }

  if (status === 'paid') {
    const { error: updateErr } = await svc
      .from('fleet_payouts')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payout.id)

    if (updateErr) {
      console.error('[PayoutService] Failed to update payout as paid:', updateErr.message)
    }
  } else {
    const { error: updateErr } = await svc
      .from('fleet_payouts')
      .update({
        status: 'failed',
        failure_code: failureCode ?? null,
        failure_message: `Transfer ${transferId} failed${failureCode ? `: ${failureCode}` : ''}`,
        retry_count: (payout.retry_count || 0) + 1,
        next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .eq('id', payout.id)

    if (updateErr) {
      console.error('[PayoutService] Failed to update payout as failed:', updateErr.message)
    }
  }
}

// ── listOwnerPayouts ───────────────────────────────────────────────────────

export async function listOwnerPayouts(ownerId: string) {
  const svc = createServiceClient()

  const { data, error } = await svc
    .from('fleet_payouts')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[PayoutService] Failed to list owner payouts:', error.message)
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to list owner payouts: ${error.message}`)
  }

  return data ?? []
}

// ── getPayout ──────────────────────────────────────────────────────────────

export async function getPayout(payoutId: string) {
  const svc = createServiceClient()

  const { data: payout, error } = await svc
    .from('fleet_payouts')
    .select('*')
    .eq('id', payoutId)
    .single()

  if (error || !payout) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Payout ${payoutId} not found`)
  }

  return payout
}

// ── releaseDeposit ─────────────────────────────────────────────────────────

export async function releaseDeposit(bookingId: string) {
  const svc = createServiceClient()

  const { data: deposit, error } = await svc
    .from('security_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('[PayoutService] Failed to fetch security deposit:', error.message)
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to fetch security deposit: ${error.message}`)
  }

  if (!deposit) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Security deposit not found for booking ${bookingId}`)
  }

  if (deposit.status !== 'authorized') {
    return deposit
  }

  // Update deposit status
  const { data: updated, error: updateErr } = await svc
    .from('security_deposits')
    .update({
      status: 'released',
      released_at: new Date().toISOString(),
    })
    .eq('id', deposit.id)
    .select('*')
    .single()

  if (updateErr) {
    console.error('[PayoutService] Failed to release deposit:', updateErr.message)
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to release deposit: ${updateErr.message}`)
  }

  // Cancel the Stripe payment intent if it exists
  if (deposit.stripe_payment_intent_id) {
    try {
      const { cancelFleetPaymentIntent } = await import('@/lib/fleet/utils/stripe-connect')
      await cancelFleetPaymentIntent(deposit.stripe_payment_intent_id)
    } catch (err) {
      console.error(
        '[PayoutService] Failed to cancel deposit payment intent:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  return updated
}
