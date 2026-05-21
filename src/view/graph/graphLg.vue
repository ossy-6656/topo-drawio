<!--
  graphLg.vue - 力光正交图编辑器组件
  基于 Vue 3 + mxGraph/drawio 的正交图编辑界面

  主要功能：
  1. 加载和显示 SVG 格式的正交图
  2. 提供图形编辑功能（拖拽、缩放、删除等）
  3. 显示左侧图元工具栏
  4. 管理图形的状态和生命周期
-->
<template>
    <!-- 柱上辅助控制面板（已注释，暂时不使用） -->
    <!-- <div class="dwControl">
        <div class="attach" title="Alt+A">
            <label style="user-select: none"
            ><input
                ref="poleEle"
                type="checkbox"
                @change="poleHelperHandler()"
                checked
            />柱上辅助</label>
        </div>
    </div> -->

    <!-- 数据选择 + 上传 G 图 -->
    <div class="dataSelector" style="position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 8px 12px; background: rgba(255, 255, 255, 0.95); border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; flex-wrap: wrap; gap: 10px; max-width: min(100vw - 24px, 560px);">
        <span style="font-size: 14px; font-weight: 500; color: #333;">选择数据源：</span>
        <select id="dataSelect" v-model="selectedData" @change="handleDataChange" style="padding: 6px 12px; font-size: 14px; border: 1px solid #dcdfe6; border-radius: 4px; background: #fff; cursor: pointer; outline: none; min-width: 150px;">
            <option value="zjtSvg">lgdata (示例数据)</option>
            <option value="dkxSvg">dkxdata (配线)</option>
            <option value="svg1">svg1</option>
            <option value="svg2">svg2</option>
            <option value="uploaded" :disabled="!uploadedSvg">本地上传的 G 图</option>
        </select>
        <label class="gUploadLabel" style="display: inline-flex; align-items: center; gap: 6px; margin: 0; cursor: pointer; font-size: 14px; color: #409eff;">
            <input
                ref="gFileInputRef"
                type="file"
                accept=".g,application/xml,text/xml"
                style="display: none"
                @change="onGFileSelected"
            />
            <span style="user-select: none;">上传 G 文件</span>
        </label>
        <span v-if="uploadingG" style="font-size: 13px; color: #909399;">正在转换为 SVG…</span>
    </div>

    <!-- 图形容器：包含图形编辑器和加载提示 -->
    <div class="graphCon" id="graphCon">
        <!-- 图形编辑器容器：mxGraph 渲染的目标容器 -->
        <div class="geEditor" :id="geEditor"></div>

        <!-- 加载状态提示：显示"加载中..."直到图形加载完成 -->
        <div id="geInfo">
            <div class="geBlock">
                <h1>图形编辑工具</h1>
                <h2 id="geStatus">加载中...</h2>
            </div>
        </div>
    </div>
    <!-- <Dialog
        :title="'多设备缩放'"
        :fullscreen="false"
        v-model="scaleDialogShow"
        :close-on-click-modal="false"
        width="300px"
        height="200px"
        :modal="false"
        class="zdy-drawer-class"
        @close="propsModelFrom = {}"
    >
        <table style="width: 100%">
            <tr>
                <td>缩放：</td>
                <td
                    ><input
                        type="range"
                        ref="scaleDom"
                        style="width: 100%"
                        min="1"
                        max="100"
                        step="1.1"
                        value="10"
                        @change="scaleCellsHandler($event)"
                /></td>
                <td
                    ><input
                        type="text"
                        v-model="scaleNum"
                        style="width: 20px"
                        @keydown.enter="scaleKeyboardHandler($event)"
                /></td>
            </tr>
        </table>
    </Dialog> -->
</template>

<script setup>
// ==================== 导入依赖 ====================
import { useRoute } from 'vue-router'                                   // Vue Router 路由钩子
import { ref, onMounted, onActivated, onBeforeUnmount, onDeactivated } from 'vue' // Vue 3 组合式 API

// 导入图形处理工具类
import GraphUtil from '@/plugins/tmzx/graph/GraphUtil.js'

