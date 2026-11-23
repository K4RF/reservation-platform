export const counters = `
  SELECT JSON_OBJECT(
    'accommodations',(SELECT COUNT(*) FROM accommodations),
    'rooms',(SELECT COUNT(*) FROM rooms),
    'media',(SELECT COUNT(*) FROM catalog_media),
    'metadata',(SELECT COUNT(*) FROM rooms WHERE metadata_bed_configuration IS NOT NULL),
    'bookingPolicies',(SELECT COUNT(*) FROM accommodation_booking_policies),
    'cancellationPolicies',(SELECT COUNT(*) FROM accommodation_cancellation_policies),
    'inventories',(SELECT COUNT(*) FROM room_inventories),
    'dailyPrices',(SELECT COUNT(*) FROM room_daily_prices),
    'members',(SELECT COUNT(*) FROM members),
    'reservations',(SELECT COUNT(*) FROM reservations),
    'confirmed',(SELECT COUNT(*) FROM reservations WHERE status='CONFIRMED'),
    'cancelled',(SELECT COUNT(*) FROM reservations WHERE status='CANCELLED'),
    'outbox',(SELECT COUNT(*) FROM reservation_outbox_events),
    'processed',(SELECT COUNT(*) FROM processed_reservation_events),
    'pending',(SELECT COUNT(*) FROM reservation_outbox_events WHERE status='PENDING'),
    'oldestPendingSeconds',(SELECT TIMESTAMPDIFF(SECOND, MIN(created_at), UTC_TIMESTAMP()) FROM reservation_outbox_events WHERE status='PENDING'),
    'unmatchedEvents',(SELECT COUNT(*) FROM reservation_outbox_events e LEFT JOIN processed_reservation_events p
      ON p.event_id=e.event_id AND p.aggregate_id=e.aggregate_id AND p.event_type=e.event_type
      WHERE p.event_id IS NULL),
    'inventoryMismatch',(SELECT COUNT(*) FROM room_inventories i WHERE i.total_quantity < i.reserved_quantity
      OR i.reserved_quantity <> (SELECT COUNT(*) FROM reservations r WHERE r.room_id=i.room_id
        AND r.status='CONFIRMED' AND i.inventory_date >= r.check_in_date AND i.inventory_date < r.check_out_date)),
    'missingInventory',(SELECT COUNT(*) FROM reservations r JOIN reservation_nights n ON n.reservation_id=r.id
      LEFT JOIN room_inventories i ON i.room_id=r.room_id AND i.inventory_date=n.stay_date WHERE i.id IS NULL),
    'snapshotMismatch',(SELECT COUNT(*) FROM reservations r WHERE
      (SELECT COUNT(*) FROM reservation_nights n WHERE n.reservation_id=r.id) <> DATEDIFF(r.check_out_date,r.check_in_date)
      OR r.total_amount <> (SELECT SUM(n.price_snapshot) FROM reservation_nights n WHERE n.reservation_id=r.id)
      OR NOT EXISTS (SELECT 1 FROM reservation_nights n WHERE n.reservation_id=r.id AND n.stay_date=r.check_in_date
        AND n.price_snapshot=r.nightly_price_snapshot)
      OR EXISTS (SELECT 1 FROM reservation_nights n JOIN rooms t ON t.id = r.room_id
        LEFT JOIN room_daily_prices p ON p.room_id=r.room_id AND p.stay_date=n.stay_date
        WHERE n.reservation_id=r.id AND (n.stay_date < r.check_in_date OR n.stay_date >= r.check_out_date
          OR n.price_snapshot <> COALESCE(p.nightly_price,t.nightly_price)))
      OR (r.status='CANCELLED' AND (r.cancelled_at IS NULL OR r.cancellation_fee_amount IS NULL OR r.refund_amount IS NULL
        OR r.cancellation_fee_amount + r.refund_amount <> r.total_amount))),
    'unexpectedOwner',(SELECT COUNT(*) FROM reservations r JOIN members m ON m.id=r.member_id WHERE m.role <> 'USER')
  );`;

export function checkInvariants(before, after, results, profile) {
  const success = (name) => results.operations?.[name]?.success ?? 0;
  const creates = success("reservation.create");
  const changes = success("reservation.change");
  const cancels = success("reservation.cancel");
  const expectedEvents = before.outbox + creates + changes + cancels;
  if (after.pending || after.unmatchedEvents || after.inventoryMismatch || after.missingInventory ||
      after.snapshotMismatch || after.unexpectedOwner ||
      after.reservations !== before.reservations + creates ||
      after.confirmed !== before.confirmed + creates - cancels ||
      after.cancelled !== before.cancelled + cancels ||
      after.outbox !== expectedEvents || after.processed !== expectedEvents)
    throw new Error("Post-run DB accounting mismatch");
  if (profile === "exhaustion" && (creates !== 1 ||
      results.operations["reservation.create"].expected_rejection !== 3))
    throw new Error("Last-unit outcome mismatch");
  if (profile !== "exhaustion" && (creates !== changes || changes !== cancels))
    throw new Error("Reservation lifecycle did not complete");
}
