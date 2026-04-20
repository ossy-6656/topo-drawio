import SymbolUtil from '@/plugins/tmzx/graph/SymbolUtil.js'
import mathutil from '@/plugins/tmzx/mathutil.js'

let singleByteCharReg = /[a-z0-9#_\-/.+?]/i // 用于验证字体是否为单字节
import {customShapeLs} from './Constants.js';

let StencilParse = {
    symbolProp: {},
    strokeWidth: 1,
    regSpace: / /g,
    getMatrix(scale, tranx, trany) {
        // 缩放矩阵
        let scaleM = new Matrix3()
        scaleM.scale(scale, scale)

        // 平移矩阵
        let tranM = new Matrix3()

        tranM.translate(tranx, trany)

        let m = scaleM.clone().multiply(tranM)

        return m
    },

    toNum(str) {
        return parseFloat(str)
    },

    parseRect(dom, scale, matrix) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let x = this.toNum(dom.getAttribute('x'))
        let y = this.toNum(dom.getAttribute('y'))
        let width = this.toNum(dom.getAttribute('width'))
        let height = this.toNum(dom.getAttribute('height'))
        let strokeWidth = dom.getAttribute('stroke-width')
        strokeWidth = 1

        let curW = width * scale
        let curH = height * scale

        let v2 = new Vector2(x, y)
        let v = v2.clone().applyMatrix3(matrix)

        let _x = v.x
        let _y = v.y

        if (stroke && stroke != 'none') {
            sb.push('<strokecolor color="' + stroke + '" />')
        }

        if (fill && fill != 'none') {
            sb.push('<fillcolor color="' + fill + '" />')
        }

        // if (stroke == 'none') {
        //     sb.push('<strokecolor color="none" />')
        // }
        //
        // if (fill == 'none') {
        //     sb.push('<fillcolor color="none" />')
        // }

        sb.push('<strokewidth fixed="1" width="' + strokeWidth + '" />')
        sb.push('<rect ')
        sb.push('x="' + _x + '" ')
        sb.push('y="' + _y + '" ')
        sb.push('w="' + curW + '" ')
        sb.push('h="' + curH + '" ')
        sb.push('/>')

        if (stroke && fill && fill != 'none') {
            sb.push('<fillstroke/>')
        } else if (stroke) {
            sb.push('<stroke/>')
        }
        return sb.join('')
    },

    parseEllipse(dom, scale, matrix) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let strokeWidth = dom.getAttribute('stroke-width')
        strokeWidth = 1

        let cx = this.toNum(dom.getAttribute('cx'))
        let cy = this.toNum(dom.getAttribute('cy'))
        let rx = this.toNum(dom.getAttribute('rx'))
        let ry = this.toNum(dom.getAttribute('ry'))
        let width = rx * 2
        let height = ry * 2

        let curW = width * scale
        let curH = height * scale

        let x = cx - rx
        let y = cy - ry

        let v2 = new Vector2(x, y)
        let v = v2.clone().applyMatrix3(matrix)
        let _x = v.x
        let _y = v.y

        if (stroke && stroke != 'none') {
            sb.push('<strokecolor color="' + stroke + '" />')
        }

        if (fill && fill != 'none') {
            sb.push('<fillcolor color="' + fill + '" />')
        }

        // if (stroke == 'none') {
        //     sb.push('<strokecolor color="none" />')
        // }
        //
        // if (fill == 'none') {
        //     sb.push('<fillcolor color="none" />')
        // }

        sb.push('<strokewidth fixed="1" width="' + strokeWidth + '" />')
        sb.push('<ellipse ')
        sb.push('x="' + _x + '" ')
        sb.push('y="' + _y + '" ')
        sb.push('w="' + curW + '" ')
        sb.push('h="' + curH + '" ')
        sb.push('/>')
        if (stroke && fill && fill != 'none') {
            sb.push('<fillstroke/>')
        } else if (stroke) {
            sb.push('<stroke/>')
        }
        return sb.join('')
    },

    parseCircle(dom, scale, matrix) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let strokeWidth = dom.getAttribute('stroke-width')
        let cx = this.toNum(dom.getAttribute('cx'))
        let cy = this.toNum(dom.getAttribute('cy'))
        let r = this.toNum(dom.getAttribute('r'))

        strokeWidth = 1
        let width = r * 2
        let height = width

        let curW = width * scale
        let curH = height * scale

        let x = cx - r
        let y = cy - r

        let v2 = new Vector2(x, y)
        let v = v2.clone().applyMatrix3(matrix)
        let _x = v.x
        let _y = v.y

        if (stroke && stroke != 'none') {
            sb.push('<strokecolor color="' + stroke + '" />')
        }

        if (fill && fill != 'none') {
            sb.push('<fillcolor color="' + fill + '" />')
        }

        // if (stroke == 'none') {
        //     sb.push('<strokecolor color="none" />')
        // }
        //
        // if (fill == 'none') {
        //     sb.push('<fillcolor color="none" />')
        // }

        sb.push('<strokewidth fixed="1" width="' + strokeWidth + '" />')
        sb.push('<ellipse ')
        sb.push('x="' + _x + '" ')
        sb.push('y="' + _y + '" ')
        sb.push('w="' + curW + '" ')
        sb.push('h="' + curH + '" ')
        sb.push('/>')
        if (stroke && fill && fill != 'none') {
            sb.push('<fillstroke/>')
        } else if (stroke) {
            sb.push('<stroke/>')
        }
        return sb.join('')
    },

    parseUseSymbol(dom, scale, matrix) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let strokeWidth = dom.getAttribute('stroke-width')
        let cx = this.toNum(dom.getAttribute('cx'))
        let cy = this.toNum(dom.getAttribute('cy'))
        let r = this.toNum(dom.getAttribute('r'))

        strokeWidth = 1
        let width = r * 2
        let height = width

        let curW = width * scale
        let curH = height * scale

        let x = cx - r
        let y = cy - r

        let v2 = new Vector2(x, y)
        let v = v2.clone().applyMatrix3(matrix)
        let _x = v.x
        let _y = v.y

        // if (stroke && stroke != 'none')
        // {
        // 	// sb.push('<strokecolor color="' + this.white2black(stroke) + '" />');
        // 	sb.push('<strokecolor color="' + '#ff0000' + '" />');
        // }
        //
        // sb.push('<fillcolor color="' + '#fff' + '" />');

        sb.push('<strokecolor color="rgb(0,200,255)" />')

        // if (fill == 'none') {
        //     sb.push('<fillcolor color="none" />')
        // }

        sb.push('<strokewidth fixed="1" width="' + strokeWidth + '" />')
        sb.push('<ellipse ')
        sb.push('x="' + _x + '" ')
        sb.push('y="' + _y + '" ')
        sb.push('w="' + curW + '" ')
        sb.push('h="' + curH + '" ')
        sb.push('/>')

        sb.push('<stroke/>')
        // if (stroke && fill && fill != 'none')
        // {
        // 	sb.push('<fillstroke/>');
        // }
        // else if (stroke)
        // {
        // 	sb.push('<stroke/>')
        // }
        return sb.join('')
    },

    _parseCircleTest(x, y, r, scale, matrix) {
        let sb = []
        let fill = 'red'
        let stroke = 'red'
        let strokeWidth = 1

        strokeWidth = 1
        let width = r * 2
        let height = width

        let curW = width * scale
        let curH = height * scale

        if (stroke && stroke != 'none') {
            // let _f = this.reverseColor(stroke);
            sb.push('<strokecolor color="' + stroke + '" />')
        }

        sb.push('<strokewidth width="' + strokeWidth + '" />')
        sb.push('<rect ')
        sb.push('x="' + x + '" ')
        sb.push('y="' + y + '" ')
        sb.push('w="' + curW + '" ')
        sb.push('h="' + curH + '" ')
        sb.push('/>')
        if (stroke && fill && fill != 'none') {
            sb.push('<fillstroke/>')
        } else if (stroke) {
            sb.push('<stroke/>')
        }
        return sb.join('')
    },
    /**
     *
     * @param dom
     * @param scale
     * @param matrix
     * @param relwidth
     * @returns {string}
     */
    parseUseCircle(dom, scale, matrix, relwidth) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let strokeWidth = dom.getAttribute('stroke-width')
        let x = this.toNum(dom.getAttribute('x'))
        let y = this.toNum(dom.getAttribute('y'))

        // let r = relwidth / 10;
        // let width = r * 2;
        let width = relwidth
        let height = width

        // let curW = width * scale;
        // let curH = height * scale;
        // let curW = width ;
        // let curH = height;

        let curW = 2
        let curH = 2
        // curW = curH = relwidth;

        let v2 = new Vector2(x, y)
        let v = v2.clone().applyMatrix3(matrix)
        let _x = v.x - curW / 2
        let _y = v.y - curH / 2

        sb.push('<strokecolor color="rgb(0,200,255)" />')

        // sb.push('<fillcolor color="red" />')

        sb.push('<ellipse ')
        sb.push('x="' + _x + '" ')
        sb.push('y="' + _y + '" ')
        sb.push('w="' + curW + '" ')
        sb.push('h="' + curH + '" ')
        sb.push('/>')
        sb.push('<stroke/>')
        return sb.join('')
    },

    parseLine(dom, scale, matrix) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let strokeWidth = dom.getAttribute('stroke-width')
        strokeWidth = 1

        let x1 = this.toNum(dom.getAttribute('x1'))
        let y1 = this.toNum(dom.getAttribute('y1'))
        let x2 = this.toNum(dom.getAttribute('x2'))
        let y2 = this.toNum(dom.getAttribute('y2'))

        let v1 = new Vector2(x1, y1)
        let v11 = v1.clone().applyMatrix3(matrix)

        let v2 = new Vector2(x2, y2)
        let v22 = v2.clone().applyMatrix3(matrix)

        let _x1 = v11.x
        let _y1 = v11.y

        let _x2 = v22.x
        let _y2 = v22.y

        // if (stroke && stroke != 'none') {
        //     sb.push('<strokecolor color="' + stroke + '" />')
        // }

        sb.push('<strokecolor color="' + stroke + '" />')
        // if (stroke == 'none') {
        //     sb.push('<strokecolor color="none" />')
        // }

        // if (fill == 'none') {
        //     sb.push('<fillcolor color="none" />')
        // }

        sb.push('<strokewidth fixed="1" width="' + strokeWidth + '" />')
        sb.push('<path> ')
        sb.push('<move x="' + _x1 + '" y="' + _y1 + '"/>')
        sb.push('<line x="' + _x2 + '" y="' + _y2 + '"/>')
        sb.push('</path>')
        sb.push('<stroke/>')
        return sb.join('')
    },

    parsePolyline(dom, scale, matrix) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let strokeWidth = dom.getAttribute('stroke-width')
        strokeWidth = 1

        let points = dom.getAttribute('points')
        let pstrarr = points.split(' ')

        if (stroke && stroke != 'none') {
            sb.push('<strokecolor color="' + stroke + '" />')
        }

        if (fill && fill != 'none') {
            sb.push('<fillcolor color="' + fill + '" />')
        }

        // if (stroke == 'none') {
        //     sb.push('<strokecolor color="none" />')
        // }
        //
        // if (fill == 'none') {
        //     sb.push('<fillcolor color="none" />')
        // }

        sb.push('<strokewidth fixed="1" width="' + strokeWidth + '" />')
        sb.push('<path> ')
        for (let i = 0; i < pstrarr.length; i++) {
            let arr = pstrarr[i].split(',')
            let x = this.toNum(arr[0])
            let y = this.toNum(arr[1])

            let v1 = new Vector2(x, y)
            let v = v1.clone().applyMatrix3(matrix)

            let x1 = v.x
            let y1 = v.y
            if (i == 0) {
                sb.push('<move x="' + x1 + '" y="' + y1 + '"/>')
            } else {
                sb.push('<line x="' + x1 + '" y="' + y1 + '"/>')
            }
        }
        sb.push('</path>')

        if (stroke && fill && fill != 'none') {
            sb.push('<fillstroke/>')
        } else if (stroke && stroke != 'none') {
            sb.push('<stroke/>')
        }
        return sb.join('')
    },

    parsePolygon(dom, scale, matrix) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let strokeWidth = dom.getAttribute('stroke-width')
        strokeWidth = 1

        let points = dom.getAttribute('points')
        let pstrarr = points.split(' ')

        if (stroke && stroke != 'none') {
            sb.push('<strokecolor color="' + stroke + '" />')
        }

        if (fill && fill != 'none') {
            sb.push('<fillcolor color="' + fill + '" />')
        }

        // if (stroke == 'none') {
        //     sb.push('<strokecolor color="none" />')
        // }
        //
        // if (fill == 'none') {
        //     sb.push('<fillcolor color="none" />')
        // }

        sb.push('<strokewidth fixed="1" width="' + strokeWidth + '" />')
        sb.push('<path> ')
        for (let i = 0; i < pstrarr.length; i++) {
            let arr = pstrarr[i].split(',')
            let x = this.toNum(arr[0])
            let y = this.toNum(arr[1])

            let v1 = new Vector2(x, y)
            let v = v1.clone().applyMatrix3(matrix)

            let x1 = v.x
            let y1 = v.y
            if (i == 0) {
                sb.push('<move x="' + x1 + '" y="' + y1 + '"/>')
            } else {
                sb.push('<line x="' + x1 + '" y="' + y1 + '"/>')
            }
        }
        sb.push('<close />')
        sb.push('</path>')

        if (stroke && fill && fill != 'none') {
            sb.push('<fillstroke/>')
        } else if (stroke && stroke != 'none') {
            sb.push('<stroke/>')
        }
        return sb.join('')
    },

    parseText(dom, scale, matrix, orign, w, h) {
        let sb = []
        let fill = dom.getAttribute('fill')
        let stroke = dom.getAttribute('stroke')
        let x = this.toNum(dom.getAttribute('x'))
        let y = this.toNum(dom.getAttribute('y'))

        let dx = dom.getAttribute('dx')
        let dy = dom.getAttribute('dy')

        let fontSize = dom.getAttribute('font-size')
        let fs = parseFloat(fontSize)
        let fontFamily = dom.getAttribute('font-family')
        let text = $(dom).html()

        let _fs = fs * scale

        let v2 = new Vector2(orign.x, orign.y)
        let v = v2.clone().applyMatrix3(matrix)

        let _x = v.x
        let _y = v.y
        // let teststr = this._parseCircleTest(_x, _y, 1, scale, matrix);
        // sb.push(teststr)

        _x = _x + w / 2
        _y = _y + h / 2

        let getTextLenFun = (str, fs) => {
            let len = 0
            for (let i = 0; i < str.length; i++) {
                if (singleByteCharReg.test(str[i])) {
                    len = len + fs / 2
                } else {
                    len = len + fs
                }
            }
            return len
        }

        if (stroke && stroke != 'none') {
            // sb.push('<strokecolor color="' + this.white2black(stroke) + '" />');
            // sb.push('<strokecolor color="' + '#f00' + '" />')
        }
        // let len = getTextLenFun(text, _fs);

        // sb.push('<fontcolor color="' + this.reverseColor(fill) + '" />');
        sb.push('<fontcolor color="' + '#fff' + '" />')
        sb.push('<fontsize size="' + _fs + '" />')
        sb.push('<fontfamily family="' + fontFamily + '" />')
        sb.push('<text ')
        sb.push('str="' + text + '" ')
        sb.push('x="' + _x + '" ')
        sb.push('y="' + _y + '" ')
        // if (dx) {
        // 	sb.push('dx="' + dx + '" ');
        // }
        // if (dy) {
        // 	sb.push('dy="' + dy + '" ');
        // }
        sb.push('valign="middle" ')
        sb.push('align="center" ')
        sb.push('/>')
        //sb.push('<fillstroke/>');
        return sb.join('')
    },
    // 计算连接点在图元中的相对位置
    getTouchPosition_(symbol) {
        let $symbol = $(symbol)
        let childLs = $symbol.children()

        let list = []
        childLs.each((index, dom) => {
            let nodeName = dom.nodeName
            let domstr
            switch (nodeName) {
                case 'rect':
                    list.push(SymbolUtil.rectDimension(dom))
                    break
                case 'line':
                    list.push(SymbolUtil.lineDimension(dom))
                    break
                case 'polyline':
                case 'polygon':
                    list.push(SymbolUtil.polygonDimension(dom))
                    break
                case 'ellipse':
                    list.push(SymbolUtil.ellipseDimension(dom))
                    break
                case 'circle':
                    list.push(SymbolUtil.circleDimension(dom))
                    break
                default:
                    console.log(nodeName, 'stencilParse：计算符号范围时未处理此元素...')
                    domstr = null
            }
        })
        let dimension = SymbolUtil.symbolDimension(list)
        let usedomList = Array.from($symbol.find('use'))

        let rslist = []
        for (let usedom of usedomList) {
            let pos = SymbolUtil.usePostion(usedom)
            let relpos = SymbolUtil.useRelativePostion(pos, dimension)
            rslist.push(relpos)
        }
        return rslist
    },
    getSymbolDimension(symbol) {
        let $symbol = $(symbol)
        let childLs = $symbol.children()

        let list = []
        childLs.each((index, dom) => {
            let nodeName = dom.nodeName
            let domstr
            switch (nodeName) {
                case 'rect':
                    list.push(SymbolUtil.rectDimension(dom))
                    break
                case 'line':
                    list.push(SymbolUtil.lineDimension(dom))
                    break
                case 'polyline':
                case 'polygon':
                    list.push(SymbolUtil.polygonDimension(dom))
                    break
                case 'ellipse':
                    list.push(SymbolUtil.ellipseDimension(dom))
                    break
                case 'circle':
                    list.push(SymbolUtil.circleDimension(dom))
                    break
                default:
                    console.log(nodeName, 'stencilParse：计算symbol范围时未处理此元素...')
                    domstr = null
            }
        })
        let { minx, miny, maxx, maxy } = SymbolUtil.symbolDimension(list)

        return {
            width: maxx - minx,
            height: maxy - miny,
            minx,
            miny,
            maxx,
            maxy
        }
    },

    // 获取连接点相对图元左上角比率
    getTouchRelativePosition(symbol, dimension) {
        let $symbol = $(symbol)
        let usedomList = Array.from($symbol.find('use'))

        let leftRate = null,
            midRate = null,
            rightRate = null

        let rslist = []
        for (let usedom of usedomList) {
            // 连接点坐标
            let pos = SymbolUtil.usePostion(usedom)

            // 连接点坐标相对图元左上角比例
            let relpos = SymbolUtil.useRelativePostion(pos, dimension)
            if (SymbolUtil.isLeftTouch(relpos.x, relpos.y)) {
                leftRate = relpos
            } else if (SymbolUtil.isRightTouch(relpos.x, relpos.y)) {
                rightRate = relpos
            } else {
                midRate = relpos
            }
            // rslist.push(relpos)
        }

        if (leftRate) {
            rslist.push(leftRate)
        }

        if (rightRate) {
            rslist.push(rightRate)
        }

        if (midRate) {
            rslist.push(midRate)
        }

        return rslist
    },

    fillDomFirst(childLs) {
        let fillList = []
        let noFillList = []
        let useList = []

        childLs.each((index, dom) => {
            let fill = dom.getAttribute('fill')
            let nodeName = dom.nodeName

            if (nodeName == 'use') {
                useList.push(dom)
            } else {
                if (fill && fill != 'none') {
                    fillList.push(dom)
                } else {
                    noFillList.push(dom)
                }
            }
        })
        // return [...fillList, ...noFillList];
        return { fillList, noFillList, useList }
    },

    createDomListStr(list, scale, matrix) {
        let sb = []
        for (let dom of list) {
            let nodeName = dom.nodeName
            let domstr
            switch (nodeName) {
                case 'rect':
                    domstr = this.parseRect(dom, scale, matrix.clone())
                    break
                case 'line':
                    domstr = this.parseLine(dom, scale, matrix.clone())
                    break
                case 'polyline':
                    domstr = this.parsePolyline(dom, scale, matrix.clone())
                    break
                case 'polygon':
                    domstr = this.parsePolygon(dom, scale, matrix.clone())
                    break
                case 'ellipse':
                    domstr = this.parseEllipse(dom, scale, matrix.clone())
                    break
                case 'circle':
                    domstr = this.parseCircle(dom, scale, matrix.clone())
                    break
                case 'text':
                    break
                default:
                    console.log(nodeName, 'stencilParse：符号未处理...')
                    domstr = null
            }
            if (domstr) {
                sb.push(domstr)
            }
        }
        return sb.join('')
    },

    parseSymbol(symbol) {
        let symbolProp = this.symbolProp

        let initWidth = symbol.getAttribute('width')
        let initHeight = symbol.getAttribute('height')

        let $symbol = $(symbol)
        let id = $symbol.attr('id')

        // 重新计算图元宽高
        let dimension = this.getSymbolDimension(symbol)
        let { width, height, minx, miny, maxx, maxy } = dimension

        symbol.setAttribute('width', width)
        symbol.setAttribute('height', height)

        let scale = 100 / width // 以100为基准，把符号都放大到100

        // 获取变换矩阵，图元只有中心在原点，drawio图元以左上角为为起点

        let tranx = -minx
        let trany = -miny

        let matrix = this.getMatrix(scale, tranx, trany)

        let orign = { x: minx, y: miny }

        let w = width * scale
        let h = height * scale

        let childLs = $symbol.children()
        let sb = []
        sb.push('<shape name="' + id + '" w="' + w + '" h="' + h + '" aspect="fixed">')

        let touchPoints = 1
        sb.push('<connections>')
        let symbolId = id.toLowerCase()

        // 力光的图元有的没有touch
        let touchList = this.getTouchRelativePosition(symbol, dimension)

        if (touchList.length == 0) {
            touchList = [{ x: 0.5, y: 0.5 }]
        }

        touchPoints = touchList.length

        for (let item of touchList) {
            let { x, y } = item
            sb.push(`<constraint x="${x}" y="${y}" perimeter="0" />`) // 0：内部及边缘、1：只能在边缘
            // if (SymbolUtil.isPointInSymbol(item)) {
            //     sb.push(`<constraint x="${x}" y="${y}" perimeter="0" />`) // 0：内部
            // } else {
            //     sb.push(`<constraint x="${x}" y="${y}" perimeter="0" />`) // 1：外部
            // }
        }

        // {a: {x: 0, y: .5}, b: {x: 1, y: .5}}
        let posObj = SymbolUtil.touchPosition(touchList)

        // 计算左侧与上方占比
        let xratio, yratio

        if (touchList.length == 1) {
            let item = touchList[0]
            if (id.toLowerCase().indexOf('grounddisconnector') == 0) // 接地刀闸中心点在中间，连接点在右边
            {
                xratio = .5;
            } else if (SymbolUtil.isRightTouch(item.x, item.y)) {
                xratio = item.x
            } else {
                xratio = 0.5
            }

            yratio = item.y // 目前遇到的单连接点图元，中心
        } else {
            let item1 = touchList[0]
            let item2 = touchList[1]

            let v1 = new Vector2(item1.x, item1.y)
            let v2 = new Vector2(item2.x, item2.y)

            let vm = mathutil.midPoint(v1, v2)
            xratio = vm.x
            yratio = vm.y
        }

        symbolProp[symbolId] = {
            initWidth: width,
            initHeight: height,
            symbolId,
            touchs: touchList.length,
            ...posObj,
            xratio,
            yratio,
            // 图元左上角的坐标，因为有空隙，需要存储
            xmin: minx,
            ymin: miny,
            w: initWidth,
            h: initHeight
        }

        sb.push('</connections>')
        sb.push('<background>')

        let { fillList, noFillList, useList } = this.fillDomFirst(childLs)

        sb.push(this.createDomListStr(fillList, scale, matrix.clone()))
        for (let useDom of useList) {
            // let relativeWidth = Math.min(width, height);
            // let relativeWidth = Math.min(w, h);
            let relativeWidth = 0.16 * scale
            let domstr = this.parseUseCircle(useDom, scale, matrix.clone(), relativeWidth)
            sb.push(domstr)
        }
        sb.push(this.createDomListStr(noFillList, scale, matrix.clone()))

        sb.push('</background>')
        sb.push('<foreground>')
        childLs = $symbol.children('text')
        childLs.each((index, dom) => {
            let nodeName = dom.nodeName
            let domstr = this.parseText(dom, scale, matrix.clone(), orign, w, h)
            if (domstr) {
                sb.push(domstr)
            }
        })
        sb.push('</foreground>')
        sb.push('</shape>')

        let str = sb.join('')

        let domParser = new DOMParser()
        let doc = domParser.parseFromString(str, 'application/xml')
        let dom = doc.children[0]
        return { id, dom, width, height, touchPoints, str }
    },

    // 单独处理terminal
    parseTerminal(symbol) {
        let symbolProp = this.symbolProp

        let $symbol = $(symbol)

        // 重新计算图元宽高
        let dimension = this.getSymbolDimension(symbol)
        let { width, height, minx, miny, maxx, maxy } = dimension
        symbol.setAttribute('width', width)
        symbol.setAttribute('height', height)

        let id = $symbol.attr('id')
        let scale = 100 / width // 以100为基准，把符号都放大到100

        // 获取变换矩阵，图元只有中心在原点，drawio图元以左上角为为起点
        let tranx = Math.abs(minx)
        let trany = Math.abs(miny)
        let matrix = this.getMatrix(scale, tranx, trany)

        let w = width * scale
        let h = height * scale

        let domParser = new DOMParser()

        let childLs = $symbol.children()
        let sb = []
        sb.push('<shape name="' + id + '" w="' + w + '" h="' + h + '" aspect="fixed">')
        let connection = 1
        let touchPoints = 1

        sb.push('<connections>')
        let symbolId = id.toLowerCase()
        sb.push('<constraint x="0.5" y="0.5" name="o" perimeter="0" />')
        symbolProp[symbolId] = {
            initWidth: 4,
            initHeight: 4,
            symbolId,
            touchs: 1,
            o: { x: 0.5, y: 0.5, flag: 'inner' },
            xratio: 0.5,
            yratio: 0.5,
            xmin: 0,
            ymin: 0
        }

        sb.push('</connections>')
        sb.push('<background>')
        let useDom = null
        let useDomList = []
        childLs.each((index, dom) => {
            let nodeName = dom.nodeName
            let domstr
            switch (nodeName) {
                case 'circle': // 这个只有连接点才有的处理方式
                    let relativeWidth = Math.min(w, h)
                    domstr = this.parseUseSymbol(dom, scale, matrix.clone())
                    sb.push(domstr)
                    break
                default:
                    console.log(nodeName, 'stencilParse：符号未处理...')
                    domstr = null
            }
            if (domstr) {
                sb.push(domstr)
            }
        })

        sb.push('</background>')
        sb.push('<foreground>')
        sb.push('</foreground>')
        sb.push('</shape>')

        let str = sb.join('')
        let doc = domParser.parseFromString(str, 'application/xml')
        let dom = doc.children[0]
        return { id, dom, width, height, touchPoints, str }
    },

    symbol2shape(symbolList) {
        let symbolProp = this.symbolProp
        let list = []
        let sb = []
        sb.push('<shapes>')
        let keyMap = {}

        symbolList.each((index, symbol) => {
            let name = symbol.getAttribute('id')

            let initWidth = symbol.getAttribute('width')
            let initHeight = symbol.getAttribute('height')

            // 自定义图元不处理
            if (customShapeLs.indexOf(name) != -1) {
                let symbolId = name.toLowerCase()


                symbolProp[symbolId] = {
                    initWidth,
                    initHeight,
                    symbolId,
                    touchs: 1,
                    o: { x: 0.5, y: 0.5, flag: 'inner' },
                    xratio: 0.5,
                    yratio: 0.5,
                    xmin: 0,
                    ymin: 0,
                    w: initWidth,
                    h: initHeight
                }
            } else {
                if (!keyMap[name]) {
                    keyMap[name] = true
                    let obj = null
                    if (name == 'terminal') {
                        obj = this.parseTerminal(symbol)
                    } else {
                        obj = this.parseSymbol(symbol)
                    }

                    if (obj) {
                        obj.w = initWidth;
                        obj.h = initHeight;
                        list.push(obj)
                        sb.push(obj.str)
                    }
                }
            }
        })
        sb.push('</shapes>')
        return sb.join('')
    }
}
export default StencilParse
