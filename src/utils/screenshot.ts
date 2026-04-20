import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'
import type { Options as Html2CanvasOptions } from 'html2canvas'

const screenshotCache = new Map<
  string,
  {
    timestamp: number
    data: string | Blob
  }
>()
const CACHE_TTL = 5000
export interface ScreenshotOptions extends Partial<Html2CanvasOptions> {
  performanceMode?: boolean
  useCache?: boolean
  cacheKey?: string
  svgOptimize?: boolean
  visibleAreaOnly?: boolean
  forceLowQuality?: boolean
  clipRect?: { x: number; y: number; width: number; height: number }
}

export const takeScreenshot = async (
  element: HTMLElement | string,
  fileName: string = 'screenShot',
  options: ScreenshotOptions = {}
): Promise<void> => {
  try {
    const targetElement = typeof element === 'string' ? document.getElementById(element) : element
    if (!targetElement) {
      ElMessage.error('截图目标元素不存在')
      return
    }
    const cacheKey =
      options.cacheKey ||
      (typeof element === 'string' ? element : targetElement.id || Math.random().toString())
    if (options.useCache !== false) {
      const cached = screenshotCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.data instanceof Blob) {
        downloadBlob(cached.data, fileName)
        return
      }
    }
    const loading = ElMessage({
      message: '截图处理中...',
      type: 'info',
      duration: 0
    })
    // let elementToCapture = targetElement
    // let svgBackup:{element:SVGElement,content:string}|null =null
    // if(options.svgOptimize){
    //     const svgElement = findSvgElement(targetElement)
    //     if(svgElement){
    //         svgBackup={
    //             element:svgElement,
    //             content:svgElement.outerHtml
    //         }
    //         simplifyTempSvg(svgElement,options)
    //     }
    // }
    // if(options.clipRect){
    //     elementToCapture = createClippedElement(targetElement,options.clipRect)
    // }else if(options.visibleAreaOnly){
    //     const rect = getVisibleRect(targetElement)
    //     if(rect){
    //         elementToCapture = createClippedElement(targetElement,rect)
    //     }
    // }
    const performanceMode = options.performanceMode === true
    const canvas = await html2canvas(targetElement, {
      useCORS: true,
      scale: performanceMode ? 1 : 2,
      logging: false,
      backgroundColor: null,
      allowTaint: true,
      removeContainer: true,
      // foreignObjectRendering:options.svgOptimize?false:undefined,
      ...options
    })
    // if(svgBackup){
    //     svgBackup.element.outerHTML = svgBackup.content
    // }
    // if(elementToCapture!==targetElement&&elementToCapture.parentNode){
    //     elementToCapture.parentNode.removeChild(elementToCapture)
    // }
    loading.close()
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          ElMessage.error('截图生成失败')
          return
        }
        if (options.useCache !== false) {
          screenshotCache.set(cacheKey, {
            timestamp: Date.now(),
            data: blob
          })
        }
        downloadBlob(blob, fileName)
      },
      'image/png',
      performanceMode ? 0.8 : 0.95
    )
  } catch (error) {
    ElMessage.error('截图过程中出现发现错误')
  }
}
const downloadBlob = (blob, fileName) => {
  const downloadLink = document.createElement('a')
  downloadLink.href = URL.createObjectURL(blob)
  downloadLink.download = `${fileName}.png`

  document.body.appendChild(downloadLink)
  downloadLink.click()
  setTimeout(() => {
    URL.revokeObjectURL(downloadLink.href)
    document.body.removeChild(downloadLink)
  }, 100)
  ElMessage.success('截图已保存')
}
// const findSvgElement = (element:HTMLElement): SVGElement | null =>{
//     if(element instanceof SVGAElement){
//         return element
//     }
//     const svgElement = element.querySelector('svg')
//     return svgElement
// }
// const simplifyTempSvg =(svgElement:SVGElement,options:ScreenshotOptions):void =>{
//     if(options.visibleAreaOnly){
//         const viewBox = svgElement.viewBox.baseVal
//         const visibleBox = options.clipRect || getVisibleRect(svgElement)
//         if(viewBox&&visibleBox){
//             Array.from(svgElement.querySelectorAll('*')).forEach(el =>{
//                 if(!isElementInViewBox(el as SVGGraphicsElement,visibleBox)){
//                     if(el.parentNode){
//                         (el.parentNode as Element).removeChild(el)
//                     }
//                 }
//             })
//         }
//     }
//     if(options.forceLowQuality){
//         ['filter','linearGradient','radiaGradient','pattern'].forEach(selector =>{
//             const elements = svgElement.querySelectorAll(selector)
//             elements.forEach(el =>{
//                 if(el.parentNode){
//                     el.parentNode.removeChild(el)
//                 }
//             })
//         })
//         Array.from(svgElement.querySelectorAll('*')).forEach(el =>{
//             ['filter','mask','clip-path'].forEach(attr =>{
//                 el.removeAttribute(attr)
//             })
//         })
//     }
// }
// const createClippedElement =(
//     elememt:HTMLElement,
//     rect:{x:number,y:number,width:number,height:number}
// ):HTMLElement =>{
//     const container = document.createElement('div')
//     container.style.position ='absolute'
//     container.style.left='0'
//     container.style.top = '0'
//     container.style.width = `${rect.width}px`
//     container.style.height = `${rect.height}px`
//     container.style.overflow = 'hidden'
//     container.style.zIndex = '-9999'
//     container.style.visibility ='hidden'

//     const clone = elememt.cloneNode(true) as HTMLElement
//     clone.style.position ='absolute'
//     clone.style.left = `-${rect.x}px`
//     clone.style.top = `-${rect.y}px`
//     container.appendChild(clone)
//     document.body.appendChild(container)
//     container.style.visibility ='visible'
//     return container
// }
// const getVisibleRect=(elememt:HTMLElement):{x:number,y:number,width:number,height:number}|null =>{
//     const rect = elememt.getBoundingClientRect()
//     const viewportWidth = window.innerWidth
//     const viewportHeight = window.innerHeight
//     if(rect.right<=0 ||rect.bottom<=0 ||rect.left>=viewportWidth ||rect.top>=viewportHeight){
//         return null
//     }
//     const visibleLeft =Math.max(0,rect.left)
//     const visibleTop =Math.max(0,rect.top)
//     const visibleRight =Math.max(viewportWidth,rect.right)
//     const visibleBottom =Math.max(viewportHeight,rect.bottom)
//     return{
//         x:visibleLeft -rect.left,
//         y:visibleTop -rect.top,
//         width:visibleRight - visibleLeft,
//         height:visibleBottom -visibleTop
//     }
// }
// const isElementInViewBox =(
//     element:SVGGraphicsElement,
//     viewBox:{x:number,y:number,width:number,height:number}
// ):boolean =>{
//     try {
//         const bbox = element.getBBox()
//         return!(
//             bbox.x+bbox.width<viewBox.x||
//             bbox.y+bbox.height<viewBox.y||
//             bbox.x>viewBox.x+viewBox.width||
//             bbox.y>viewBox.y+viewBox.height
//         )
//     } catch (error) {
//         return true
//     }
// }
