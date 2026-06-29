/** 正交图画布背景主题：亮色 / 暗色 */

import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'

export const LG_CANVAS_THEME_STORAGE_KEY = 'lgCanvasTheme'

const THEME_BG = {
    dark: '#000000',
    light: '#ffffff',
}

const THEME_DEVICE_NAME_COLOR = {
    dark: '#ffffff',
    light: '#000000',
}

const THEME_MEASURE_COLOR = {
    dark: '#959595',
    light: '#000000',
}

const THEME_FEEDER_NAME_FALLBACK = {
    dark: '#00ff00',
    light: '#000000',
}

const THEME_FLOW_OVERLAY_COLOR = {
    dark: '#00e5ff',
    light: '#000000',
}

export function getLgCanvasTheme() {
    try {
        const stored = localStorage.getItem(LG_CANVAS_THEME_STORAGE_KEY)
        return stored === 'dark' ? 'dark' : 'light'
    } catch {
        return 'light'
    }
}

/** 隐藏画布网格（/graphLg、/in-site-svg、/region-system-svg 默认不显示） */
export function applyLgGridHidden(uiOrGraph) {
    const graph = uiOrGraph?.editor?.graph ?? uiOrGraph
    if (!graph || typeof graph.setGridEnabled !== 'function') {
        return
    }
    graph.defaultGridEnabled = false
    graph.setGridEnabled(false)
}

export function getLgCanvasBackgroundColor(theme = getLgCanvasTheme()) {
    return theme === 'light' ? THEME_BG.light : THEME_BG.dark
}

/** 设备名称文字颜色（亮色主题黑色，暗色主题白色） */
export function getLgDeviceNameFontColor(theme = getLgCanvasTheme()) {
    return theme === 'light' ? THEME_DEVICE_NAME_COLOR.light : THEME_DEVICE_NAME_COLOR.dark
}

/** 量测数据（Point_Layer / pqi）文字颜色 */
export function getLgMeasureFontColor(theme = getLgCanvasTheme()) {
    return theme === 'light' ? THEME_MEASURE_COLOR.light : THEME_MEASURE_COLOR.dark
}

/** 馈线名称（Hot_Layer / lgPeiXian）文字颜色；暗色主题恢复 SVG 原始色 */
export function getLgFeederNameFontColor(theme = getLgCanvasTheme(), originalFill) {
    if (theme === 'light') {
        return THEME_FEEDER_NAME_FALLBACK.light
    }
    return originalFill || THEME_FEEDER_NAME_FALLBACK.dark
}

/** 潮流数据上图 overlay 文字颜色 */
export function getLgFlowOverlayFontColor(theme = getLgCanvasTheme()) {
    return theme === 'light' ? THEME_FLOW_OVERLAY_COLOR.light : THEME_FLOW_OVERLAY_COLOR.dark
}

function persistLgCanvasTheme(theme) {
    try {
        localStorage.setItem(LG_CANVAS_THEME_STORAGE_KEY, theme)
    } catch {
        /* ignore */
    }
}

/** Text_Layer 设备名称文本（不含测点、配线链接等） */
export function isLgDeviceNameTextCell(cell, graph) {
    if (!cell || !graph?.getModel()?.isVertex(cell)) {
        return false
    }
    if (!DeviceCategoryUtil.isTextCell(cell)) {
        return false
    }
    if (DeviceCategoryUtil.isPointCell(cell)) {
        return false
    }
    if (cell.lgPeiXian === true) {
        return false
    }

    const st = graph.getCurrentCellStyle(cell) || {}
    if (st.flag === 'pqi') {
        return false
    }
    if (st.layer === 'Hot_Layer' || st.layer === 'Point_Layer') {
        return false
    }

    return st.layer === 'Text_Layer' && st.flag === 'text'
}

/** Point_Layer 量测数据（P/Q/I 等） */
export function isLgMeasureTextCell(cell, graph) {
    if (!cell || !graph?.getModel()?.isVertex(cell)) {
        return false
    }
    if (!DeviceCategoryUtil.isTextCell(cell) && !DeviceCategoryUtil.isPointCell(cell)) {
        return false
    }
    const st = graph.getCurrentCellStyle(cell) || {}
    return st.layer === 'Point_Layer' || st.flag === 'pqi' || DeviceCategoryUtil.isPointCell(cell)
}

/** Hot_Layer 馈线名称（配线链接文字） */
export function isLgFeederNameTextCell(cell, graph) {
    if (!cell || !graph?.getModel()?.isVertex(cell)) {
        return false
    }
    if (cell.lgPeiXian === true || cell.lgRegionFeeder === true) {
        return true
    }
    const st = graph.getCurrentCellStyle(cell) || {}
    return st.layer === 'Hot_Layer'
}

