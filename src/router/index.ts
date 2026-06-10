import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue')
    },
    {
      path: '/requests',
      name: 'requests',
      component: () => import('@/components/RequestHistory.vue')
    }
  ]
})

export default router
