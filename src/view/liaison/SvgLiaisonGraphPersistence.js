/**
 * 站间联络：图形 + JSON 本地持久化（JSON 不含布局坐标）
 *
 * 策略 B（生产）：graphXml 为布局快照长期不变；JSON 拓扑不变、仅量测字段更新时，
 * 由 SvgLiaisonDrawioParser.syncMeasurementsFromDoc() 刷新画布上的 P/Q/箭头/开关，不重载 XML。
 */

export const LIAISON_BUNDLE_VERSION = 1

/** 超过此体积的 bundle 不写 localStorage，仅下载本地文件 */
export const LIAISON_LOCAL_STORAGE_MAX_BYTES = 512 * 1024

/** 超过此体积的 public/bundles 静态 bundle 不自动加载（避免大图 import XML 卡死页面） */
export const LIAISON_STATIC_BUNDLE_MAX_BYTES = 2 * 1024 * 1024

/** ?bundle=static 时允许加载的静态 bundle 上限（仍可能较慢，需显式 opt-in） */
export const LIAISON_STATIC_BUNDLE_FORCE_MAX_BYTES = 8 * 1024 * 1024

export function liaisonStorageKey(filePath) {
  return `liaison_bundle_v1:${filePath || 'default'}`
}

function parseLiaisonBundleObject(o) {
  if (!o || o.version !== LIAISON_BUNDLE_VERSION) return null
  if (!o.json || typeof o.graphXml !== 'string' || !o.graphXml.trim()) return null
  return o
}

