import type { RouteLocationNormalized, Router, RouteRecordNormalized } from 'vue-router'
import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { isUrl, isRouterPath } from '@/utils/is'
import {
  AppCustomRouteRecordRaw,
  AppRouteRecordRaw,
  QiankunApp,
  FlatRoute
} from '@/types/permission'
import { cloneDeep, isArray, omit } from 'lodash-es'
import remainingRouter from '@/router/modules/remaining'
import { qiankunStoreWithOut } from '@/store/modules/qiankun'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import pack from '../../package.json'
import { CACHE_KEY, useCache } from '@/hooks/web/useCache'
const vueQiankunStore = qiankunStoreWithOut()
const { wsCache } = useCache()

const modules = import.meta.glob('../views/**/*.{vue,tsx}')

/**
 * 注册一个异步组件
 * @param componentPath 例:/bpm/oa/leave/detail
 */
export const registerComponent = (componentPath: string) => {
  const pathName: any = Object.keys(modules).find((path) => path.includes(componentPath))
  return pathName ? defineAsyncComponent(modules[pathName]) : undefined
}
/* Layout */
export const Layout = () => import('@/layout/Layout.vue')

export const getParentLayout = () => {
  return () =>
    new Promise((resolve) => {
      resolve({
        name: 'ParentLayout'
      })
    })
}

// 按照路由中meta下的rank等级升序来排序路由
export const ascending = (arr: any[]) => {
  arr.forEach((v) => {
    if (v?.meta?.rank === null) v.meta.rank = undefined
    if (v?.meta?.rank === 0) {
      if (v.name !== 'home' && v.path !== '/') {
        console.warn('rank only the home page can be 0')
      }
    }
  })
  return arr.sort((a: { meta: { rank: number } }, b: { meta: { rank: number } }) => {
    return a?.meta?.rank - b?.meta?.rank
  })
}

export const getRawRoute = (route: RouteLocationNormalized): RouteLocationNormalized => {
  if (!route) return route
  const { matched, ...opt } = route
  return {
    ...opt,
    matched: (matched
      ? matched.map((item) => ({
        meta: item.meta,
        name: item.name,
        path: item.path
      }))
      : undefined) as RouteRecordNormalized[]
  }
}

// 后端控制路由生成
export const generateRoute = (routes: AppCustomRouteRecordRaw[]): AppRouteRecordRaw[] => {
  const res: AppRouteRecordRaw[] = []
  const modulesRoutesKeys = Object.keys(modules)
  for (const route of routes) {
    const meta = {
      title: route.name,
      icon: route.icon,
      hidden: !route.visible,
      noCache: !route.keepAlive,
      isFullScreen: route.isFullScreen,
      alwaysShow:
        route.children &&
        route.children.length === 1 &&
        (route.alwaysShow !== undefined ? route.alwaysShow : true)
    }
    const devShowPathList = ['/developmentTool']
    if (devShowPathList.includes(route.path) && (import.meta.env.DEV || pack.name === 'microTemplate')) {
      meta.hidden = false
    }
    // 路由地址转首字母大写驼峰，作为路由名称，适配keepAlive
    let data: AppRouteRecordRaw = {
      path: route.path,
      name:
        route.componentName && route.componentName.length > 0
          ? route.componentName
          : toCamelCase(route.path, true),
      redirect: route.redirect,
      meta: meta
    }
    //处理顶级非目录路由
    if (!route.children && route.parentId == 0 && route.component) {
      data.component = Layout
      data.meta = {}
      data.name = toCamelCase(route.path, true) + 'Parent'
      data.redirect = ''
      meta.alwaysShow = true
      const childrenData: AppRouteRecordRaw = {
        path: '',
        name:
          route.componentName && route.componentName.length > 0
            ? route.componentName
            : toCamelCase(route.path, true),
        redirect: route.redirect,
        meta: meta
      }
      const index = route?.component
        ? modulesRoutesKeys.findIndex((ev) => ev.includes(route.component))
        : modulesRoutesKeys.findIndex((ev) => ev.includes(route.path))
      childrenData.component = modules[modulesRoutesKeys[index]]
      data.children = [childrenData]
    } else {
      // 目录
      if (route.children) {
        data.component = Layout
        data.redirect = getRedirect(route.path, route.children)
        // 外链
      } else if (isUrl(route.path)) {
        data = {
          path: '/external-link',
          component: Layout,
          meta: {
            name: route.name
          },
          children: [data]
        } as AppRouteRecordRaw
        // 菜单
      } else {
        // 对后端传component组件路径和不传做兼容（如果后端传component组件路径，那么path可以随便写，如果不传，component组件路径会根path保持一致）
        const index = route?.component
          ? modulesRoutesKeys.findIndex((ev) => ev.includes(route.component))
          : modulesRoutesKeys.findIndex((ev) => ev.includes(route.path))
        data.component = modules[modulesRoutesKeys[index]]
      }
      if (route.children) {
        data.children = generateRoute(route.children)
      }
    }
    res.push(data as AppRouteRecordRaw)
  }
  return res
}
export const getRedirect = (parentPath: string, children: AppCustomRouteRecordRaw[]) => {
  if (!children || children.length == 0) {
    return parentPath
  }
  const path = generateRoutePath(parentPath, children[0].path)
  // 递归子节点
  if (children[0].children) return getRedirect(path, children[0].children)
}
const generateRoutePath = (parentPath: string, path: string) => {
  if (parentPath.endsWith('/')) {
    parentPath = parentPath.slice(0, -1) // 移除默认的 /
  }
  if (!path?.startsWith('/')) {
    path = '/' + path
  }
  return parentPath + path
}
export const pathResolve = (parentPath: string, path: string) => {
  if (isUrl(path)) return path
  const childPath = path?.startsWith('/') || !path ? path : `/${path}`
  return `${parentPath}${childPath}`.replace(/\/\//g, '/')
}

// 路由降级
export const flatMultiLevelRoutes = (routes: AppRouteRecordRaw[]) => {
  const modules: AppRouteRecordRaw[] = cloneDeep(routes)
  for (let index = 0; index < modules.length; index++) {
    const route = modules[index]
    if (!isMultipleRoute(route)) {
      continue
    }
    promoteRouteLevel(route)
  }
  return modules
}

// 层级是否大于2
const isMultipleRoute = (route: AppRouteRecordRaw) => {
  if (!route || !Reflect.has(route, 'children') || !route.children?.length) {
    return false
  }

  const children = route.children

  let flag = false
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (child.children?.length) {
      flag = true
      break
    }
  }
  return flag
}

