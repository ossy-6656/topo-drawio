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

    <!-- 数据源选择页（/graphLg）顶栏 -->
    <div
        v-if="isDatasetMode"
        class="dataSelector"
        style="position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 8px 12px; background: rgba(255, 255, 255, 0.95); border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; flex-wrap: wrap; gap: 10px; max-width: min(100vw - 24px, 560px);"
    >
        <span style="font-size: 14px; font-weight: 500; color: #333;">选择数据源：</span>
        <select id="dataSelect" v-model="selectedData" @change="handleDataChange" style="padding: 6px 12px; font-size: 14px; border: 1px solid #dcdfe6; border-radius: 4px; background: #fff; cursor: pointer; outline: none; min-width: 150px;">
            <option
                v-for="opt in stationDataOptions"
                :key="opt.value"
                :value="opt.value"
            >{{ opt.label }}</option>
        </select>
    </div>

    <!-- 图形容器：包含图形编辑器和加载提示 -->
    <div
        class="graphCon"
        :class="isSvgFileMode || !lgSidebarExpanded ? 'lg-sidebar-collapsed' : 'lg-sidebar-expanded'"
        id="graphCon"
    >
        <!-- 图形编辑器容器：mxGraph 渲染的目标容器 -->
        <div class="geEditor" :id="geEditor"></div>

        <!-- 加载状态提示：显示"加载中..."直到图形加载完成 -->
        <div id="geInfo">
            <div class="geBlock">
                <h1>图形编辑工具</h1>
                <h2 id="geStatus">加载中...</h2>
            </div>
        </div>

        <button
            v-show="!isSvgFileMode && lgSidebarExpanded"
            type="button"
            class="lg-sidebar-toggle lg-sidebar-toggle--collapse"
            title="收起图元面板"
            aria-label="收起图元面板"
            @click="setLgSidebarExpanded(false)"
        >
            <svg class="lg-sidebar-toggle__svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
            </svg>
        </button>
        <button
            v-show="!isSvgFileMode && !lgSidebarExpanded"
            type="button"
            class="lg-sidebar-toggle lg-sidebar-toggle--expand"
            title="展开图元面板"
            aria-label="展开图元面板"
            @click="setLgSidebarExpanded(true)"
        >
            <svg class="lg-sidebar-toggle__svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
            </svg>
        </button>
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
import { useRoute, useRouter } from 'vue-router'                          // Vue Router 路由钩子
import { ref, computed, onMounted, onActivated, onBeforeUnmount, onDeactivated } from 'vue' // Vue 3 组合式 API

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
import { svg2 } from '@/view/graph/data/svg2.js'                        // SVG 数据 2
import {
    STATION_DATA_OPTIONS,
    STATION_DATA_MAP,
} from '@/view/graph/data/stationDatasets.js'                          // data/*.svg 转 lgdata 格式
import changcunPvList from '@/view/graph/data/changcunPV.json'
import { teardownLgPvIconShine } from '@/view/graph/lg/lgPvIconOverlay.js'

// 导入 G 文件转换工具
import { convertFacGBufferToSvg } from '@/view/graph/utils/facGToSvg.js' // G 文件转 SVG
// import { checkEditZjtPermission } from '@/api/tmzx/abnormalchange/index.ts'