// 导入 mxGraph 核心库和覆盖层
import '@/plugins/tmzx/graph/graph.js'           // mxGraph 初始化
import '@/view/graph/lg/override.js'             // 自定义方法覆盖

// 导入 App 类（正交图编辑器主类）
import App from '@/view/graph/lg/App'

// 导入 API 接口（已注释，使用测试数据）
// import { getZjtSvg } from '@/api/tmzx/svg/index.ts'
import { zjtSvg } from '@/view/graph/data/lgdata.js'                    // 测试用的正交图 SVG 数据
import { dkxSvg } from '@/view/graph/data/dkxdata.js'                  // 配线单线图 SVG 数据
import { svg1 } from '@/view/graph/data/svg1.js'                        // SVG 数据 1
import { svg2 } from '@/view/graph/data/svg2.js'                        // SVG 数据 2

// 导入 G 文件转换工具
import { convertFacGBufferToSvg } from '@/view/graph/utils/facGToSvg.js' // G 文件转 SVG
// import { checkEditZjtPermission } from '@/api/tmzx/abnormalchange/index.ts'

// 导入其他工具
import $bus from '@/utils/bus'                                           // 全局事件总线
import customSymbolStr from './data/symbol.js'                           // 自定义 SVG 符号
import LGSvgParser from '@/view/graph/lg/LGSvgParser.js'                 // SVG 解析器
import {
    LG_SIDEBAR_DEVICE_ENTRIES,
    LG_SIDEBAR_DRAG_SYMBOL_BLEND,
    LG_SIDEBAR_TRANSFORMER_ENTRIES,
    LG_SIDEBAR_UNIT_ENTRIES,
} from '@/view/graph/lg/Constants.js' // 力光侧栏图元与 lgdata / symbol.js 对齐
// import * as api from '@/api/tmzx/abnormalchange'
import { ElMessage } from 'element-plus'                                  // 消息提示组件

/**
 * 侧栏拖入顶点宽高：优先图中 shapeDragDefaults；否则条目网格与 symbol 模板按 LG_SIDEBAR_DRAG_SYMBOL_BLEND 折中
 */
function resolveLgSidebarDragWh(key, fw, fh, fromGraph, symbolMapForTpl, gScale) {
    const blend = Number(LG_SIDEBAR_DRAG_SYMBOL_BLEND)
    const t = Number.isFinite(blend) ? Math.min(1, Math.max(0, blend)) : 0.5
    if (fromGraph && fromGraph.w > 0 && fromGraph.h > 0) {
        return { w: fromGraph.w, h: fromGraph.h }
    }
    const arr = symbolMapForTpl[key]
    const entryMissing =
        fw == null || fh == null || !(Number(fw) > 0) || !(Number(fh) > 0)
    if (entryMissing && arr && arr.initWidth != null && arr.initHeight != null) {
        return {
            w: Number(arr.initWidth) * gScale,
            h: Number(arr.initHeight) * gScale,
        }
    }
    let w = Number(fw) * gScale
    let h = Number(fh) * gScale
    if (!entryMissing && arr && arr.initWidth != null && arr.initHeight != null) {
        const sw = Number(arr.initWidth)
        const sh = Number(arr.initHeight)
        if (Number.isFinite(sw) && Number.isFinite(sh) && sw > 0 && sh > 0) {
            const gw = Number(fw)
            const gh = Number(fh)
            w = ((1 - t) * gw + t * sw) * gScale
            h = ((1 - t) * gh + t * sh) * gScale
        }
    }
    return { w, h }
}

/**
 * 由侧栏条目生成 createVertexTemplateEntry 列表（宽高见 resolveLgSidebarDragWh）
 */
