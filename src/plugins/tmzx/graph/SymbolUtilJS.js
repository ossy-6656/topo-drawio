import geometric from '@/plugins/tmzx/geometric.js'
import GridSymbol from '@/plugins/tmzx/graph/GridSymbol.js'
import mathutil from '@/plugins/tmzx/mathutil.js'

let SymbolUtilJS = {
    toNum(str) {
        return +str
    },
    /**
     * 验证触点是否在symbol内部
     * @param pos {x:, y:}
     * @returns {boolean}
     */
    isPointInSymbol(pos) {
        let { x, y } = pos
        let xbool = x >= 0.3 && x <= 0.7
        let ybool = y >= 0.3 && y <= 0.7
        return xbool && ybool
    },
    isLeftTouch(x, y) {
        // return x <= .3 && x >= 0;
        return x <= 0.3
    },
    isRightTouch(x, y) {
        // return x <= 1 && x >= .7;
        return x >= 0.7
    },
    isTopTouch(x, y) {
        // return y <= .3 && y >= 0;
        return y <= 0.3
    },
    isBottomTouch(x, y) {
        // return y <= 1 && y >= .7;
        return y >= 0.7
    },
    isCenterTouch(x, y) {
        return x > 0.3 && x < 0.7 && y > 0.3 && y <= 1
    },
    touchPosByRatio(x, y) {
        if (this.isLeftTouch(x, y)) {
            return 'a'
        } else if (this.isRightTouch(x, y)) {
            return 'b'
        } else if (this.isCenterTouch(x, y)) {
            return 'o'
        }
    },
    rectDimension(shape) {
        let startPoint = shape.startPoint
        let endPoint = shape.endPoint

        let x = startPoint[0]
        let y = startPoint[1]
        let width = Math.abs(endPoint.x - startPoint.x)
        let height = Math.abs(endPoint.y - startPoint.y)

        return {
            minx: x,
            miny: y,
            maxx: x + width,
            maxy: y + height
        }
    },

    lineDimension(shape) {
        let startPoint = shape.startPoint
        let endPoint = shape.endPoint

        let x1 = startPoint[0]
        let y1 = startPoint[1]

        let x2 = endPoint[0]
        let y2 = endPoint[1]

        let ls = [
            { x: x1, y: y1 },
            { x: x2, y: y2 }
        ]

        let xlist = ls.map((v) => v.x)
        let ylist = ls.map((v) => v.y)

        let minx = xlist.reduce((pre, cur) => cur < pre ? cur : pre, Number.MAX_VALUE)
        let miny = ylist.reduce((pre, cur) => cur < pre ? cur : pre, Number.MAX_VALUE)

        let maxx = xlist.reduce((pre, cur) => cur > pre ? cur : pre, Number.MIN_VALUE)
        let maxy = ylist.reduce((pre, cur) => cur > pre ? cur : pre, Number.MIN_VALUE)

        return { minx, miny, maxx, maxy}
    },

    polygonDimension(shape) {
        let points = shape.points

        let pointArr = []

        for (let i = 0; i < points.length; i++) {
            let arr = points[i]
            let x = arr[0]
            let y = arr[1]
            pointArr.push([x, y])
        }

        let bounds = geometric.polygonBounds(pointArr)
        let lb = bounds[0]
        let rt = bounds[1]
        return {
            minx: lb[0],
            miny: lb[1],
            maxx: rt[0],
            maxy: rt[1]
        }
    },

    ellipseDimension(dom) {
        let cx = this.toNum(dom.getAttribute('cx'))
        let cy = this.toNum(dom.getAttribute('cy'))
        let rx = this.toNum(dom.getAttribute('rx'))
        let ry = this.toNum(dom.getAttribute('ry'))

        let minx, miny, maxx, maxy
        minx = cx - rx
        maxx = cx + rx
        miny = cy - ry
        maxy = cy + ry

        return { minx, miny, maxx, maxy }
    },

    circleDimension(shape) {
        let centerPoint = shape.centerPoint

        let cx = centerPoint[0]
        let cy = centerPoint[1]
        let r = shape.radius

        let minx, miny, maxx, maxy
        minx = cx - r
        maxx = cx + r
        miny = cy - r
        maxy = cy + r

        return { minx, miny, maxx, maxy }
    },


    symbolDimension(list) {
        let xlist = []
        let ylist = []

        for (let item of list) {
            xlist.push(item.minx, item.maxx)
            ylist.push(item.miny, item.maxy)
        }

        let minx = xlist.reduce((pre, cur) => cur < pre ? cur : pre, Number.MAX_VALUE)
        let miny = ylist.reduce((pre, cur) => cur < pre ? cur : pre, Number.MAX_VALUE)

        let maxx = xlist.reduce((pre, cur) => cur > pre ? cur : pre, Number.MIN_VALUE)
        let maxy = ylist.reduce((pre, cur) => cur > pre ? cur : pre, Number.MIN_VALUE)

        return { minx, miny, maxx, maxy}
    },

    /**
     * 计算图元属性信息
     * @param symbol
     * @param flag     ty、lg
     * @returns {GridSymbol}
     */
    getSymbolProps(symbol, flag) {
        let symbolObj = new GridSymbol()
        let id = symbol.id
        if (id == 'terminal') {
            // 只有这个特殊
            let circle = symbol.shapes[0]
            let r = circle.radius
            let width = r * 2

            symbolObj.touchList = [
                {
                    touch: 'o',
                    x: 0.5,
                    y: 0.5
                }
            ]
            symbolObj.dom = symbol
            symbolObj.initWidth = width
            symbolObj.initHeight = width
        } else {
            let shapes = symbol.shapes
            let list = []

            let useLs = []
            for (let shape of shapes) {
                let nodeName = shape.type.toLowerCase()
                switch (nodeName) {
                    case 'rectangle':
                        list.push(this.rectDimension(shape))
                        break
                    case 'line':
                        list.push(this.lineDimension(shape))
                        break
                    case 'polygon':
                        list.push(this.polygonDimension(shape))
                        break
                    case 'ellipse':
                        list.push(this.ellipseDimension(shape))
                        break
                    case 'circle':
                        list.push(this.circleDimension(shape))
                        break
                    case 'use':
                        useLs.push(shape)
                        break
                    default:
                        console.log('Unknown symbol ->' + nodeName)
                }
            }
            // 计算图元坐标范围
            let { minx, miny, maxx, maxy } = this.symbolDimension(list)
            let width = maxx - minx
            let height = maxy - miny

            // 计算连接点位置

            let touchList = []
            let touchPosList = [] // 用于力光计算中心点

            for (let shape of useLs) {
                let coor = shape.centerPoint
                let vec = new Vector2(coor[0], coor[1])
                touchPosList.push(vec)

                // 这里是连接点比率
                let ratio_x = (vec.x - minx) / width
                let ratio_y = (vec.y - miny) / height

                let touch = this.touchPosByRatio(ratio_x, ratio_y)
                touchList.push({
                    touch,
                    x: ratio_x,
                    y: ratio_y
                })
            }

            symbolObj.id = id
            symbolObj.initWidth = width
            symbolObj.initHeight = height

            if (touchList.length == 0) {
                // 处理一些没有use节点的symbol
                touchList = [{ x: 0.5, y: 0.5 }]
                touchPosList = [new Vector2((minx + maxx) / 2, (miny + maxy) / 2)]
            }

            // 计算中心点比率
            if (flag == 'ty') {
                symbolObj.xratio = Math.abs(minx) / width
                symbolObj.yratio = Math.abs(miny) / height
            } else {
                if (touchList.length == 1) {
                    let item = touchList[0]
                    // xratio = 0.5
                    // yratio = item.y; // 目前遇到的单连接点图元，中心

                    symbolObj.xratio = 0.5
                    symbolObj.yratio = item.y
                } else if (touchList.length == 2) {
                    let p1 = touchPosList[0]
                    let p2 = touchPosList[1]

                    let co = mathutil.midPoint(p1, p2)
                    symbolObj.xratio = (co.x - minx) / width
                    symbolObj.yratio = (co.y - miny) / height
                } else {
                    let p1 = touchPosList[0]
                    let p2 = touchPosList[2]

                    let co = mathutil.midPoint(p1, p2)
                    symbolObj.xratio = (co.x - minx) / width
                    symbolObj.yratio = (co.y - miny) / height
                }
            }

            symbolObj.touchList = touchList
            symbolObj.dom = symbol
            symbolObj.xmin = minx
            symbolObj.ymin = miny
        }

        return symbolObj
    }
}
export default SymbolUtilJS
