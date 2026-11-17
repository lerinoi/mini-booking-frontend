<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import BookingDialog from './components/BookingDialog.vue'
import ProgressSpinner from 'primevue/progressspinner'
import { useBookings } from './composables/useBookings'
import { dateKey, formatDate, slotStatus } from './schedule'

const { slots, loading, loadError, loadSlots, createBooking } = useBookings()
const toast = useToast()
const selectedSlot = ref(null)
const submitting = ref(false)
const formErrors = ref({})
const formError = ref('')
function openBooking(slot) {
  selectedSlot.value = slot; formErrors.value = {}; formError.value = ''
}
async function submitBooking(payload) {
  if (submitting.value) return
  submitting.value = true; formErrors.value = {}; formError.value = ''
  try {
    await createBooking(payload)
    selectedSlot.value = null
    toast.add({ severity: 'success', summary: 'Встреча запланирована', detail: 'Переговорная забронирована.', life: 5000 })
    await loadSlots()
  } catch (error) {
    formErrors.value = error.errors ?? {}; formError.value = error.message
  } finally { submitting.value = false }
}
const selectedDate = ref(null)
const now = ref(Date.now())
let clock
const dates = computed(() => [...new Map(slots.value.map(slot => [dateKey(slot), {
  value: dateKey(slot), label: formatDate(slot.starts_at, slot.timezone, { day: 'numeric', month: 'long', weekday: 'short' }),
}])).values()])
watch(dates, values => {
  if (!values.some(day => day.value === selectedDate.value)) selectedDate.value = values[0]?.value ?? null
})
const daySlots = computed(() => slots.value.filter(slot => dateKey(slot) === selectedDate.value))
const timezone = computed(() => slots.value[0]?.timezone ?? '')
const statusLabels = { available: 'Свободен', booked: 'Занят', past: 'Прошёл' }
const severity = { available: 'success', booked: 'warn', past: 'secondary' }
const status = slot => slotStatus(slot, now.value)
const time = slot => `${formatDate(slot.starts_at, slot.timezone, { hour: '2-digit', minute: '2-digit' })} — ${formatDate(slot.ends_at, slot.timezone, { hour: '2-digit', minute: '2-digit' })}`
onMounted(() => { loadSlots(); clock = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(clock))
</script>

<template>
  <Toast /><BookingDialog :slot="selectedSlot" :busy="submitting" :errors="formErrors" :error="formError" @close="selectedSlot = null" @submit="submitBooking" />
  <main class="booking-page">
    <header class="page-header">
      <div class="brand"><i class="pi pi-building" aria-hidden="true"></i> MINI BOOKING</div>
      <h1>Бронирование переговорной</h1>
      <p>Выберите удобное время для встречи с командой.</p>
      <div class="working-hours"><i class="pi pi-clock" aria-hidden="true"></i> Ежедневно с 09:00 до 18:00 <span v-if="timezone">· {{ timezone }}</span></div>
    </header>
    <section class="schedule-panel" aria-labelledby="schedule-heading" :aria-busy="loading">
      <div class="toolbar">
        <div><h2 id="schedule-heading">Расписание</h2><p>Часовые слоты · выходные включены</p></div>
        <div class="date-filter"><label for="schedule-date">Дата встречи</label><Select input-id="schedule-date" v-model="selectedDate" :options="dates" option-label="label" option-value="value" :disabled="loading" placeholder="Выберите дату" /></div>
        <Button icon="pi pi-refresh" aria-label="Обновить расписание" severity="secondary" outlined :disabled="loading" @click="loadSlots" />
      </div>
      <Message v-if="loadError" severity="error" :closable="false">{{ loadError }} <Button label="Повторить" text :disabled="loading" @click="loadSlots" /></Message>
      <div v-if="loading && !slots.length" class="empty-state" role="status"><ProgressSpinner aria-label="Загрузка расписания" /><p>Загружаем расписание…</p></div>
      <div v-else-if="!slots.length && !loadError" class="empty-state">Расписание пока не опубликовано.</div>
      <div class="slot-grid">
        <article v-for="slot in daySlots" :key="slot.id" class="slot-card" :class="status(slot)">
          <div class="slot-top"><i class="pi pi-clock" aria-hidden="true"></i><Tag :value="statusLabels[status(slot)]" :severity="severity[status(slot)]" /></div>
          <h3>{{ time(slot) }}</h3><p>Переговорная комната · 1 час</p>
          <Button v-if="status(slot) === 'available'" label="Забронировать" icon="pi pi-plus" :disabled="loading || submitting" @click="openBooking(slot)" />
          <span v-else class="slot-note">{{ status(slot) === 'past' ? 'Время встречи прошло' : 'Это время уже забронировано' }}</span>
        </article>
      </div>
    </section>
    <footer>Планируйте встречи — остальное подождёт.</footer>
  </main>
</template>