function createLgVertexPaletteFns(ui, entries, symbolMapForTpl, dragDef, gScale) {
    const rows = entries.map((entry) => {
        const symbolId = entry[0]
        const label = entry[1]
        const fw = entry[2]
        const fh = entry[3]
        const styleExtra = entry.length > 4 && entry[4] ? String(entry[4]) : ''
        const key = String(symbolId).toLowerCase()
        const fromGraph = dragDef[key]
        const { w, h } = resolveLgSidebarDragWh(key, fw, fh, fromGraph, symbolMapForTpl, gScale)
        return { symbolId, label, w, h, styleExtra }
    })
    return rows.map(({ symbolId, label, w, h, styleExtra }) => {
        const style = `shape=${symbolId};whiteSpace=wrap;aspect=fixed;` + styleExtra
        return ui.sidebar.createVertexTemplateEntry(style, w, h, '', label, null, null, label)
    })
}

/**
 * 与 LGSvgParser.parseSvg / getMinFontSize 一致：由 #Text_Layer 首段文字字号推算 scale，
 * 供 svg1/svg2 侧栏与 lgdata 对齐（未先打开 lgdata 时也有预估值）。
 */
function computeLgSidebarScaleFromSvgString(svgStr) {
    if (!svgStr || typeof svgStr !== 'string') return 1
    try {
        const doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml')
        const layer = doc.querySelector('#Text_Layer')
        if (!layer) return 1
        let minFs = 999
        const children = layer.children
        for (let i = 0; i < children.length; i++) {
            const gNode = children[i]
            const textEl = gNode.querySelector && gNode.querySelector('text')
            if (!textEl) continue
            const fs = parseFloat(textEl.getAttribute('font-size')) || 8
            if (fs < minFs) minFs = fs
        }
        if (minFs >= 999) return 1
        return minFs < 8 ? 8 / minFs : 1
    } catch {
        return 1
    }
}

/** 以 lgdata 为基准的侧栏缩放与图中位尺寸（切换 svg1/svg2 时沿用，与 lgdata 视觉一致） */
let cachedLgSidebarScale = computeLgSidebarScaleFromSvgString(zjtSvg)
let cachedLgSidebarDragDef = null

