<!--
  inSiteSvg.vue - 站内图 G 文件展示页
  路由：/in-site-svg
-->
<template>
    <GraphLg mode="gfile" :g-file-url="gFileUrl" />
</template>

<script setup>
import { useRoute } from 'vue-router'
import { ref } from 'vue'
import GraphLg from './graphLg.vue'
import { names } from '../../assets/substation/xxNames.js'

const route = useRoute()

function resolveGFileUrl() {
    const q = route.query
    for (const i in names) {
        if (names[i].name == q.name) {
            return `/src/assets/substation/410700.${names[i].sg_id}.fac.pic.g`
        }
    }
    return '/src/assets/substation/410700.01124107000001.fac.pic.g'
}

/** 同步解析 URL，避免 GraphLg 首次 mount 时 gFileUrl 仍为 null */
const gFileUrl = ref(resolveGFileUrl())
</script>
