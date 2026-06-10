import axios from 'axios'
import type { AxiosInstance } from 'axios'

const client: AxiosInstance = axios.create({
  baseURL: '/__admin',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 响应拦截器：统一错误处理
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.errors?.[0]?.message
      || error.message
      || '请求失败'
    console.error('[WireMock API Error]', message)
    return Promise.reject(error)
  }
)

export default client