/** 替换 draw.io 默认「保存」图（易与下载混淆），与 .geStatusAlert 文字同色 #b62623（grapheditor.css） */
function applyDrawioSaveStatusIcon() {
    if (typeof Editor === 'undefined') return
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">' +
        '<path stroke="#b62623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'd="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>' +
        '<polyline stroke="#b62623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'points="17 21 17 13 7 13 7 21"/>' +
        '<polyline stroke="#b62623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'points="7 3 7 8 15 8"/>' +
        '</svg>'
    Editor.saveImage = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

// ==================== 全局配置 ====================
// 设置图形拖拽时的预览颜色为白色
mxGraphHandler.prototype.previewColor = '#fff'

// ==================== 全局变量 ====================
let lgsvgParser                     // SVG 解析器实例，用于解析和渲染 SVG 图形
let scrollLeft = 500,              // 图形容器的水平滚动位置
    scrollTop = 500                // 图形容器的垂直滚动位置

// ==================== window 全局属性 ====================
// window['drawflag']: 绘图标志，用于控制绘图状态
// 0 = 正常模式，其他值可能有特殊用途
window['drawflag'] = 0

// window['disableOper']: 是否禁用操作
// true = 禁用删除、移动等操作
// false = 允许所有操作
window['disableOper'] = false

// window['customShape']: 是否启用自定义图元和 Sidebar 工具栏
// true = 显示左侧图元工具栏
// false = 隐藏左侧图元工具栏
window['customShape'] = true

// 将 App 类挂载到 window 对象，方便全局访问
window.App = App

// ==================== 路由参数获取 ====================
const route = useRoute()
let { id, taskId, name } = route.query  // 从 URL 获取：正交图ID、任务ID、名称

// 如果有名称参数，设置页面标题
if (name) {
    document.title = name
}

// ==================== 组件状态变量 ====================
let uiEditor                       // 编辑器 UI 实例（App 类的实例）
let poleEle = ref()                 // 柱上辅助复选框的引用
const selectedData = ref('zjtSvg')  // 当前选中的数据源

// G 文件上传相关
let uploadedSvg = ref('')           // 存储上传 G 文件转换后的 SVG 数据
let uploadingG = ref(false)         // 上传状态标志
let gFileInputRef = ref()           // 文件输入框的引用

// 数据源映射
const dataSources = {
    zjtSvg: zjtSvg,
    dkxSvg: dkxSvg,
    svg1: svg1,
    svg2: svg2,
    uploaded: null  // 动态获取
}

// G 文件选择处理函数
async function onGFileSelected(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    uploadingG.value = true
    try {
        const arrayBuffer = await file.arrayBuffer()
        const { svg: svgStr, missingSymbols } = await convertFacGBufferToSvg(arrayBuffer, {})
        uploadedSvg.value = svgStr
        dataSources.uploaded = svgStr
        if (missingSymbols?.length) {
            console.warn('[facG] 以下图元未在工程中加载:', missingSymbols)
        }
        selectedData.value = 'uploaded'
        // 自动切换到上传的 G 图
        handleDataChange()
        ElMessage.success('G 文件转换成功')
    } catch (e) {
        console.error('G 文件转换失败:', e)
        ElMessage.error('G 文件转换失败: ' + (e.message || e))
    } finally {
        uploadingG.value = false
        // 清空文件输入，允许重复上传同一文件
        if (gFileInputRef.value) {
            gFileInputRef.value.value = ''
        }
    }
}

// 数据切换处理函数（须用 window.initGraphWithSvg：赋值在 onMounted 内，模块内无同名变量）
const handleDataChange = () => {
    let selectedSvg = null
    if (selectedData.value === 'uploaded') {
        selectedSvg = uploadedSvg.value
    } else {
        selectedSvg = dataSources[selectedData.value]
    }
    const load = typeof window.initGraphWithSvg === 'function' ? window.initGraphWithSvg : null
    if (!selectedSvg || !load) return
    // App.main 在 isMainCalled 为 true 时直接 return，必须重置后才能再次加载新 SVG
    App.isMainCalled = false
    try {
        if (uiEditor) {
            uiEditor.destroy()
            uiEditor = null
        }
    } catch (e) {
        console.warn('切换数据源：销毁编辑器', e)
    }
    load(selectedSvg, undefined)
}

/** 切换为配线数据（dkxdata.js），供图中「配线」热点点击调用 */
function switchToDkxData() {
    if (selectedData.value === 'dkxSvg') {
        return
    }
    selectedData.value = 'dkxSvg'
    handleDataChange()
    ElMessage.success('已切换至配线数据')
}
window.switchToDkxData = switchToDkxData

/** 切换为 svg2.js 数据，供「站外-大馈线」点击调用 */
function switchToSvg2() {
    if (selectedData.value === 'svg2') {
        return
    }
    selectedData.value = 'svg2'
    handleDataChange()
    ElMessage.success('已切换至 svg2 数据')
}
window.switchToSvg2 = switchToSvg2

// ==================== 容器 ID 生成 ====================
// 生成唯一的容器 ID，避免多个实例冲突
// 格式: geEditor_时间戳
let conid = 'geEditor_' + new Date().getTime()
let geEditor = ref(conid)           // Vue 响应式引用，绑定到模板中的 :id

let svgTxtObj // 存储symbol及defs等信息

let initEditFun = (svgstr, lgsvgParser) => {
    App['main'](
        (ui) => {
            applyDrawioSaveStatusIcon()
            lgsvgParser.ui = ui
            // let svgTxtObj = lgsvgParser.getSvgSymbolStyle(svgstr);

            ui.setSvgTxtObj(svgTxtObj)
            ui.setBackgroundColor('#000')

            // 强制显示 Sidebar 和分割线
            uiEditor = ui
            setTimeout(() => {
                // 直接通过 DOM 查找并显示
                const container = document.getElementById(conid)
                if (container) {
                    const sidebar = container.querySelector('.geSidebarContainer') ||
                                   container.querySelector('.geSidebar')
                    const hsplit = container.querySelector('.geHsplit')
                    const diagramContainer = container.querySelector('.geDiagramContainer')

                    if (sidebar) {
                        sidebar.style.display = 'block'
                        sidebar.style.visibility = 'visible'
                        sidebar.style.width = '240px'
                        console.log('Sidebar 显示成功')
                    }
                    if (hsplit) {
                        hsplit.style.display = 'block'
                        hsplit.style.visibility = 'visible'
                        console.log('分割线 显示成功')
                    }
                    if (diagramContainer) {
                        diagramContainer.style.left = '240px'
                        console.log('画布调整成功')
                    }

                    // 初始化 Sidebar，只加载「负荷」面板
                    if (ui.sidebar) {
                        try {
                            // 调用 Sidebar 的 init() 方法
                            ui.sidebar.init()

                            if (selectedData.value === 'zjtSvg' || selectedData.value === 'dkxSvg') {
                                cachedLgSidebarScale = lgsvgParser.getScale() || 1
                                const d = lgsvgParser.shapeDragDefaults || {}
                                cachedLgSidebarDragDef = { ...d }
                            }

                            const useLgRefSidebar =
                                selectedData.value === 'svg1' || selectedData.value === 'svg2'
                            // 侧栏初始宽高：svg1/svg2 与 lgdata 一致；lgdata/上传仍跟当前解析结果
                            const symbolMapForTpl = lgsvgParser.getSymbolMap()
                            const gScale = useLgRefSidebar
                                ? (cachedLgSidebarScale != null ? cachedLgSidebarScale : (lgsvgParser.getScale() || 1))
                                : (lgsvgParser.getScale() || 1)
                            const dragDef = useLgRefSidebar
                                ? (cachedLgSidebarDragDef != null ? cachedLgSidebarDragDef : {})
                                : (lgsvgParser.shapeDragDefaults || {})
                            // 先算出各负荷图元宽高；箱式变(zf08) 与配电站(zf06) 强制同尺寸（避免 xb 走 symbol 回退而 substation 走图中位数导致拖入/导出不一致）
                            const lgDeviceSizes = LG_SIDEBAR_DEVICE_ENTRIES.map(([symbolId, label, fw, fh]) => {
                                const key = String(symbolId).toLowerCase()
                                const fromGraph = dragDef[key]
                                const { w, h } = resolveLgSidebarDragWh(
                                    key,
                                    fw,
                                    fh,
                                    fromGraph,
                                    symbolMapForTpl,
                                    gScale
                                )
                                return { symbolId, label, key, w, h }
                            })
                            const pdSize = lgDeviceSizes.find((r) => r.key === 'substation')
                            if (pdSize && pdSize.w > 0 && pdSize.h > 0) {
                                for (const row of lgDeviceSizes) {
                                    if (row.key === 'xb') {
                                        row.w = pdSize.w
                                        row.h = pdSize.h
                                    }
                                }
                            }
                            const lgDeviceFns = lgDeviceSizes.map(({ symbolId, label, w, h }) => {
                                const style = `shape=${symbolId};whiteSpace=wrap;aspect=fixed;`
                                return ui.sidebar.createVertexTemplateEntry(style, w, h, '', label, null, null, label)
                            })

                            // ── 辅助：解析 mxlibrary XML，返回图元 DOM 节点数组（与 addLibraryEntries 逻辑一致）──
                            const parseScratchpadXml = (xml) => {
                                const nodes = []
                                try {
                                    // drawio 便笺本格式：<mxlibrary>[{"xml":"...","w":N,"h":N,"title":"..."}]</mxlibrary>
                                    const doc = new DOMParser().parseFromString(xml, 'text/xml')
                                    const node = doc.querySelector('mxlibrary')
                                    if (node) {
                                        const items = JSON.parse(node.textContent)
                                        if (Array.isArray(items)) {
                                            items.forEach(item => {
                                                try {
                                                    const w = item.w || 100
                                                    const h = item.h || 100
                                                    const title = item.title || ''
                                                    if (item.data) {
                                                        // 图片类型
                                                        let s = 'shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;'
                                                        if (item.aspect === 'fixed') s += 'aspect=fixed;'
                                                        s += 'image=' + ui.convertDataUri(item.data) + ';'
                                                        if (item.style) s += item.style
                                                        nodes.push(ui.sidebar.createVertexTemplate(s, w, h, '', title, false, null, true))
                                                    } else if (item.xml) {
                                                        // cells XML 类型：与 addLibraryEntries 完全一致
                                                        const xmlStr = (item.xml.charAt(0) === '<')
                                                            ? item.xml
                                                            : Graph.decompress(item.xml)
                                                        const cells = ui.stringToCells(xmlStr)
                                                        if (cells.length > 0) {
                                                            nodes.push(ui.sidebar.createVertexTemplateFromCells(
                                                                cells, w, h, title, true, null, true
                                                            ))
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.warn('便笺本单个图元解析失败:', e)
                                                }
                                            })
                                        }
                                    }
                                } catch (e) {
                                    console.warn('解析便笺本 XML 失败:', e)
                                }
                                return nodes
                            }

                            // ── 母线 / 连接线模板（与下方 add 顺序一致：母线→连接线→变压器→机组→负荷）──
                            const lgBusbarFns = [
                                // 站内母线 0311：与 LGSvgParser.parseBusbar 一致（矩形 + flag=busbar）
                                ui.sidebar.createVertexTemplateEntry(
                                    'shape=rect;flag=busbar;busbarThin=1;whiteSpace=wrap;psrtype=0311;fillColor=rgb(185,72,66);strokeColor=none;rotation=0;rotatable=0;html=1;',
                                    200,
                                    1.6,  // 拖入画布默认高度与 LGSvgParser 母线 busbarThin 锁定一致
                                    '',
                                    '站内-母线（0311）',
                                    null,
                                    null,
                                    '站内-母线（0311）'
                                ),
                            ]
                            // 连接线：直线（noEdgeStyle=1，无正交/肘形弯折）；默认下沿中点→上沿中点，上下排列时为竖直线段
                            const lgStraightVerticalLineStyle =
                                'endArrow=none;html=1;rounded=0;noEdgeStyle=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;flag=line;type=polyline;strokeWidth=0.4;strokeColor=rgb(185,72,66);'
                            const lgLineFns = [
                                ui.sidebar.createEdgeTemplateEntry(
                                    lgStraightVerticalLineStyle,
                                    50,
                                    50,
                                    '',
                                    '母线连接线',
                                    null,
                                    null,
                                    '母线连接线 母线-母线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    lgStraightVerticalLineStyle,
                                    50,
                                    50,
                                    '',
                                    '连接线',
                                    null,
                                    null,
                                    '连接线 普通 设备'
                                ),
                            ]

                            // 侧栏分类顺序：母线、连接线、变压器、机组、负荷（便笺本仍追加到「负荷」）
                            ui.sidebar.addPaletteFunctions('lg-busbar', '母线', true, lgBusbarFns)
                            ui.sidebar.addPaletteFunctions('lg-lines', '连接线', true, lgLineFns)

                            const lgTransformerFns = createLgVertexPaletteFns(
                                ui,
                                LG_SIDEBAR_TRANSFORMER_ENTRIES,
                                symbolMapForTpl,
                                dragDef,
                                gScale
                            )
                            ui.sidebar.addPaletteFunctions('lg-transformer', '变压器', true, lgTransformerFns)

                            const lgUnitFns = createLgVertexPaletteFns(
                                ui,
                                LG_SIDEBAR_UNIT_ENTRIES,
                                symbolMapForTpl,
                                dragDef,
                                gScale
                            )
                            ui.sidebar.addPaletteFunctions('lg-unit', '机组', true, lgUnitFns)

                            ui.sidebar.addPaletteFunctions('lg-devices', '负荷', true, lgDeviceFns)

                            // ── 辅助：将解析出的图元节点追加到「负荷」面板 ──
                            const appendScratchNodes = (scratchNodes) => {
                                if (!scratchNodes || scratchNodes.length === 0) return
                                // palettes['lg-devices'] = [titleEl, outerDiv]
                                // outerDiv.firstChild 是 .geSidebar content div
                                const palette = ui.sidebar.palettes['lg-devices']
                                const contentDiv = palette && palette[1] && palette[1].firstChild
                                if (contentDiv) {
                                    scratchNodes.forEach(node => contentDiv.appendChild(node))
                                    console.log('便笺本图元已追加到「负荷」面板，共', scratchNodes.length, '个')
                                } else {
                                    console.warn('未找到「负荷」面板 content div，palettes:', ui.sidebar.palettes['lg-devices'])
                                }
                            }

                            // 异步追加便笺本图元
                            const loadScratchpad = () => {
                                if (typeof StorageFile !== 'undefined') {
                                    StorageFile.getFileContent(ui, '.scratchpad', (xml) => {
                                        console.log('StorageFile.getFileContent 回调，xml长度:', xml ? xml.length : 0)
                                        if (xml && xml !== ui.emptyLibraryXml) {
                                            appendScratchNodes(parseScratchpadXml(xml))
                                        } else {
                                            // 降级：从 localStorage 尝试
                                            const lsXml = localStorage.getItem('.scratchpad')
                                            console.log('localStorage .scratchpad 长度:', lsXml ? lsXml.length : 0)
                                            if (lsXml) appendScratchNodes(parseScratchpadXml(lsXml))
                                        }
                                    })
                                } else {
                                    // StorageFile 未定义，直接读 localStorage
                                    const lsXml = localStorage.getItem('.scratchpad')
                                    if (lsXml) appendScratchNodes(parseScratchpadXml(lsXml))
                                }
                            }
                            loadScratchpad()

                        } catch (e) {
                            console.error('初始化 Sidebar 失败:', e)
                        }
                    }
                }
            }, 500)
        },
        null,
        conid,
        lgsvgParser
    )
}

function poleHelperHandler() {
    let ele = poleEle.value
    let ch = ele.checked
    if (lgsvgParser) {
        lgsvgParser.poleHelper = ch
    }
}

onMounted(() => {
    applyDrawioSaveStatusIcon()

    // const params = {
    //     psrId: id,
    //     id: taskId
    // }

    // checkEditZjtPermission(params).then((data) => {
    //     console.log("datadatadata",data)
    //     if (!data) {
    //         ElMessage.error('当前正交图不可编辑')
    //         return
    //     } else {
            App.isMainCalled = false
            if (uiEditor) {
                uiEditor.destroy()
                uiEditor = null
            }

            // 全局函数：初始化图形
window.initGraphWithSvg = (_svg, themecut) => {
                let mysvg = _svg

                lgsvgParser = new LGSvgParser(id)
                lgsvgParser.setTaskId(taskId)
                lgsvgParser.setThemecut(themecut)

                if (_svg.indexOf('bridgeOverRiver') == -1) {
                    let index = _svg.indexOf('</defs>')
                    let leftStr = _svg.substring(0, index)
                    let rightStr = _svg.substring(index)
                    mysvg = leftStr + customSymbolStr + rightStr
                }

                // 须用合并了 customSymbolStr 的 mysvg：保存/导出时 SvgGenerate 会原样写入 defsContent，
                // 若仍用原始 _svg 抽 defs，则缺少 symbol.js 中的 <symbol>，<use xlink:href> 无法显示。
                svgTxtObj = lgsvgParser.getSvgSymbolStyle(mysvg)

                lgsvgParser.loadSvg(mysvg, () => {
                    lgsvgParser.parseStencil() // 先初始化图元
                    initEditFun(mysvg, lgsvgParser)
                })
            }

            // 数据获取
            // getZjtSvg(id, taskId).then((res) => {
                // console.log("getZjtSvggetZjtSvg", res)
                // if(!res.msg){
                //   let obj = res.data
                //   let svgstr = obj.svgstr
                //   let themecut = obj.themecut
                //   console.log("888888888888",svgstr, themecut)
                setTimeout(() => {
                    const firstSvg = dataSources[selectedData.value]
                    console.log('graphLg init', selectedData.value, firstSvg && firstSvg.length)
                    window.initGraphWithSvg(firstSvg, undefined)
                }, 500);
                  
                    //  go(_svg, themecut)
                // } else {
                //   ElMessage.error('正交图打开失败:' + res.msg)
                // }
            // })
        // }
    // })

    // testDljxt();
})

onBeforeUnmount(() => {
    $bus.off('multiScale_zjt')
    try {
        if (uiEditor) {
            uiEditor.destroy()
            uiEditor = null
        }
    } catch (e) {
        console.log('图形编辑器：', '销毁异常...')
    }
})

onActivated(() => {
    window['drawflag'] = 0
    window.App = App
    if (uiEditor) {
        window.setTimeout(function () {
            uiEditor.editor.graph.container.scrollLeft = uiEditor.scrollLeft
            uiEditor.editor.graph.container.scrollTop = uiEditor.scrollTop
        }, 200)
    }
    console.log('graph onActivated', Math.random())
})
</script>

<style scoped lang="scss">
::v-deep *,
::v-deep *::before,
::v-deep *::after {
    box-sizing: content-box; // 这个本应该是个默认值，但被项目给覆盖，需要重设
}

.graphCon {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    line-height: normal;
    .geEditor {
        position: absolute;
        width: 100%;
        height: 100%;
    }
    ::v-deep > a.geToolbarButton {
        box-sizing: border-box;
    }
}

// 强制显示 Sidebar
::v-deep .geSidebarContainer {
    display: block !important;
    visibility: visible !important;
    width: 240px !important;
}

::v-deep .geSidebar {
    display: block !important;
    visibility: visible !important;
    text-align: left !important;
}

::v-deep .geHsplit {
    display: block !important;
    visibility: visible !important;
}

::v-deep .geDiagramContainer {
    left: 240px !important;
}

/* 顶栏右侧按钮容器：保存按钮对齐 */
.graphCon ::v-deep .geButtonContainer {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 6px;
}

/* 正交图自定义「保存」主按钮 — 对齐 Element Plus 主色与设计规范 */
.graphCon ::v-deep .geZjtSaveBtn {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    min-width: 64px;
    padding: 0 14px;
    margin-right: 2px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    font-family: inherit;
    color: #fff;
    cursor: pointer;
    user-select: none;
    border: 1px solid #337ecc;
    border-radius: 4px;
    background: linear-gradient(180deg, #5cadff 0%, #409eff 45%, #337ecc 100%);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.25),
        0 1px 2px rgba(0, 0, 0, 0.12);
    transition:
        filter 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.08s ease;
}

.graphCon ::v-deep .geZjtSaveBtn:hover:not(:disabled) {
    filter: brightness(1.05);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        0 2px 6px rgba(64, 158, 255, 0.35);
}

.graphCon ::v-deep .geZjtSaveBtn:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
}

.graphCon ::v-deep .geZjtSaveBtn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    filter: saturate(0.6);
}

/* 底部「修改未保存…」提示条右侧保存图标：与警示条主色一致、对齐文字 */
.graphCon ::v-deep a.geStatus .geStatusAlert img.geAdaptiveAsset {
    display: inline-block;
    vertical-align: middle;
    width: 16px;
    height: 16px;
    margin-left: 6px;
    margin-top: -1px;
}


.dwControl {
    position: absolute;
    z-index: 10;
    left: 15px;
    top: 85px;
    display: flex;
    width: auto;
    justify-content: space-around;
    font-size: 12px;
    color: #000;

    div {
        height: 20px;
        line-height: 20px;
        border-radius: 3px;
        text-align: center;
        padding: 2px 5px;
        cursor: pointer;
        font-size: 12px;
        width: 60px;
        background-color: #fff;
        border: 1px #bdbdbd solid;
        margin-right: 5px;
    }

    div.trunk {
        width: 80px;
        //box-shadow: 0px 0px 1px 2px rgba(39, 225, 0, 0.75);
        //background-color: rgb(62 153 42 / 60%);
    }

    .txt {
        width: 60px;
    }

    .attach {
        width: 70px;

        label {
            cursor: pointer;
            display: flex;
            align-items: center;

            input {
                margin-right: 2px;
            }
        }
    }
}
</style>
