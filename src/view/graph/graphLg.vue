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
// import { checkEditZjtPermission } from '@/api/tmzx/abnormalchange/index.ts'

// 导入其他工具
import $bus from '@/utils/bus'                                           // 全局事件总线
import customSymbolStr from './data/symbol.js'                           // 自定义 SVG 符号
import LGSvgParser from '@/view/graph/lg/LGSvgParser.js'                 // SVG 解析器
// import * as api from '@/api/tmzx/abnormalchange'
import { ElMessage } from 'element-plus'                                  // 消息提示组件

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

// ==================== 容器 ID 生成 ====================
// 生成唯一的容器 ID，避免多个实例冲突
// 格式: geEditor_时间戳
let conid = 'geEditor_' + new Date().getTime()
let geEditor = ref(conid)           // Vue 响应式引用，绑定到模板中的 :id

let svgTxtObj // 存储symbol及defs等信息

let initEditFun = (svgstr, lgsvgParser) => {
    App['main'](
        (ui) => {
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

                    // 初始化 Sidebar，只加载电力设备面板
                    if (ui.sidebar) {
                        try {
                            // 调用 Sidebar 的 init() 方法
                            ui.sidebar.init()

                            // ── 构建基础电力设备图元列表（基于 symbol.js 中的 SVG 符号）──
                            // 定义图元数据：symbolId, 中文标签, 原宽度, 原高度
                            const lgDeviceItems = [
                                ['junction',            '节点/T接',          52,  60],
                                ['breaker',             '断路器',            120,  63],
                                ['breaker0305',         '站内-断路器(0305)', 120,  56],
                                ['disconnector',        '隔离开关',          120,  74],
                                ['fuse',                '熔断器',            120,  51],
                                ['grounddisconnector',  '接地刀闸',          120,  61],
                                ['powertransformer',    '变压器',             90,  98],
                                ['currenttransformer',  '电流互感器',         60,  71],
                                ['potentialtransformer','电压互感器',         70,  68],
                                ['remoteunit',          '远动装置',           70,  70],
                                ['polecode',            '杆塔',               50,  50],
                                ['substation',          '配电站(zf06)',       70,  70],
                                ['xb',                  '箱式变电站(zf08)',   70,  70],
                                ['lightningarrester',   '避雷器',             50,  80],
                            ]

                            // 辅助函数：从 symbol.js 中提取指定 symbol 的 SVG
                            const getSymbolSvg = (symbolId) => {
                                const regex = new RegExp(`<symbol[^>]*id=["']${symbolId}["'][^>]*>([\\s\\S]*?)</symbol>`, 'i')
                                const match = customSymbolStr.match(regex)
                                if (match && match[1]) {
                                    // match[1] 是 symbol 标签内的内容
                                    const symbolContent = match[0]
                                    const widthMatch = symbolContent.match(/width=["'](\d+(?:\.\d+)?)["']/)
                                    const heightMatch = symbolContent.match(/height=["'](\d+(?:\.\d+)?)["']/)
                                    const viewBoxMatch = symbolContent.match(/viewBox=["']([^"']+)["']/)
                                    const w = widthMatch ? widthMatch[1] : 100
                                    const h = heightMatch ? heightMatch[1] : 100
                                    const vb = viewBoxMatch ? viewBoxMatch[1] : `0 0 ${w} ${h}`
                                    // 提取 symbol 内的内容，而不是整个 symbol 标签
                                    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${match[1]}</svg>`
                                }
                                return null
                            }

                            // 创建基于 SVG symbol 的图元
                            const lgDeviceFns = lgDeviceItems.map(([symbolId, label, w, h]) => {
                                const svgStr = getSymbolSvg(symbolId)
                                if (svgStr) {
                                    // 将 SVG 转换为 Data URI（使用更可靠的编码方式）
                                    const encodedSvg = svgStr.replace(/#/g, '%23').replace(/\n/g, '').replace(/\r/g, '')
                                    const svgUri = 'data:image/svg+xml,' + encodedSvg
                                    const style = `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=${svgUri};`
                                    return ui.sidebar.createVertexTemplateEntry(style, w, h, '', label, null, null, label)
                                }
                                // 如果没有找到对应的 symbol，回退到使用 shape id
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

                            // ── 用 StorageFile.getFileContent 异步读取便笺本，追加到电力设备面板 ──
                            // 先渲染基础图元
                            ui.sidebar.addPaletteFunctions('lg-devices', '电力设备', true, lgDeviceFns)

                            // ── 连接线分类 ──
                            const lgLineFns = [
                                ui.sidebar.createEdgeTemplateEntry(
                                    'endArrow=none;html=1;',
                                    50, 50, '', '直线', null, null, '直线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    'endArrow=none;dashed=1;html=1;',
                                    50, 50, '', '虚线', null, null, '虚线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    'endArrow=classic;html=1;',
                                    50, 50, '', '有向连接线', null, null, '有向连接线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    'endArrow=classic;startArrow=classic;html=1;',
                                    50, 50, '', '双向连接线', null, null, '双向连接线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    'endArrow=none;html=1;edgeStyle=orthogonalEdgeStyle;',
                                    50, 50, '', '直角折线', null, null, '直角折线'
                                ),
                                ui.sidebar.createEdgeTemplateEntry(
                                    'endArrow=none;html=1;curved=1;',
                                    50, 50, '', '曲线', null, null, '曲线'
                                ),
                            ]
                            ui.sidebar.addPaletteFunctions('lg-lines', '连接线', true, lgLineFns)

                            // ── 辅助：将解析出的图元节点追加到电力设备面板 ──
                            const appendScratchNodes = (scratchNodes) => {
                                if (!scratchNodes || scratchNodes.length === 0) return
                                // palettes['lg-devices'] = [titleEl, outerDiv]
                                // outerDiv.firstChild 是 .geSidebar content div
                                const palette = ui.sidebar.palettes['lg-devices']
                                const contentDiv = palette && palette[1] && palette[1].firstChild
                                if (contentDiv) {
                                    scratchNodes.forEach(node => contentDiv.appendChild(node))
                                    console.log('便笺本图元已追加到电力设备面板，共', scratchNodes.length, '个')
                                } else {
                                    console.warn('未找到电力设备面板 content div，palettes:', ui.sidebar.palettes['lg-devices'])
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

            let go = (_svg, themecut) => {
                let mysvg = _svg

                lgsvgParser = new LGSvgParser(id)
                lgsvgParser.setTaskId(taskId)
                lgsvgParser.setThemecut(themecut)

                svgTxtObj = lgsvgParser.getSvgSymbolStyle(_svg)

                if (_svg.indexOf('bridgeOverRiver') == -1) {
                    let index = _svg.indexOf('</defs>')
                    let leftStr = _svg.substring(0, index)
                    let rightStr = _svg.substring(index)
                    mysvg = leftStr + customSymbolStr + rightStr
                }

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
                    console.log("getZjtSvggetZjtSvg", zjtSvg)
                    go(zjtSvg, zjtSvg.themecut)
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
}

::v-deep .geHsplit {
    display: block !important;
    visibility: visible !important;
}

::v-deep .geDiagramContainer {
    left: 240px !important;
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