/** 潮流仿真「潮流数据上图」overlay 文本 */
export function isLgFlowOverlayTextCell(cell) {
    if (!cell) {
        return false
    }
    if (cell.lgFlowOverlay === true) {
        return true
    }
    const id = String(cell.id || '')
    return id.startsWith('lg-flow-overlay-')
}

/** 按当前主题刷新画布内设备名称、量测、馈线名称、潮流上图字体颜色 */
export function applyLgThemeTextColors(ui, theme = getLgCanvasTheme()) {
    const graph = ui?.editor?.graph
    if (!graph) {
        return
    }

    const fontColorKey =
        typeof mxConstants !== 'undefined' ? mxConstants.STYLE_FONTCOLOR : 'fontColor'
    const model = graph.getModel()
    const deviceCells = []
    const measureCells = []
    const feederCells = []
    const flowOverlayCells = []

    for (const id in model.cells) {
        const cell = model.cells[id]
        if (isLgFlowOverlayTextCell(cell)) {
            flowOverlayCells.push(cell)
        } else if (isLgDeviceNameTextCell(cell, graph)) {
            deviceCells.push(cell)
        } else if (isLgMeasureTextCell(cell, graph)) {
            measureCells.push(cell)
        } else if (isLgFeederNameTextCell(cell, graph)) {
            feederCells.push(cell)
        }
    }

    if (deviceCells.length > 0) {
        graph.setCellStyles(fontColorKey, getLgDeviceNameFontColor(theme), deviceCells)
    }
    if (measureCells.length > 0) {
        graph.setCellStyles(fontColorKey, getLgMeasureFontColor(theme), measureCells)
    }
    if (flowOverlayCells.length > 0) {
        graph.setCellStyles(fontColorKey, getLgFlowOverlayFontColor(theme), flowOverlayCells)
    }
    for (const cell of feederCells) {
        graph.setCellStyles(
            fontColorKey,
            getLgFeederNameFontColor(theme, cell.lgOriginalFontColor),
            [cell]
        )
    }
}

/** @deprecated 使用 applyLgThemeTextColors */
export function applyLgDeviceNameFontColors(ui, theme = getLgCanvasTheme()) {
    applyLgThemeTextColors(ui, theme)
}

/** 应用画布背景色，并同步 diagram 容器底色 */
export function applyLgCanvasTheme(ui, theme) {
    const resolved = theme === 'light' ? 'light' : 'dark'
    const bg = getLgCanvasBackgroundColor(resolved)
    persistLgCanvasTheme(resolved)

    if (ui && typeof ui.setBackgroundColor === 'function') {
        ui.setBackgroundColor(bg)
    }

    const diagramContainer =
        ui?.diagramContainer ||
        ui?.editor?.graph?.container?.parentNode
    if (diagramContainer && diagramContainer.classList?.contains('geDiagramContainer')) {
        diagramContainer.style.backgroundColor = bg
    }

    applyLgThemeTextColors(ui, resolved)

    if (typeof window !== 'undefined') {
        window.__lgCanvasTheme = resolved
    }

    return resolved
}

function installLgCanvasThemeActions(actions) {
    const ui = actions.editorUi

    const light = actions.put(
        'lgCanvasThemeLight',
        new Action('亮色', function () {
            applyLgCanvasTheme(ui, 'light')
        })
    )
    light.setToggleAction(true)
    light.setSelectedCallback(function () {
        return getLgCanvasTheme() === 'light'
    })

    const dark = actions.put(
        'lgCanvasThemeDark',
        new Action('暗色', function () {
            applyLgCanvasTheme(ui, 'dark')
        })
    )
    dark.setToggleAction(true)
    dark.setSelectedCallback(function () {
        return getLgCanvasTheme() === 'dark'
    })
}

function installLgCanvasThemeMenus() {
    const items = Menus.prototype.defaultMenuItems
    if (items.indexOf('theme') < 0) {
        Menus.prototype.defaultMenuItems = items.concat(['theme'])
    }

    const preMenusInit = Menus.prototype.init
    Menus.prototype.init = function () {
        preMenusInit.apply(this, arguments)

        this.put(
            'theme',
            new Menu(
                mxUtils.bind(this, function (menu, parent) {
                    this.addMenuItems(menu, ['lgCanvasThemeLight', 'lgCanvasThemeDark'], parent)
                })
            )
        )
    }
}

let lgCanvasThemeMenuInstalled = false

/** 注册顶部「主题」菜单（与「其他」同级）及亮色/暗色动作 */
export function installLgCanvasThemeMenu() {
    if (lgCanvasThemeMenuInstalled) return
    if (typeof Actions === 'undefined' || typeof Menus === 'undefined' || typeof Action === 'undefined') {
        return
    }

    const preActionsInit = Actions.prototype.init
    Actions.prototype.init = function () {
        preActionsInit.apply(this, arguments)
        installLgCanvasThemeActions(this)
    }

    installLgCanvasThemeMenus()
    lgCanvasThemeMenuInstalled = true
}
