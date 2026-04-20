import { SVG } from '@svgdotjs/svg.js'
import svgPanZoom from 'svg-pan-zoom'
import $ from 'jquery'
import { fullDefs } from './mapDepend/SvgVariable.js'
// import $bus from '@/utils/bus'
const $bus = {
  emit: (that, a, b) => {
    that.set$BusValue(a, b)
  }
}
// import { ElMessage } from 'element-plus'
const ElMessage = {
  warning: (e) => console.log(e),
  success: (e) => console.log(e),
}
import 'svg2pdf.js'
// import router from '@/router'
const router = { resolve: (p) => console.log(p) }
import mapTool from './tools/MapTool.js'
import { toNumber } from 'lodash-es'
export default class SvgView {
  constructor(accessToken, dkxid, starttime, endtime, flysb, szpsrid) {
    this.uniqueMap$Bus = new Map()
    this.exportConfig = null
    this.accessToken = accessToken
    this.isreload = true
    this.dkxid = dkxid
    this.starttime = starttime
    this.endtime = endtime
    this.flysb = flysb
    this.drawid = null
    this.szpsrid = szpsrid
    this.initEvt()

    this.currentSuffix = 'IA'
    this.currentSuffixBuffer = 'IA'

    this.panZoom = null

    this.currentPowerDownPDHandle = [] //停电配变
    this.currentPowerDownTopoHandel = [] //停电配变拓扑path

    // this.effect_poweron = [];//开关因素影响_正常设备,默认状态,暂未启动
    this.effect_transform = [] //开关因素影响_转供
    this.effect_error = [] //开关因素影响_停电区域
    this.nchf_breaker = [] //需要更改图元的开关
    this.breaker_point = [] //开关测点值
    this.breaker_protect = [] //开关保护定值
    this.theme1Cut = [] //精简场景1隐藏设备
    this.theme1Togger = true

    this.fzlcolor = ['#0095ff', '#00FF00', '#ffff0b', '#fca819', '#ff4545']

    this.operScaleHis = 1 //缩放操作记录

    this.defaultSvgZoom = -404 //默认svg缩放状态
    this.defaultSvgTextShow = -404 //默认svg文字显示状态
    this.powerDownTopoResult = null

    this.svgMapBounds = null
    this.svgReadMode = 1 // 当前显示模式 1 正交图 2 沿步图 3站室图

    this.currentLeftEquip = null //当前鼠标左键选中设备的gid
    this.currentRightEquip = null //右键设备

    this.dkxName = ''
    this.svgPointEdit = null

    this.svgEditPointMap = null

    this.tranPointFontSize = null //配变测点文字大小  20240220修改 要求页面测点都一样大
    this.tranTTUPointFontSize = null //配变测点文字大小  20240220修改 要求页面测点都一样大
    this.switchPointFontSize = null //开关测点文件大小
    this.switchTerminalPointFontSize = null

    this.svgsource = null
    this.svgid = null

    // svg超出边框的话  这就是红色边框宽高
    this.otherLayerObj = null

    //立光图元 map 替换图元用
    this.lgSymbolMap = new Map()
  }
  renderSvg() {
    //正交图
    this.initSVG()
  }
  // 设置导出配置参数
  setExportConfigValue(config) {
    this.exportConfig = config
  }
  set$BusValue(key, value) {
    if (!this.uniqueMap$Bus.has(key)) {
      this.uniqueMap$Bus.set(key, value)
    }
  }
  get$BusValue(key) {
    return this.uniqueMap$Bus.get(key)
  }
  async renderOutSvg(svgid, source) {
    let that = this
    this.svgid = svgid
    this.svgsource = source
    if (this.svgid) {
      this.initOuterSvg()
    } else {
      const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getOuterSvgSvgidByDkxid', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dkxid: this.dkxid, drawtype: 'zjt'
        })
      })
      const { code, data: res } = await r.json()
      if (code === 200 && res) {
        that.svgid = res.svgid
        that.initOuterSvg()
      }
    }
  }

  renderSvgOnMap(m) {
    //地理图
    this.initSVGOnMap(m)
  }
  async renderOuterSvgOnMap(m, svgid, source) {
    let that = this
    //地理图
    this.svgid = svgid
    this.svgsource = source
    if (this.svgid) {
      this.initOuterSVGOnMap(m, svgid)
    } else {
      const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getOuterSvgSvgidByDkxid', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dkxid: this.dkxid, drawtype: 'dljxt'
        })
      })
      const { code, data: res } = await r.json()
      if (code === 200 && res) {
        that.svgid = res.svgid
        let diagramsource = res.source
        if (diagramsource == 'szdw') {
          that.initSVGOnMap(m)
        } else {
          that.initOuterSVGOnMap(m)
        }
      }
    }
  }
  renderStationSvg() {
    //站市图
    this.initStationSvg()
  }
  initEvt() {
    document.oncontextmenu = function (e) {
      return false
    }
    $('body').on('click', function () {
      $('#rightClickDiv').hide()
    })
    let that = this
    setInterval(
      function () {
        if (that.isreload) {
          that.resetSVG()
        }
      },
      1000 * 60 * 10
    )
    $('#styleSwLi').on('click', function () {
      if ($('#styleSwLi').hasClass('active')) {
        $('#styleSwLi').removeClass('active')
        $('link[smarker=hahaha]').attr('href', styleW)
      } else {
        $('#styleSwLi').addClass('active')
        $('link[smarker=hahaha]').attr('href', styleR)
      }
    })

    $('#powercutTransDivSwitch').on('click', function () {
      if ($('#powercutTransDivSwitchI').hasClass('el-icon-arrow-down')) {
        $('#powercutTransDivSwitchI').removeClass('el-icon-arrow-down')
        $('#powercutTransDivSwitchI').addClass('el-icon-arrow-up')
        $('#pctContent').slideToggle(300)
      } else if ($('#powercutTransDivSwitchI').hasClass('el-icon-arrow-up')) {
        $('#powercutTransDivSwitchI').removeClass('el-icon-arrow-up')
        $('#powercutTransDivSwitchI').addClass('el-icon-arrow-down')
        $('#pctContent').slideToggle(300)
      }
    })
    $('#lineDeviceSwitchDiv').on('click', function () {
      if ($('#legendInfoDeviceSwitchI').hasClass('el-icon-d-arrow-left')) {
        $('#legendInfoDeviceSwitchDiv').click()
      }
      if ($('#lineDeviceSwitchI').hasClass('el-icon-d-arrow-left')) {
        $('#legendInfoDeviceSwitchDiv').css('z-index', '99')
        $('#lineDeviceSwitchDiv').css('left', '5px')
        $('#lineDeviceSwitchI').removeClass('el-icon-d-arrow-left')
        $('#lineDeviceSwitchI').addClass('el-icon-d-arrow-right')
        $('#lineInfoDiv').fadeOut(300)
      } else if ($('#lineDeviceSwitchI').hasClass('el-icon-d-arrow-right')) {
        $('#legendInfoDeviceSwitchDiv').css('z-index', '1')
        $('#lineDeviceSwitchDiv').css('left', '340px')
        $('#lineDeviceSwitchI').removeClass('el-icon-d-arrow-right')
        $('#lineDeviceSwitchI').addClass('el-icon-d-arrow-left')
        $('#lineInfoDiv').fadeIn(300)
      }
    })
    $('#legendInfoDeviceSwitchDiv').on('click', function () {
      if ($('#lineDeviceSwitchI').hasClass('el-icon-d-arrow-left')) {
        $('#lineDeviceSwitchDiv').click()
      }
      if ($('#legendInfoDeviceSwitchI').hasClass('el-icon-d-arrow-left')) {
        $('#lineDeviceSwitchDiv').css('z-index', '99')
        $('#legendInfoDeviceSwitchDiv').css('left', '5px')
        $('#legendInfoDeviceSwitchI').removeClass('el-icon-d-arrow-left')
        $('#legendInfoDeviceSwitchI').addClass('el-icon-d-arrow-right')
        $('#legendInfoDiv').fadeOut(300)
      } else if ($('#legendInfoDeviceSwitchI').hasClass('el-icon-d-arrow-right')) {
        $('#lineDeviceSwitchDiv').css('z-index', '1')
        $('#legendInfoDeviceSwitchDiv').css('left', '620px')
        $('#legendInfoDeviceSwitchI').removeClass('el-icon-d-arrow-right')
        $('#legendInfoDeviceSwitchI').addClass('el-icon-d-arrow-left')
        $('#legendInfoDiv').fadeIn(300)
      }
    })
    $('#openOtherDraw').on('click', function () {
      let svgpage = null

      if (that.svgReadMode == 2) {
        svgpage = router.resolve({
          name: 'explor_svgview',
          query: {
            fullScreen: true,
            _szpsrid: that.szpsrid,
            id: that.dkxid,
            // attid: that.attid,
            type: that.svgsource,
            flysb: that.currentRightEquip
          }
        })
        //window.open(ctx+'/drawings/cadexplor/preview/svg?dkxid=' + dkxid + '&qst=' + starttime+'&qet='+endtime+'&drawid='+otherdrawid+'&flysb='+that.currentRightEquip,dkxid+otherdrawid);
      } else {
        svgpage = router.resolve({
          name: 'explor_svgviewmap',
          query: {
            fullScreen: true,
            _szpsrid: that.szpsrid,
            id: that.dkxid,
            // attid: that.attid,
            type: that.svgsource,
            flysb: that.currentRightEquip
          }
        })
        // window.open(ctx+'/drawings/cadexplor/preview/svgOnMap?dkxid=' + dkxid + '&qst=' + starttime+'&qet='+endtime+'&drawid='+otherdrawid+'&flysb='+that.currentRightEquip,dkxid+otherdrawid);
      }
      window.open(svgpage.href, '_blank')
    })
    $('#flyToDrawDiv').on('click', function () {
      let svgpage = null

      if (that.svgReadMode == 2) {
        svgpage = router.resolve({
          name: 'explor_svgview',
          query: {
            fullScreen: true,
            _szpsrid: that.szpsrid,
            id: that.dkxid,
            // attid: that.attid,
            type: that.svgsource,
            flysb: that.currentRightEquip
          }
        })
        //window.open(ctx+'/drawings/cadexplor/preview/svg?dkxid=' + dkxid + '&qst=' + starttime+'&qet='+endtime+'&drawid='+otherdrawid+'&flysb='+that.currentRightEquip,dkxid+otherdrawid);
      } else {
        svgpage = router.resolve({
          name: 'explor_svgviewmap',
          query: {
            fullScreen: true,
            _szpsrid: that.szpsrid,
            id: that.dkxid,
            // attid: that.attid,
            type: that.svgsource,
            flysb: that.currentRightEquip
          }
        })
        // window.open(ctx+'/drawings/cadexplor/preview/svgOnMap?dkxid=' + dkxid + '&qst=' + starttime+'&qet='+endtime+'&drawid='+otherdrawid+'&flysb='+that.currentRightEquip,dkxid+otherdrawid);
      }
      window.open(svgpage.href, '_blank')
      $('#rightClickDiv').hide()
    })
  }
  setReloadPara(e) {
    this.isreload = e
  }
  setPointLayerShow(e) {
    if (e) {
      $('#Point_Layer').show()
      // $('#Temp_Layer').show() // 渲染配自开关
    } else {
      $('#Point_Layer').hide()
      // $('#Temp_Layer').hide() // 隐藏配自开关
    }
  }
  setTopoShow(e) {
    if (e) {
      this.addSvgTopo()
    } else {
      this.removeSvgTopo()
    }
  }
  svgColorOperate(scaleX) {
    let that = this
    let mysvg = null
    if (this.svgReadMode == 2) {
      mysvg = $('#svgContainer svg:eq(0) g')
    } else {
      mysvg = $('#svgContainer svg:eq(1) g')
    }
    mysvg.each(function (idx0, child0) {
      let cadid0 = child0.id
      let childsvg = $('#' + cadid0)
      childsvg.each(function (idx, child) {
        let lastNodeId = child.id
        let lastNodeSVG = SVG('#' + lastNodeId)
        let isscaled = true //会执行两次,加标记位阻止

        lastNodeSVG.each(function (idxx, children) {
          let stype = this.type
          if (isscaled && stype != 'g') {
            if (children.length > 1) {
              let fmeta = children[1].type
              if (fmeta == 'metadata') {
                let metaDataChildren = children[1].node.children
                for (let mci = 0; mci < metaDataChildren.length; mci++) {
                  let metav = metaDataChildren[mci]
                  if (metav.nodeName == 'cge:psr_ref') {
                    //if ($(metav.outerHTML).attr('objectlayer')) {  //兼容立光 同源图纸objectlayer
                    if (true) {
                      if (
                        that.svgReadMode == 3 ||
                        ($(metav.outerHTML).attr('objectlayer') != '0' &&
                          $(metav.outerHTML).attr('objectlayer') != '')
                      ) {
                        if (scaleX > 0) {
                          if (children[0].attr('stroke-width')) {
                            let sw = children[0].attr('stroke-width')
                            children[0].attr('stroke-width', (sw / that.operScaleHis) * scaleX)
                            isscaled = false
                          } else if (children[0].attr('style')) {
                            let sw = children[0].attr('style')
                            let swFull = ''
                            for (let swi = 0; swi < sw.split(';').length; swi++) {
                              let sws = sw.split(';')[swi]
                              let strokeWidthStr = sws.split(':')[0]
                              if (strokeWidthStr == 'stroke-width') {
                                let strokeWidthNum = sws.split(':')[1]
                                let strokeWidthNum_f = parseFloat(strokeWidthNum)
                                swFull +=
                                  'stroke-width:' +
                                  (strokeWidthNum_f / that.operScaleHis) * scaleX +
                                  ';'
                                isscaled = false
                              } else {
                                if (sws != '') {
                                  swFull += sws + ';'
                                }
                              }
                            }
                            children[0].attr('style', swFull)
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      })
    })
    that.operScaleHis = scaleX
  }
  reloadRunInfo(phase) {
    this.currentSuffixBuffer = phase
    this.resetSVG()
  }
  resetSVG() {
    this.renderRunStatus()
    this.renderBreakerPointInfo()

    setTimeout(() => {
      if (this.otherdraw) {
        $('#openOtherDraw').show()
      }
      if (this.topoDivShow === true) {
        $('#topoDiv').show()
      }
    }, 1000)
  }
  resetPowerDownInfo() {
    for (let hi = 0; hi < this.currentPowerDownPDHandle.length; hi++) {
      let chandle = this.currentPowerDownPDHandle[hi]
      $('#' + chandle).removeClass('svgtdpb')
      $('#' + chandle).unbind('click')
      $('#' + chandle).unbind('mouseover')
      $('#' + chandle).unbind('mouseout')
    }
  }
  readEditPoint(drawtype, dkxid) {
    let that = this
    $.ajax({
      type: 'POST',
      url: ctx + '/drawings/cadexplor/svgEdit/readEditPoint',
      data: { drawtype: drawtype, dkxid: dkxid },
      async: false,
      success: function (res) {
        if (res.code == 0) {
          that.svgEditPointMap = res.data
        }
      }
    })
  }
  async initSVG() {
    let that = this
    this.svgReadMode = 1
    let screenWidth = $('#app').width()
    let screenHeight = $('#app').height()

    $('#svgContainer').width(screenWidth)
    $('#svgContainer').height(screenHeight)

    var svgWidth
    var svgHeight
    var svgContainerWidth = $('#svgContainer').width()
    var svgContainerHeight = $('#svgContainer').height()

    var initZoom = 1
    var draw = SVG().addTo('#svgContainer').size(svgContainerWidth, svgContainerHeight)
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgByDkxid', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dkxid: that.dkxid, drawtype: 'dxzj'
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      let svgstr = res.svgstr
      that.drawid = res.drawid
      $bus.emit(that, 'init-page-drawname', res.dkxname)
      if (res.otherdraw) {
        that.otherdraw = res.otherdraw
        $('#openOtherDraw').show()
      }

      draw.svg(svgstr)

      draw.defs().clear()
      draw.defs().svg(fullDefs)

      //加虚拟边框
      $('symbol').each(function () {
        var symbol = SVG('#' + this.id)
        var width = this.getAttribute('width')
        var height = this.getAttribute('height')
        // this.viewBox.baseVal.width, this.viewBox.baseVal.height
        symbol
          .rect(width, height)
          .attr({
            stroke: 'yellow',
            'stroke-width': 0,
            fill: 'yellow',
            'fill-opacity': 0,
            'stroke-opacity': 0
          })
          .translate(width / 2, height / 2)
      })

      svgWidth = $('#svgContainer svg')[1].viewBox.baseVal.width
      svgHeight = $('#svgContainer svg')[1].viewBox.baseVal.height
      if (!SVG('#Point_Layer')) {
        SVG($('#svgContainer svg')[1]).svg('<g id="Point_Layer"></g>')
      }

      var xZoom = svgContainerWidth / svgWidth
      var yZoom = svgContainerHeight / svgHeight

      initZoom = xZoom > yZoom ? yZoom : xZoom

      draw.rect(svgWidth, svgHeight).attr({ fill: 'none', stroke: '#ab0000', 'stroke-width': 2 })

      that.panZoom = svgPanZoom($('#svgContainer svg')[0], {
        fit: false,
        center: false,
        minZoom: 0.05,
        onZoom: that.svgZoomEvt
      })

      $('#reset').on('click', function () {
        that.panZoom.resetZoom()
        that.panZoom.resetPan()

        that.panZoom.panBy({
          x: (svgContainerWidth * 0.8) / 2 - svgWidth / 2,
          y: (svgContainerHeight * 0.8) / 2 - svgHeight / 2
        })
        that.panZoom.zoom(initZoom)

        that.defaultSvgZoom = initZoom
      })
      $('#reset').click()

      //**************************
      //svg加载完操作
      //**************************
      that.svgColorOperate(1) //默认
      if (that.flysb) {
        that.locatEquipOnSvg(that.flysb)
      }
      that.initSVGRightEvent()
      that.initLinkerLineLabelEvent()

      $('#Point_Layer').hide()
      that.renderRunStatus() //加载运行状态
      that.renderLineInfo() //线路运行信息
      that.renderFaultMsg() //线路预警信息

      await that.renderBreakerState() //先拉取开关状态,再拉取停电信息

    }
  }

  // 单线图
  async initOuterSvg() {
    let that = this
    this.svgReadMode = -1
    let screenWidth = $('#app').width()
    let screenHeight = $('#app').height()
    $('#svgContainer').addClass('lg')
    // $('#svgContainer').css('background-color', 'rgb(0,0,0,0)')
    // $('#bwThemeBtn').hide()
    $('#svgContainer').width(screenWidth)
    $('#svgContainer').height(screenHeight)

    var svgWidth
    var svgHeight
    var svgContainerWidth = $('#svgContainer').width()
    var svgContainerHeight = $('#svgContainer').height()

    var initZoom = 1

    $('#svgContainer').empty()

    var draw = SVG().addTo('#svgContainer').size(svgContainerWidth, svgContainerHeight)
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getOuterSvgByDkxid', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        svgid: that.svgid
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      let svgstr = res.svgstr
      that.dkxid = res.dkxid
      $bus.emit(that, 'init-page-drawname', res.dkxname)
      const config = that.exportConfig
      draw.svg(svgstr)
      //处理立光图纸缺失开关symbol  兼容无替换symbol返回
      if (res.lgsymbols) {
        let allSymbolList = []
        $('#svgContainer svg:eq(1) symbol').each(function () {
          var symbol = SVG(this)
          if (!symbol) {
            return
          }
          allSymbolList.push(symbol.node.id)
        })
        for (let lgsymObj of res.lgsymbols) {
          let lgsymid = lgsymObj.symbolid
          that.lgSymbolMap.set(lgsymid, lgsymObj.sbzlxgroup)
          if (allSymbolList.includes(lgsymid)) {
            continue
          }
          draw.defs().svg(lgsymObj.content)
        }
      }

      //加虚拟边框
      $('#svgContainer svg:eq(1) symbol').each(function () {
        var symbol = SVG(this)
        if (!symbol) {
          return
        }

        let symbolChilds = symbol.node.childNodes
        for (let i = 0; i < symbolChilds.length; i++) {
          let cs = symbolChilds[i]
          if (cs.nodeName == '#text' || cs.nodeName == 'text') {
            $(cs).removeAttr('fill')
          } else {
            $(cs).removeAttr('stroke')
          }
        }

        var width = this.getAttribute('width')
        var height = this.getAttribute('height')

        // this.viewBox.baseVal.width, this.viewBox.baseVal.height

        symbol.rect(width, height).attr({
          stroke: 'yellow',
          'stroke-width': 0,
          fill: 'yellow',
          'fill-opacity': 0,
          'stroke-opacity': 0
        })
        // .translate(0, 0)
      })

      setTimeout(() => {
        $($('#svgContainer #Other_Layer polygon')[0])?.attr('fill', 'none')
      })

      svgWidth = $('#svgContainer svg')[1].viewBox.baseVal.width
      svgHeight = $('#svgContainer svg')[1].viewBox.baseVal.height
      // 测点图层
      if (!SVG('#Point_Layer')) {
        SVG($('#svgContainer svg')[1]).svg('<g id="Point_Layer"></g>')
      }
      // 配自开关图层
      if (!SVG('#Temp_Layer')) {
        SVG($('#svgContainer svg')[1]).svg('<g id="Temp_Layer"></g>')
      }
      // 判断是否自带边框
      const Other_Layer = $('#svgContainer #Other_Layer')
      const isOther_Layer = Other_Layer.length > 0
      var scale = !isOther_Layer ? 1.1 : 0.8
      var xZoom = svgContainerWidth / (svgWidth * scale)
      var yZoom = svgContainerHeight / (svgHeight * scale)

      initZoom = xZoom > yZoom ? yZoom : xZoom
      if (!isOther_Layer) {
        draw
          .rect(svgWidth, svgHeight)
          .attr({ fill: 'none', stroke: '#ab0000', 'stroke-width': 2 })
      } else {
        // 如果自带边框 去掉背景，调整边框颜色  去掉table标签和文字
        $('#svgContainer #BackGround_Layer').detach()
        const a3line = $(Other_Layer[0]).find('.a3line')
        a3line.each((index, el) => {
          const line = $(el)
          const color = '#ab0000'
          line.attr('stroke', color)
          line.attr('stroke-width', 2)
          line.attr('fill', 'transparent')
          line.attr('class', 'exportA3line')
          if (index) {
            line.detach()
          }
        })
        const Text_Layer_g = $('#Text_Layer>g')
        Text_Layer_g.each((index, el) => {
          const text = $(el)
          const metadata = text.find('metadata').children()
          const objectname = metadata && metadata.length && metadata[0].getAttribute('objectname')
          const isTableText = metadata.length === 1 && objectname === 'Text_Layer'
          if (isTableText) {
            text.detach()
          }
        })
      }
      that.panZoom = svgPanZoom($('#svgContainer svg')[0], {
        fit: false,
        center: false,
        minZoom: 0.05
        // onZoom: that.svgZoomEvt
      })

      $('#reset').on('click', function () {
        that.panZoom.resetZoom()
        that.panZoom.resetPan()

        that.panZoom.panBy({
          x: (svgContainerWidth * 1) / 2 - svgWidth / 2,
          y: (svgContainerHeight * 1) / 2 - svgHeight / 2
        })
        that.panZoom.zoom(initZoom)

        that.defaultSvgZoom = initZoom
      })
      $('#reset').click()

      //**************************
      //svg加载完操作
      //**************************
      that.svgColorOperate(1) //默认
      if (that.flysb) {
        that.locatEquipOnSvg(that.flysb)
      }
      that.initSVGRightEvent()
      that.initLinkerLineLabelEventOuter()

      $('#Point_Layer').hide()
      // $('#Temp_Layer').hide() // 先把配自开关隐藏

      that.renderRunStatus() //加载运行状态
      await that.renderOuterLineInfo('zjt', 'lg') //线路运行信息
      that.renderFaultMsg() //线路预警信息

      await that.renderBreakerState() //先拉取开关状态,再拉取停电信息

      that.initSearchData()
      // $('#Substation_Layer g>use').addClass('svgtdpb')
      // $('#PowerTransformer_Layer g>use').addClass('svgtdpb')
    }
  }
  async initSVGOnMap(map) {
    this.svgReadMode = 2
    let resetDivStyle = (bbox) => {
      let lt_pixel = that.map.project(bbox[0])
      let rb_pixel = that.map.project(bbox[1])

      let width = rb_pixel.x - lt_pixel.x
      let height = rb_pixel.y - lt_pixel.y

      let $graphCon = $('#svgContainer')
      let $svg = $graphCon.find('svg')
      $svg.attr('width', width)
      $svg.attr('height', height)

      $graphCon.css({
        left: `${lt_pixel.x}px`,
        top: `${lt_pixel.y}px`,
        width: `${width}px`,
        height: `${height}px`
      })
    }

    let webMercator2LngLat = (x, y) => {
      var lon = (x / 20037508.34) * 180
      var lat = (y / 20037508.34) * 180
      lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
      return { lon: lon, lat: lat }
    }

    let getConvertCoor = async (newbbox) => {
      that.map.fitBounds(newbbox, {
        animate: false,
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      })
      $("#svgContainer svg>g[id='Background_Layer']>rect").attr('fill', 'rgba(255,255,255,0.5)')

      that.map.on('movestart', function (e) {
        $('#svgContainer').css('opacity', 0.2)
      })
      that.map.on('moveend', function (e) {
        resetDivStyle(newbbox)
        $('#svgContainer').css('opacity', 1)
        $('#svgContainer').show()
      })

      $('#reset').on('click', function () {
        that.map.fitBounds(newbbox, {
          animate: false,
          padding: { top: 0, bottom: 0, left: 0, right: 0 }
        })
      })

      //**************************
      //svg加载完操作
      //**************************
      that.svgColorOperate(1) //默认
      if (that.flysb) {
        that.locatEquipOnSvg(that.flysb)
      }
      that.initSVGRightEvent()
      that.initLinkerLineLabelEvent(map)

      $('#Point_Layer').hide()
      that.renderRunStatus() //加载运行状态
      that.renderLineInfo() //线路运行信息
      that.renderFaultMsg() //线路预警信息

      await that.renderBreakerState() //先拉取开关状态,再拉取停电信息
    }

    $('#mapdivSvgViewMap .sgmap-canvas-container').append(
      `<div class="svgContainer" id="svgContainer"></div>`
    )
    let that = this
    this.map = map
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgByDkxid', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dkxid: that.dkxid, drawtype: 'dxdl'
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      that.drawid = res.drawid
      $bus.emit(that, 'init-page-drawname', res.dkxname)
      if (res.otherdraw) {
        that.otherdraw = res.otherdraw
        $('#openOtherDraw').show()
      }
      $('#svgContainer').addClass('lg')
      $('#svgContainer').html(res.svgstr)
      $('#svgContainer').hide()
      let $svg = $('#svgContainer>svg')
      $('symbol').each(function () {
        var symbol = SVG(this)
        var width = this.getAttribute('width')
        var height = this.getAttribute('height')
        // this.viewBox.baseVal.width, this.viewBox.baseVal.height
        symbol
          .rect(width, height)
          .attr({
            stroke: 'yellow',
            'stroke-width': 0,
            fill: 'yellow',
            'fill-opacity': 0,
            'stroke-opacity': 0
          })
          .translate(width / 2, height / 2)
      })
      // let view = $svg.attr('viewBox');
      // let viewArr = view.split(' ').map(n => +n);
      // $svg.attr('viewBox', `0 0 ${viewArr[2]} ${viewArr[3]}`);
      // $('#Text_Layer g>text').attr('fill','rgb(0,0,0)');
      // $('#Hot_Layer g>text').attr('fill','rgb(0,153,255)');
      if (!SVG('#Point_Layer')) {
        SVG($('#svgContainer svg')[0]).svg('<g id="Point_Layer"></g>')
      }
      let coordinateExtent = $svg.attr('coordinateextent')
      let coordinateExtentArr = coordinateExtent.split(' ')
      that.svgMapBounds = coordinateExtentArr
      let sgbounds1 = webMercator2LngLat(coordinateExtentArr[0], coordinateExtentArr[3])
      let sgbounds2 = webMercator2LngLat(coordinateExtentArr[2], coordinateExtentArr[1])
      var bbox = [
        [sgbounds1.lon, sgbounds1.lat],
        [sgbounds2.lon, sgbounds2.lat]
      ]
      that.bbox = bbox
      mapTool.getSingleLineCor(bbox, getConvertCoor)
      //resetDivStyle(bbox);

    }
  }

  // 全景预览地理接线图
  async initOuterSVGOnMap(map) {
    this.svgReadMode = 2
    let resetDivStyle = (bbox) => {
      let lt_pixel = that.map.project(bbox[0])
      let rb_pixel = that.map.project(bbox[1])

      let width = rb_pixel.x - lt_pixel.x
      let height = rb_pixel.y - lt_pixel.y

      let $graphCon = $('#svgContainer')
      let $svg = $graphCon.find('svg')
      console.log('$graphCon', $graphCon, $svg);
      $svg.attr('width', width)
      $svg.attr('height', height)

      $graphCon.css({
        left: `${lt_pixel.x}px`,
        top: `${lt_pixel.y}px`,
        width: `${width}px`,
        height: `${height}px`
      })
    }

    let webMercator2LngLat = (x, y) => {
      var lon = (x / 20037508.34) * 180
      var lat = (y / 20037508.34) * 180
      lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
      return { lon: lon, lat: lat }
    }

    let getConvertCoor = async (newbbox) => {
      const resetDiv = () => {
        resetDivStyle(newbbox)
        $('#svgContainer').css('opacity', 1)
        $('#svgContainer').show()
      }
      that.map.fitBounds(newbbox, {
        animate: false,
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      })
      resetDiv()
      $("#svgContainer svg>g[id='Background_Layer']>rect").attr('fill', 'rgba(255,255,255,0)')
      that.map.on('movestart', function (e) {
        $('#svgContainer').css('opacity', 0.2)
      })
      that.map.on('moveend', function (e) {
        resetDiv()
      })

      $('#reset').on('click', function () {
        that.map.fitBounds(newbbox, {
          animate: false,
          padding: { top: 0, bottom: 0, left: 0, right: 0 }
        })
      })

      //**************************
      //svg加载完操作
      //**************************
      that.svgColorOperate(1) //默认
      if (that.flysb) {
        that.locatEquipOnSvg(that.flysb)
      }

      that.initLinkerLineLabelEvent(map)

      $('#Point_Layer').hide()
      that.renderRunStatus() //加载运行状态
      await that.renderOuterLineInfo('dljxt', 'tm') //线路运行信息
      that.renderFaultMsg() //线路预警信息

      await that.renderBreakerState() //先拉取开关状态,再拉取停电信息

      // that.initSVGRightEvent(5000)
    }

    $('#mapdivSvgViewMap .sgmap-canvas-container').append(
      `<div class="svgContainer" id="svgContainer"></div>`
    )
    let that = this
    this.map = map
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getOuterSvgByDkxid', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        svgid: that.svgid
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      that.dkxid = res.dkxid
      $bus.emit(that, 'init-page-drawname', res.dkxname)
      $('#svgContainer').addClass('lg')
      $('#svgContainer').html(res.svgstr)
      $('#svgContainer').hide()
      let $svg = $('#svgContainer>svg')
      $('symbol').each(function () {
        var symbol = SVG(this)
        var width = this.getAttribute('width')
        var height = this.getAttribute('height')
        // this.viewBox.baseVal.width, this.viewBox.baseVal.height
        symbol
          .rect(width, height)
          .attr({
            stroke: 'yellow',
            'stroke-width': 0,
            fill: 'yellow',
            'fill-opacity': 0,
            'stroke-opacity': 0
          })
          .translate(-width / 2, -height / 2)
      })

      // 给主干线路加粗
      let metadataList = $('#svgContainer>svg metadata')
      for (const dom of metadataList) {
        let ls = $(dom).children()
        for (const item of ls) {
          if (item.nodeName == 'cge:psr_ref' && item.getAttribute('linetype') == 'Trunk') {
            $(item).parent().parent().find('polyline').addClass('blodStroke')
          }
        }
      }

      // let view = $svg.attr('viewBox');
      // let viewArr = view.split(' ').map(n => +n);
      // $svg.attr('viewBox', `0 0 ${viewArr[2]} ${viewArr[3]}`);
      // $('#Text_Layer g>text').attr('fill','rgb(0,0,0)');
      // $('#Hot_Layer g>text').attr('fill','rgb(0,153,255)');
      if (!SVG('#Point_Layer')) {
        SVG($('#svgContainer svg')[0]).svg('<g id="Point_Layer"></g>')
      } else {
        SVG('#Point_Layer').clear()
      }
      let coordinateExtent = $svg.attr('coordinateextent')
      let coordinateExtentArr = coordinateExtent.split(' ')
      that.svgMapBounds = coordinateExtentArr
      let sgbounds1 = webMercator2LngLat(coordinateExtentArr[0], coordinateExtentArr[3])
      let sgbounds2 = webMercator2LngLat(coordinateExtentArr[2], coordinateExtentArr[1])
      var bbox = [
        [sgbounds1.lon, sgbounds1.lat],
        [sgbounds2.lon, sgbounds2.lat]
      ]
      // mapTool.getSingleLineCor(bbox, getConvertCoor)
      getConvertCoor(bbox)
      //resetDivStyle(bbox);
      that.bbox = bbox
      that.initSVGRightEvent()

    }
  }
  async initStationSvg() {
    //dkxid这个用做stationid用
    let that = this
    this.svgReadMode = 3
    let screenWidth = $('#app').width()
    let screenHeight = $('#app').height()

    $('#svgContainer').width(screenWidth)
    $('#svgContainer').height(screenHeight)

    var svgWidth
    var svgHeight
    var svgContainerWidth = $('#svgContainer').width()
    var svgContainerHeight = $('#svgContainer').height()

    var initZoom = 1
    var draw = SVG().addTo('#svgContainer').size(svgContainerWidth, svgContainerHeight)
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwStationSvgByid', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stationid: that.dkxid
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      let svgstr = res.svgstr

      draw.svg(svgstr)

      draw.defs().clear()
      draw.defs().svg(fullDefs)

      //加虚拟边框
      $('symbol').each(function () {
        var symbol = SVG('#' + this.id)
        var width = this.getAttribute('width')
        var height = this.getAttribute('height')
        // this.viewBox.baseVal.width, this.viewBox.baseVal.height
        symbol
          .rect(width, height)
          .attr({
            stroke: 'yellow',
            'stroke-width': 0,
            fill: 'yellow',
            'fill-opacity': 0,
            'stroke-opacity': 0
          })
          .translate(width / 2, height / 2)
      })

      svgWidth = $('#svgContainer svg')[1].viewBox.baseVal.width
      svgHeight = $('#svgContainer svg')[1].viewBox.baseVal.height
      if (!SVG('#Point_Layer')) {
        SVG($('#svgContainer svg')[1]).svg('<g id="Point_Layer"></g>')
      }

      var xZoom = svgContainerWidth / svgWidth
      var yZoom = svgContainerHeight / svgHeight

      initZoom = xZoom > yZoom ? yZoom : xZoom

      draw.rect(svgWidth, svgHeight).attr({ fill: 'none', stroke: '#ab0000', 'stroke-width': 4 })

      that.panZoom = svgPanZoom($('#svgContainer svg')[0], {
        fit: false,
        center: false,
        minZoom: 0.05,
        onZoom: that.svgZoomEvt
      })

      $('#reset').on('click', function () {
        that.panZoom.resetZoom()
        that.panZoom.resetPan()

        that.panZoom.panBy({
          x: (svgContainerWidth * 0.8) / 2 - svgWidth / 2,
          y: (svgContainerHeight * 0.8) / 2 - svgHeight / 2
        })
        that.panZoom.zoom(initZoom)

        that.defaultSvgZoom = initZoom
      })
      $('#reset').click()

      //**************************
      //svg加载完操作
      //**************************
      that.svgColorOperate(1) //默认

      that.initSVGRightEvent()

      that.renderRunStatus() //加载运行状态
      // that.renderBreakerState() //先拉取开关状态,再拉取停电信息  拉取svg信息会报错，暂时注释20250126

    }
  }
  initSVGRightEvent() {
    let that = this

    if (that.svgReadMode != 3) {
      //正交图沿步图增加右键事件
      let allEventG = $(
        '#ACLineSegment_Layer g,#PowerTransformer_Layer g,#Substation_Layer g,#Breaker_Layer g,#PoleCode_Layer g,#LoadBreakSwitch_Layer g,#Fuse_Layer g,#Disconnector_Layer g,#RemoteUnit_Layer g,#EnergyConsumer_Layer g,#BusbarSection_Layer g'
      )

      // 变电站 和 母线 边框太细 加粗 便于点击
      let lar = setInterval(() => {
        if ($('#Substation_Layer g,#BusbarSection_Layer g')[0].getBBox().x) {
          $('#Substation_Layer g,#BusbarSection_Layer g').each(function () {
            let { width, height, x, y } = this.getBBox()
            var symbol = SVG(this)
            symbol.rect(width || 0.1, height || 0.1).attr({
              stroke: 'yellow',
              'stroke-width': 10,
              fill: 'none',
              'fill-opacity': 0,
              'stroke-opacity': 0,
              x,
              y
            })
            symbol.findOne('rect').addClass('svgRightClickEquip')
          })
          clearInterval(lar)
        }
      }, 1000)

      for (let i = 0; i < allEventG.length; i++) {
        let to_cadid = $(allEventG[i]).attr('id')
        let g = SVG('#' + to_cadid)
        // let targetObj = g.findOne('path') == null ? g.findOne('use') : g.findOne('path')
        let targetObj =
          g.findOne('path') || g.findOne('use') || g.findOne('polyline') || g.findOne('polygon')
        if (!targetObj) {
          targetObj = g.findOne('polyline')
        }
        if (g.findOne('polygon')) {
          targetObj = g.findOne('rect')
        }
        if (targetObj) {
          if (!targetObj.hasClass('svgRightClickEquip')) {
            targetObj.addClass('svgRightClickEquip')
          }
        }
      }
    }

    $(
      '#ACLineSegment_Layer g,#PowerTransformer_Layer g,#Substation_Layer g,#Breaker_Layer g,#PoleCode_Layer g,#LoadBreakSwitch_Layer g,#Fuse_Layer g,#Disconnector_Layer g,#RemoteUnit_Layer g,#EnergyConsumer_Layer g,#BusbarSection_Layer g'
    ).on('mousedown', function (e) {
      if (1 == e.which) {
        //左键事件 demo代码以后做设备选取用
        //============================先删除前边选中的样式============================
        if (that.currentLeftEquip) {
          let removeObj = SVG('#' + that.currentLeftEquip)
          let removeObjUse = removeObj.findOne('use')
          if (removeObjUse) {
            removeObjUse.removeClass('svg_select_eq')
          }
          let removeObjPath =
            removeObj.findOne('path') ||
            removeObj.findOne('polyline') ||
            removeObj.findOne('polygon')
          if (removeObjPath) {
            removeObjPath.removeClass('svg_select_line')
          }
        }

        //===============================================================================
        let obj = $(this)
        let to_cadid = obj.attr('id')
        let g = SVG('#' + to_cadid)
        let metaG = g.findOne('metadata')
        let sel_globeid = null
        let sel_psrtype = null

        for (let mgi = 0; mgi < metaG.node.children.length; mgi++) {
          let metaGChildren = metaG.node.children[mgi]
          if (metaGChildren.nodeName == 'cge:psr_ref') {
            sel_globeid = $(metaGChildren).attr('globeid')
            sel_psrtype = $(metaGChildren).attr('psrtype')
            break
          }
        }
        if (!sel_globeid) {
          ElMessage.warning({
            message: '选中设备无id',
            duration: 3000
          })
          return
        } else {
          that.readyOpenDeviceDetail(g, sel_globeid, to_cadid, sel_psrtype)
        }
      }

      //=======================================================================
      if (!that.svgsource && 3 == e.which && that.svgReadMode != 3) {
        //右键事件
        let obj = $(this)
        that.currentRightEquip = obj.attr('id')

        $('#rightClickDiv').css('left', e.clientX)
        $('#rightClickDiv').css('top', e.clientY)
        $('#rightClickDiv').show(300)
      }
    })
  }
  readyOpenDeviceDetail(g, sel_globeid, to_cadid, sel_psrtype) {
    let that = this
    that.currentLeftEquip = to_cadid
    let dialogParams = [sel_globeid, sel_psrtype, to_cadid]
    //设备的情况
    if (g) {
      let targetObj = g.findOne('use')
      if (targetObj) {
        if (!targetObj.hasClass('svg_select_eq')) {
          targetObj.addClass('svg_select_eq')
          $bus.emit(that, 'open-svgeq-dialog', dialogParams)
          return
        }
      }
    }

    //线路的情况
    if (g) {
      let targetObj = g.findOne('path') || g.findOne('polyline') || g.findOne('polygon')
      if (targetObj) {
        if (!targetObj.hasClass('svg_select_line')) {
          targetObj.addClass('svg_select_line')
          $bus.emit(that, 'open-svgeq-dialog', dialogParams)
        }
      }
    }
  }
  initLinkerLineLabelEventOuter(map) {
    let that = this
    let type = 'dxzj' //正交
    if (map) {
      type = 'dxdl' //地理
    }
    let aclineG = $('#Hot_Layer a')
    for (let i = 0; i < aclineG.length; i++) {
      let $alink = $(aclineG[i])
      let alinktext = $alink.children('text')
      let nname = ''
      for (let jj = 0; jj < alinktext.length; jj++) {
        let atext = $(alinktext[jj])
        nname += atext[0].innerHTML
      }
      $alink.on('click', (e) => {
        e.preventDefault()
        let ndkxid = $alink.attr('superlinkpsrid')
        if (ndkxid && ndkxid != that.dkxid) {
          if (type == 'dxdl') {
            let svgpage = router.resolve({
              name: 'explor_svgviewmap',
              query: {
                fullScreen: true,
                _szpsrid: that.szpsrid,
                // attid: that.attid,
                type: that.svgsource,
                id: ndkxid
              }
            })
            window.open(svgpage.href, '_blank')
          } else if (type == 'dxzj') {
            let svgpage = router.resolve({
              name: 'explor_svgview',
              query: {
                fullScreen: true,
                _szpsrid: that.szpsrid,
                // attid: that.attid,
                type: that.svgsource,
                id: ndkxid
              }
            })
            window.open(svgpage.href, '_blank')
          }
        } else {
          ElMessage.success({
            message: '无联络线路属性id',
            duration: 3000
          })
        }
      })
      //     superlinkpsrid
    }
  }
  initLinkerLineLabelEvent(map) {
    let that = this
    let type = 'dxzj' //正交
    if (map) {
      type = 'dxdl' //地理
    }
    let aclineG = $('#ACLineSegment_Layer g')
    for (let i = 0; i < aclineG.length; i++) {
      let to_cadid = $(aclineG[i]).attr('id')
      let g = SVG('#' + to_cadid)
      let metanode = g.findOne('metadata').node
      let metaNodeChildren = metanode.children
      for (let mi = 0; mi < metaNodeChildren.length; mi++) {
        let n = metaNodeChildren[mi]
        if (n.nodeName == 'cge:psr_ref') {
          let nname = n.getAttribute('objectname')
          if (
            nname &&
            (nname.startsWith('[联络') || nname.startsWith('至') || nname.startsWith('联络'))
          ) {
            let ndkxid = n.getAttribute('globeid')
            if (ndkxid != that.dkxid) {
              let txtG = SVG('#TXT-' + to_cadid)
              if (txtG) {
                //20240220增加判断
                txtG.find('text').addClass('txtLinkerClick')
                txtG.on('click', (e) => {
                  if (ndkxid && ndkxid != '') {
                    if (type == 'dxdl') {
                      let svgpage = router.resolve({
                        name: 'explor_svgviewmap',
                        query: {
                          fullScreen: true,
                          _szpsrid: that.szpsrid,
                          // attid: that.attid,
                          type: that.svgsource,
                          id: ndkxid
                        }
                      })
                      window.open(svgpage.href, '_blank')
                    } else if (type == 'dxzj') {
                      let svgpage = router.resolve({
                        name: 'explor_svgview',
                        query: {
                          fullScreen: true,
                          _szpsrid: that.szpsrid,
                          // attid: that.attid,
                          type: that.svgsource,
                          id: ndkxid
                        }
                      })
                      window.open(svgpage.href, '_blank')
                    }
                  } else {
                    ElMessage.success({
                      message: '无联络线路属性id',
                      duration: 3000
                    })
                  }
                })
              }
            }
          }
        }
      }
    }
  }
  svgZoomEvt(e) {
    if (this.svgReadMode == 2) {
      if (e >= 17) {
        if (this.defaultSvgTextShow != 1) {
          $("svg:eq(1) g[id='Text_Layer']").show()
          this.defaultSvgTextShow = 1
        }
      } else {
        if (this.defaultSvgTextShow != 0) {
          $("svg:eq(1) g[id='Text_Layer']").hide()
          this.defaultSvgTextShow = 0
        }
      }
    } else {
      if (e > 0) {
        if (e < 0.25) {
          if (this.defaultSvgTextShow != 0) {
            $("g [id='Text_Layer']").hide()
            this.defaultSvgTextShow = 0
          }
        } else {
          if (this.defaultSvgTextShow != 1) {
            $("g [id='Text_Layer']").show()
            this.defaultSvgTextShow = 1
          }
        }
      }
    }
  }
  async renderRunStatus() {
    let that = this

    let moveX = 8
    let moveY = 8
    let ttu_moveY = 12
    let fontSize = 38
    let ttu_fontSize = 28
    if (
      that.currentSuffixBuffer == 'KGBHDZ' ||
      that.currentSuffixBuffer == 'PROTECTI' ||
      that.currentSuffixBuffer == 'PROTECTII' ||
      that.currentSuffixBuffer == 'PROTECTIII' ||
      that.currentSuffixBuffer == 'PROTECTZ'
    ) {
      return
    }
    that.setRadioReadOnly(true)
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgRunStatus', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cadid: null,
        suffix: that.currentSuffixBuffer,
        dkxid: that.dkxid,
        drawid: that.drawid,
        svgid: that.svgid,
        svgReadMode: that.svgReadMode
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      that.setRadioReadOnly(false)
      let dataobj = res

      for (let dkey in dataobj) {
        let plist = dataobj[dkey]
        var g = SVG('#' + dkey)

        var gtext = SVG('#Point-' + dkey)
        let isclear = false
        let isttu = false
        if (gtext) {
          gtext.clear()
          isclear = true
        }
        if (that.currentSuffixBuffer == 'KGBHDZ') {
          break
        }
        if (g) {
          if (g.find('use').length == 0) {
            //展开的站室边框
            continue
          }
          //可能存在数据库数据与图纸数据不匹配20221114
          let children = $(g.find('use')[0].node)
          //动态计算位置大小
          let eq_use_x = parseFloat(children.attr('x'))
          let eq_use_y = parseFloat(children.attr('y'))
          let eq_use_width = children.attr('width')
          let eq_use_height = children.attr('height')
          //w h 兼容恒哥哥地理图
          if (!eq_use_width) {
            eq_use_width = children.attr('w')
          }
          if (!eq_use_height) {
            eq_use_height = children.attr('h')
          }

          let eq_length = eq_use_width > eq_use_height ? eq_use_width : eq_use_height
          let eq_transform = children.attr('transform')
          let eq_scale = 1
          for (let tidx in eq_transform.split(' ')) {
            let trStr = eq_transform.split(' ')[tidx]
            if (trStr.startsWith('scale')) {
              trStr = trStr.replace('scale(', '').replace(',', '')
              eq_scale = parseFloat(trStr)
              break
            }
          }
          eq_length = eq_length * eq_scale
          //20240220修改 要求页面测点都一样大
          if (that.tranPointFontSize) {
            fontSize = that.tranPointFontSize
          } else {
            fontSize = Math.round(eq_length * 0.55)
            if (fontSize < 1) {
              fontSize = 8
            }
            that.tranPointFontSize = fontSize
          }
          if (that.tranTTUPointFontSize) {
            ttu_fontSize = that.tranTTUPointFontSize
            if (ttu_fontSize < 1) {
              ttu_fontSize = 8
            }
          } else {
            ttu_fontSize = Math.round(eq_length * 0.4)
            that.tranTTUPointFontSize = ttu_fontSize
          }

          let svgTTUX = 0,
            svgTTUY = 0,
            svgX = 0,
            svgY = 0
          if (that.svgEditPointMap && that.svgEditPointMap['Point-' + dkey]) {
            let svgPointList = that.svgEditPointMap['Point-' + dkey]
            ttu_fontSize = svgPointList[0].fontsize
            svgTTUX = eq_use_x + parseFloat(svgPointList[0].x)
            svgTTUY = eq_use_y + parseFloat(svgPointList[0].y)
            fontSize = svgPointList[1].fontsize
            svgX = eq_use_x + parseFloat(svgPointList[1].x)
            svgY = eq_use_y + parseFloat(svgPointList[1].y)
          } else {
            moveX = eq_length * 0.4
            moveY = eq_length * 0.4
            ttu_moveY = eq_length * 0.45

            let eq_use_x_I = eq_use_x + moveX
            let eq_use_y_I = eq_use_y + moveY

            svgTTUX = eq_use_x_I
            svgTTUY = eq_use_y_I - ttu_moveY
            svgX = eq_use_x_I
            svgY = eq_use_y_I
          }

          let dva
          let runVa
          let textMetaSVG = []
          let pobj = plist[0]
          runVa = pobj.value
          let moreDetial = ''
          if (plist.length > 1) {
            moreDetial = '..更多(' + plist.length + ')'
          }
          dva = that.getFormatNum(runVa, that.currentSuffix) + moreDetial
          textMetaSVG.push('<metadata>')

          for (let pi = 0; pi < plist.length; pi++) {
            let dctime = plist[pi].time == null ? '-' : plist[pi].time
            if (plist[pi].ttutime) {
              let ttuvalue = plist[pi].ttuvalue == null ? '-' : plist[pi].ttuvalue
              if (runVa == '-') {
                dva = ttuvalue
              }
              textMetaSVG.push(
                '<pdes name="' +
                plist[pi].name +
                '" cap="' +
                parseInt(plist[pi].cap) +
                '" ' +
                ' dyyh="' +
                plist[pi].dyyh +
                '" ' +
                ' zyyh="' +
                plist[pi].zyyh +
                '" ' +
                ' meterid="' +
                plist[pi].meterid +
                '" tgid="' +
                plist[pi].tgid +
                '" time="' +
                dctime +
                '" value="' +
                plist[pi].value +
                '"' +
                ' ttutime = "' +
                plist[pi].ttutime +
                '" ttuvalue="' +
                ttuvalue +
                '"></pdes>'
              )
              isttu = true
            } else {
              textMetaSVG.push(
                '<pdes name="' +
                plist[pi].name +
                '" cap="' +
                parseInt(plist[pi].cap) +
                '" ' +
                ' dyyh="' +
                plist[pi].dyyh +
                '" ' +
                ' zyyh="' +
                plist[pi].zyyh +
                '" ' +
                ' meterid="' +
                plist[pi].meterid +
                '" tgid="' +
                plist[pi].tgid +
                '" time="' +
                dctime +
                '" value="' +
                plist[pi].value +
                '"></pdes>'
              )
            }
          }
          textMetaSVG.push('</metadata>')

          let textcolor = that.getTextColor(runVa, that.currentSuffix)
          let textSvgElementTTU =
            '<text x="' +
            svgTTUX +
            '" y="' +
            svgTTUY +
            '" font-size="' +
            ttu_fontSize +
            '" font-family="SimSun" fill="' +
            textcolor +
            '" ttu="ttu" self="self">◨</text>'
          let textSvgElement =
            '<text x="' +
            svgX +
            '" y="' +
            svgY +
            '" font-size="' +
            fontSize +
            '" font-family="SimSun" fill="' +
            textcolor +
            '" self="self">' +
            dva +
            '</text>'

          if (isclear == true) {
            //已经创建过标签
            if (isttu) {
              gtext.svg(textSvgElementTTU)
            }
            gtext.svg(textSvgElement)
            gtext.svg(textMetaSVG.join(' '))
          } else {
            let pointLayerG = SVG('#Point_Layer')

            if (isttu) {
              pointLayerG.svg(
                '<g id="Point-' +
                dkey +
                '" class="svgTextMore">' +
                textSvgElementTTU +
                textSvgElement +
                textMetaSVG.join(' ') +
                '</g>'
              )
            } else {
              pointLayerG.svg(
                '<g id="Point-' +
                dkey +
                '" class="svgTextMore">' +
                textSvgElement +
                textMetaSVG.join(' ') +
                '</g>'
              )
            }
          }
        }
      }
      that.svgBindEvent()
      that.setRadioReadOnly(false)

    }
  }

  setRadioReadOnly(t) {
    if (t) {
      let showpre = ''
      if (this.currentSuffixBuffer == 'FZL') {
        showpre = '[负载率]'
      } else if (this.currentSuffixBuffer == 'P') {
        showpre = '[功率]'
      } else if (this.currentSuffixBuffer == 'IA') {
        showpre = '[电流]'
      } else if (this.currentSuffixBuffer == 'UA') {
        showpre = '[电压]'
      } else if (this.currentSuffixBuffer == 'SXBPH') {
        showpre = '[三相不平衡]'
      }
      $('#loadingDivContentSpanName').html(showpre)
      $('#loadingDivContentSpanProgress').html('初始化')
      $('#loadingDiv').slideDown(350)
      $("#rightTopDiv input[type='radio']").attr('disabled', 'disabled')
    } else {
      $('#loadingDiv').slideUp(350)
      $("#rightTopDiv input[type='radio']").removeAttr('disabled')
      this.currentSuffix = this.currentSuffixBuffer
    }
  }
  svgBindEvent() {
    let that = this
    //样式方法不会自动解绑
    $('.svgTextMore').unbind('click')
    $('.svgTextMore').unbind('mouseover')
    $('.svgTextMore').unbind('mouseout')
    //重新打完数值数据绑定方法
    $('.svgTextMore').on('click', function (e) {
      let $obj = $(this)
      let g = SVG('#' + $obj.attr('id'))
      g.each(function (idx, children) {
        let stype = this.type
        if (stype == 'metadata') {
          let metadata = children[idx]
          let metaChildLength = metadata.node.children.length
          if (metaChildLength == 1) {
            metadata.each(function (midx, mchild) {
              let metaname = mchild[midx].attr('name')
              let metatgid = mchild[midx].attr('tgid')
              let metameterid = mchild[midx].attr('meterid')
              let isttu = -1
              if (mchild[midx].attr('ttutime')) {
                isttu = 1
              }

              // let page = router.resolve({
              //   name: 'tranDcTrend',
              //   query: {
              //     fullScreen: true,
              //     titlename: metaname,
              //     _szpsrid: that.szpsrid,
              //     meterId: metameterid
              //   }
              // })
              // window.open(page.href, '_blank')
              const query = {
                fullScreen: true,
                titlename: metaname,
                _szpsrid: that.szpsrid,
                meterId: metameterid
              }
              $bus.emit(that, 'svgDataClickDialog', { type: 'tranDcTrend', query })
            })
          } else {
            let multiMetaHtml = []
            multiMetaHtml.push(
              '<div><span>选择查看配变运行曲线：</span><a class="multiTrendCloseA" style="cursor:pointer">[关闭]</a></div>'
            )
            metadata.each(function (midx, mchild) {
              let metaname = mchild[midx].attr('name')
              let metatgid = mchild[midx].attr('tgid')
              let metameterid = mchild[midx].attr('meterid')
              let isttu = -1
              if (mchild[midx].attr('ttutime')) {
                isttu = 1
              }
              multiMetaHtml.push(
                `<div><span style="padding-left: 8px"><a class="multiTrendA" style="cursor:pointer" metaname="${metaname}" meterid="${metameterid}">${metaname}</a></span></div>`
              )
            })
            $('#multiTrendDiv').html(multiMetaHtml.join(' '))
            $('#multiTrendDiv').css('left', e.clientX)
            $('#multiTrendDiv').css('top', e.clientY)
            $('#multiTrendDiv').show(300)
            $('.multiTrendA').off('click')
            $('.multiTrendA').on('click', function () {
              let metaname = $(this).attr('metaname')
              let metameterid = $(this).attr('meterid')
              // let page = router.resolve({
              //   name: 'tranDcTrend',
              //   query: {
              //     fullScreen: true,
              //     titlename: metaname,
              //     _szpsrid: that.szpsrid,
              //     meterId: metameterid
              //   }
              // })
              // window.open(page.href, '_blank')
              const query = {
                fullScreen: true,
                titlename: metaname,
                _szpsrid: that.szpsrid,
                meterId: metameterid
              }
              $bus.emit(that, 'svgDataClickDialog', { type: 'tranDcTrend', query })
            })
            $('.multiTrendCloseA').off('click')
            $('.multiTrendCloseA').on('click', function () {
              $('#multiTrendDiv').hide()
            })
          }
        }
      })
    })
    $('.svgTextMore').on('mouseover', function (e) {
      let scX = e.pageX + 10
      let scY = e.pageY + 10
      let $obj = $(this)
      let g = SVG('#' + $obj.attr('id'))
      let showpre = ''
      let txtcolor = '#02ff02'
      if (that.currentSuffix == 'FZL') {
        showpre = '负载率:'
      } else if (that.currentSuffix == 'P') {
        showpre = '功率:'
      } else if (that.currentSuffix == 'IA') {
        showpre = '电流:'
      } else if (that.currentSuffix == 'UA') {
        showpre = '电压:'
      } else if (that.currentSuffix == 'SXBPH') {
        showpre = '三相不平衡:'
      }
      g.each(function (idx, children) {
        let stype = this.type
        if (stype == 'metadata') {
          let metadata = children[idx]
          let pdata = []

          metadata.each(function (midx, mchild) {
            let txtInfo = mchild[midx].attr('value')
            txtcolor = that.getTextColor(mchild[midx].attr('value'))
            txtInfo = that.getFormatNum(txtInfo, that.currentSuffix)
            pdata.push('<div>')
            pdata.push(
              "<span style='margin-left: 2px;color: white'>" + mchild[midx].attr('name') + '</span>'
            )
            pdata.push(
              "<span style='margin-left: 10px;color:cornflowerblue'>" +
              mchild[midx].attr('time') +
              '</span>'
            )
            pdata.push(
              "<span style='margin-left: 15px;color:" +
              txtcolor +
              "'>" +
              showpre +
              txtInfo +
              '</span>'
            )
            pdata.push('</div>')
            if (mchild[midx].attr('ttutime')) {
              let ttutxtInfo = that.getFormatNum(mchild[midx].attr('ttuvalue'), that.currentSuffix)
              let ttutxtcolor = that.getTextColor(mchild[midx].attr('ttuvalue'))
              pdata.push('<div>')
              pdata.push("<span style='margin-left: 2px;color: " + ttutxtcolor + "'>TTU测点</span>")
              pdata.push(
                "<span style='margin-left: 10px;color:cornflowerblue'>" +
                mchild[midx].attr('ttutime') +
                '</span>'
              )
              pdata.push(
                "<span style='margin-left: 15px;color:" +
                ttutxtcolor +
                "'>" +
                showpre +
                ttutxtInfo +
                '</span>'
              )
              pdata.push('</div>')
            }
            pdata.push('<div>')
            pdata.push(
              "<span style='margin-left: 2px;color: white'>容量:" +
              mchild[midx].attr('cap') +
              '</span>'
            )
            pdata.push(
              "<span style='margin-left: 10px;color:white'>低压用户:" +
              mchild[midx].attr('dyyh') +
              '</span>'
            )
            // pdata.push("<span style='margin-left: 15px;color:white'>高压用户:"+mchild[midx].attr('zyyh')+"</span>");
            pdata.push('</div>')
          })
          $('#meterDiv').html(pdata.join(' '))
          $('#meterDiv').attr('style', 'position:absolute;top:' + scY + 'px;left:' + scX + 'px;')
          $('#meterDiv').show()
        }
      })
    })
    $('.svgTextMore').on('mouseout', function (e) {
      // let $obj = $(this);
      // console.log("i am out:"+$obj.attr("id"));
      $('#meterDiv').hide()
    })
  }
  async renderOuterLineInfo(flag, type) {
    let that = this
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgOuterLineRunInfo', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dkxid: that.dkxid, svgid: that.svgid, flag: flag, type: type
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      let dobj = res
      let di = dobj.i == null ? '-' : dobj.i
      let dp = dobj.p == null ? '-' : dobj.p
      let dt = dobj.t == null ? '-' : dobj.t
      let dfzl = dobj.fzl == null ? '-' : dobj.fzl
      let fzlcolor = that.getTextColor(dfzl, 'FZL')
      that.dkxName = dobj.dkxn
      let dkxinfoRowspan = 9
      if (dobj.casefile) {
        dkxinfoRowspan = 10
      }
      let tabHtml = []
      tabHtml.push('<tr class="tableRowTitle">')
      tabHtml.push("<td colspan='2'>基本信息</td>")
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>线路名称</td>')
      tabHtml.push('<td><span>' + dobj.dkxn + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<td>图纸更新时间</td>')
      tabHtml.push('<td><span>' + dobj.lasttime + '</span></td>')
      tabHtml.push('</tr>')
      if (dobj.casefile) {
        tabHtml.push('<tr>')
        tabHtml.push('<td>事故预案</td>')
        tabHtml.push(
          "<td><a style='cursor:pointer' dkxid='" +
          that.dkxid +
          "' filename='" +
          dobj.casefile +
          "' id='casefile_a' >" +
          dobj.casefile +
          '</a></td>'
        )
        tabHtml.push('</tr>')
      }
      tabHtml.push('<tr>')
      tabHtml.push('<td>变电站名称</td>')
      tabHtml.push('<td><span>' + dobj.bdzn + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>所属地市</td>')
      tabHtml.push('<td><span>' + dobj.ywdw + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>运维单位</td>')
      tabHtml.push('<td><span>' + dobj.whbz + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>测点时间</td>')
      tabHtml.push('<td><span>' + dt + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push(`<td>线路负载率
      <i id="icon-tip" class="el-icon-warning"></i>
      </td>`)
      tabHtml.push(
        "<td><span id='lineFzlSpan' style='cursor:pointer;color: " +
        fzlcolor +
        "'>" +
        that.getFormatNum(dfzl, 'FZL') +
        '</span></td>'
      )
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>线路电流</td>')
      tabHtml.push('<td><span>' + that.getFormatNum(di, 'IA') + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>线路功率</td>')
      tabHtml.push('<td><span>' + that.getFormatNum(dp, 'LP') + '</span></td>')
      tabHtml.push('</tr>')
      // tabHtml.push('<tr>')
      // tabHtml.push('<td>出线开关名称</td>')
      // tabHtml.push('<td><span>' + dobj.breaker + '</span></td>')
      // tabHtml.push('</tr>')

      tabHtml.push('<tr class="tableRowTitle">')
      tabHtml.push("<td colspan='2'>规模信息</td>")
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      // tabHtml.push("<td rowspan='17'><p>规模信息</p></td>")
      tabHtml.push('<td>线路总长度(km)</td>' + '<td><span>' + dobj.zcd + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>架空长度(km)</td>' + '<td><span>' + dobj.jkcd + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>电缆长度(km)</td>' + '<td><span>' + dobj.dlcd + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>配变总数</td>' + '<td><span>' + dobj.pbNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>公变数量</td>' + '<td><span>' + dobj.pbGbNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>公变容量(kVA)</td>' + '<td><span>' + dobj.pbGbrl + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>专变数量</td>' + '<td><span>' + dobj.pbZbNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>专变容量(kVA)</td>' + '<td><span>' + dobj.pbZbrl + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>运行杆塔总数</td>' + '<td><span>' + dobj.gtNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>开关站数量</td>' + '<td><span>' + dobj.kgzNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>环网柜数量</td>' + '<td><span>' + dobj.hwgNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>分支箱数量</td>' + '<td><span>' + dobj.fzxNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>配电室数量</td>' + '<td><span>' + dobj.pdsNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>箱变数量</td>' + '<td><span>' + dobj.xbNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>联络开关数量</td>' + '<td><span>' + dobj.llkgNum + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>分段开关数量</td>' + '<td><span>' + dobj.fdkgNum + '</span></td>')
      tabHtml.push('</tr>')

      $('#svgLineInfoTab').html(tabHtml.join(' '))

      $('#lineInfoDiv').slideToggle(300)
      $('#lineDeviceSwitchDiv').show()
      $('#lineDeviceSwitchDiv').css('left', '340px')
      $('#exportImg').show()
      setTimeout(function () {
        if ($('#lineDeviceSwitchI').hasClass('el-icon-d-arrow-left')) {
          $('#lineDeviceSwitchDiv').click()
        }
      }, 5000)
      $bus.emit(that, 'initPrintInfo', { dobj })
      $('#icon-tip').on('mouseover', function (e) {
        $bus.emit(that, 'show-legend-tip-showHide', { e, visible: true })
      })
      $('#icon-tip').on('mouseout', function (e) {
        $bus.emit(that, 'show-legend-tip-showHide', { e, visible: false })
      })
      $('#lineFzlSpan').on('click', (e) => {
        let that = this
        let page = router.resolve({
          name: `lineTrend`,
          query: {
            fullScreen: 'true',
            _szpsrid: that.szpsrid,
            titlename: dobj.dkxn,
            dkxid: that.dkxid
          }
        })
        window.open(page.href, '_blank')
      })

    }
  }
  async renderLineInfo() {
    let that = this
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgLineRunInfo', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dkxid: that.dkxid
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      let dobj = res
      let di = that.getFormatNum(dobj.i, '')
      let dp = that.getFormatNum(dobj.p, '')
      let dt = dobj.t == null ? '-' : dobj.t
      let dfzl = dobj.fzl == null ? '-' : dobj.fzl
      let fzlcolor = that.getTextColor(dfzl, 'FZL')
      let showfzl = that.getFormatNum(dfzl, 'FZL')
      that.dkxName = dobj.dkxn
      let dkxinfoRowspan = 9
      if (dobj.casefile) {
        dkxinfoRowspan = 10
      }
      let tabHtml = []
      tabHtml.push('<tr class="tableRowTitle">')
      tabHtml.push("<td colspan='2'>基本信息</td>")
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>线路名称</td>')
      tabHtml.push('<td><span>' + dobj.dkxn + '</span></td>')
      tabHtml.push('</tr>')
      if (dobj.casefile) {
        tabHtml.push('<tr>')
        tabHtml.push('<td>事故预案</td>')
        tabHtml.push(
          "<td><a style='cursor:pointer' dkxid='" +
          that.dkxid +
          "' filename='" +
          dobj.casefile +
          "' id='casefile_a' >" +
          dobj.casefile +
          '</a></td>'
        )
        tabHtml.push('</tr>')
      }
      tabHtml.push('<tr>')
      tabHtml.push('<td>变电站名称</td>')
      tabHtml.push('<td><span>' + dobj.bdzn + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>运维单位</td>')
      tabHtml.push('<td><span>' + dobj.ywdw + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>维护班组</td>')
      tabHtml.push('<td><span>' + dobj.whbz + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>测点时间</td>')
      tabHtml.push('<td><span>' + dt + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push(`<td>线路负载率
        <i id="icon-tip" class="el-icon-warning"></i>
        </td>`)
      tabHtml.push("<td><span style='color: " + fzlcolor + "'>" + showfzl + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>线路电流</td>')
      tabHtml.push('<td><span>' + di + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>线路功率</td>')
      tabHtml.push('<td><span>' + dp + '</span></td>')
      tabHtml.push('</tr>')
      tabHtml.push('<tr>')
      tabHtml.push('<td>出线开关名称</td>')
      tabHtml.push('<td><span>' + dobj.breaker + '</span></td>')
      tabHtml.push('</tr>')
      // tabHtml.push("<tr>");
      // tabHtml.push("<td>出线开关状态</td>");
      // tabHtml.push("<td>"+dobj.ss+"</td>");
      // tabHtml.push("</tr>");
      // $('#svgLineInfoTab').html(tabHtml.join(" "));
      const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgDeviceCount', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          drawid: that.drawid, dkxid: that.dkxid
        })
      })
      const { code, data: res } = await r.json()
      if (code === 200 && res) {
        let dobj2 = res2
        let tabHtml2 = []
        let source = dobj2.source
        if (source && source == 'table') {
          tabHtml2.push('<tr class="tableRowTitle">')
          tabHtml2.push("<td colspan='2'>规模信息</td>")
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          // tabHtml.push("<td rowspan='17'><p>规模信息</p></td>")
          tabHtml2.push('<td>线路总长度(km)</td>' + '<td><span>' + dobj2.zcd + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>架空长度(km)</td>' + '<td><span>' + dobj2.jkcd + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>电缆长度(km)</td>' + '<td><span>' + dobj2.dlcd + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>配变总数</td>' + '<td><span>' + dobj2.pbNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>配变总容量</td>' + '<td><span>' + dobj2.pbZrl + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>公变数量</td>' + '<td><span>' + dobj2.pbGbNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>公变容量(kVA)</td>' + '<td><span>' + dobj2.pbGbrl + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>专变数量</td>' + '<td><span>' + dobj2.pbZbNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>专变容量(kVA)</td>' + '<td><span>' + dobj2.pbZbrl + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>运行杆塔总数</td>' + '<td><span>' + dobj2.gtNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>开关站数量</td>' + '<td><span>' + dobj2.kgzNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>环网柜数量</td>' + '<td><span>' + dobj2.hwgNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>分支箱数量</td>' + '<td><span>' + dobj2.fzxNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>配电室数量</td>' + '<td><span>' + dobj2.pdsNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>箱变数量</td>' + '<td><span>' + dobj2.xbNum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>联络开关数量</td>' + '<td><span>' + dobj2.llkgNum + '</span></td>')
          tabHtml2.push('</tr>')
        } else {
          tabHtml2.push('<tr class="tableRowTitle">')
          tabHtml2.push("<td colspan='2'>规模信息</td>")
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          // tabHtml.push("<td rowspan='16'><p>规模信息</p></td>")
          tabHtml2.push('<td>线路总长度</td>' + '<td><span>' + dobj.totall + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>架空长度</td>' + '<td><span>' + dobj.jkl + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>电缆长度</td>' + '<td><span>' + dobj.dll + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>配变</td>' + '<td><span>' + dobj2.pbnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>公变</td>' + '<td><span>' + dobj2.gbnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>公变容量</td>' + '<td><span>' + dobj2.gbrl + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>专变</td>' + '<td><span>' + dobj2.zbnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>专变容量</td>' + '<td><span>' + dobj2.zbrl + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>开闭所</td>' + '<td><span>' + dobj2.kbsnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>分段开关</td>' + '<td><span>' + dobj2.fdkgnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>联络开关</td>' + '<td><span>' + dobj2.llkg + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>箱变</td>' + '<td><span>' + dobj2.xbnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>配电室</td>' + '<td><span>' + dobj2.pdsnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>环网柜</td>' + '<td><span>' + dobj2.hwgnum + '</span></td>')
          tabHtml2.push('</tr>')
          tabHtml2.push('<tr>')
          tabHtml2.push('<td>分接箱</td>' + '<td><span>' + dobj2.fjxnum + '</span></td>')
          tabHtml2.push('</tr>')
        }
        $('#svgLineInfoTab').html(tabHtml.join(' ') + ' ' + tabHtml2.join(' '))

        $('#svgLineDeviceTab').html(tabHtml2.join(' '))
        $('#lineInfoDiv').slideToggle(300)
        $('#lineDeviceSwitchDiv').show()
        $('#lineDeviceSwitchDiv').css('left', '340px')
        setTimeout(function () {
          if ($('#lineDeviceSwitchI').hasClass('el-icon-d-arrow-left')) {
            $('#lineDeviceSwitchDiv').click()
          }
        }, 5000)

        $('#casefile_a').on('click', function () {
          let fname = $(this).attr('filename')
          let dkxid = $(this).attr('dkxid')
          // .openOnecaseFile(dkxid, fname).then((res) => {
          //   let pdfUrl = window.URL.createObjectURL(
          //     new Blob([res], { type: 'application/pdf;charset=utf-8' })
          //   )
          //   window.open(pdfUrl)
          // })
        })
        $('#icon-tip').on('mouseover', function (e) {
          $bus.emit(that, 'show-legend-tip-showHide', { e, visible: true })
        })
        $('#icon-tip').on('mouseout', function (e) {
          $bus.emit(that, 'show-legend-tip-showHide', { e, visible: false })
        })

      }

    }
  }
  renderFaultMsg() {
    let that = this
    // .getSzdwSvgFualtMsgInfo({ dkxid: that.dkxid }).then((res) => {
    //   let dobj = res
    //   if (dobj) {
    //     for (let i = 0; i < dobj.length; i++) {
    //       let faultMsgContent = dobj[i].content
    //       let faultMsgTime = dobj[i].msgtime
    //       if (faultMsgContent.startsWith('20')) {
    //         $('#faultMsgContentDiv').html('<span>' + faultMsgContent + '</span>')
    //       } else {
    //         $('#faultMsgContentDiv').html('<span>' + faultMsgTime + faultMsgContent + '</span>')
    //       }
    //     }
    //     if (dobj.length > 0) {
    //       $('#faultMsgDiv').show()
    //       let faultmsgTimer
    //       $('#faultMsgContentDiv').show(500, function () {
    //         setTimeout(function () {
    //           $('#faultMsgContentDiv').hide(500)
    //         }, 1000 * 10)
    //       })
    //       $('#faultMsgBell').on('click', function () {
    //         let cstate = $('#faultMsgContentDiv').is(':visible')
    //         if (cstate) {
    //           if (faultmsgTimer) {
    //             clearInterval(faultmsgTimer)
    //           }
    //           $('#faultMsgContentDiv').hide(500)
    //         } else {
    //           $('#faultMsgContentDiv').show(500)
    //         }
    //       })
    //     }
    //   }
    // })
  }
  async renderPowerDownTran() {
    //获取线路停电配变并标出
    let that = this
    that.currentPowerDownPDHandle = []

    if (this.dkxid) {
      //暂时停电页面才显示执行，看后续需求
      const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgPowcutTran', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dkxid: that.dkxid,
          svgid: that.svgid,
          starttime: that.starttime,
          endtime: that.endtime
        })
      })
      const { code, data: res } = await r.json()
      if (code === 200 && res) {
        let dataobj = res
        let valihandle = 0
        $.each(dataobj, function (dn, dv) {
          if ((dv.sbzlx && dv.handle) || dv.gid) {
            let do_sbzlx = dv.sbzlx
            let do_handle = dv.handle
            let do_tgid = dv.tgid
            let do_gid = dv.gid
            let do_meterid = dv.meter_id
            let tdtype = dv.tdtype
            let tddes = '-'
            if (tdtype == 3) {
              tddes = '电采+融合终端'
            } else if (tdtype == 2) {
              tddes = '融合终端'
            } else if (tdtype == 1) {
              tddes = '电采'
            }

            let do_cadid = 'PD_' + do_sbzlx + '_' + do_handle
            if (do_gid) {
              do_cadid = do_gid
            }
            that.currentPowerDownPDHandle.push(do_cadid)
            let g = SVG('#' + do_cadid)
            if (g) {
              //可能存在数据库数据与图纸数据不匹配20221114
              g.each(function (idx, children) {
                let stype = this.type
                if (stype == 'use') {
                  //处理样式
                  children[0].addClass('svgtdpb')
                  //添加事件
                  children[0].off('click')
                  children[0].off('mouseover')
                  children[0].off('mouseout')
                  // children[0].on('click', function () {
                  //   window.open(
                  //     ctx +
                  //       '/drawings/tdlist' +
                  //       '/tdpb?meterid=' +
                  //       do_meterid +
                  //       '&tgid=' +
                  //       do_tgid,
                  //     do_tgid + do_meterid
                  //   )
                  // })
                  children[0].on('mouseover', function (e) {
                    let scX = e.pageX + 10
                    let scY = e.pageY + 10
                    let pdata = []
                    pdata.push('<div>')
                    pdata.push(
                      "<span style='margin-left: 2px;color: white'>" + dv.bdz + '</span>'
                    )
                    pdata.push(
                      "<span style='margin-left: 10px;color: white'>" + dv.dkxname + '</span>'
                    )
                    pdata.push('</div>')

                    pdata.push('<div>')
                    pdata.push(
                      "<span style='margin-left: 2px;color: white'>" + dv.pbname + '</span>'
                    )
                    pdata.push(
                      "<span style='margin-left: 10px;color: white'>" + dv.pbtype + '</span>'
                    )
                    pdata.push('</div>')

                    pdata.push('<div>')
                    pdata.push(
                      "<span style='margin-left: 2px;color:cornflowerblue'>停电时间：</span>"
                    )
                    pdata.push(
                      "<span style='margin-left: 10px;color:cornflowerblue'>" +
                      dv.tdsj2 +
                      '</span>'
                    )
                    pdata.push('</div>')

                    pdata.push('<div>')
                    pdata.push("<span style='margin-left: 2px;color:#04c497'>信号来源：</span>")
                    pdata.push(
                      "<span style='margin-left: 10px;color:#04c497'>" + tddes + '</span>'
                    )
                    pdata.push('</div>')

                    pdata.push('<div>')
                    pdata.push("<span style='margin-left: 2px;color:#fdb343'>停电类型：</span>")
                    pdata.push(
                      "<span style='margin-left: 10px;color:#fdb343'>" +
                      dv.faultinfo +
                      '</span>'
                    )
                    pdata.push('</div>')

                    $('#meterDiv').html(pdata.join(' '))
                    $('#meterDiv').attr(
                      'style',
                      'position:absolute;top:' + scY + 'px;left:' + scX + 'px;'
                    )
                    $('#meterDiv').show()
                  })
                  children[0].on('mouseout', function (e) {
                    $('#meterDiv').hide()
                  })
                }
              })
              valihandle++
            }
          }
        })
        const r2 = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgPowcutAnalysisRealtime', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + this.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dkxid: that.dkxid,
            svgid: that.svgid,
            starttime: that.starttime,
            endtime: that.endtime,
            svgmode: that.svgReadMode,
            drawid: that.drawid
          })
        })
        const { code, data: res2 } = await r2.json()
        if (code === 200 && res2) {
          that.powerDownTopoResult = res2
          that.initPowerCutTransInfo()
          if (valihandle > 1) {
            that.topoDivShow = true
            $('#topoDiv').show()
          } else {
            $('#topoDiv').hide()
          }
          that.theme1Cut = that.powerDownTopoResult.theme1
          $bus.emit(that, 'initSvgSearchIdInfo', that.powerDownTopoResult.psridgid)
          $('#themeCalcDiv').show()

        }

      }
    }
  }
  initPowerCutTransInfo() {
    let that = this
    let result = this.powerDownTopoResult
    // if(result.city)
    // {
    //     $('#tdcitys').html(result.city);
    // }
    // if(result.county)
    // {
    //     $('#tdcountys').html(result.county);
    // }
    let gh_id_map = result.ghidmap
    if (result.map) {
      let tdpb_html = ''
      let tdcount = 0
      $.each(result.map, function (vi, vn) {
        if (tdcount == 0) {
          if (vn.dkxname) {
            $('#tdlines').html(vn.dkxname)
          }
        }
        if (vn.handle || vn.gid) {
          let td_gid = ''
          if (vn.handle) {
            td_gid = 'PD_' + vn.sbzlx + '_' + vn.handle
          }
          if (vn.gid) {
            td_gid = vn.gid
          }
          tdpb_html +=
            "<tr><td gid='" +
            td_gid +
            "'><a>[" +
            vn.stime +
            ']' +
            vn.pbname +
            '-' +
            vn.pbtype +
            '</a><td></tr>'
        } else {
          tdpb_html +=
            "<tr><td><span style='color: rgb(222,236,3)'>[" +
            vn.stime +
            ']' +
            vn.pbname +
            '-' +
            vn.pbtype +
            '</span></td></tr>'
        }
        tdcount++
      })
      if (tdpb_html != '') {
        $('#tdnums').html('停电配变(' + tdcount + ')')
        $('#powercutTransTable').html(tdpb_html)
        $('#powercutTransDiv').slideToggle(500)
        $('#powercutTransTable td').on('click', function () {
          let gid = $(this).attr('gid')

          if (gid && gid != 'null') {
            that.locatEquipOnSvg(gid)
          } else {
            ElMessage.warning({
              message: '未绑定数据',
              duration: 3000
            })
          }
        })
      }
    }
  }
  addSvgTopo() {
    let that = this

    if (that.powerDownTopoResult) {
      that.currentPowerDownTopoHandel = that.powerDownTopoResult.list
      for (let tti = 0; tti < that.currentPowerDownTopoHandel.length; tti++) {
        let to_cadid = that.currentPowerDownTopoHandel[tti]
        let g = SVG('#' + to_cadid)
        g.each(function (idx, children) {
          let stype = this.type
          if (stype == 'use') {
            if (!children[0].hasClass('svgtdpb')) {
              children[0].addClass('svgtdpb')
            }
          } else if (stype == 'polyline' || stype == 'path') {
            if (!children[0].hasClass('svgtdline')) {
              children[0].addClass('svgtdline')
            }
          }
        })
      }
    }
  }
  removeSvgTopo() {
    let that = this
    for (let tti = 0; tti < that.currentPowerDownTopoHandel.length; tti++) {
      let to_cadid = that.currentPowerDownTopoHandel[tti]
      let g = SVG('#' + to_cadid)
      g.each(function (idx, children) {
        let stype = this.type
        if (stype == 'use') {
          if (children[0].hasClass('svgtdpb')) {
            children[0].removeClass('svgtdpb')
          }
        } else if (stype == 'polyline' || stype == 'path') {
          if (children[0].hasClass('svgtdline')) {
            children[0].removeClass('svgtdline')
          }
        }
      })
    }
    for (let tti = 0; tti < that.currentPowerDownPDHandle.length; tti++) {
      let to_cadid = that.currentPowerDownPDHandle[tti]
      let g = SVG('#' + to_cadid)
      if (!g) {
        continue
      }
      g.each(function (idx, children) {
        let stype = this.type
        if (stype == 'use') {
          if (!children[0].hasClass('svgtdpb')) {
            children[0].addClass('svgtdpb')
          }
        } else if (stype == 'polyline' || stype == 'path') {
          if (!children[0].hasClass('svgtdline')) {
            children[0].addClass('svgtdline')
          }
        }
      })
    }
  }
  getTextColor(runVa, suffix) {
    if (suffix == 'FZL') {
      let absnum = Math.abs(runVa)
      if (absnum) {
        if (absnum < 20) {
          return this.fzlcolor[0]
        } else if (absnum >= 20 && absnum < 60) {
          return this.fzlcolor[1]
        } else if (absnum >= 60 && absnum < 80) {
          return this.fzlcolor[2]
        } else if (absnum >= 80 && absnum < 100) {
          return this.fzlcolor[3]
        } else if (absnum >= 100) {
          return this.fzlcolor[4]
        }
      } else {
        return 'rgb(230,0,255)'
      }
    } else {
      if (runVa && runVa < 0) {
        return 'rgb(0,230,255)'
      } else {
        return 'rgb(0,190,0)'
      }
    }
  }
  getFormatNum(runVa, suffix) {
    let reverseMarker = ''
    let unit = ''
    if (runVa && toNumber(runVa)) {
      switch (suffix) {
        case 'UA':
          unit = 'V'
          break
        case 'IA':
          unit = 'A'
          break
        case 'P':
          unit = 'kW'
          break
        case 'LP':
          unit = 'MW'
          break
        default:
          unit = ''
      }
    }

    if (runVa && runVa < 0) {
      // reverseMarker = '[反向]';
      reverseMarker = ''
    }
    if (runVa && toNumber(runVa)) {
      runVa = toNumber(runVa).toFixed(2)
    }
    if (suffix == 'FZL') {
      let absnum = Math.abs(runVa)
      if (absnum) {
        let rnum = Number(runVa)
        rnum = rnum.toFixed(2)
        return rnum + '%' + reverseMarker
      }
    } else if (suffix == 'UA') {
      if (runVa) {
        if (runVa < 198) {
          return runVa + unit + ' [低电压]' + reverseMarker
        }
      }
    } else if (suffix == 'SXBPH') {
      if (toNumber(runVa)) {
        let absnum = Math.abs(runVa)
        if (absnum) {
          // let rnum = runVa * 100
          // let rnum = runVa
          // rnum = rnum.toFixed(2)
          return absnum + '%'
        }
      } else {
        runVa = '-'
      }
    }
    return runVa + unit + reverseMarker
  }
  async renderBreakerState() {
    let that = this
    this.effect_transform = []
    this.effect_error = []
    this.nchf_breaker = []

    //20250722暂时改到这，开关拉取慢影响这里展示，改到这里可能会影响保护信息展示
    if (that.svgReadMode != 3) {
      //站室图暂时不拉停电信息
      that.renderPowerDownTran() //拉取停电信息,样式覆盖
    }
    const r = await fetch('http://25.213.110.169:18055/tmzx/admin-api/tmzx/szdwsvg/preview/getSzdwSvgInitBreakerData', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dkxpmsid: that.dkxid,
        svgid: that.svgid,
        drawingId: that.drawid,
        svgReadMode: that.svgReadMode
      })
    })
    const { code, data: res } = await r.json()
    if (code === 200 && res) {
      let dobj = res
      // let nor = dobj.nor;正常设备,不处理

      that.nchf_breaker = dobj.needChangeHref

      // 这个接口里返回了测点和配自开关  -  过滤出测点
      let obj = {}
      for (let [key, value] of Object.entries(res.breakerPoint)) {
        if ('psrid' in value) {
          obj[key] = value
        }
      }
      that.breaker_point = { ...obj }

      // 显示配自开关
      that.addPzIcon({ ...res.breakerPoint })

      // that.breaker_point = dobj.breakerPoint
      that.breaker_protect = dobj.breakerProtect

      //转供后台毙掉了，后台传dobj.tra 拓扑着色才生效
      if (that.svgReadMode != 3 && dobj.tra) {
        let tra = dobj.tra //专供设备 紫色
        let err = dobj.err //停电设备 绿色

        //转供设备
        for (let i = 0; i < tra.length; i++) {
          that.effect_transform.push(tra[i])
          let effect_g = SVG('#' + tra[i])
          effect_g.each(function (idx, children) {
            let stype = this.type
            if (stype == 'use') {
              if (!children[0].hasClass('svg_powertransform_eq')) {
                children[0].addClass('svg_powertransform_eq')
              }
            } else if (stype == 'polyline' || stype == 'path') {
              if (!children[0].hasClass('svg_powertransform_line')) {
                children[0].addClass('svg_powertransform_line')
              }
            }
          })
        }

        //停电设备
        for (let i = 0; i < err.length; i++) {
          that.effect_error.push(err[i])
          let effect_g = SVG('#' + err[i])
          effect_g.each(function (idx, children) {
            let stype = this.type
            if (stype == 'use') {
              if (!children[0].hasClass('svg_powercut_eq')) {
                children[0].addClass('svg_powercut_eq')
              }
            } else if (stype == 'polyline' || stype == 'path') {
              if (!children[0].hasClass('svg_powercut_line')) {
                children[0].addClass('svg_powercut_line')
              }
            }
          })
        }
      }

      that.renderBreakerPointInfo()
      that.changeSvgBreakerStatus()
      $('#hidPointDiv').show()
      $bus.emit(that, 'initProtectInfo', false)
    }
  }

  // 添加配自开关标识
  addPzIcon(bz_obj) {
    let that = this
    // 先清除之前的旧数据
    if (!SVG('#Temp_Layer')) {
      //新乡没有这个东西，会报错阻止js执行
      return
    }
    SVG('#Temp_Layer').clear()
    // 更新数据
    for (let [key, value] of Object.entries(bz_obj)) {
      // 获取symbol的放大倍数
      let useDom = $('#' + key + ' use')
      let useTransform = useDom.attr('transform').split(' ')
      let scaleStr = useTransform.filter((item) => {
        return item.includes('scale')
      })[0]
      let scale = Math.abs(scaleStr.split('(')[1].split(')')[0].split(',')[0])

      // 通过放大拿到真实的polygon宽高（为了兼容不规则的g标签）
      let symbolId = useDom.attr('xlink:href').slice(1)
      let symbol = document.getElementById(symbolId)
      // 其他开关图形没有polygon就默认一个
      let width = 1.3 // 默认宽
      let height = 0.63 // 默认高
      if ($(symbol).find('polygon').length) {
        let pol_obj = $(symbol).find('polygon')[0].getBBox()
        width = pol_obj.width
        height = pol_obj.height
      }
      width = width * scale
      height = height * scale

      // 获取g标签的真实坐标（为了兼容不规则的g标签）
      let x_list = []
      let y_list = []
      let position_left = {}
      let position_right = {}
      let contentDom = ''
      $('#' + key + ' polyline').each(function () {
        $(this)
          .attr('points')
          .split(' ')
          .forEach((item) => {
            x_list.push(item.split(',')[0])
            y_list.push(item.split(',')[1])
          })
      })

      // 取整 避免出现 坐标细微偏差问题
      let new_x_list = x_list.map((item) => parseInt(item))
      let new_y_list = y_list.map((item) => parseInt(item))

      // 横向
      if (new Set(new_y_list).size === 1) {
        position_left = { x: Math.min(...x_list), y: y_list[0] }
        position_right = { x: Math.max(...x_list), y: y_list[0] }
        contentDom = `
        <g id='Temp-${key}'>
          <circle cx='${position_left.x + (position_right.x - position_left.x) / 2}' cy='${position_left.y}' r='${height / 2}' fill='#fff' />
          <text x='${position_left.x + (position_right.x - position_left.x) / 2}' y='${position_left.y}' text-anchor='middle' dominant-baseline='middle' font-size='${height}' fill="#000">A</text>
        </g>
        `
      }
      // 纵向
      if (new Set(new_x_list).size === 1) {
        position_left = { x: x_list[0], y: Math.min(...y_list) }
        position_right = { x: x_list[0], y: Math.max(...y_list) }
        contentDom = `
        <g id='Temp-${key}'>
          <circle cx='${position_left.x}' cy='${position_left.y + (position_right.y - position_left.y) / 2}' r='${height / 2}' fill='#fff' />
          <text x='${position_left.x}' y='${position_left.y + (position_right.y - position_left.y) / 2}' text-anchor='middle' dominant-baseline='middle' font-size='${height}' fill="#000">A</text>
        </g>
        `
      }

      // 万一没有polyline的话 默认用use大小位置做计算
      if (x_list.length == 0 && y_list.length == 0) {
        // 获取use的真实坐标
        let useBBox = $('#' + key + ' use')[0].getBBox()
        // 计算polygon的真实坐标
        let obj = {
          x: useBBox.x + useBBox.width / 2,
          y: useBBox.y,
          width,
          height
        }

        contentDom = `
          <g id='Temp-${key}'>
          <circle cx='${obj.x}' cy='${obj.y}' r='${obj.height / 2}'  fill='#fff' />
          <text x='${obj.x}' y='${obj.y}' text-anchor='middle' dominant-baseline='middle' font-size='${obj.height}' fill="#000">A</text>
        </g>
          `
      }

      // 渲染配自开关标志
      SVG('#Temp_Layer').svg(contentDom)
    }
  }
  renderBreakerPointInfo() {
    let that = this
    let moveX = 5
    let moveY = 5

    let fontSize = 30
    let terminalSize = 36

    if (this.svgReadMode == 2) {
      moveX = 5
      moveY = 5
    }
    let bp = []
    console.log(that.currentSuffixBuffer)
    if (
      that.currentSuffixBuffer == 'KGBHDZ' ||
      that.currentSuffixBuffer == 'PROTECTI' ||
      that.currentSuffixBuffer == 'PROTECTII' ||
      that.currentSuffixBuffer == 'PROTECTIII' ||
      that.currentSuffixBuffer == 'PROTECTZ'
    ) {
      let ppchilds = SVG('#Point_Layer').node.childNodes
      for (let ppi = 0; ppi < ppchilds.length; ppi++) {
        SVG('#' + ppchilds[ppi].id).clear()
      }
      bp = this.breaker_protect
    } else {
      for (let bpkey in this.breaker_protect) {
        if (SVG('#Point-' + bpkey)) {
          SVG('#Point-' + bpkey).clear()
        }
      }
      bp = this.breaker_point
    }

    if (!bp) {
      return
    }

    for (let bkey in bp) {
      let dobj = bp[bkey]
      if (!dobj) {
        continue
      }
      let g = SVG('#' + bkey)
      var gtext = SVG('#Point-' + bkey)
      let dva = ''
      let noshow = false
      if (this.currentSuffixBuffer == 'FZL') {
        noshow = true
      } else if (this.currentSuffixBuffer == 'P') {
        dva = dobj.p
      } else if (this.currentSuffixBuffer == 'IA') {
        dva = dobj.ia
      } else if (this.currentSuffixBuffer == 'UA') {
        dva = dobj.uab
      } else if (this.currentSuffixBuffer == 'SXBPH') {
        noshow = true
      }

      let isclear = false
      if (gtext) {
        gtext.clear()
        isclear = true
      }
      if (noshow == false) {
        let gmdChild = g.find('metadata')[0].node.childNodes
        let objectname = ''
        for (let gmdi = 0; gmdi < gmdChild.length; gmdi++) {
          if (gmdChild[gmdi].nodeName == 'cge:psr_ref') {
            objectname = $(gmdChild[gmdi]).attr('objectname')
            break
          }
        }
        let children = $(g.find('use')[0].node)
        //动态计算位置大小
        let eq_use_x = parseFloat(children.attr('x'))
        let eq_use_y = parseFloat(children.attr('y'))
        let eq_use_width = children.attr('width')
        let eq_use_height = children.attr('height')
        let eq_length = eq_use_width > eq_use_height ? eq_use_width : eq_use_height
        let eq_transform = children.attr('transform')
        let eq_scale = 1
        for (let tidx in eq_transform.split(' ')) {
          let trStr = eq_transform.split(' ')[tidx]
          if (trStr.startsWith('scale')) {
            trStr = trStr.replace('scale(', '').replace(',', '')
            eq_scale = parseFloat(trStr)
            break
          }
        }
        eq_length = eq_length * eq_scale

        //20240220修改 要求页面元素都一样大
        if (that.switchPointFontSize) {
          fontSize = that.switchPointFontSize
        } else {
          fontSize = Math.round(eq_length * 0.6)
          if (fontSize < 1) {
            fontSize = 8
          }
          that.switchPointFontSize = fontSize
        }
        if (that.switchTerminalPointFontSize) {
          terminalSize = that.switchTerminalPointFontSize
        } else {
          terminalSize = Math.round(fontSize * 0.88)
          if (terminalSize < 1) {
            terminalSize = 8
          }
          that.switchTerminalPointFontSize = terminalSize
        }

        let svgX0 = 0,
          svgY0 = 0,
          svgX1 = 0,
          svgY1 = 0,
          svgBCX = 0,
          svgBCY = 0
        if (that.svgEditPointMap && that.svgEditPointMap['Point-' + bkey]) {
          let svgPointList = that.svgEditPointMap['Point-' + bkey]
          terminalSize = svgPointList[0].fontsize
          svgX0 = eq_use_x + parseFloat(svgPointList[0].x)
          svgY0 = eq_use_y + parseFloat(svgPointList[0].y)
          fontSize = svgPointList[1].fontsize
          svgX1 = eq_use_x + parseFloat(svgPointList[1].x)
          svgY1 = eq_use_y + parseFloat(svgPointList[1].y)
        } else {
          moveX = Math.round(eq_length * 0.2)
          moveY = Math.round(eq_length * 0.5)

          eq_use_x = eq_use_x + moveX
          eq_use_y = eq_use_y + moveY

          svgX0 = eq_use_x
          svgY0 = eq_use_y
          svgX1 = eq_use_x + terminalSize
          svgY1 = eq_use_y

          svgBCX = eq_use_x - eq_length * 0.5
          svgBCY = eq_use_y + eq_length * 0.5
        }

        if (
          this.currentSuffixBuffer != 'KGBHDZ' &&
          this.currentSuffixBuffer != 'PROTECTI' &&
          this.currentSuffixBuffer != 'PROTECTII' &&
          this.currentSuffixBuffer != 'PROTECTIII' &&
          this.currentSuffixBuffer != 'PROTECTZ'
        ) {
          let terinfo = ''
          let monitorText = null
          if (dobj.terinfo) {
            terinfo = " terinfo='" + dobj.terinfo + "' tername='" + dobj.tername + "' "
            if (parseInt(dobj.terinfo) == 1) {
              monitorText =
                '<text x="' +
                svgX0 +
                '" y="' +
                svgY0 +
                '" font-size="' +
                fontSize +
                '" font-family="SimSun" fill="green" self="self">●</text>'
            } else if (parseInt(dobj.terinfo) == 4 || parseInt(dobj.terinfo) == 0) {
              monitorText =
                '<text x="' +
                svgX0 +
                '" y="' +
                svgY0 +
                '" font-size="' +
                fontSize +
                '" font-family="SimSun" fill="red" self="self">●</text>'
            }
          } else {
            monitorText =
              '<text x="' +
              svgX0 +
              '" y="' +
              svgY0 +
              '" font-size="' +
              fontSize +
              '" font-family="SimSun" fill="darkgrey" self="self">◎</text>'
          }

          let textMetaSVG = []
          let textSvgElement =
            '<text x="' +
            svgX1 +
            '" y="' +
            svgY1 +
            '" font-size="' +
            fontSize +
            '" font-family="SimSun" fill="#0095ff" self="self">' +
            that.breakerFormatNumer(dva, that.currentSuffixBuffer) +
            '</text>'
          textMetaSVG.push('<metadata>')
          let bwinfo = ``
          if (dobj.bw && dobj.bwtime) {
            bwinfo = ` bw="${toNumber(dobj.bw) == 1 ? '闭合' : '断开'}" bwtime="${dobj.bwtime}" `
          }
          textMetaSVG.push(
            '<pdes ' +
            terinfo +
            ' psrid="' +
            dobj.psrid +
            '" name="' +
            objectname +
            '" p="' +
            that.breakerFormatNumer(dobj.p, 'P') +
            '" q="' +
            that.breakerFormatNumer(dobj.q, 'Q') +
            '" i="' +
            that.breakerFormatNumer(dobj.i, 'IA') +
            '" ia="' +
            that.breakerFormatNumer(dobj.ia, 'IA') +
            '" ib="' +
            that.breakerFormatNumer(dobj.ib, 'IA') +
            '" ic="' +
            that.breakerFormatNumer(dobj.ic, 'IA') +
            '" ' +
            ' uab="' +
            that.breakerFormatNumer(dobj.uab, 'UA') +
            '" ubc="' +
            that.breakerFormatNumer(dobj.ubc, 'UA') +
            '" uca="' +
            that.breakerFormatNumer(dobj.uca, 'UA') +
            '" yctime="' +
            dobj.yctime +
            '"  ' +
            bwinfo +
            '  ></pdes>'
          )
          textMetaSVG.push('</metadata>')
          if (isclear == true) {
            //已经创建过标签
            gtext.svg(monitorText + textSvgElement + textMetaSVG.join(' '))
          } else {
            let pointLayerG = SVG('#Point_Layer')
            pointLayerG.svg(
              '<g id="Point-' +
              bkey +
              '" class="svgTextMoreBreaker">' +
              monitorText +
              textSvgElement +
              textMetaSVG.join(' ') +
              '</g>'
            )
          }
        } else if (
          this.currentSuffixBuffer == 'KGBHDZ' ||
          this.currentSuffixBuffer == 'PROTECTI' ||
          this.currentSuffixBuffer == 'PROTECTII' ||
          this.currentSuffixBuffer == 'PROTECTIII' ||
          this.currentSuffixBuffer == 'PROTECTZ'
        ) {
          let state = ''
          let statecolor = 'green'
          if (dobj.state && dobj.state == '投') {
            state = '投'
          } else {
            state = '退'
            statecolor = 'red'
          }
          let textSvgElement = ''
          let monitorText = ''
          let textMetaSVG = []
          let infoI = []
          let infoII = []
          let infoIII = []
          let infoZ = []

          if (dobj.value_1) {
            infoI.push(`${dobj.value_1}`)
            if (dobj.time_1) {
              infoI.push(` ${dobj.time_1}`)
            }
            if (dobj.stateA_1 || dobj.statB_1) {
              let kgpState = ''
              if (dobj.stateA_1) {
                kgpState = '(跳闸)'
              }
              if (kgpState == '' && dobj.stateB_1) {
                kgpState = '(告警)'
              }
              infoI.push(kgpState)
            }
          }
          if (dobj.value_2) {
            infoII.push(`${dobj.value_2}`)
            if (dobj.time_2) {
              infoII.push(` ${dobj.time_2}`)
            }
            if (dobj.stateA_2 || dobj.statB_2) {
              let kgpState = ''
              if (dobj.stateA_2) {
                kgpState = '(跳闸)'
              }
              if (kgpState == '' && dobj.stateB_2) {
                kgpState = '(告警)'
              }
              infoII.push(kgpState)
            }
          }
          if (dobj.value_3) {
            infoIII.push(`${dobj.value_3}`)
            if (dobj.time_3) {
              infoIII.push(` ${dobj.time_3}`)
            }
            if (dobj.stateA_3 || dobj.statB_3) {
              let kgpState = ''
              if (dobj.stateA_3) {
                kgpState = '(跳闸)'
              }
              if (kgpState == '' && dobj.stateB_3) {
                kgpState = '(告警)'
              }
              infoIII.push(kgpState)
            }
          }
          if (dobj.value_0) {
            infoZ.push(`${dobj.value_0}`)
            if (dobj.time_0) {
              infoZ.push(` ${dobj.time_0}`)
            }
            if (dobj.stateA_0 || dobj.statB_0) {
              let kgpState = ''
              if (dobj.stateA_0) {
                kgpState = '(跳闸)'
              }
              if (kgpState == '' && dobj.stateB_0) {
                kgpState = '(告警)'
              }
              infoZ.push(kgpState)
            }
          }
          if (this.currentSuffixBuffer == 'KGBHDZ') {
            textSvgElement = `<text x="${svgX0}" y="${svgY0}" font-size="${fontSize}" font-family="SimSun" fill="${statecolor}" self="self">${state}</text>`
          } else if (this.currentSuffixBuffer == 'PROTECTI' && infoI.length > 0) {
            monitorText = `<text x="${svgBCX - terminalSize}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="white" self="self">I:</text>`
            textSvgElement = `<text x="${svgBCX}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="green" self="self">${infoI.join('')}</text>`
          } else if (this.currentSuffixBuffer == 'PROTECTII' && infoII.length > 0) {
            monitorText = `<text x="${svgBCX - terminalSize * 1.8}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="white" self="self">II:</text>`
            textSvgElement = `<text x="${svgBCX}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="green" self="self">${infoII.join('')}</text>`
          } else if (this.currentSuffixBuffer == 'PROTECTIII' && infoIII.length > 0) {
            monitorText = `<text x="${svgBCX - terminalSize * 2.2}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="white" self="self">III:</text>`
            textSvgElement = `<text x="${svgBCX}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="green" self="self">${infoIII.join('')}</text>`
          } else if (this.currentSuffixBuffer == 'PROTECTZ' && infoZ.length > 0) {
            monitorText = `<text x="${svgBCX - terminalSize * 2.8}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="white" self="self">零序:</text>`
            textSvgElement = `<text x="${svgBCX}" y="${svgBCY}" font-size="${fontSize}" font-family="SimSun" fill="green" self="self">${infoZ.join('')}</text>`
          }

          textMetaSVG.push('<metadata>')
          textMetaSVG.push(
            `<pds tername='${dobj.tername}' psrid='${dobj.psrid}' state='${state}' statecolor='${statecolor}' infoi='${infoI.join('')}' infoii='${infoII.join('')}' infoiii='${infoIII.join('')}' infoz='${infoZ.join('')}' />`
          )
          textMetaSVG.push('</metadata>')
          if (isclear == true) {
            //已经创建过标签
            gtext.svg(monitorText + textSvgElement + textMetaSVG.join(' '))
          } else {
            let pointLayerG = SVG('#Point_Layer')
            pointLayerG.svg(
              '<g id="Point-' +
              bkey +
              '" class="svgTextMoreBreaker">' +
              monitorText +
              textSvgElement +
              textMetaSVG.join(' ') +
              '</g>'
            )
          }
        }
      }
    }
    this.svgBindEventBreaker()
  }
  breakerFormatNumer(va, suffix) {
    let unit = ''
    if (va && toNumber(va)) {
      va = toNumber(va).toFixed(2)
      switch (suffix) {
        case 'IA':
          unit = 'A'
          break
        case 'UA':
          unit = 'kV'
          break
        case 'P':
          unit = 'kW'
          break
        case 'Q':
          unit = 'kVar'
          break
        default:
          unit = ''
      }
      return va + unit
    }
    return '-'
  }
  svgBindEventBreaker() {
    let that = this
    //样式方法不会自动解绑
    $('.svgTextMoreBreaker').unbind('click')
    $('.svgTextMoreBreaker').unbind('mouseover')
    $('.svgTextMoreBreaker').unbind('mouseout')
    //重新打完数值数据绑定方法
    $('.svgTextMoreBreaker').on('click', function (e) {
      let $obj = $(this)
      let g = SVG('#' + $obj.attr('id'))
      g.each(function (idx, children) {
        let stype = this.type
        if (stype == 'metadata') {
          let metadata = children[idx]
          metadata.each(function (midx, mchild) {
            let psrid = mchild[midx].attr('psrid')
            let tername = mchild[midx].attr('tername')
            // let page = router.resolve({
            //   name: 'breakerTrend',
            //   query: {
            //     fullScreen: true,
            //     titlename: tername,
            //     _szpsrid: that.szpsrid,
            //     psrid: psrid
            //   }
            // })
            // window.open(page.href, '_blank')
            const query = {
              fullScreen: true,
              titlename: tername,
              _szpsrid: that.szpsrid,
              psrid: psrid
            }
            $bus.emit(that, 'svgDataClickDialog', { type: 'breakerTrend', query })
          })
        }
      })
    })
    $('.svgTextMoreBreaker').on('mouseover', function (e) {
      let scX = e.pageX + 10
      let scY = e.pageY + 10
      let $obj = $(this)
      let g = SVG('#' + $obj.attr('id'))
      g.each(function (idx, children) {
        let stype = this.type
        if (stype == 'metadata') {
          let metadata = children[idx]
          let pdata = []

          metadata.each(function (midx, mchild) {
            if (
              that.currentSuffixBuffer != 'KGBHDZ' &&
              that.currentSuffixBuffer != 'KGBHDZ' &&
              that.currentSuffixBuffer != 'PROTECTI' &&
              that.currentSuffixBuffer != 'PROTECTII' &&
              that.currentSuffixBuffer != 'PROTECTIII' &&
              that.currentSuffixBuffer != 'PROTECTZ'
            ) {
              pdata.push('<div>')
              let terinfo = mchild[midx].attr('terinfo')
              let tername = mchild[midx].attr('tername')
              let bw = mchild[midx].attr('bw')
              let bwtime = mchild[midx].attr('bwtime')
              pdata.push(
                "<span style='margin-left: 2px;color: white'>" +
                mchild[midx].attr('name') +
                '</span>'
              )
              if (terinfo == 1 || terinfo == 4 || terinfo == 0) {
                if (parseInt(terinfo) == 1) {
                  pdata.push(
                    "<span style='margin-left: 2px;color: green'>" + tername + '[在线]</span>'
                  )
                } else if (parseInt(terinfo) == 4 || parseInt(terinfo) == 0) {
                  pdata.push(
                    "<span style='margin-left: 2px;color: red'>" + tername + '[离线]</span>'
                  )
                }
              } else {
                pdata.push("<span style='margin-left: 2px;color: darkgrey'>无终端</span>")
              }
              pdata.push('</div>')
              pdata.push('<div>')
              pdata.push("<span style='margin-left: 2px;color: white'>有功:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('p') +
                '</span>'
              )
              pdata.push("<span style='margin-left: 10px;color: white'>无功:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('q') +
                '</span>'
              )
              pdata.push("<span style='margin-left: 10px;color: white'>电流:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('i') +
                '</span>'
              )
              pdata.push('</div>')

              pdata.push('<div>')
              pdata.push("<span style='margin-left: 2px;color: white'>电流A:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('ia') +
                '</span>'
              )
              pdata.push("<span style='margin-left: 10px;color: white'>电流B:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('ib') +
                '</span>'
              )
              pdata.push("<span style='margin-left: 10px;color: white'>电流C:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('ic') +
                '</span>'
              )
              pdata.push('</div>')

              pdata.push('<div>')
              pdata.push("<span style='margin-left: 2px;color: white'>电压B:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('uab') +
                '</span>'
              )
              pdata.push("<span style='margin-left: 10px;color: white'>电压C:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('ubc') +
                '</span>'
              )
              pdata.push("<span style='margin-left: 10px;color: white'>电压A:</span>")
              pdata.push(
                "<span style='margin-left: 5px;color:cornflowerblue'>" +
                mchild[midx].attr('uca') +
                '</span>'
              )
              pdata.push('</div>')

              pdata.push('<div>')
              pdata.push("<span style='margin-left: 2px;color: white'>测点时间:</span>")
              pdata.push(
                "<span style='margin-left: 10px;color:cornflowerblue'>" +
                mchild[midx].attr('yctime') +
                '</span>'
              )
              pdata.push('</div>')
              if (bw && bwtime) {
                pdata.push('<div>')
                pdata.push("<span style='margin-left: 2px;color: white'>状态:" + bw + '</span>')

                pdata.push("<span style='margin-left: 2px;color: white'>状态时间:</span>")
                pdata.push(
                  "<span style='margin-left: 10px;color:cornflowerblue'>" + bwtime + '</span>'
                )
              }
            } else if (
              that.currentSuffixBuffer == 'KGBHDZ' ||
              that.currentSuffixBuffer == 'PROTECTI' ||
              that.currentSuffixBuffer == 'PROTECTII' ||
              that.currentSuffixBuffer == 'PROTECTIII' ||
              that.currentSuffixBuffer == 'PROTECTZ'
            ) {
              let tername = mchild[midx].attr('tername')
              let state = mchild[midx].attr('state')
              let statecolor = mchild[midx].attr('statecolor')
              let infoI = mchild[midx].attr('infoi')
              let infoII = mchild[midx].attr('infoii')
              let infoIII = mchild[midx].attr('infoiii')
              let infoZ = mchild[midx].attr('infoz')
              pdata.push('<div>')
              pdata.push(
                `<span style='margin-left: 2px;color: green'>${tername}</span><span style='margin-left: 2px;color: ${statecolor}'>[${state}]</span>`
              )
              pdata.push('</div>')
              if (infoI && infoI != '') {
                pdata.push('<div>')
                pdata.push(
                  `<span style='margin-left: 2px;color: white'>I:</span><span style='margin-left: 2px;color: cornflowerblue'>${infoI}</span>`
                )
                pdata.push('</div>')
              }
              if (infoII && infoII != '') {
                pdata.push('<div>')
                pdata.push(
                  `<span style='margin-left: 2px;color: white'>II:</span><span style='margin-left: 2px;color: cornflowerblue'>${infoII}</span>`
                )
                pdata.push('</div>')
              }
              if (infoIII && infoIII != '') {
                pdata.push('<div>')
                pdata.push(
                  `<span style='margin-left: 2px;color: white'>III:</span><span style='margin-left: 2px;color: cornflowerblue'>${infoIII}</span>`
                )
                pdata.push('</div>')
              }
              if (infoZ && infoZ != '') {
                pdata.push('<div>')
                pdata.push(
                  `<span style='margin-left: 2px;color: white'>零序:</span><span style='margin-left: 2px;color: cornflowerblue'>${infoZ}</span>`
                )
                pdata.push('</div>')
              }
            }
          })
          $('#meterDiv').html(pdata.join(' '))
          $('#meterDiv').attr('style', 'position:absolute;top:' + scY + 'px;left:' + scX + 'px;')
          $('#meterDiv').show()
        }
      })
    })
    $('.svgTextMoreBreaker').on('mouseout', function (e) {
      // let $obj = $(this);
      // console.log("i am out:"+$obj.attr("id"));
      $('#meterDiv').hide()
    })
  }
  changeSvgBreakerStatus() {
    let that = this
    let nchf = this.nchf_breaker
    let tzmarker = 'href'
    if (!nchf) {
      return
    }
    for (let i = 0; i < nchf.length; i++) {
      let g = SVG('#' + nchf[i])
      let gchref = ''
      g.each(function (idx, children) {
        let stype = this.type
        if (stype == 'use') {
          let ghref = children[0].attr('href')
          if (!ghref) {
            ghref = children[0].attr('xlink:href')
            tzmarker = 'xlink:href'
          }
          if (ghref) {
            switch (ghref) {
              case '#Breaker_99999999-1':
                gchref = '#Breaker_99999990-1'
                break
              case '#Breaker_99999990-1':
                gchref = '#Breaker_99999999-1'
                break
              case '#Breaker_30500000-1-0-4030011':
                gchref = '#Breaker_30500000-1-1-4030010'
                break
              case '#Breaker_30500000-1-1-4030010':
                gchref = '#Breaker_30500000-1-0-4030011'
                break
              default:
                gchref = ghref
                //立光图纸替换图元 defs图元
                let symbolgroup = that.lgSymbolMap.get(ghref.replace('#', ''))
                if (symbolgroup) {
                  for (let smkey of that.lgSymbolMap.keys()) {
                    let smvalue = that.lgSymbolMap.get(smkey)
                    if (smvalue == symbolgroup && smkey != ghref) {
                      gchref = '#' + smkey
                      break
                    }
                  }
                }
                break
            }

            children[0].attr(tzmarker, gchref)
          }
        }
      })
    }
  }
  webMercator2LngLat(x, y) {
    var lon = (x / 20037508.34) * 180
    var lat = (y / 20037508.34) * 180
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
    return { lon: lon, lat: lat }
  }
  lonLat2WebMercator(lat, lon) {
    let x = (lon * 20037508.34) / 180
    let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)
    y = (y * 20037508.34) / 180
    return [x, y]
  }
  locatEquipOnSvg(gid) {
    // let that = this
    // var g = $('#' + gid + ' use')[0]
    // if (!g) {
    //   return
    // }

    // let getConvertCoor = (sjLonLat) => {
    //   that.map.flyTo({ center: sjLonLat[0], zoom: 19 })
    // }

    // let gx = Number($(g).attr('x'))
    // let gy = Number($(g).attr('y'))

    // if (this.svgReadMode == 2) {
    //   let oraextent = this.svgMapBounds
    //   let x1 = oraextent[0]
    //   let y2 = oraextent[3]
    //   let mercx = Number(x1) + gx
    //   let mercy = Number(y2) - gy
    //   let transLonLat = this.webMercator2LngLat(mercx, mercy)
    //   mapTool.getSingleLineCor([[transLonLat.lon, transLonLat.lat]], getConvertCoor)
    // } else {
    //   let svgContainerWidth = $('#svgContainer').width()
    //   let svgContainerHeight = $('#svgContainer').height()
    //   this.panZoom.resetZoom()
    //   this.panZoom.resetPan()
    //   this.panZoom.panBy({ x: svgContainerWidth / 2 - gx, y: svgContainerHeight / 2 - gy })
    //   this.panZoom.zoom(this.defaultSvgZoom + 0.5)
    // }
    // that.addEquipRect(gid)
    let that = this
    let g = $('#' + gid)[0]
    if (!g) {
      return
    }
    g = SVG(g)
    if (!g) {
      return
    }

    let getConvertCoor = (sjLonLat) => {
      that.map.flyTo({ center: sjLonLat[0], zoom: 19 })
    }

    let gx = g.cx()
    let gy = g.cy()

    if (this.svgReadMode == 2) {
      let oraextent = this.svgMapBounds
      let x1 = oraextent[0]
      let y2 = oraextent[3]
      let mercx = Number(x1) + gx
      let mercy = Number(y2) - gy
      let transLonLat = this.webMercator2LngLat(mercx, mercy)
      mapTool.getSingleLineCor([[transLonLat.lon, transLonLat.lat]], getConvertCoor)
    } else {
      let svgContainerWidth = $('#svgContainer').width()
      let svgContainerHeight = $('#svgContainer').height()
      this.panZoom.resetZoom()
      this.panZoom.resetPan()
      this.panZoom.panBy({ x: svgContainerWidth / 2 - gx, y: svgContainerHeight / 2 - gy })
      this.panZoom.zoom(this.defaultSvgZoom + 2)
    }
    that.addEquipRect(gid)
  }
  addEquipRect(to_cadid) {
    console.log(to_cadid)
    let g = SVG('#' + to_cadid)
    let rectWidth = 2
    if (this.map) {
      rectWidth = 0.2
    }
    let that = this
    let targetObj = g.findOne('use')
    let targetPolygon = g.findOne('polygon')
    let targetPolyline = g.findOne('polyline')

    // if (targetObj) {
    if (that.currentLeftUseEquip) {
      let g_old = SVG('#' + that.currentLeftUseEquip)
      if (g_old.findOne('rect')) {
        g_old.findOne('rect').remove()
        that.currentLeftUseEquip = null
      }
    }
    let tgBounds = $(targetObj)[0]?.attr('bounds')
    if (tgBounds) {
      let tg_x1 = tgBounds.split(',')[0]
      let tg_y1 = tgBounds.split(',')[1]
      let tg_x2 = tgBounds.split(',')[2]
      let tg_y2 = tgBounds.split(',')[3]
      let tgwidth = tg_x2 - tg_x1
      let tgheight = tg_y2 - tg_y1
      let tgX = $(targetObj)[0].attr('x') - tgwidth / 2
      let tgY = $(targetObj)[0].attr('y') - tgheight / 2
      let tgRect = `<rect x="${tgX}" y="${tgY}" class="svg_select_rect" width="${tgwidth}" height="${tgheight}" style="stroke-width: ${rectWidth};fill:none"></rect>`
      g.svg(tgRect)
    } else {
      let gbbox = g.bbox()
      let tg_x1 = gbbox.x
      let tg_y1 = gbbox.y
      let tg_x2 = gbbox.x2
      let tg_y2 = gbbox.y2
      let tg_cx = gbbox.cx
      let tg_cy = gbbox.cy
      let tgwidth = tg_x2 - tg_x1
      let tgheight = tg_y2 - tg_y1
      let tgX = tg_cx - tgwidth / 2
      let tgY = tg_cy - tgheight / 2
      // 母线比较细 做特殊处理
      let tgRect = ''
      if (targetPolyline && tgheight == 0) {
        tgheight = 1
        tgY = tg_cy - tgheight / 2
      }
      if (targetPolyline && tgwidth == 0) {
        tgwidth = 1
        tgX = tg_cx - tgwidth / 2
      }
      // console.log($(targetPolyline)[0].addClass('svg_select_rect'))
      tgRect = `<rect x="${tgX}" y="${tgY}" class="svg_select_rect" width="${tgwidth}" height="${tgheight}" style="stroke-width: ${rectWidth};fill:none"></rect>`
      g.svg(tgRect)
    }
    // }
    that.currentLeftUseEquip = to_cadid
  }
  themeCalcShow(e) {
    if (e === 0) {
      this.theme1Togger = !this.theme1Togger
      this.toggleFullSimpleDraw()
    } else if (e === 1) {
      if (this.theme1Togger) {
        this.theme1Togger = !this.theme1Togger
        this.toggleFullSimpleDraw()
      }
    } else if (e === 2) {
      if (this.theme1Togger) {
        this.theme1Togger = !this.theme1Togger
        this.toggleFullSimpleDraw()
      }
    }
  }
  toggleFullSimpleDraw() {
    for (let item of this.theme1Cut) {
      $('#' + item).toggle()
      $('#Point-' + item).toggle()
      $('#TXT-' + item).toggle()
      $('#EX-' + item).toggle()
    }
  }
  initSearchData() {
    let that = this

    // .initSvgDeviceSearchData({ svgid: that.svgid }).then((res) => {
    //   $bus.emit(that,'initSvgSearchNameInfo', res)
    // })
  }
}
