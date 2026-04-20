
import 'svg2pdf.js'
import html2canvas from 'html2canvas'
import $ from 'jquery'
import legend_black from '../img/svg_legend/svg_legend_black.png'
/** =================================
   * 工具函数
   * ================================= */
// 获取截图区域
const cuptureA4Area = async (divId) => {
  const element = document.querySelector('#' + divId)
  return await html2canvas(element, {
    logging: true,
    useCORS: true,
    foreignObjectRendering: false,
    allowTaint: false,
    backgroundColor: null,
    scale: window.devicePixelRatio / 2
  })
}
// svg字符串tocanvas
const drawSvgString = async (svgString, svgWidth, svgHeight, canvas, capture = { effectiveStartX: 0, effectiveStartY: 0, effectiveWidth: 0, effectiveHeight: 0 }) => {
  const ctx = canvas.getContext('2d')
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const { effectiveStartX, effectiveStartY, effectiveWidth, effectiveHeight } = capture
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      const canvasHeight = canvas.height
      const canvasWidth = canvas.width
      // svg位置根据纸张方向需要做不通的判断
      // const canvasRatio = canvasWidth / canvasHeight
      const svgRatio = svgWidth / svgHeight
      let canvasRatio = svgRatio
      if (svgRatio > 0.75 && svgRatio < 1) {
        canvasRatio += 0.25
      }
      if (svgRatio < 1.25 && svgRatio > 1) {
        canvasRatio -= 0.25
      }
      const ratio = canvasRatio >= 1 ? svgWidth / canvasWidth : svgHeight / canvasHeight
      const x = canvasRatio >= 1 ? (canvasWidth - canvasWidth) / 2 : (canvasWidth - (svgWidth / ratio)) / 2
      const y = canvasRatio >= 1 ? (canvasHeight - (svgHeight / ratio)) / 2 : (canvasHeight - canvasHeight) / 2
      // ctx.drawImage(svgCanvas, , x, y, canvasRatio >= 1 ? canvasWidth : svgWidth / ratio, canvasRatio >= 1 ? svgHeight / ratio : canvasHeight)
      if (effectiveStartX !== undefined && effectiveStartY !== undefined && effectiveWidth !== undefined && effectiveHeight !== undefined) {
        ctx.drawImage(img, effectiveStartX, effectiveStartY, effectiveWidth, effectiveHeight, x, y, canvasRatio >= 1 ? canvasWidth : svgWidth / ratio, canvasRatio >= 1 ? svgHeight / ratio : canvasHeight)
      } else {
        ctx.drawImage(img, x, y, canvasRatio >= 1 ? canvasWidth : svgWidth / ratio, canvasRatio >= 1 ? svgHeight / ratio : canvasHeight)
      }
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = reject
    img.src = url
  })
}
// 加载图片
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
// 自动换行
const wrapText = (context, text, x, y, maxWidth, maxHieght) => {
  const lineHeight = 28 //行高
  const marginTop = 3
  const lines = []
  let currentLine = ''
  // 按空格和换行符分割单词
  const words = splitByTextLength(context, text, maxWidth)

  // 构建适合宽度的行
  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i]
    const metrics = context.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = words[i]
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }

  // 检查是否超出最大高度
  const totalHeight = lines.length * lineHeight
  if (totalHeight > maxHieght) {
    const maxLines = Math.floor(maxHieght / lineHeight)
    if (maxLines > 0) {
      // 显示maxLines-1行 最后一行显示...
      const visibleLines = lines.slice(0, maxLines - 1)
      const lastLine = lines[maxLines - 1] + '...'

      // 绘制可见行
      for (let i = 0; i < visibleLines.length; i++) {
        context.fillText(visibleLines[i], x, y - totalHeight / 5 + i * lineHeight + marginTop)
      }
      // 绘制最后一行
      context.fillText(
        lastLine,
        x,
        y - totalHeight / 5 + (maxLines - 1) * lineHeight + marginTop + 5
      )
    } else {
      // 空间太小只能显示...
      context.fillText('...', x, y + marginTop)
    }
  } else {
    // 绘制所有行 垂直居中
    for (let i = 0; i < lines.length; i++) {
      context.fillText(
        lines[i],
        x,
        y - totalHeight / 2 + lineHeight / 2 + i * lineHeight + marginTop
      )
    }
  }
}
// 根据文字宽度分割
const splitByTextLength = (context, text, maxWidth) => {
  const result = []
  let currentLine = ''
  let currentWidth = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const charWidth = context.measureText(char).width

    // 如果当前行宽度不大于这个字符宽度
    if (currentWidth + charWidth <= maxWidth) {
      currentLine += char
      currentWidth += charWidth
    } else {
      if (currentLine) {
        result.push(currentLine)
      }

      // 开始新行
      currentLine = char
      currentWidth = charWidth
    }
  }
  // 添加最后一行
  if (currentLine) {
    result.push(currentLine)
  }
  return result
}
// 计算获取添加元素的位置坐标
const getposition = (canvas, eleWidth, eleHieght, position = 'bottom-right', padding = 8) => {
  // 计算表格位置
  let startX, startY
  const canvasWidth = canvas.width - 47
  const canvasHeight = canvas.height - 47
  // 根据位置参数设置起始坐标
  switch (position) {
    case 'top-left':
      startX = padding
      startY = padding
      break
    case 'top-right':
      startX = canvasWidth - eleWidth - padding
      startY = padding
      break
    case 'bottom-left':
      startX = padding
      startY = canvasHeight - eleHieght - padding
      break
    case 'bottom-right':
    default:
      startX = canvasWidth - eleWidth - padding
      startY = canvasHeight - eleHieght - padding
      break
  }
  return { startX, startY }
}
// 重置svg样式
const resetSvgStyle = (svg) => {
  // 如果自带边框 去掉背景，调整边框颜色  去掉table标签和文字
  $(svg).find('#Background_Layer>rect').attr('fill', 'rgba(0,0,0,0)')
  $(svg).find('#Text_Layer g>text').attr('fill', 'rgb(0,0,0)')
  $(svg).find('#ACLineSegment_Layer g>polyline').attr('stroke-width', '1.2px')
  $(svg).find('#Other_Layer').css({ display: 'none' })
}
// 在Canvas上绘制表格
const drawTableOnCanvas = (
  ctx,
  tableData = [[]],
  tableMerges = [],
  position = 'bottom-left',
  exportSvgSize// { width, height, infoWidthSize, infoHeightSize, borderLineWidth }
) => {
  const { width: canvasWidth, height: canvasHeight, infoWidthSize = 1 / 5, infoHeightSize = 1 / 5, borderLineWidth = 3 } = exportSvgSize
  const canvas = ctx.canvas
  const rowCount = tableData.length
  const colCount = tableData[0].length

  // 计算表格位置
  const cellWidth = canvasWidth * infoWidthSize / rowCount
  const cellHeight = canvasHeight * infoHeightSize / colCount
  const tableWidth = colCount * cellWidth
  const tableHeight = rowCount * cellHeight
  const { startX, startY } = getposition(canvas, tableWidth, tableHeight, position)
  // 绘制表格背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0)'
  ctx.fillRect(startX, startY, tableWidth, tableHeight)
  ctx.strokeStyle = '#333'
  ctx.strokeRect(startX, startY, tableWidth, tableHeight)

  // 绘制表格内容
  ctx.font = `${Math.round((cellWidth / 100) * 22)}px Arial`
  ctx.fillStyle = 'black'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 设置线宽
  ctx.lineWidth = borderLineWidth
  // 跟踪合并的单元格
  const mergedCells = Array(rowCount)
    .fill(false)
    .map(() => Array(colCount).fill(false))
  // 处理合并的单元格
  for (const merge of tableMerges) {
    const { row, col, rowspan = 1, colspan = 1 } = merge
    // 计算合并后的单元格尺寸
    const mergedWidth = colspan * cellWidth
    const mergedHeight = rowspan * cellHeight
    // 标记所有被合并的单元格
    for (let i = row; i < row + rowspan; i++) {
      for (let j = col; j < col + colspan; j++) {
        if (i < rowCount && j < colCount) {
          mergedCells[i][j] = true
        }
      }
    }
    // 绘制合并单元格边框
    ctx.strokeRect(startX + col * cellWidth, startY + row * cellHeight, mergedWidth, mergedHeight)
    // 绘制合并后的文本，只在第一个单元格显示
    if (row < rowCount && col < colCount) {
      const x = startX + col * cellWidth + mergedWidth / 2
      const y = startY + row * cellHeight + mergedHeight / 2
      const text = tableData[row][col] + ''
      wrapText(ctx, text, x, y, mergedWidth - 10, mergedHeight - 10)
    }
  }
  // 绘制未合并的单元格
  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      if (!mergedCells[i][j]) {
        const x = startX + j * cellWidth + cellWidth / 2
        const y = startY + i * cellHeight + cellHeight / 2
        ctx.strokeRect(startX + j * cellWidth, startY + i * cellHeight, cellWidth, cellHeight)

        // 绘制文本
        const text = tableData[i][j] + ''
        wrapText(ctx, text, x, y, cellWidth - 10, cellHeight - 10)
      }
    }
  }
}
// 在Canvas上绘制图片（内容超出红框调整）
const drawImgOnCanvas = (
  ctx,
  img,
  imgInfo,
  position = 'bottom-right',
) => {
  const canvas = ctx.canvas
  const { width: imgWith, height: imgHeight } = imgInfo
  const { startX, startY } = getposition(canvas, imgWith, imgHeight, position)
  ctx.drawImage(
    img,
    startX,
    startY,
    imgWith,
    imgHeight
  )
  return canvas
}
// 计算纸张对应的像素
const haversineDistance = (
  lat1,
  lon1,
  lat2,
  lon2
) => {
  const R = 6378137;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// mm 2 px
const paperSizeToPixels = (widthMM, heightMM, dpi) => {
  const inchPerMM = 1 / 25.4;
  const maxwhPx = 16384 * 16384 //最大像素
  const targetRatio = widthMM / heightMM
  let width = Math.round(widthMM * inchPerMM * dpi)
  let height = Math.round(heightMM * inchPerMM * dpi)
  if (width * height > maxwhPx) {
    width = Math.sqrt(maxwhPx * targetRatio)
    height = width / targetRatio
  }
  return {
    width,
    height
  };
}
// px 2 lnglat
const webMercator2LngLat = (x, y) => {
  const lon = (x / 20037508.34) * 180
  let lat = (y / 20037508.34) * 180
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
  return { lon: lon, lat: lat }
}
// 调整bbox比例，保证导出纸张宽高比例一致
const adjustBBoxAndOrientation = (svgEl, bbox, paperMM) => {
  if (svgEl) {
    const originalPixelWidth = svgEl.getAttribute('width')
    const originalPixelHeight = svgEl.getAttribute('height')
    const originalAspectRatio = originalPixelWidth / originalPixelHeight
    // 判断方向后 计算目标比例
    let orientation = 'portrait' //'portrait'人像竖 'landscape'风景横
    let targetWidthMM = paperMM[0]
    let targetHeightMM = paperMM[1]
    if (originalAspectRatio >= 1) {
      orientation = 'landscape'
      if (paperMM[0] < paperMM[1]) {
        [targetWidthMM, targetHeightMM] = [paperMM[1], paperMM[0]]
      }
    }
    return {
      orientation,
      targetWidthMM,
      targetHeightMM
    }
  }
  return
}
/** 绘制比例尺条 */
const drawScaleBar = (
  ctx,
  canvas,
  bbox// [number, number, number, number]
) => {
  const margin = 100;
  const barHeight = 20;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const realWidthM = haversineDistance(
    (minLat + maxLat) / 2,
    minLng,
    (minLat + maxLat) / 2,
    maxLng
  );
  const pxWidth = canvas.width;
  const meterPerPx = realWidthM / pxWidth;
  const scaleKm = Math.pow(
    10,
    Math.floor(Math.log10((pxWidth * meterPerPx) / 1000))
  );
  const scalePx = (scaleKm * 1000) / meterPerPx;
  // 绘制比例尺
  // ctx.save();
  // ctx.fillStyle = "black";
  // ctx.fillRect(margin, canvas.height - margin, scalePx, barHeight);

  // const segments = 1,
  //   segPx = scalePx / segments,
  //   segKm = scaleKm / segments;
  // ctx.font = "85px Arial";
  // ctx.fillStyle = "black";
  // ctx.textAlign = "center";
  // for (let i = 0; i <= segments; i++) {
  //   const x = margin + i * segPx;
  //   ctx.fillRect(x, canvas.height - margin, 20, barHeight + 20);
  //   ctx.fillText(`${(i * segKm).toFixed(0)}km`, x, canvas.height - margin - 20);
  // }
  // ctx.restore();
  return realWidthM
}
// 绘制地图边框
const drawMapBorder = (
  canvas, targetWidth, targetHeight, borderStyle = 'dualLine' // 'fineLine' | 'thickLine' | 'dualLine'
) => {
  const borderSize = canvas.width / 150 >= 20 ? canvas.width / 150 : 20
  const newCanvas = document.createElement('canvas')
  newCanvas.width = targetWidth
  newCanvas.height = targetHeight
  const nctx = newCanvas.getContext("2d")
  nctx.fillStyle = 'transparent'
  if (borderStyle === 'thickLine' || borderStyle === 'dualLine') {
    nctx.strokeStyle = '#000'
    nctx.lineWidth = 5
    nctx.fillRect(0, 0, newCanvas.width - 5, newCanvas.height - 5)
  }
  if (borderStyle === 'fineLine' || borderStyle === 'dualLine') {
    // nctx.fillStyle = 'white'
    // nctx.fillRect(borderSize / 3, borderSize / 3, newCanvas.width - (borderSize * 2 / 3), newCanvas.height - (borderSize * 2 / 3))
    nctx.strokeStyle = '#000'
    nctx.lineWidth = 2
    nctx.fillRect(borderSize - 5, borderSize - 5, newCanvas.width - (2 * borderSize) + 10, newCanvas.height - 2 * borderSize + 10)
  }
  nctx.drawImage(canvas, borderSize, borderSize, targetWidth - (borderSize * 2), targetHeight - (borderSize * 2))
  return newCanvas
}
const newDrawMapBorder = (
  container, borderStyle = 'dualLine' // 'fineLine' | 'thickLine' | 'dualLine'
) => {
  if (container && container instanceof HTMLElement) {
    container.classList.add(borderStyle)

  }
}
/** 绘制标题/图例/比例尺 */
const drawMapDecorations = async (
  options = {
    titleShow, //是否显示标题 默认不显示
    titleText, //标题内容 默认为空
    titleFontSize,
    titlePosition,
    scaleShow, //是否显示比例尺 默认不显示
    scaleText, //比例尺内容 默认为空
    infoShow, //是否显示图纸信息 默认不显示
    infoPosition, //'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; //图纸信息位置 默认左下
    infoWidthSize, //图纸信息尺寸 默认为图纸的1/6宽
    infoHeightSize, //图纸信息尺寸 默认为图纸的1/6宽
    borderLineWidth, //图纸信息线粗
    legendShow, //是否显示图例信息 默认显示
    legendUrl, //图例图样 默认png
    legendPosition,// 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; //图例位置 默认右下
    legendSize //图例尺寸 默认为图纸的1/6宽
  }
) => {
  const {
    title, bbox, paperMM, tableData, tableMerges, targetHeight, targetWidth,
    titleShow = false, //是否显示标题 默认不显示
    titleText = title, //标题内容 默认为空
    titleFontSize = 70, //标题内容 默认为空
    titlePosition = 100,
    scaleShow = false, //是否显示比例尺 默认不显示
    scaleText = '', //比例尺内容 默认为空
    infoShow = false, //是否显示图纸信息 默认不显示
    infoPosition = 'bottom-left', //图纸信息位置 默认左下
    infoWidthSize = 1 / 5, //图纸信息宽度尺寸 默认为图纸的1/6宽
    infoHeightSize = 1 / 5, //图纸信息高度尺寸 默认为图纸的1/6宽
    borderLineWidth = 3, //图纸信息线粗
    legendShow = true, //是否显示图例信息 默认显示
    legendUrl = legend_black, //图例图样 默认png
    legendPosition = 'bottom-right', //图例位置 默认右下
    legendSize = 1 / 5, //图例尺寸 默认为图纸的1/6宽
  } = options;
  const canvas = document.createElement('canvas')
  const canvasWidth = canvas.width = targetWidth
  const canvasHeight = canvas.height = targetHeight
  const ctx = canvas.getContext('2d')

  ctx.save();

  // 绘制标题
  if (titleText && titleShow) {
    ctx.font = `bold ${titleFontSize}px FontsFree-Net-Alibaba-PuHuiTi`;
    ctx.textAlign = "center";
    ctx.fillStyle = "black";
    ctx.fillText(titleText, canvasWidth / 2, titlePosition);
  }
  // 绘制png图例
  if (ctx && legendShow) {
    const legend_black_png = await loadImage(legendUrl)
    const ratio = legend_black_png.width / legend_black_png.height
    const legendWidth = canvas.width * (legendSize)
    const legendHeight = legendWidth / ratio
    drawImgOnCanvas(ctx, legend_black_png, { width: legendWidth, height: legendHeight }, legendPosition)
  }
  // 绘制比例文本
  if (paperMM && scaleShow) {
    let scText = ''
    if (bbox) {
      const paperWidthM = paperMM[0] / 1000
      const realWidthM = drawScaleBar(ctx, canvas, bbox);
      scText = scaleText || `比例尺 1:${Math.round(realWidthM / paperWidthM)}`
    } else {
      scText = scaleText
    }
    if (scText) {
      ctx.font = `${canvasHeight / 80}px FontsFree-Net-Alibaba-PuHuiTi`;
      ctx.fillStyle = "black";
      ctx.textAlign = "right";
      ctx.fillText(scText, canvasHeight / 10, canvasHeight / 20);
    }
  }
  if (tableData && tableData.length && infoShow) {
    // 绘制table信息
    drawTableOnCanvas(ctx, tableData, tableMerges, infoPosition, {
      width: canvas.width,
      height: canvas.height,
      infoWidthSize, //图纸信息宽度尺寸 默认为图纸的1/6宽
      infoHeightSize,
      borderLineWidth
    })
  }
  ctx.restore();
  return canvas
}
// 调整svg尺寸，填满容器
const adjustSvg = (svgEl) => {
  resetSvgStyle(svgEl)
  // 如果是svg单线图，则需要处理掉边框，使得svg撑满
  if (svgEl) {
    const Other_Layer = svgEl.querySelector('#Other_Layer polygon')
    const points = Other_Layer && Other_Layer.getAttribute('points').split(' ').map(i => i.split(','))
    if (points && points.length >= 3) {
      const effectiveStartX = points[0][0]
      const effectiveStartY = points[0][1]
      const effectiveWidth = points[1][0] - points[0][0]
      const effectiveHeight = points[2][1] - points[1][1]
      svgEl.setAttribute('viewBox', `${effectiveStartX} ${effectiveStartY} ${effectiveWidth} ${effectiveHeight}`)
    }
    const svgWidth = svgEl.getAttribute('width')
    const svgHeight = svgEl.getAttribute('height')
    // svg位置根据纸张方向需要做不通的判断
    // const canvasRatio = canvasWidth / canvasHeight
    const canvasWidth = window.innerWidth
    const canvasHeight = window.innerHeight
    const svgRatio = svgWidth / svgHeight
    let canvasRatio = svgRatio
    if (svgRatio > 0.75 && svgRatio < 1) {
      canvasRatio += 0.25
    }
    if (svgRatio < 1.25 && svgRatio > 1) {
      canvasRatio -= 0.25
    }
    const ratio = canvasRatio >= 1 ? svgWidth / canvasWidth : svgHeight / canvasHeight
    const x = canvasRatio >= 1 ? (canvasWidth - canvasWidth) / 2 : (canvasWidth - (svgWidth / ratio)) / 2
    const y = canvasRatio >= 1 ? (canvasHeight - (svgHeight / ratio)) / 2 : (canvasHeight - canvasHeight) / 2
    const width = canvasRatio >= 1 ? canvasWidth : svgWidth / ratio
    const height = canvasRatio >= 1 ? svgHeight / ratio : canvasHeight
    console.log('x, y, width, height', canvasWidth, canvasHeight, x, y, width, height);
    svgEl.setAttribute('x', x)
    svgEl.setAttribute('y', y)
    svgEl.setAttribute('width', width)
    svgEl.setAttribute('height', height)
  }
}

// 返回表格信息
const returnTableInfo = (printInfo) => {
  const {
    totall = '-',
    pbNum = '-',
    dkxn = '-',
    jkcd = '-',
    pbGbNum = '-',
    pbGbrl = '-',
    dlcd = '-',
    pbZbNum = '-',
    pbZbrl = '-',
    bdzn = '-',
    ywdw = '-',
    whbz = '-',
    kgzNum = '-',
    hwgNum = '-',
    llkgNum = '-',
    lasttime = '-',
    fzxNum = '-',
    pdsNum = '-',
    fdkgNum = '-',
    xbNum = '-',
    gtNum = '-'
  } = printInfo
  const tableData = [
    [
      '线路（km）',
      '',
      '',
      '配电变压器',
      '',
      '',
      '',
      '',
      '',
      '图纸类型',
      '',
      '10kV单线正交图',
      '',
      ''
    ],
    [
      '总长度',
      '',
      totall,
      '总台数',
      '',
      pbNum,
      '总容量（kVA）',
      '',
      pbGbrl + pbZbrl,
      '图纸名称',
      '',
      dkxn,
      '',
      ''
    ],
    [
      '架空长度',
      '',
      jkcd,
      '公变数量',
      '',
      pbGbNum,
      '公变容量（kVA）',
      '',
      pbGbrl,
      '',
      '',
      '',
      '',
      ''
    ],
    [
      '电缆长度',
      '',
      dlcd,
      '专变数量',
      '',
      pbZbNum,
      '专变容量（kVA）',
      '',
      pbZbrl,
      '起点电站',
      '',
      bdzn,
      '',
      ''
    ],
    ['其他设备', '', '', '', '', '', '', '', '', '运维单位', '', whbz, '', ''],
    [
      '开关站数量',
      '',
      kgzNum,
      '环网柜数量',
      '',
      hwgNum,
      '联络开关数量',
      '',
      llkgNum,
      '更新时间',
      '',
      lasttime,
      '',
      ''
    ],
    [
      '分支箱数量',
      '',
      fzxNum,
      '配电室数量',
      '',
      pdsNum,
      '分段开关数量',
      '',
      fdkgNum,
      '',
      '',
      '',
      '',
      ''
    ],
    ['箱式变数量', '', xbNum, '', '', '', '运行杆塔数量', '', gtNum, '', '', '', '']
  ]
  const tableMerges = [
    // 第一行
    {
      row: 0,
      col: 0,
      colspan: 3
    },
    {
      row: 0,
      col: 3,
      colspan: 6
    },
    {
      row: 0,
      col: 9,
      colspan: 2
    },
    {
      row: 0,
      col: 11,
      colspan: 3
    },
    // 第二行
    {
      row: 1,
      col: 0,
      colspan: 2
    },
    {
      row: 1,
      col: 3,
      colspan: 2
    },
    {
      row: 1,
      col: 6,
      colspan: 2
    },
    {
      row: 1,
      col: 9,
      colspan: 2,
      rowspan: 2
    },
    {
      row: 1,
      col: 11,
      colspan: 3,
      rowspan: 2
    },
    // 第三行
    {
      row: 2,
      col: 0,
      colspan: 2
    },
    {
      row: 2,
      col: 3,
      colspan: 2
    },
    {
      row: 2,
      col: 6,
      colspan: 2
    },
    // 第四行
    {
      row: 3,
      col: 0,
      colspan: 2
    },
    {
      row: 3,
      col: 3,
      colspan: 2
    },
    {
      row: 3,
      col: 6,
      colspan: 2
    },
    {
      row: 3,
      col: 9,
      colspan: 2
    },
    {
      row: 3,
      col: 11,
      colspan: 3
    },
    // 第五行
    {
      row: 4,
      col: 0,
      colspan: 9
    },
    {
      row: 4,
      col: 9,
      colspan: 2
    },
    {
      row: 4,
      col: 11,
      colspan: 3
    },
    // 第六行
    {
      row: 5,
      col: 0,
      colspan: 2
    },
    {
      row: 5,
      col: 3,
      colspan: 2
    },
    {
      row: 5,
      col: 6,
      colspan: 2
    },
    {
      row: 5,
      col: 9,
      colspan: 2
    },
    {
      row: 5,
      col: 11,
      colspan: 3
    },
    // 第七行
    {
      row: 6,
      col: 0,
      colspan: 2
    },
    {
      row: 6,
      col: 3,
      colspan: 2
    },
    {
      row: 6,
      col: 6,
      colspan: 2
    },
    {
      row: 6,
      col: 9,
      colspan: 5,
      rowspan: 2
    },
    // 第八行
    {
      row: 7,
      col: 0,
      colspan: 2
    },
    {
      row: 7,
      col: 3,
      colspan: 3
    },
    {
      row: 7,
      col: 6,
      colspan: 2
    }
  ]
  return { tableData, tableMerges }
}
export default {
  drawMapBorder,
  newDrawMapBorder,
  drawMapDecorations,
  adjustSvg,
  returnTableInfo
}