import { ref } from 'vue'

export class ApiError extends Error {
  constructor(message, status = 0, errors = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const messages = {
  422: 'Проверьте данные формы.',
  409: 'Слот уже занят или время встречи прошло. Расписание обновлено.',
  404: 'Бронирование уже недоступно. Расписание обновлено.',
  503: 'Сервер временно занят. Попробуйте ещё раз.',
}

async function request(path, options = {}, expectedStatus = 200) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`/api${path}`, {
      ...options, signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    })
    if (response.status === 204 && expectedStatus === 204) return null
    let data
    try { data = await response.json() } catch { data = null }
    if (response.status !== expectedStatus) {
      throw new ApiError(messages[response.status] ?? 'Ошибка сервера. Попробуйте ещё раз.', response.status, data?.errors)
    }
    if (data === null) throw new ApiError('Ответ сервера не удалось прочитать. Проверьте расписание и повторите действие.')
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.')
  } finally { clearTimeout(timeout) }
}

export function useBookings() {
  const slots = ref([])
  const loading = ref(false)
  const loadError = ref('')
  let loadingPromise
  let uncertainSlotId = null

  function loadSlots() {
    if (loadingPromise) return loadingPromise
    loading.value = true
    loadError.value = ''
    loadingPromise = (async () => {
      try {
        const data = await request('/slots')
        if (!Array.isArray(data)) throw new ApiError('Сервер вернул некорректное расписание. Попробуйте ещё раз.')
        slots.value = data
        return true
      } catch (error) {
        loadError.value = error.message
        return false
      } finally {
        loading.value = false
        loadingPromise = null
      }
    })()
    return loadingPromise
  }

  async function createBooking(payload) {
    // An interrupted POST may have committed. Reconcile before another attempt.
    if (uncertainSlotId !== null) {
      if (!await loadSlots()) throw new ApiError('Результат бронирования неизвестен. Сначала восстановите связь и обновите расписание.')
      const previous = slots.value.find(slot => slot.id === uncertainSlotId)
      if (payload.slot_id === uncertainSlotId && previous && (previous.status !== 'available' || Date.parse(previous.starts_at) <= Date.now())) {
        uncertainSlotId = null
        throw new ApiError('Слот уже недоступен. Проверьте обновлённое расписание.', 409)
      }
      uncertainSlotId = null
    }
    try {
      return await request('/bookings', { method: 'POST', body: JSON.stringify(payload) }, 201)
    } catch (error) {
      if (error.status === 409) await loadSlots()
      if (!error.status || error.status >= 500) {
        uncertainSlotId = payload.slot_id
        const refreshed = await loadSlots()
        const slot = slots.value.find(item => item.id === payload.slot_id)
        if (refreshed && slot && (slot.status !== 'available' || Date.parse(slot.starts_at) <= Date.now())) {
          uncertainSlotId = null
          throw new ApiError('Ответ на запрос не получен, но слот уже недоступен. Расписание обновлено; повторная отправка не требуется.', 409)
        }
        error.message += refreshed ? ' Расписание сверено; можно повторить действие.' : ' Результат неизвестен: перед повтором проверим расписание.'
      }
      throw error
    }
  }

  async function cancelBooking(id) {
    try {
      return await request(`/bookings/${id}`, { method: 'DELETE' }, 204)
    } catch (error) {
      if (error.status === 404 || !error.status || error.status >= 500) await loadSlots()
      throw error
    }
  }
  return { slots, loading, loadError, loadSlots, createBooking, cancelBooking }
}