// 生成二级路由
const promoteRouteLevel = (route: AppRouteRecordRaw) => {
  let router: Router | null = createRouter({
    routes: [route as RouteRecordRaw],
    history: createWebHashHistory()
  })

  const routes = router.getRoutes()
  addToChildren(routes, route.children || [], route)
  router = null

  route.children = route.children?.map((item) => omit(item, 'children'))
}

// 添加所有子菜单
const addToChildren = (
  routes: RouteRecordNormalized[],
  children: AppRouteRecordRaw[],
  routeModule: AppRouteRecordRaw
) => {
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    const route = routes.find((item) => item.name === child.name)
    if (!route) {
      continue
    }
    routeModule.children = routeModule.children || []
    if (!routeModule.children.find((item) => item.name === route.name)) {
      routeModule.children?.push(route as unknown as AppRouteRecordRaw)
    }
    if (child.children?.length) {
      addToChildren(routes, child.children, routeModule)
    }
  }
}
const toCamelCase = (str: string, upperCaseFirst: boolean) => {
  str = (str || '')
    .replace(/-(.)/g, function (group1: string) {
      return group1.toUpperCase()
    })
    .replaceAll('-', '')

  if (upperCaseFirst && str) {
    str = str.charAt(0).toUpperCase() + str.slice(1)
  }

  return str
}

// 处理微前端路由
export class RouterGenerator {
  addRouters: AppRouteRecordRaw[] = []
  routers: AppRouteRecordRaw[] = []
  flatRoutes: AppRouteRecordRaw[] = []

