export function formatDate(value, timeZone, options) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone, ...options }).format(new Date(value))
}

export function dateKey(slot) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: slot.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(slot.starts_at))
  const get = type => parts.find(part => part.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function slotStatus(slot, now) {
  return new Date(slot.starts_at).getTime() <= now ? 'past' : slot.status
}
