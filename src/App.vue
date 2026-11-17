<script setup>
import { ref } from 'vue'
import Button from 'primevue/button'

const status = ref('Соединение ещё не проверено')
const loading = ref(false)

async function checkBackend() {
  loading.value = true
  try {
    const response = await fetch('/api/health')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    status.value = data.status === 'ok' ? 'Backend доступен' : 'Неожиданный ответ backend'
  } catch {
    status.value = 'Backend недоступен'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main>
    <h1>Mini Booking</h1>
    <p>Vue 3 + PrimeVue 4</p>
    <Button label="Проверить backend" icon="pi pi-check" :loading="loading" @click="checkBackend" />
    <p role="status">{{ status }}</p>
  </main>
</template>
