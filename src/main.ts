import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import { createPinia } from 'pinia';

import router from './router'//导入router

import * as echarts from 'echarts'

import axios from 'axios';

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app =  createApp(App)

// 将axios添加到Vue的原型链上，使其可在所有组件中使用this.$axios访问
app.config.globalProperties.$axios = axios;

app.config.globalProperties.$echarts = echarts

const pinia = createPinia();
app.use(pinia); // 使用 pinia 实例

app.use(ElementPlus)
app.use(router)//注册router
app.mount('#app')