import { ElButton, ElDialog } from 'element-plus'
import { getAccessToken } from './auth'
import router from '@/router'
import { isArray } from './is'

/**
 * 跳转方法
 * @param title 弹窗标题
 * @param name 组件名
 * @param url 跳转地址
 * @param params 参数
 * @param key localStorage key
 * @param isDialog 强制弹窗
 */
export const jump = (row) => {
  const { title, name, url, params, key, isDialog = false } = row
  const isInIframe = window.self !== window.top // 是否是在Iframe中
  if (isInIframe || isDialog) {
    // Iframe或isDialog为true，使用弹窗打开
    const baseUrl = `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`
    let pathWithParams = `_auth_token=${encodeURIComponent(getAccessToken())}&fullScreen=true`
    Object.keys(params).forEach((key) => {
      if (isArray(params[key])) {
        pathWithParams = `${pathWithParams}&${key}=${encodeURIComponent(JSON.stringify(params[key]))}`
      } else {
        pathWithParams = `${pathWithParams}&${key}=${encodeURIComponent(params[key])}`
      }
    })
    const finalUrl = `${baseUrl}?${pathWithParams}`
    openPageInDialog(finalUrl, title)
  } else {
    // 跳转页面
    if (key) localStorage.setItem(key, JSON.stringify(params))
    router.push({ name: name })
  }
}

// 弹窗
export function openPageInDialog(url: string, title: string = '', width: string = '90%') {
  const mountNode = document.createElement('div')
  document.body.appendChild(mountNode)

  const visible = ref(true)
  const currentUrl = ref(url)

  const app = createApp({
    setup() {
      const handleClose = () => {
        visible.value = false
        setTimeout(() => {
          app.unmount()
          document.body.removeChild(mountNode)
        }, 300)
      }

      return () =>
        h(
          ElDialog,
          {
            modelValue: visible.value,
            'onUpdate:modelValue': (val: boolean) => {
              if (!val) handleClose()
            },
            title,
            width,
            customClass: 'dialog-iframe',
            fullscreen: width === '100%',
            top: '3vh'
          },
          {
            default: () =>
              h('iframe', {
                src: currentUrl.value,
                style: {
                  width: '100%',
                  height: '80vh',
                  border: 'none'
                },
                loading: 'lazy'
              })
            // footer: () => [
            //   h(
            //     'div',
            //     {
            //       style: {}
            //     },
            //     [
            //       h(
            //         ElButton,
            //         {
            //           onClick: handleClose
            //         },
            //         '关闭'
            //       )
            //     ]
            //   )
            // ]
          }
        )
    }
  })

  app.use(ElDialog).use(ElButton)
  app.mount(mountNode)
  return {
    close: () => {
      visible.value = false
    },
    upadteUrl: (newUrl: string) => {
      currentUrl.value = newUrl
    }
  }
}