// 导入其他工具
import $bus from '@/utils/bus'                                           // 全局事件总线
import customSymbolStr from './data/symbol.js'                           // 自定义 SVG 符号
import LGSvgParser from '@/view/graph/lg/LGSvgParser.js'                 // SVG 解析器
import { applyLgCanvasTheme, getLgCanvasTheme } from '@/view/graph/lg/lgCanvasTheme.js'
import {
    LG_SIDEBAR_DEVICE_ENTRIES,
    LG_SIDEBAR_DRAG_SYMBOL_BLEND,
    LG_SIDEBAR_SWITCH_ENTRIES,
    LG_SIDEBAR_TRANSFORMER_ENTRIES,
    LG_SIDEBAR_UNIT_ENTRIES,
    getLgdataSidebarReferenceDragDef,
    buildInSiteGfileSidebarDragDef,
    scaleInSiteGfileSidebarDragDef,
    LG_IN_SITE_GFILE_DEVICE_DISPLAY_SCALE,
    maxSideFromShapeDragDefaults,
    computeLgSwitchCanvasRefSideFromLgdataScale,
    computeLgSwitchCanvasRefSideFromScale,
    setLgSwitchCanvasRefSide,
    getLgSwitchCanvasRefSide,
    setLgLgdataParserTextScale,
    getLgLgdataParserTextScale,
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

/** 画布/保存仍用 dropH=1.6；侧栏单独用 CSS 粗条预览，避免缩略图几乎不可见 */
const LG_BUSBAR_DROP_W = 200
const LG_BUSBAR_DROP_H = 1.6
const LG_BUSBAR_SIDEBAR_STYLE =
    'shape=rect;flag=busbar;busbarThin=1;whiteSpace=wrap;psrtype=0311;fillColor=rgb(185,72,66);strokeColor=none;rotation=0;rotatable=0;html=1;'

function createLgBusbarSidebarEntry(ui) {
    const title = '站内-母线（0311）'
    const sidebar = ui.sidebar
    return sidebar.addEntry(title + ' ' + title, function () {
        const elt = document.createElement('a')
        elt.className = 'geItem lgSidebarBusbarPreview'
        const border = 2 * sidebar.thumbBorder
        elt.style.width = sidebar.thumbWidth + border + 'px'
        elt.style.height = sidebar.thumbHeight + border + 'px'
        elt.style.padding = sidebar.thumbPadding + 'px'
        elt.style.boxSizing = 'content-box'

        const bar = document.createElement('div')
        bar.className = 'lgSidebarBusbarPreviewBar'
        bar.setAttribute('aria-hidden', 'true')
        elt.appendChild(bar)

        mxEvent.addListener(elt, 'click', function (evt) {
            mxEvent.consume(evt)
        })

        const cells = [
            new mxCell('', new mxGeometry(0, 0, LG_BUSBAR_DROP_W, LG_BUSBAR_DROP_H), LG_BUSBAR_SIDEBAR_STYLE),
        ]
        cells[0].vertex = true
        const bounds = new mxRectangle(0, 0, LG_BUSBAR_DROP_W, LG_BUSBAR_DROP_H)
        const ds = sidebar.createDragSource(
            elt,
            sidebar.createDropHandler(cells, true, true, bounds),
            sidebar.createDragPreview(LG_BUSBAR_DROP_W, LG_BUSBAR_DROP_H),
            cells,
            bounds
        )
        sidebar.addClickHandler(elt, ds, cells)
        ds.isGuidesEnabled = mxUtils.bind(sidebar, function () {
            return sidebar.editorUi.editor.graph.graphHandler.guidesEnabled
        })

        if (!mxClient.IS_IOS) {
            mxEvent.addGestureListeners(
                elt,
                null,
                mxUtils.bind(sidebar, function (evt) {
                    if (mxEvent.isMouseEvent(evt)) {
                        sidebar.showTooltip(elt, cells, bounds.width, bounds.height, title, null)
                    }
                })
            )
        }

        return elt
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

/** 以 lgdata 为基准的侧栏缩放与拖入尺寸；切换数据源时沿用，避免侧栏图元顺序/布局变化 */
let cachedLgSidebarScale = computeLgSidebarScaleFromSvgString(zjtSvg)
let cachedLgSidebarDragDef = {}
/** /graphLg 打开 lgdata 后冻结的侧栏参考；/in-site-svg 复用，不被 G 文件解析覆盖 */
let lgdataSidebarRefScale = cachedLgSidebarScale
let lgdataSidebarRefDragDef = getLgdataSidebarReferenceDragDef(lgdataSidebarRefScale)
setLgLgdataParserTextScale(cachedLgSidebarScale)
setLgSwitchCanvasRefSide(computeLgSwitchCanvasRefSideFromLgdataScale())

function freezeLgdataSidebarRef(parser) {
    if (!parser) {
        return
    }
    const scale = parser.getScale() || lgdataSidebarRefScale || 1
    lgdataSidebarRefScale = scale
    const defs = parser.shapeDragDefaults || {}
    if (defs && Object.keys(defs).length > 0) {
        lgdataSidebarRefDragDef = { ...defs }
    }
}

/** /in-site-svg 侧栏：与 /graphLg 默认 lgdata(zjtSvg) 尺寸一致 */
function getLgdataSidebarReferenceSizing() {
    const gScale =
        lgdataSidebarRefScale > 0
            ? lgdataSidebarRefScale
            : cachedLgSidebarScale > 0
              ? cachedLgSidebarScale
              : 1
    let dragDef = lgdataSidebarRefDragDef
    if (!dragDef || Object.keys(dragDef).length === 0) {
        dragDef = cachedLgSidebarDragDef
    }
    if (!dragDef || Object.keys(dragDef).length === 0) {
        dragDef = getLgdataSidebarReferenceDragDef(gScale)
    }
    return { gScale, dragDef }
}

/**
 * /in-site-svg：侧栏与拖入尺寸跟当前 G 图画布设备（断路器/负荷等）对齐，避免 lgdata 小尺寸。
 */
function resolveLgInSiteGfileSidebarSizing(lgsvgParser) {
    const gScale = lgsvgParser?.getScale() || 1
    const gDrag = lgsvgParser?.shapeDragDefaults || {}
    let anchorSide = maxSideFromShapeDragDefaults(gDrag, [
        'cbreaker',
        'substation',
        'xb',
        'ptuser',
        'generatingunit',
        'potentialtransformer2w',
        'potentialtransformer3w',
    ])
    if (anchorSide <= 0) {
        anchorSide = getLgSwitchCanvasRefSide() || 0
    }
    if (anchorSide <= 0) {
        const lgRef = getLgdataSidebarReferenceSizing()
        anchorSide = Math.max(
            maxSideFromShapeDragDefaults(lgRef.dragDef),
            3 * lgRef.gScale
        )
    }
    const dragDef = scaleInSiteGfileSidebarDragDef(
        buildInSiteGfileSidebarDragDef(gDrag, anchorSide),
        LG_IN_SITE_GFILE_DEVICE_DISPLAY_SCALE
    )
    return { gScale, dragDef }
}

/** 打开 lgdata 时刷新侧栏/开关基准；站所图只换画布，开关仍按 lgdata 边长缩小对齐 */
function cacheLgSidebarRefFromParser(parser, dataKey) {
    if (dataKey !== 'zjtSvg' || !parser) {
        return
    }
    const lgScale = parser.getScale() || 1
    cachedLgSidebarScale = lgScale
    setLgLgdataParserTextScale(lgScale)
    cachedLgSidebarDragDef = { ...(parser.shapeDragDefaults || {}) }
    freezeLgdataSidebarRef(parser)
    const d = cachedLgSidebarDragDef.cbreaker
    if (d && d.w > 0 && d.h > 0) {
        setLgSwitchCanvasRefSide(Math.max(d.w, d.h))
    } else {
        setLgSwitchCanvasRefSide(computeLgSwitchCanvasRefSideFromLgdataScale())
    }
}

/**
 * 站所 SVG（张衡等）负荷侧栏：跟当前图 scale 与图中设备尺寸；
 * lgdata/svg2 仍沿用 lgdata 基准，避免侧栏随站所图漂移。
 */
function resolveLgLoadSidebarSizing(lgsvgParser, dataKey) {
    const isStationDataset = Boolean(STATION_DATA_MAP[dataKey])
    const fallbackScale =
        cachedLgSidebarScale != null
            ? cachedLgSidebarScale
            : lgsvgParser?.getScale() || 1
    if (!isStationDataset || !lgsvgParser) {
        return { gScale: fallbackScale, dragDef: cachedLgSidebarDragDef }
    }
    const stationDrag = lgsvgParser.shapeDragDefaults || {}
    const stationScale =
        lgsvgParser.getScale() ||
        computeLgSidebarScaleFromSvgString(STATION_DATA_MAP[dataKey]) ||
        fallbackScale
    return {
        gScale: stationScale,
        dragDef: Object.keys(stationDrag).length > 0 ? stationDrag : cachedLgSidebarDragDef,
    }
}

function resolveCachedLgSwitchDragSize(parser) {
    const side = getLgSwitchCanvasRefSide()
    if (side > 0) {
        return { w: side, h: side }
    }
    const d = cachedLgSidebarDragDef && cachedLgSidebarDragDef.cbreaker
    if (d && d.w > 0 && d.h > 0) {
        const cachedSide = Math.max(d.w, d.h)
        return { w: cachedSide, h: cachedSide }
    }
    return parser && typeof parser.getLgSwitchDragSize === 'function'
        ? parser.getLgSwitchDragSize()
        : { w: 10, h: 10 }
}

const LG_SIDEBAR_WIDTH = 240
const lgSidebarExpanded = ref(true)

function disableLgGraphContextMenus(graph) {
    if (!graph?.popupMenuHandler) return
    if (typeof graph.popupMenuHandler.setEnabled === 'function') {
        graph.popupMenuHandler.setEnabled(false)
    }
    graph.popupMenuHandler.factoryMethod = function () {}
    if (graph.container && typeof mxEvent !== 'undefined' && typeof mxEvent.disableContextMenu === 'function') {
        mxEvent.disableContextMenu(graph.container)
    }
}

/** 区域系统图等只读 SVG 页：隐藏左侧图元面板并禁用编辑 */
function applyLgSvgViewOnlyMode(ui, container) {
    applyLgSidebarLayout(ui, container, false)
    const graph = ui?.editor?.graph
    if (graph && typeof graph.setEnabled === 'function') {
        graph.setEnabled(false)
    }
    disableLgGraphContextMenus(graph)
}

function setLgSidebarExpanded(expanded) {
    applyLgSidebarLayout(uiEditor, document.getElementById(conid), expanded)
}

function isLgGraphDragActive(graph) {
    if (!graph) return false
    if (typeof graph.isMouseDown === 'function' && graph.isMouseDown()) return true
    const gh = graph.graphHandler
    return gh != null && gh.first != null
}

/** 全图内容边界（图坐标，忽略当前选中项，避免拖入的开关/变压器单独撑满视口） */
function getLgDiagramFitBounds(graph) {
    const bounds = graph.getGraphBounds()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null
    const t = graph.view.translate
    const s = graph.view.scale
    return {
        x: bounds.x / s - t.x,
        y: bounds.y / s - t.y,
        width: bounds.width / s,
        height: bounds.height / s,
    }
}

/** 内容过小时按视口等比扩展边界，避免 fit 时过度放大 */
function expandLgFitBounds(bounds, minW, minH) {
    if (bounds.width >= minW && bounds.height >= minH) return bounds
    const cx = bounds.x + bounds.width / 2
    const cy = bounds.y + bounds.height / 2
    const w = Math.max(bounds.width, minW)
    const h = Math.max(bounds.height, minH)
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h }
}

/** 侧栏展开/收起后：按全图居中适配，限制放大倍数，避免单个图元占满全屏 */
function fitLgDiagramToViewport(ui) {
    if (!ui?.editor?.graph) return
    if (window['drawflag']) return

    const graph = ui.editor.graph
    if (typeof graph.isEditing === 'function' && graph.isEditing()) return
    if (isLgGraphDragActive(graph)) return

    const LG_SIDEBAR_FIT_MAX_SCALE = 2

    const doFit = () => {
        try {
            if (isLgGraphDragActive(graph)) return

            const border = 10
            const cw = graph.container.clientWidth - border
            const ch = graph.container.clientHeight - border
            if (cw <= 0 || ch <= 0) return

            const prevScale = graph.view.scale
            let bounds = getLgDiagramFitBounds(graph)
            if (!bounds) {
                graph.zoomTo(1)
                if (typeof ui.resetScrollbars === 'function') ui.resetScrollbars()
                return
            }

            // 内容小于当前视口时扩展虚拟边界，配合缩放上限防止单开关/变压器撑满画布
            const minW = cw / Math.max(prevScale, 1)
            const minH = ch / Math.max(prevScale, 1)
            bounds = expandLgFitBounds(bounds, minW, minH)

            let scale =
                Math.floor(20 * Math.min(cw / bounds.width, ch / bounds.height)) / 20
            scale = Math.min(scale, prevScale, LG_SIDEBAR_FIT_MAX_SCALE)
            scale = Math.max(scale, 0.01)

            graph.zoomTo(scale)

            const t = graph.view.translate
            const scrollLeft =
                (bounds.x + t.x) * scale -
                Math.max((cw - bounds.width * scale) / 2 + border / 2, 0)
            const scrollTop =
                (bounds.y + t.y) * scale -
                Math.max((ch - bounds.height * scale) / 2 + border / 2, 0)

            window.setTimeout(() => {
                graph.container.scrollLeft = Math.max(0, scrollLeft)
                graph.container.scrollTop = Math.max(0, scrollTop)
                ui.scrollLeft = graph.container.scrollLeft
                ui.scrollTop = graph.container.scrollTop
                if (typeof graph.sizeDidChange === 'function') {
                    graph.sizeDidChange()
                }
                if (ui.toolbar?.updateZoom) ui.toolbar.updateZoom()
            }, 0)
        } catch (e) {
            console.warn('侧栏切换后画布适配失败', e)
        }
    }

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            window.setTimeout(doFit, 50)
        })
    })
}

