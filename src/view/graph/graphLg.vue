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

                    // 初始化 Sidebar，只加载便笺本和通用面板
                    if (ui.sidebar) {
                        try {
                            console.log('开始初始化 Sidebar...')

                            // 确保 Scratchpad 被初始化
                            if (!ui.scratchpad) {
                                // 初始化 Scratchpad
                                ui.toggleScratchpad();
                                console.log('Scratchpad 初始化成功')
                            }

                            // 修改Sidebar的默认条目，只显示便笺本和通用
                            ui.sidebar.defaultEntries = '.scratchpad;general'
                            
                            // 确保模板被正确加载
                            ui.sidebar.addStencilsToIndex = true
                            
                            // 调用 Sidebar 的 init() 方法
                            ui.sidebar.init()

                            // 延迟显示便笺本和通用标签，确保所有面板都已加载完成
                            setTimeout(() => {
                                console.log('开始显示便笺本和通用标签')
                                console.log('Sidebar配置:', ui.sidebar.configuration)
                                console.log('默认条目:', ui.sidebar.defaultEntries)
                                console.log('Palettes:', Object.keys(ui.sidebar.palettes))
                                
                                // 只显示便笺本和通用标签
                                ui.sidebar.showEntries('.scratchpad;general', true, true)
                                
                                // 检查通用标签是否显示
                                setTimeout(() => {
                                    console.log('通用标签是否可见:', ui.sidebar.isEntryVisible('general'))
                                    console.log('显示便笺本和通用标签成功')
                                }, 500)
                            }, 2000)

                            console.log('Sidebar 初始化完成，只加载便笺本和通用面板')

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
