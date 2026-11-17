import test from 'node:test'
import assert from 'node:assert/strict'
import { useBookings } from '../src/composables/useBookings.js'
import { dateKey, formatDate, slotStatus } from '../src/schedule.js'
const future = { id: 1, starts_at: '2099-06-01T09:00:00+03:00', timezone: 'Europe/Moscow', status: 'available' }
const payload = { slot_id: 1, customer_name: 'Test', customer_email: 'test@example.com' }
function mock(sequence) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method ?? 'GET'])
    const next = sequence.shift()
    if (next instanceof Error) throw next
    assert.ok(next, 'Unexpected request')
    return new Response(next[1] === undefined ? null : JSON.stringify(next[1]), { status: next[0] })
  }
  return calls
}
test('explicit schedule timezone and past priority', () => {
  assert.equal(dateKey({ ...future, starts_at: '2030-06-01T23:00:00Z' }), '2030-06-02')
  assert.equal(formatDate(future.starts_at, future.timezone, { hour: '2-digit', minute: '2-digit' }), '09:00')
  assert.equal(slotStatus({ ...future, status: 'booked' }, Date.parse(future.starts_at)), 'past')
})
test('load failure and successful retry', async () => {
  mock([new TypeError('network'), [200, [future]]])
  const api = useBookings()
  assert.equal(await api.loadSlots(), false)
  assert.match(api.loadError.value, /Нет связи/)
  assert.equal(api.loading.value, false)
  assert.equal(await api.loadSlots(), true)
  assert.equal(api.loadError.value, '')
  assert.equal(api.slots.value.length, 1)
})
test('201 create and 204 cancellation', async () => {
  mock([[201, { id: 2 }], [204]])
  const api = useBookings()
  assert.equal((await api.createBooking(payload)).id, 2)
  assert.equal(await api.cancelBooking(2), null)
})
test('422 preserves Laravel field errors', async () => {
  mock([[422, { errors: { customer_email: ['Invalid email'] } }]])
  await assert.rejects(useBookings().createBooking(payload), e => e.status === 422 && e.errors.customer_email[0] === 'Invalid email')
})
test('409 immediately refreshes slots', async () => {
  const calls = mock([[409, {}], [200, [{ ...future, status: 'booked', active_booking_id: 2 }]]])
  const api = useBookings()
  await assert.rejects(api.createBooking(payload), e => e.status === 409)
  assert.equal(api.slots.value[0].status, 'booked')
  assert.deepEqual(calls.map(c => c[1]), ['POST', 'GET'])
})
test('404 cancellation refreshes slots', async () => {
  mock([[404, {}], [200, [future]]])
  const api = useBookings()
  await assert.rejects(api.cancelBooking(2), e => e.status === 404)
  assert.equal(api.slots.value.length, 1)
})
test('503 is retryable after reconciliation', async () => {
  const calls = mock([[503, {}], [200, [future]], [200, [future]], [201, { id: 3 }]])
  const api = useBookings()
  await assert.rejects(api.createBooking(payload), /Сервер временно занят/)
  assert.equal((await api.createBooking(payload)).id, 3)
  assert.deepEqual(calls.map(c => c[1]), ['POST', 'GET', 'GET', 'POST'])
})
test('lost POST response never blindly repeats a committed booking', async () => {
  const booked = { ...future, status: 'booked' }
  const calls = mock([new TypeError('network'), new TypeError('network'), [200, [booked]]])
  const api = useBookings()
  await assert.rejects(api.createBooking(payload), /Результат неизвестен/)
  await assert.rejects(api.createBooking(payload), e => e.status === 409)
  assert.deepEqual(calls.map(c => c[1]), ['POST', 'GET', 'GET'])
})
test('500 and failed refresh block retry until reconciliation succeeds', async () => {
  const calls = mock([[500, {}], new TypeError('network'), new TypeError('network')])
  const api = useBookings()
  await assert.rejects(api.createBooking(payload), /Ошибка сервера/)
  await assert.rejects(api.createBooking(payload), /Результат бронирования неизвестен/)
  assert.equal(calls.filter(c => c[1] === 'POST').length, 1)
})

test('reconciling a previous uncertain slot does not block a different slot', async () => {
  const booked = { ...future, status: 'booked' }
  const other = { ...future, id: 2 }
  const calls = mock([new TypeError('network'), new TypeError('network'), [200, [booked, other]], [201, { id: 4 }]])
  const api = useBookings()
  await assert.rejects(api.createBooking(payload))
  assert.equal((await api.createBooking({ ...payload, slot_id: 2 })).id, 4)
  assert.deepEqual(calls.map(c => c[1]), ['POST', 'GET', 'GET', 'POST'])
})