/** 左侧图元侧栏展开/收起，收起时画布铺满剩余区域 */
function applyLgSidebarLayout(ui, container, expanded) {
    lgSidebarExpanded.value = expanded
    const graphCon = document.getElementById('graphCon')
    if (graphCon) {
        graphCon.classList.toggle('lg-sidebar-expanded', expanded)
        graphCon.classList.toggle('lg-sidebar-collapsed', !expanded)
    }
    if (ui) {
        ui.hsplitPosition = expanded ? LG_SIDEBAR_WIDTH : 0
        if (typeof ui.refresh === 'function') {
            ui.refresh()
        }
    }
    if (!container) return

    const sidebar =
        container.querySelector('.geSidebarContainer') ||
        container.querySelector('.geSidebar')
    const hsplit = container.querySelector('.geHsplit')
    const diagramContainer = container.querySelector('.geDiagramContainer')

    if (expanded) {
        if (sidebar) {
            sidebar.style.display = 'block'
            sidebar.style.visibility = 'visible'
            sidebar.style.width = LG_SIDEBAR_WIDTH + 'px'
        }
        if (hsplit) {
            hsplit.style.display = 'block'
            hsplit.style.visibility = 'visible'
        }
        if (diagramContainer) {
            diagramContainer.style.left = LG_SIDEBAR_WIDTH + 'px'
            diagramContainer.style.right = '0px'
        }
    } else {
        if (sidebar) {
            sidebar.style.display = 'none'
            sidebar.style.visibility = 'hidden'
            sidebar.style.width = '0'
        }
        if (hsplit) {
            hsplit.style.display = 'none'
            hsplit.style.visibility = 'hidden'
        }
        if (diagramContainer) {
            diagramContainer.style.left = '0px'
            diagramContainer.style.right = '0px'
        }
    }
    hideLgRightFormatPanel(ui, container, false)
    const graph = ui?.editor?.graph
    if (ui && typeof ui.refresh === 'function') {
        ui.refresh()
    }
    if (graph && typeof graph.sizeDidChange === 'function') {
        graph.sizeDidChange()
    }
    fitLgDiagramToViewport(ui)
}

