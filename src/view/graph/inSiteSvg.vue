<!--
  inSiteSvg.vue - 站内图 G 文件展示页
  路由：/in-site-svg，直接加载项目根目录 123.g
-->
<template>
    <GraphLg mode="gfile" :g-file-url="gFileUrl" />
</template>

<script setup>
import GraphLg from './graphLg.vue'
import gFileUrl from '../../../123.g?url'
</script>
