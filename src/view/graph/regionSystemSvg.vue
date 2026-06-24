<!--
  regionSystemSvg.vue - 区域系统图展示页
  路由：/region-system-svg，加载 public/regionSystemSvg 下的 SVG 文件
-->
<template>
    <GraphLg mode="svgfile" :svg-file-url="svgFileUrl" />
</template>

<script setup>
import GraphLg from './graphLg.vue'

const svgFileUrl = '/regionSystemSvg/' + encodeURIComponent('新乡市城北供电部区域系统图.svg')

document.title = '新乡市城北供电部区域系统图'
</script>