export function estimateBundleStorageBytes(json, graphXml, viewState) {
  try {
    return new TextEncoder().encode(
      JSON.stringify({
        version: LIAISON_BUNDLE_VERSION,
        savedAt: '',
        json,
        graphXml,
        viewState: viewState || null,
      })
    ).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export function shouldPersistBundleToLocalStorage(json, graphXml, viewState) {
  return estimateBundleStorageBytes(json, graphXml, viewState) <= LIAISON_LOCAL_STORAGE_MAX_BYTES
}

export function estimateLiaisonBundleObjectBytes(bundle) {
  if (!bundle) return 0
  return estimateBundleStorageBytes(bundle.json, bundle.graphXml, bundle.viewState)
}

function isBundleWithinMaxBytes(bundle, maxBytes) {
  if (!bundle || !maxBytes || maxBytes <= 0) return true
  return estimateLiaisonBundleObjectBytes(bundle) <= maxBytes
}

export function loadLiaisonBundle(filePath, options = {}) {
  if (typeof localStorage === 'undefined') return null
  const { maxBytes = LIAISON_LOCAL_STORAGE_MAX_BYTES } = options
  try {
    const raw = localStorage.getItem(liaisonStorageKey(filePath))
    if (!raw) return null
    if (maxBytes > 0 && new TextEncoder().encode(raw).length > maxBytes) {
      console.warn('[liaison] localStorage bundle too large, skipped', filePath)
      return null
    }
    const bundle = parseLiaisonBundleObject(JSON.parse(raw))
    if (!isBundleWithinMaxBytes(bundle, maxBytes)) {
      console.warn('[liaison] localStorage bundle payload too large, skipped', filePath)
      return null
    }
    return bundle
  } catch {
    return null
  }
}

/** 与 downloadLiaisonBundle 命名一致：同目录下 bundles/xxx-liaison-bundle.json */
export function resolveStaticLiaisonBundlePath(filePath) {
  if (!filePath) return null
  const base = filePath.split('/').pop() || ''
  if (!base) return null
  const bundleName = `${base.replace(/\.json$/i, '')}-liaison-bundle.json`
  const dir = filePath.replace(/\/[^/]+$/, '')
  return `${dir}/bundles/${bundleName}`
}

function parseLiaisonBundleSavedAt(bundle) {
  if (!bundle?.savedAt) return 0
  const t = Date.parse(bundle.savedAt)
  return Number.isNaN(t) ? 0 : t
}

/** 在 localStorage 与静态 bundle 之间取 savedAt 较新者（演示机拷贝 bundle 后不被旧缓存挡住） */
export function pickNewerLiaisonBundle(localBundle, staticBundle) {
  if (!localBundle) return staticBundle || null
  if (!staticBundle) return localBundle
  return parseLiaisonBundleSavedAt(staticBundle) >= parseLiaisonBundleSavedAt(localBundle)
    ? staticBundle
    : localBundle
}

export async function fetchStaticLiaisonBundle(filePath, options = {}) {
  const staticPath = resolveStaticLiaisonBundlePath(filePath)
  if (!staticPath) return { bundle: null, skippedLarge: false }

  const { maxBytes = LIAISON_STATIC_BUNDLE_MAX_BYTES } = options

  try {
    const response = await fetch(encodeURI(staticPath))
    if (!response.ok) return { bundle: null, skippedLarge: false }

    const contentLength = Number(response.headers.get('Content-Length'))
    if (contentLength > 0 && maxBytes > 0 && contentLength > maxBytes) {
      console.warn('[liaison] static bundle too large, skipped auto-load', staticPath, contentLength)
      return { bundle: null, skippedLarge: true }
    }

    let text
    if (response.body && typeof response.body.getReader === 'function' && maxBytes > 0) {
      const reader = response.body.getReader()
      const chunks = []
      let total = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
          console.warn('[liaison] static bundle too large, skipped auto-load', staticPath, total)
          try {
            await reader.cancel()
          } catch {
            /* ignore */
          }
          return { bundle: null, skippedLarge: true }
        }
        chunks.push(value)
      }
      text = new TextDecoder().decode(
        chunks.reduce((acc, cur) => {
          const merged = new Uint8Array(acc.length + cur.length)
          merged.set(acc)
          merged.set(cur, acc.length)
          return merged
        }, new Uint8Array(0))
      )
    } else {
      text = await response.text()
    }

    const byteLen = new TextEncoder().encode(text).length
    if (maxBytes > 0 && byteLen > maxBytes) {
      console.warn('[liaison] static bundle too large, skipped auto-load', staticPath, byteLen)
      return { bundle: null, skippedLarge: true }
    }

    const bundle = parseLiaisonBundleObject(JSON.parse(text))
    if (!isBundleWithinMaxBytes(bundle, maxBytes)) {
      console.warn('[liaison] static bundle payload too large, skipped auto-load', staticPath)
      return { bundle: null, skippedLarge: true }
    }
    return { bundle, skippedLarge: false }
  } catch {
    return { bundle: null, skippedLarge: false }
  }
}

/**
 * 合并 localStorage 与 public/bundles 静态 bundle，取 savedAt 较新者。
 * 静态 bundle 较新时会覆盖 localStorage（便于拷贝 bundle 到演示机）。
 */
export async function loadLiaisonBundleWithFallback(filePath, options = {}) {
  const { preferStatic = false } = options
  const maxBytes = preferStatic
    ? LIAISON_STATIC_BUNDLE_FORCE_MAX_BYTES
    : LIAISON_STATIC_BUNDLE_MAX_BYTES
  const cached = loadLiaisonBundle(filePath, { maxBytes })
  const { bundle: staticBundle, skippedLarge: staticBundleSkippedLarge } = await fetchStaticLiaisonBundle(
    filePath,
    { maxBytes }
  )

  let bundle = preferStatic && staticBundle ? staticBundle : pickNewerLiaisonBundle(cached, staticBundle)
  if (!bundle) {
    return { bundle: null, staticBundleSkippedLarge: staticBundleSkippedLarge && !preferStatic }
  }

  const source =
    bundle === staticBundle ? 'static' : bundle === cached ? 'localStorage' : 'unknown'
  if (typeof console !== 'undefined' && console.info) {
    console.info('[liaison] bundle loaded from', source, filePath, bundle.savedAt || '')
  }

  if (
    (bundle === staticBundle || bundle !== cached) &&
    shouldPersistBundleToLocalStorage(bundle.json, bundle.graphXml, bundle.viewState)
  ) {
    saveLiaisonBundle(filePath, bundle.json, bundle.graphXml, bundle.viewState)
  }
  return { bundle, staticBundleSkippedLarge: false }
}