  async generateRoutes(): Promise<void> {
    try {
      // 获取缓存路由或默认空数组
      const cachedRoutes = wsCache.get(CACHE_KEY.ROLE_ROUTERS) || []
      const rawRoutes: AppCustomRouteRecordRaw[] = Array.isArray(cachedRoutes) ? cachedRoutes : []

      // 生成基础路由（扁平化结构）
      const generatedRoutes = generateRoute(rawRoutes)
      const flatRoutes = this.flattenRoutes(generatedRoutes).map((route) => {
        return {
          ...route,
          meta: {
            ...route.meta,
            isAsyncRoute: true
          }
        }
      })
      // 处理微前端路由
      // const processedRoutes = this.isInQiankun
      //   ? this.processRoutesInQiankun(flatRoutes)
      //   : this.processRoutesWithMicroApps(flatRoutes)
      const processedRoutes = this.processRoutesWithMicroApps(flatRoutes)
      this.flatRoutes = processedRoutes
      // 重建路由层级结构
      const nestedRoutes = this.buildNestedRoutes(processedRoutes)
      // 添加404路由
      this.addRouters = [
        ...nestedRoutes,
        {
          path: '/:path(.*)*',
          redirect: '/403',
          name: '403Page',
          meta: { hidden: true, breadcrumb: false }
        }
      ]

      // 合并基础路由和剩余路由
      this.routers = cloneDeep(remainingRouter).concat(nestedRoutes)
    } catch (error) {
      console.error('路由生成失败:', error)
      throw error
    }
  }

  /**
   * 将嵌套路由结构扁平化
   */
  private flattenRoutes(routes: AppRouteRecordRaw[], parentPath = ''): FlatRoute[] {
    return routes.flatMap((route) => {
      const currentPath = `${parentPath}${route.path}`
      const flatRoute: FlatRoute = {
        ...route,
        originalPath: route.path,
        fullPath: currentPath,
        parentPath,
        children: undefined // 移除children以扁平化
      }

      return route.children?.length
        ? [flatRoute, ...this.flattenRoutes(route.children, `${currentPath}/`)]
        : [flatRoute]
    })
  }

  /**
   * 主应用中处理微前端路由（优化版）
   */
  private processRoutesWithMicroApps(flatRoutes: FlatRoute[]): FlatRoute[] {
    const appList = vueQiankunStore.getAppList
    if (!appList?.length) return flatRoutes

    // 预处理微应用规则为映射表
    const appRuleMap = this.buildAppRuleMap(appList)

    return flatRoutes.map((route) => {
      // 查找匹配的微应用规则
      const matchedRule = appRuleMap.find(
        ([rulePath]) =>
          // route.fullPath === rulePath || route.fullPath.startsWith(`${rulePath}/`)
          route.fullPath === rulePath
      )
      if (!matchedRule) return route

      const [_, appName] = matchedRule
      return {
        ...route,
        path: `${route.parentPath ? '' : '/'}${appName}${route.originalPath.startsWith('/') ? route.originalPath : `/${route.originalPath}`}`
      }
    })
  }

  /**
   * 构建微应用规则映射表
   */
  private buildAppRuleMap(appList: QiankunApp[]): [string, string][] {
    return appList.flatMap((app) => {
      const rules = app.activeRule?.split(',').filter(Boolean) || []
      return rules.map((rule) => {
        const matchName = rule.substring(app.name.length + 1)
        return [matchName, app.name] as [string, string]
      })
    })
  }

  /**
   * 在微应用中处理路由
   */
  private processRoutesInQiankun(flatRoutes: FlatRoute[]): FlatRoute[] {
    // const basePath = import.meta.env.VITE_BASE_PATH || ''
    const basePath = handelMicwebPath('basePath')
    return flatRoutes.map((route) => {
      return route.parentPath
        ? route
        : {
          ...route,
          path: `${basePath}${route.path}`
        }
    })
  }

  /**
   * 将扁平路由重建为嵌套结构
   */
  private buildNestedRoutes(flatRoutes: FlatRoute[]): AppRouteRecordRaw[] {
    // 映射所有路由
    const routeMap = new Map<string, AppRouteRecordRaw>()
    // 创建所有路由节点 按顺序
    const allRouters = flatRoutes.map((flatRoute) => {
      const route: AppRouteRecordRaw = {
        ...flatRoute,
        // path: flatRoute.originalPath,
        path: flatRoute.path,
        children: []
      }
      routeMap.set(flatRoute.fullPath, route)
      return route
    })
    // 构建父子关系
    const rootRoutes: AppRouteRecordRaw[] = []
    const childRouteMap = new Map<string, AppRouteRecordRaw[]>()
    // 创建所有路由节点
    allRouters.forEach((route) => {
      const parentPath = (route as any).parentPath.slice(0, -1)
      if (!parentPath) {
        rootRoutes.push(route)
      } else {
        if (!childRouteMap.has(parentPath)) {
          childRouteMap.set(parentPath, [])
        }
        childRouteMap.get(parentPath)!.push(route)
      }
    })
    // 最后按照原始顺序分配子路由
    allRouters.forEach((parentRoute) => {
      const children = childRouteMap.get(parentRoute.fullPath)
      if (children) {
        parentRoute.children = [...children]
      }
    })

    return rootRoutes
  }
  /**
   * 判断是否在乾坤微前端环境中
   */
  private get isInQiankun(): boolean {
    return !!qiankunWindow.__POWERED_BY_QIANKUN__
  }
}

