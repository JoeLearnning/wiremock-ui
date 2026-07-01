import { createApp } from 'vue'
import { createPinia } from 'pinia'
import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'
import router from './router'
import App from './App.vue'
import './styles/global.css'
import { useThemeStore } from './stores/theme'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const themeStore = useThemeStore(pinia)
themeStore.restoreThemeColor()

app.use(router)
app.use(TDesign)
app.mount('#app')