/** 隐藏右侧「绘图/样式」格式面板，画布铺满剩余区域 */
function hideLgRightFormatPanel(ui, container, refreshUi = true) {
    if (ui) {
        ui.formatWidth = 0
        if (typeof ui.toggleFormatPanel === 'function') {
            ui.toggleFormatPanel(false)
        }
        if (ui.toggleFormatElement) {
            ui.toggleFormatElement.style.display = 'none'
            ui.toggleFormatElement.style.visibility = 'hidden'
            ui.toggleFormatElement.style.pointerEvents = 'none'
        }
        if (refreshUi && typeof ui.refresh === 'function') {
            ui.refresh()
        }
    }
    if (!container) return
    const hideEl = (el) => {
        if (!el) return
        el.style.display = 'none'
        el.style.visibility = 'hidden'
        el.style.width = '0'
        el.style.maxWidth = '0'
        el.style.overflow = 'hidden'
        el.style.pointerEvents = 'none'
    }
    hideEl(container.querySelector('.geFormatContainer'))
    hideEl(container.querySelector('.geVsplit'))
    const diagramContainer = container.querySelector('.geDiagramContainer')
    if (diagramContainer) {
        diagramContainer.style.right = '0px'
    }
}

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

// ==================== 页面模式（dataset=/graphLg，gfile=/in-site-svg，svgfile=/region-system-svg） ====================
const props = defineProps({
    mode: {
        type: String,
        default: 'dataset',
        validator: (v) => ['dataset', 'gfile', 'svgfile'].includes(v),
    },
    gFileUrl: {
        type: String,
        default: '',
    },
    svgFileUrl: {
        type: String,
        default: '',
    },
})
const isDatasetMode = computed(() => props.mode === 'dataset')
const isGFileMode = computed(() => props.mode === 'gfile')
const isSvgFileMode = computed(() => props.mode === 'svgfile')

