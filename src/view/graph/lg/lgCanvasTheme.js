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

export function getLgCanvasTheme() {
    try {
        const stored = localStorage.getItem(LG_CANVAS_THEME_STORAGE_KEY)
        return stored === 'light' ? 'light' : 'dark'
    } catch {
        return 'dark'
    }
}

export function getLgCanvasBackgroundColor(theme = getLgCanvasTheme()) {
    return theme === 'light' ? THEME_BG.light : THEME_BG.dark
}

/** 设备名称文字颜色（亮色主题黑色，暗色主题白色） */
export function getLgDeviceNameFontColor(theme = getLgCanvasTheme()) {
    return theme === 'light' ? THEME_DEVICE_NAME_COLOR.light : THEME_DEVICE_NAME_COLOR.dark
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

/** 按当前主题刷新画布内设备名称字体颜色 */
export function applyLgDeviceNameFontColors(ui, theme = getLgCanvasTheme()) {
    const graph = ui?.editor?.graph
    if (!graph) {
        return
    }

    const color = getLgDeviceNameFontColor(theme)
    const fontColorKey =
        typeof mxConstants !== 'undefined' ? mxConstants.STYLE_FONTCOLOR : 'fontColor'
    const model = graph.getModel()
    const cells = []

    for (const id in model.cells) {
        const cell = model.cells[id]
        if (isLgDeviceNameTextCell(cell, graph)) {
            cells.push(cell)
        }
    }

    if (cells.length === 0) {
        return
    }

    graph.setCellStyles(fontColorKey, color, cells)
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

    applyLgDeviceNameFontColors(ui, resolved)

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
