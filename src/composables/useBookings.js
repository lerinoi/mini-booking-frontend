import { ref } from 'vue'

export function useBookings() {
  const slots = ref([])
  const loading = ref(false)
  const loadError = ref('')
  async function loadSlots() {
    loading.value = true
    loadError.value = ''
    try {
      const response = await fetch('/api/slots', { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('Не удалось загрузить расписание. Попробуйте ещё раз.')
      slots.value = await response.json()
      return true
    } catch (error) {
      loadError.value = error.message
      return false
    } finally { loading.value = false }
  }
  return { slots, loading, loadError, loadSlots }
}