// ==================== 路由参数获取 ====================
const route = useRoute()
const router = useRouter()
let { id, taskId, name } = route.query  // 从 URL 获取：正交图ID、任务ID、名称

/** 从 /in-site-svg 跳转时携带的馈线 query */
function getFeederQueryFromRoute() {
    const q = route.query
    const feeder = q.feeder != null ? String(q.feeder) : ''
    const feederKey = q.feederKey != null ? String(q.feederKey) : ''
    const keyid = q.keyid != null ? String(q.keyid) : ''
    const rtkeyid = q.rtkeyid != null ? String(q.rtkeyid) : ''
    if (!feeder && !feederKey && !keyid) {
        return null
    }
    return { feeder, feederKey, keyid, rtkeyid }
}

const feederFromRoute = getFeederQueryFromRoute()

// 页面标题：优先馈线名，其次 name 参数
if (feederFromRoute?.feeder) {
    document.title = feederFromRoute.feeder
} else if (name) {
    document.title = name
}

// ==================== 组件状态变量 ====================
let uiEditor                       // 编辑器 UI 实例（App 类的实例）
let poleEle = ref()                 // 柱上辅助复选框的引用
const selectedData = ref('fucheng23')  // /graphLg 及站内馈线跳转默认府城变23板府馨线

/** /graphLg 数据源下拉框可见项（仅府城变四条线路） */
const VISIBLE_DATASET_KEYS = ['fucheng09', 'fucheng19', 'fucheng22', 'fucheng23']
const stationDataOptions = STATION_DATA_OPTIONS.filter((o) => VISIBLE_DATASET_KEYS.includes(o.value))

// 数据源映射
const dataSources = {
    zjtSvg: zjtSvg,
    svg2: svg2,
    ...STATION_DATA_MAP,
}

/** 将 G 文件 buffer 转为 SVG 并加载到编辑器 */
async function loadGFromBuffer(arrayBuffer) {
    const { svg: svgStr, missingSymbols } = await convertFacGBufferToSvg(arrayBuffer, {})
    if (missingSymbols?.length) {
        console.warn('[facG] 以下图元未在工程中加载:', missingSymbols)
    }
    loadSvgIntoEditor(svgStr)
    return svgStr
}

/** 从 URL 加载预设 SVG 文件（/region-system-svg 使用） */
async function loadPresetSvgFile() {
    const url = props.svgFileUrl
    if (!url) {
        ElMessage.error('未配置 SVG 文件路径')
        return
    }
    const statusEl = document.getElementById('geStatus')
    if (statusEl) {
        statusEl.textContent = '正在加载 SVG…'
    }
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }
        loadSvgIntoEditor(await response.text())
    } catch (e) {
        console.error('SVG 文件加载失败:', e)
        if (statusEl) {
            statusEl.textContent = 'SVG 文件加载失败'
        }
        ElMessage.error('SVG 文件加载失败: ' + (e.message || e))
    }
}

/** 从 URL 加载预设 G 文件（/in-site-svg 使用） */
async function loadPresetGFile() {
    const url = props.gFileUrl
    if (!url) {
        ElMessage.error('未配置 G 文件路径')
        return
    }
    const statusEl = document.getElementById('geStatus')
    if (statusEl) {
        statusEl.textContent = '正在加载 G 文件…'
    }
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }
        await loadGFromBuffer(await response.arrayBuffer())
    } catch (e) {
        console.error('G 文件加载失败:', e)
        if (statusEl) {
            statusEl.textContent = 'G 文件加载失败'
        }
        ElMessage.error('G 文件加载失败: ' + (e.message || e))
    }
}

/** 加载 SVG 到编辑器（须用 window.initGraphWithSvg：赋值在 onMounted 内） */
function loadSvgIntoEditor(selectedSvg) {
    const load = typeof window.initGraphWithSvg === 'function' ? window.initGraphWithSvg : null
    if (!selectedSvg || !load) return
    // App.main 在 isMainCalled 为 true 时直接 return，必须重置后才能再次加载新 SVG
    App.isMainCalled = false
    try {
        if (uiEditor?.editor?.graph) {
            teardownLgPvIconShine(uiEditor.editor.graph)
        }
        if (uiEditor) {
            uiEditor.destroy()
            uiEditor = null
        }
    } catch (e) {
        console.warn('切换数据源：销毁编辑器', e)
    }
    load(selectedSvg, undefined)
}

// 数据切换处理函数
const handleDataChange = () => {
    loadSvgIntoEditor(dataSources[selectedData.value])
}

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

