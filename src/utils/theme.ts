/*
 * @Author: mapan mapanq123@qq.com
 * @Date: 2025-07-25 10:26:55
 * @LastEditors: mapan mapanq123@qq.com
 * @LastEditTime: 2025-07-25 15:04:14
 * @FilePath: \micWeb-template\src\utils\theme.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { useAppStore } from '@/store/modules/app'
import { useDesign } from '@/hooks/web/useDesign'
import { useCssVar } from '@vueuse/core'
import { colorIsDark, hexToRGB, lighten, darkenHex } from '@/utils/color'
import { setCssVar } from '@/utils'
import { computed } from 'vue'

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('layout-radio-picker')

const appStore = useAppStore()

// 5种主题 全绿 绿白 全蓝 蓝白 深蓝
const getLeftMenuBgActiveColor = (color, flag) => {
  if (!flag) {
    if (color === '#103377') {
      return '#4290ff'
    } else {
      return darkenHex(color, 0.2)
    }
  } else {
    return hexToRGB(color, 0.2)
  }
}

const theme = computed(() => appStore.getTheme)
/**
 *
 * @param c 颜色
 * @param flag 是否白色菜单栏 true是 false否
 */
export const setTheme = (c: any, flag = false) => {
  const color = c
  // 站房主题切换
  let zfThemeName = ''
  switch (color) {
    case '#018987':
      zfThemeName = 'stateGridGreen'
      break
    case '#035580':
      zfThemeName = 'stateGridBlue'
      break
    case '#103377':
      zfThemeName = 'blue'
      break
    default:
      zfThemeName = 'stateGridGreen'
      break
  }

  document.documentElement.setAttribute('theme-color', zfThemeName)
  const isDarkColor = colorIsDark(color)
  const textColor = isDarkColor ? '#fff' : 'inherit'
  const textHoverColor = isDarkColor ? lighten(color!, 6) : '#f6f6f6'
  const topToolBorderColor = isDarkColor ? color : '#eee'
  setCssVar('--top-header-bg-color', color)
  setCssVar('--top-header-text-color', textColor)
  setCssVar('--top-header-hover-color', textHoverColor)
  const primaryColor = useCssVar('--el-color-primary', document.documentElement)
  setCssVar('--el-color-primary', color)

  appStore.setTheme({
    elColorPrimary: color,
    topHeaderBgColor: color,
    topHeaderTextColor: textColor,
    topHeaderHoverColor: textHoverColor,
    topToolBorderColor,
    topToolBgColor: color === '#103377' ? '#061e4b' : '#ffffff',
    // 左侧菜单边框颜色
    leftMenuBorderColor: isDarkColor ? 'inherit' : '#eee',
    // 左侧菜单背景颜色
    leftMenuBgColor: !flag ? color : '#ffffff',
    // 左侧菜单浅色背景颜色
    leftMenuBgLightColor: isDarkColor ? lighten(color!, 0.1) : color,
    // 左侧菜单选中背景颜色
    leftMenuBgActiveColor: getLeftMenuBgActiveColor(color, flag),
    // 左侧菜单收起选中背景颜色
    leftMenuCollapseBgActiveColor: isDarkColor
      ? 'var(--el-color-primary)'
      : hexToRGB(unref(primaryColor), 0.1),
    // 左侧菜单字体颜色
    leftMenuTextColor: !flag ? '#ffffff' : '#000000',
    // 左侧菜单选中字体颜色
    // --left-menu-text-active-color
    leftMenuTextActiveColor: !flag ? '#ffffff' : 'var(--el-color-primary)',
    // logo字体颜色
    logoTitleTextColor: isDarkColor ? '#ffffff' : 'inherit',
    // logo边框颜色
    logoBorderColor: isDarkColor ? color : '#eee',
    // 是否白色菜单主题色
    isWhiteBgMenu: flag
  })
  appStore.setCssVarTheme()
}
