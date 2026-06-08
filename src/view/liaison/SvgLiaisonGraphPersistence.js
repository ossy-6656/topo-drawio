/**
 * 站间联络：图形 + JSON 本地持久化（JSON 不含布局坐标）
 *
 * 策略 B（生产）：graphXml 为布局快照长期不变；JSON 拓扑不变、仅量测字段更新时，
 * 由 SvgLiaisonDrawioParser.syncMeasurementsFromDoc() 刷新画布上的 P/Q/箭头/开关，不重载 XML。
 */

export const LIAISON_BUNDLE_VERSION = 1

export function liaisonStorageKey(filePath) {
  return `liaison_bundle_v1:${filePath || 'default'}`
}

export function loadLiaisonBundle(filePath) {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(liaisonStorageKey(filePath))
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || o.version !== LIAISON_BUNDLE_VERSION) return null
    if (!o.json || typeof o.graphXml !== 'string' || !o.graphXml.trim()) return null
    return o
  } catch {
    return null
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
  const action = ui.actions?.get?.('fitWindow')
  if (action?.funct && !window.drawflag) {
    action.funct()
    return
  }
  const graph = ui.editor?.graph
  if (graph?.fitWindow && graph.getGraphBounds) {
    const bounds = graph.getGraphBounds()
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      graph.fitWindow(bounds)
      if (ui.toolbar?.updateZoom) ui.toolbar.updateZoom()
    }
  }
}

export function saveLiaisonBundle(filePath, json, graphXml, viewState) {
  if (typeof localStorage === 'undefined') return
  const payload = {
    version: LIAISON_BUNDLE_VERSION,
    savedAt: new Date().toISOString(),
    json,
    graphXml,
    viewState: viewState || null,
  }
  localStorage.setItem(liaisonStorageKey(filePath), JSON.stringify(payload))
  return payload
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