/** 小图写入 localStorage；大图跳过（由页面仅下载 bundle 文件） */
export function saveLiaisonBundle(filePath, json, graphXml, viewState) {
  if (typeof localStorage === 'undefined') return false
  if (!shouldPersistBundleToLocalStorage(json, graphXml, viewState)) return false
  const payload = {
    version: LIAISON_BUNDLE_VERSION,
    savedAt: new Date().toISOString(),
    json,
    graphXml,
    viewState: viewState || null,
  }
  try {
    localStorage.setItem(liaisonStorageKey(filePath), JSON.stringify(payload))
    return true
  } catch (err) {
    console.warn('[liaison] localStorage save skipped', err)
    return false
  }
}

/** 捕获当前画布缩放与平移（setGraphXml 会重置 scale=1，须单独保存） */
export function captureGraphViewState(graph) {
  const view = graph?.view
  if (!view) return null
  const scale = Number(view.scale)
  const tx = Number(view.translate?.x)
  const ty = Number(view.translate?.y)
  if (Number.isNaN(scale) || scale <= 0) return null
  return {
    scale,
    translateX: Number.isNaN(tx) ? 0 : tx,
    translateY: Number.isNaN(ty) ? 0 : ty,
  }
}

/** 恢复画布缩放与平移，并刷新工具栏百分比显示 */
export function applyGraphViewState(graph, ui, viewState) {
  const view = graph?.view
  if (!view || !viewState) return
  const scale = Number(viewState.scale)
  const tx = Number(viewState.translateX)
  const ty = Number(viewState.translateY)
  if (!Number.isNaN(scale) && scale > 0 && typeof view.setScale === 'function') {
    view.setScale(scale)
  }
  if (!Number.isNaN(tx) && !Number.isNaN(ty) && typeof view.setTranslate === 'function') {
    view.setTranslate(tx, ty)
  }
  if (view.invalidate) view.invalidate()
  if (ui?.toolbar?.updateZoom) {
    ui.toolbar.updateZoom()
  } else if (typeof mxEvent !== 'undefined') {
    view.fireEvent(new mxEventObject(mxEvent.SCALE, 'scale', view.scale))
  }
}

/** 与首次成图一致：自适应窗口并居中（fitWindow / fitDiagramToWindow） */
export function fitLiaisonGraphToWindow(ui) {
  if (!ui) return
  const graph = ui.editor?.graph
  if (!graph) return
  if (graph.view?.validate) graph.view.validate()
  const action = ui.actions?.get?.('fitWindow')
  if (action?.funct && !window.drawflag) {
    action.funct()
    return
  }
  if (graph.fitWindow && graph.getGraphBounds) {
    const bounds = graph.getGraphBounds()
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      graph.fitWindow(bounds)
      if (ui.toolbar?.updateZoom) ui.toolbar.updateZoom()
    }
  }
}

export function clearLiaisonBundle(filePath) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(liaisonStorageKey(filePath))
}

function extractLabelFromObjectElement(objEl) {
  if (!objEl) return ''
  const label = objEl.getAttribute('label')
  if (label != null && label !== '') return label
  const adds = objEl.getElementsByTagName('add')
  for (let i = 0; i < adds.length; i++) {
    const el = adds[i]
    if (el.getAttribute('as') === 'label') {
      return el.getAttribute('value') || mxUtils.getTextContent(el) || ''
    }
  }
  return mxUtils.getTextContent(objEl) || ''
}

/**
 * 清理 XML 中 mxCodec 无法解码的 <Object> 节点（由 cell.value 为普通 JS 对象导致）
 */