/** 站内图馈线点击 → 跳转 /graphLg 并携带馈线信息（由 graph.js 调用） */
window.navigateToGraphLgWithFeeder = (payload) => {
    router.push({
        path: '/graphLg',
        query: {
            feeder: payload.feeder || '',
            feederKey: payload.feederKey || '',
            keyid: payload.keyid || '',
            rtkeyid: payload.rtkeyid || '',
        },
    })
}

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
            applyLgCanvasTheme(ui, getLgCanvasTheme())

            // 强制显示 Sidebar 和分割线
            uiEditor = ui
            hideLgRightFormatPanel(ui, document.getElementById(conid))
            setTimeout(() => {
                const container = document.getElementById(conid)
                if (!container) return

                if (isSvgFileMode.value) {
                    applyLgSvgViewOnlyMode(ui, container)
                    return
                }

                // 直接通过 DOM 查找并显示
                if (container) {
                    applyLgSidebarLayout(ui, container, lgSidebarExpanded.value)

                    // 初始化 Sidebar：按页面模式加载对应图元面板
                    if (ui.sidebar) {
                        try {
                            // Sidebar 构造时已 init；勿重复 init，避免默认面板重复插入导致顺序漂移
                            // 注册 symbol→stencil（含 cbreaker），避免仅侧栏模板未加载导致 shape 无效、旋转失效
                            if (
                                lgsvgParser.stencilDoc &&
                                typeof ui.sidebar.addStencilShape === 'function'
                            ) {
                                ui.sidebar.addStencilShape(
                                    'lg',
                                    '',
                                    lgsvgParser.stencilDoc,
                                    ';',
                                    null,
                                    null,
                                    1
                                )
                            }

                            const gfileMode = isGFileMode.value
                            const inSiteSizing = gfileMode
                                ? resolveLgInSiteGfileSidebarSizing(lgsvgParser)
                                : null
                            if (!gfileMode) {
                                cacheLgSidebarRefFromParser(lgsvgParser, selectedData.value)
                            }
                            if (inSiteSizing && typeof lgsvgParser.setInSiteSidebarDragDef === 'function') {
                                lgsvgParser.setInSiteSidebarDragDef(inSiteSizing.dragDef)
                            }
                            // gfile：变压器/机组/负荷跟 G 图画布设备；graphLg 仍按数据源策略
                            const symbolMapForTpl = lgsvgParser.getSymbolMap()
                            const gScale =
                                inSiteSizing?.gScale ??
                                (cachedLgSidebarScale != null
                                    ? cachedLgSidebarScale
                                    : lgsvgParser.getScale() || 1)
                            const dragDef =
                                inSiteSizing?.dragDef ?? cachedLgSidebarDragDef
                            const loadSizing =
                                inSiteSizing ??
                                resolveLgLoadSidebarSizing(lgsvgParser, selectedData.value)
                            const { gScale: loadGScale, dragDef: loadDragDef } = loadSizing

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

                            // ── 母线 / 连接线模板（与下方 add 顺序一致：母线→连接线→变压器→机组→开关→负荷）──
                            const lgBusbarFns = [createLgBusbarSidebarEntry(ui)]
                            // 连接线：直线（noEdgeStyle=1，无正交/肘形弯折）；默认下沿中点→上沿中点，上下排列时为竖直线段
                            const lgStraightVerticalLineStyle =
                                'endArrow=none;html=1;rounded=0;noEdgeStyle=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;flag=line;type=polyline;strokeWidth=0.4;strokeColor=rgb(185,72,66);'
                            const lgDashedVerticalLineStyle =
                                lgStraightVerticalLineStyle + 'dashed=1;dashPattern=2 1;'
                            const createLgPaletteLineBreak = () =>
                                function () {
                                    const br = document.createElement('div')
                                    br.className = 'lgSidebarPaletteLineBreak'
                                    return br
                                }
                            const lgBusLineFns = [
                                ui.sidebar.createEdgeTemplateEntry(
                                    lgStraightVerticalLineStyle,
                                    50,
                                    50,
                                    '',
                                    '母线连接线',
                                    null,
                                    null,
                                    '母线连接线 母线-母线 实线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    lgDashedVerticalLineStyle,
                                    50,
                                    50,
                                    '',
                                    '虚线母线连接线',
                                    null,
                                    null,
                                    '虚线母线连接线 母线-母线'
                                ),
                            ]
                            const lgNormalLineFns = [
                                ui.sidebar.createEdgeTemplateEntry(
                                    lgStraightVerticalLineStyle,
                                    50,
                                    50,
                                    '',
                                    '连接线',
                                    null,
                                    null,
                                    '连接线 普通 设备 实线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    lgDashedVerticalLineStyle,
                                    50,
                                    50,
                                    '',
                                    '虚线连接线',
                                    null,
                                    null,
                                    '虚线连接线 普通 设备'
                                ),
                            ]
                            const lgLineFns = [
                                ...lgBusLineFns,
                                createLgPaletteLineBreak(),
                                ...lgNormalLineFns,
                            ]

                            // 侧栏分类：/in-site-svg → 母线、连接线、变压器、开关；/graphLg → 母线、连接线、机组、开关、负荷
                            ui.sidebar.addPaletteFunctions('lg-busbar', '母线', true, lgBusbarFns)
                            ui.sidebar.addPaletteFunctions('lg-lines', '连接线', true, lgLineFns)

                            if (gfileMode) {
                                const lgTransformerFns = createLgVertexPaletteFns(
                                    ui,
                                    LG_SIDEBAR_TRANSFORMER_ENTRIES,
                                    symbolMapForTpl,
                                    dragDef,
                                    gScale
                                )
                                ui.sidebar.addPaletteFunctions('lg-transformer', '变压器', true, lgTransformerFns)
                            }

                            if (!gfileMode) {
                                const lgUnitFns = createLgVertexPaletteFns(
                                    ui,
                                    LG_SIDEBAR_UNIT_ENTRIES,
                                    symbolMapForTpl,
                                    dragDef,
                                    gScale
                                )
                                ui.sidebar.addPaletteFunctions('lg-unit', '机组', true, lgUnitFns)
                            }

                            const buildLgSwitchPaletteFns = () => {
                                const size = resolveCachedLgSwitchDragSize(lgsvgParser)
                                return LG_SIDEBAR_SWITCH_ENTRIES.map((entry) => {
                                    const symbolId = entry[0]
                                    const label = entry[1]
                                    const styleExtra =
                                        entry.length > 4 && entry[4] ? String(entry[4]) : ''
                                    const style =
                                        `shape=${symbolId};whiteSpace=wrap;aspect=fixed;` +
                                        styleExtra
                                    return ui.sidebar.createVertexTemplateEntry(
                                        style,
                                        size.w,
                                        size.h,
                                        '',
                                        label,
                                        null,
                                        null,
                                        label
                                    )
                                })
                            }
                            // 站内-断路器(0305)：与 lgdata Breaker_30500000 尺寸一致，可旋转
                            ui.sidebar.addPaletteFunctions(
                                'lg-switch',
                                '开关',
                                true,
                                buildLgSwitchPaletteFns()
                            )

                            if (!gfileMode) {
                                // 先算出各负荷图元宽高；箱式变(zf08) 与配电站(zf06) 强制同尺寸
                                const lgDeviceSizes = LG_SIDEBAR_DEVICE_ENTRIES.map((entry) => {
                                    const symbolId = entry[0]
                                    const label = entry[1]
                                    const fw = entry[2]
                                    const fh = entry[3]
                                    const styleExtra =
                                        entry.length > 4 && entry[4] ? String(entry[4]) : ''
                                    const key = String(symbolId).toLowerCase()
                                    const fromGraph = loadDragDef[key]
                                    const { w, h } = resolveLgSidebarDragWh(
                                        key,
                                        fw,
                                        fh,
                                        fromGraph,
                                        symbolMapForTpl,
                                        loadGScale
                                    )
                                    return { symbolId, label, key, w, h, styleExtra }
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
                                const lgDeviceFns = lgDeviceSizes.map(
                                    ({ symbolId, label, w, h, styleExtra }) => {
                                        const style =
                                            `shape=${symbolId};whiteSpace=wrap;aspect=fixed;` +
                                            styleExtra
                                        return ui.sidebar.createVertexTemplateEntry(
                                            style,
                                            w,
                                            h,
                                            '',
                                            label,
                                            null,
                                            null,
                                            label
                                        )
                                    }
                                )
                                ui.sidebar.addPaletteFunctions('lg-devices', '负荷', true, lgDeviceFns)

                                // ── 辅助：将解析出的图元节点追加到「负荷」面板 ──
                                const appendScratchNodes = (scratchNodes) => {
                                    if (!scratchNodes || scratchNodes.length === 0) return
                                    const palette = ui.sidebar.palettes['lg-devices']
                                    const contentDiv = palette && palette[1] && palette[1].firstChild
                                    if (contentDiv) {
                                        scratchNodes.forEach(node => contentDiv.appendChild(node))
                                        console.log('便笺本图元已追加到「负荷」面板，共', scratchNodes.length, '个')
                                    } else {
                                        console.warn('未找到「负荷」面板 content div，palettes:', ui.sidebar.palettes['lg-devices'])
                                    }
                                }

                                const loadScratchpad = () => {
                                    if (typeof StorageFile !== 'undefined') {
                                        StorageFile.getFileContent(ui, '.scratchpad', (xml) => {
                                            console.log('StorageFile.getFileContent 回调，xml长度:', xml ? xml.length : 0)
                                            if (xml && xml !== ui.emptyLibraryXml) {
                                                appendScratchNodes(parseScratchpadXml(xml))
                                            } else {
                                                const lsXml = localStorage.getItem('.scratchpad')
                                                console.log('localStorage .scratchpad 长度:', lsXml ? lsXml.length : 0)
                                                if (lsXml) appendScratchNodes(parseScratchpadXml(lsXml))
                                            }
                                        })
                                    } else {
                                        const lsXml = localStorage.getItem('.scratchpad')
                                        if (lsXml) appendScratchNodes(parseScratchpadXml(lsXml))
                                    }
                                }
                                loadScratchpad()
                            }

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
    if (isGFileMode.value) {
        window.__lgInSiteSvgMode = true
    }
    if (isSvgFileMode.value) {
        window['disableOper'] = true
        window['customShape'] = false
    }

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
                lgsvgParser.pvDeviceList =
                    selectedData.value === 'changcun' ? changcunPvList : null

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
                    if (isGFileMode.value) {
                        loadPresetGFile()
                        return
                    }
                    if (isSvgFileMode.value) {
                        loadPresetSvgFile()
                        return
                    }
                    const firstSvg = dataSources[selectedData.value]
                    console.log('graphLg init', selectedData.value, firstSvg && firstSvg.length)
                    window.initGraphWithSvg(firstSvg, undefined)
                    if (feederFromRoute) {
                        const stationLabel =
                            stationDataOptions.find((o) => o.value === selectedData.value)?.label || '府城变23板府馨线'
                        ElMessage.success(
                            `已打开馈线：${feederFromRoute.feeder || feederFromRoute.feederKey}（${stationLabel}）`
                        )
                    }
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
    if (isGFileMode.value) {
        window.__lgInSiteSvgMode = false
    }
    if (isSvgFileMode.value) {
        window['disableOper'] = false
        window['customShape'] = true
    }
    delete window.navigateToGraphLgWithFeeder
    try {
        if (uiEditor?.editor?.graph) {
            teardownLgPvIconShine(uiEditor.editor.graph)
        }
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

// 左侧图元侧栏：展开 / 收起
.graphCon.lg-sidebar-expanded {
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
        right: 0 !important;
    }
}

.graphCon.lg-sidebar-collapsed {
    ::v-deep .geSidebarContainer {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        max-width: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
    }

    ::v-deep .geSidebar {
        display: none !important;
        visibility: hidden !important;
    }

    ::v-deep .geHsplit {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        pointer-events: none !important;
    }

    ::v-deep .geDiagramContainer {
        left: 0 !important;
        right: 0 !important;
    }
}

/* 连接线面板：母线连接线与普通连接线分行展示 */
::v-deep .geSidebar .lgSidebarPaletteLineBreak {
    display: block;
    width: 100%;
    height: 0;
    clear: both;
}

/* 母线侧栏预览：仅加粗展示，拖入画布/导出 SVG 仍为 1.6 高 */
::v-deep .geSidebar .lgSidebarBusbarPreview {
    display: flex !important;
    align-items: center;
    justify-content: center;
}

::v-deep .geSidebar .lgSidebarBusbarPreviewBar {
    width: calc(100% - 6px);
    height: 3px;
    min-height: 3px;
    background: rgb(185, 72, 66);
    border-radius: 1px;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
    pointer-events: none;
}

::v-deep .geFormatContainer,
::v-deep .geVsplit {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    max-width: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
}

.lg-sidebar-toggle {
    position: absolute;
    /* 高于侧栏(1)，低于 mxPopupMenu(10006) 与顶部下拉菜单 */
    z-index: 2;
    top: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 44px;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0 6px 6px 0;
    background: linear-gradient(90deg, rgba(245, 247, 250, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
    color: #909399;
    cursor: pointer;
    box-shadow:
        1px 0 0 rgba(0, 0, 0, 0.06),
        2px 0 8px rgba(0, 0, 0, 0.06);
    user-select: none;
    box-sizing: border-box;
    pointer-events: auto;
    transform: translateY(-50%);
    transition:
        width 0.2s ease,
        color 0.2s ease,
        background 0.2s ease,
        box-shadow 0.2s ease;
}

.lg-sidebar-toggle::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 2px;
    border-radius: 0 1px 1px 0;
    background: transparent;
    transition: background 0.2s ease;
}

.lg-sidebar-toggle:hover {
    width: 14px;
    color: #409eff;
    background: #fff;
    box-shadow:
        1px 0 0 rgba(64, 158, 255, 0.25),
        2px 0 12px rgba(64, 158, 255, 0.12);
}

.lg-sidebar-toggle:hover::before {
    background: #409eff;
}

.lg-sidebar-toggle__svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}

.lg-sidebar-toggle__svg path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.lg-sidebar-toggle--collapse {
    left: 240px;
    transform: translate(-100%, -50%);
}

.lg-sidebar-toggle--collapse:active {
    transform: translate(-100%, -50%) scale(0.96);
}

.lg-sidebar-toggle--expand {
    left: 0;
}

.lg-sidebar-toggle--expand:active {
    transform: translateY(-50%) scale(0.96);
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

/* 滚动条：侧栏（深色）/ 画布与弹窗（浅色）统一细条样式 */
@mixin lg-thin-scrollbar($thumb, $thumb-hover) {
    scrollbar-width: thin;
    scrollbar-color: #{$thumb} transparent;

    &::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        background-color: #{$thumb};
        border-radius: 999px;
        border: 1px solid transparent;
        background-clip: padding-box;
        transition: background-color 0.2s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
        background-color: #{$thumb-hover};
    }

    &::-webkit-scrollbar-corner {
        background: transparent;
    }
}

.graphCon {
    ::v-deep .geSidebarContainer,
    ::v-deep .geSidebarContainer > div,
    ::v-deep .geSidebarContainer .geSidebar {
        @include lg-thin-scrollbar(rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.42));
    }

    ::v-deep .geDiagramContainer,
    ::v-deep .geDiagramContainer > div,
    ::v-deep .lg-edit-dialog-body,
    ::v-deep .geDialog,
    ::v-deep .mxWindowPane {
        @include lg-thin-scrollbar(rgba(120, 126, 134, 0.38), rgba(64, 158, 255, 0.55));
    }
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

<style lang="scss">
/* draw.io 右键菜单等挂载在 body 下，需全局作用域 */
.mxPopupMenu,
.mxWindow .mxWindowPane {
    scrollbar-width: thin;
    scrollbar-color: rgba(120, 126, 134, 0.38) transparent;
}

.mxPopupMenu::-webkit-scrollbar,
.mxWindow .mxWindowPane::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.mxPopupMenu::-webkit-scrollbar-track,
.mxWindow .mxWindowPane::-webkit-scrollbar-track {
    background: transparent;
}

.mxPopupMenu::-webkit-scrollbar-thumb,
.mxWindow .mxWindowPane::-webkit-scrollbar-thumb {
    background-color: rgba(120, 126, 134, 0.38);
    border-radius: 999px;
    border: 1px solid transparent;
    background-clip: padding-box;
}

.mxPopupMenu::-webkit-scrollbar-thumb:hover,
.mxWindow .mxWindowPane::-webkit-scrollbar-thumb:hover {
    background-color: rgba(64, 158, 255, 0.55);
}
</style>
