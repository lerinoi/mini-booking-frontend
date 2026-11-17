import { createApp } from 'vue'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'
import './style.css'
import App from './App.vue'

createApp(App)
  .use(PrimeVue, { theme: { preset: Aura } })
  .use(ToastService)
  .use(ConfirmationService)
  .mount('#app')
