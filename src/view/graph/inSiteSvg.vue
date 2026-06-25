<!--
  inSiteSvg.vue - 站内图 G 文件展示页
  路由：/in-site-svg，直接加载项目根目录 123.g
-->
<template>
    <GraphLg mode="gfile" :g-file-url="gFileUrl" />
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'                          // Vue Router 路由钩子
import { ref, computed, onMounted, onActivated, onBeforeUnmount, onDeactivated, defineAsyncComponent } from 'vue'
import GraphLg from './graphLg.vue'
// import gFileUrl from '../../assets/substation/410700.01124107000001.fac.pic.g?url'
import {names} from '../../assets/substation/xxNames.js'
const route = useRoute()
const router = useRouter()
const gFileUrl = ref(null)
const getG = async () => {
    const modules = import.meta.glob('../../assets/substation/*.g')
    const q = route.query
    for(let i in names) {
        if (names[i].name == q.name) {
            gFileUrl.value = `/src/assets/substation/410700.${names[i].sg_id}.fac.pic.g`
        }
    }
    if(gFileUrl.value == null) {
        gFileUrl.value = '/src/assets/substation/410700.01124107000001.fac.pic.g'
    }
}
onMounted(() => {
    getG()
    
})
</script>