export function sanitizeGraphXmlForImport(graphXml) {
  if (!graphXml?.trim()) return graphXml
  let doc
  try {
    doc = mxUtils.parseXml(graphXml)
  } catch {
    return graphXml
  }
  const docEl = doc?.documentElement
  if (!docEl) return graphXml

  const cells = doc.getElementsByTagName('mxCell')
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    let value = cell.getAttribute('value') || ''
    const toRemove = []
    for (let c = cell.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue
      if (c.nodeName === 'Object') {
        value = value || extractLabelFromObjectElement(c)
        toRemove.push(c)
      } else if (c.nodeName === 'mxGeometry' || c.nodeName === 'mxCell') {
        continue
      } else {
        const innerMx = c.getElementsByTagName('mxCell')
        if (innerMx.length > 0) continue
        value = value || mxUtils.getOuterHtml(c) || ''
        toRemove.push(c)
      }
    }
    for (let j = 0; j < toRemove.length; j++) {
      cell.removeChild(toRemove[j])
    }
    if (value) cell.setAttribute('value', value)
  }

  const roots = doc.getElementsByTagName('root')
  for (let r = 0; r < roots.length; r++) {
    const root = roots[r]
    const orphans = []
    for (let c = root.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && c.nodeName === 'Object') orphans.push(c)
    }
    for (let j = 0; j < orphans.length; j++) {
      root.removeChild(orphans[j])
    }
  }

  return mxUtils.getXml(docEl)
}

/** 导出前将 DOM / 普通对象 形式的 value 统一为 HTML 字符串，避免写入 <Object> */
export function normalizeGraphCellValuesForExport(graph) {
  if (!graph) return
  const model = graph.getModel()
  const parent = graph.getDefaultParent()
  const cells = graph.getChildCells(parent, true, true) || []
  model.beginUpdate()
  try {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const v = model.getValue(cell)
      if (v == null || typeof v === 'string') continue
      let str = ''
      if (typeof v === 'object' && mxUtils.isNode(v)) {
        str = mxUtils.getOuterHtml(v) || graph.convertValueToString(cell) || ''
      } else if (typeof v.getAttribute === 'function') {
        str = v.getAttribute('label') || mxUtils.getOuterHtml(v) || graph.convertValueToString(cell) || ''
      } else if (typeof v === 'object') {
        str = graph.convertValueToString(cell) || ''
      }
      model.setValue(cell, str)
    }
  } finally {
    model.endUpdate()
  }
}

/** 从 draw.io Editor 导出 mxGraphModel XML */
export function exportEditorGraphXml(editor) {
  if (!editor?.getGraphXml) return ''
  normalizeGraphCellValuesForExport(editor.graph)
  const node = editor.getGraphXml(true)
  return mxUtils.getXml(node)
}

/** 将已保存的图形载入当前画布（不触发 parseSvg）；viewState 由调用方在 setGraphXml 之后恢复 */
export function importEditorGraphXml(editor, graphXml) {
  if (!editor?.setGraphXml || !graphXml?.trim()) return false
  const cleaned = sanitizeGraphXmlForImport(graphXml)
  try {
    const doc = mxUtils.parseXml(cleaned)
    const root = doc?.documentElement
    if (!root) return false
    editor.setGraphXml(root)
    return true
  } catch (e) {
    console.error('[liaison] importEditorGraphXml failed', e)
    return false
  }
}

/** 下载 bundle 文件（JSON + 内嵌 graphXml） */
export function downloadLiaisonBundle(filenameBase, json, graphXml, viewState) {
  const payload = {
    version: LIAISON_BUNDLE_VERSION,
    savedAt: new Date().toISOString(),
    json,
    graphXml,
    viewState: viewState || null,
  }
  const text = JSON.stringify(payload, null, 2)
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase.replace(/\.json$/i, '')}-liaison-bundle.json`
  a.click()
  URL.revokeObjectURL(url)
}