export const qiankunWindowHelper = qiankunWindow
export const packHelper = pack

// 处理作为微服务环境 baseUrl:获取基座前缀 basePath：获取微服务前缀（包括多层嵌套的上一层微服务）  comPareBasePath：判断微服务前缀是否变更
export const handelMicwebPath: any = (type = 'baseUrl') => {
  const firstBasePath: string = wsCache.get(CACHE_KEY.FIRST_BASE_PATH) || null
  function getFirstMicwebName(pathname) {
    const pathArr = pathname && pathname.split('/')?.filter(Boolean)
    const micName = 'micweb'
    const basePath = import.meta.env.VITE_BASE_PATH || ''
    const micwebList = pathArr && isArray(pathArr) && pathArr.filter((path) => path === micName)
    const micwebListLen = micwebList ? micwebList.length : 0
    if (micwebListLen > 1) {
      const firstMicweb = pathArr.indexOf(micName)
      return `/${micName}/${pathArr[firstMicweb + 1]}`
    } else {
      return basePath
    }
  }
  const pathname = window.location.pathname
  const basePath = getFirstMicwebName(pathname)
  let prefix = pathname.match(/^\/[^/]+/)?.[0] || `/${pack.name}`
  prefix = prefix.endsWith('/') ? prefix : `${prefix}/`
  // const baseUrl = qiankunWindow.__POWERED_BY_QIANKUN__ ? `/${qiankunWindow.__qiankun_base_MianAppName__}` : `/${pack.name}`
  // vue-router注册时的前缀
  const baseUrl = !!qiankunWindow.__POWERED_BY_QIANKUN__ ? prefix : `/${pack.name}`
  switch (type) {
    case 'baseUrl':
      return baseUrl
    case 'basePath':
      wsCache.set(CACHE_KEY.FIRST_BASE_PATH, basePath)
      return basePath

    default:
      if (!!qiankunWindow.__POWERED_BY_QIANKUN__) {
        return !(!!firstBasePath && basePath !== firstBasePath)
      } else {
        return true
      }
  }
}

// 路由参数处理
export const parseURL = (
  url: string | null | undefined
): { basePath: string; paramsObject: { [key: string]: string } } => {
  // 如果输入为 null 或 undefined，返回空字符串和空对象
  if (url == null) {
    return { basePath: '', paramsObject: {} }
  }

  // 找到问号 (?) 的位置，它之前是基础路径，之后是查询参数
  const questionMarkIndex = url.indexOf('?')
  let basePath = url
  const paramsObject: { [key: string]: string } = {}

  // 如果找到了问号，说明有查询参数
  if (questionMarkIndex !== -1) {
    // 获取 basePath
    basePath = url.substring(0, questionMarkIndex)

    // 从 URL 中获取查询字符串部分
    const queryString = url.substring(questionMarkIndex + 1)

    // 使用 URLSearchParams 遍历参数
    const searchParams = new URLSearchParams(queryString)
    searchParams.forEach((value, key) => {
      // 封装进 paramsObject 对象
      paramsObject[key] = value
    })
  }

  // 返回 basePath 和 paramsObject
  return { basePath, paramsObject }
}

// 路由不重定向白名单
export const whiteList = [
  '/social-login',
  '/auth-redirect',
  '/bind',
  '/register',
  '/oauthLogin/gitee'
]

// 路由首页处理
export let fullPath = import.meta.env.VITE_APP_PAGE_INDEX
export const setInitMenu = (initRouters: any[], serverPageIndex: string) => {
  if (isRouterPath(serverPageIndex)) {
    fullPath = serverPageIndex
  }
  const routers = initRouters.filter((route) => route.parentPath)
  const isPageIndex = fullPath && routers.findIndex((route) => route.fullPath === fullPath) !== -1
  if (!isPageIndex) {
    // fullPath = routers && routers.length ? getRedirect(routers[0].path, routers[0].children) : 'index'
    fullPath = routers && routers.length ? routers[0].fullPath : 'index'
  }
}

// 获取参数
export function getParams(fullPath) {
  return fullPath.split('&').reduce((params, param) => {
    const [key, value] = param.split('=')
    params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    return params
  }, {})
}
