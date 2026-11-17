<script setup>
import { reactive, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { formatDate } from '../schedule'
const props = defineProps({ slot: Object, busy: Boolean, errors: Object, error: String })
const emit = defineEmits(['close', 'submit'])
const form = reactive({ customer_name: '', customer_email: '' })
const localErrors = reactive({})
watch(() => props.slot?.id, () => {
  form.customer_name = ''; form.customer_email = ''
  Object.keys(localErrors).forEach(key => delete localErrors[key])
})
function submit() {
  if (props.busy) return
  Object.keys(localErrors).forEach(key => delete localErrors[key])
  if (!form.customer_name.trim()) localErrors.customer_name = ['Укажите имя сотрудника.']
  if (!form.customer_email.trim()) localErrors.customer_email = ['Укажите email.']
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())) localErrors.customer_email = ['Укажите корректный email.']
  if (Object.keys(localErrors).length) return
  emit('submit', { slot_id: props.slot.id, customer_name: form.customer_name.trim(), customer_email: form.customer_email.trim() })
}
const fieldError = field => localErrors[field]?.[0] || props.errors?.[field]?.[0]
</script>

<template>
  <Dialog :visible="!!slot" modal header="Забронировать переговорную" :closable="!busy" :close-on-escape="!busy" class="booking-dialog" @update:visible="value => { if (!value && !busy) emit('close') }">
    <template v-if="slot">
      <div class="selected-meeting"><i class="pi pi-calendar" aria-hidden="true"></i><div><strong>{{ formatDate(slot.starts_at, slot.timezone, { day: 'numeric', month: 'long', year: 'numeric' }) }}</strong><p>{{ formatDate(slot.starts_at, slot.timezone, { hour: '2-digit', minute: '2-digit' }) }} — {{ formatDate(slot.ends_at, slot.timezone, { hour: '2-digit', minute: '2-digit' }) }} · {{ slot.timezone }}</p></div></div>
      <form novalidate @submit.prevent="submit">
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <Message v-if="fieldError('slot_id')" severity="error" :closable="false">{{ fieldError('slot_id') }}</Message>
        <div class="form-field"><label for="customer-name">Имя сотрудника</label><InputText id="customer-name" v-model="form.customer_name" autocomplete="name" maxlength="255" :disabled="busy" :invalid="!!fieldError('customer_name')" :aria-describedby="fieldError('customer_name') ? 'name-error' : undefined" aria-required="true" /><small v-if="fieldError('customer_name')" id="name-error" class="field-error">{{ fieldError('customer_name') }}</small></div>
        <div class="form-field"><label for="customer-email">Email</label><InputText id="customer-email" v-model="form.customer_email" type="email" autocomplete="email" maxlength="255" :disabled="busy" :invalid="!!fieldError('customer_email')" :aria-describedby="fieldError('customer_email') ? 'email-error' : undefined" aria-required="true" /><small v-if="fieldError('customer_email')" id="email-error" class="field-error">{{ fieldError('customer_email') }}</small></div>
        <div class="dialog-actions"><Button label="Отмена" severity="secondary" outlined :disabled="busy" @click="emit('close')" /><Button type="submit" label="Забронировать" :loading="busy" :disabled="busy" /></div>
      </form>
    </template>
  </Dialog>
</template>
