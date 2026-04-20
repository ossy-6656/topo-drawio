import geometric from '@/plugins/tmzx/geometric.js'
import GridSymbol from '@/plugins/tmzx/graph/GridSymbol.js'
import mathutil from '@/plugins/tmzx/mathutil.js'

let SymbolUtil = {
  toNum(str) {
    return parseFloat(str)
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
  rectDimension(dom) {
    let x = this.toNum(dom.getAttribute('x'))
    let y = this.toNum(dom.getAttribute('y'))
    let width = this.toNum(dom.getAttribute('width'))
    let height = this.toNum(dom.getAttribute('height'))

    return {
      minx: x,
      miny: y,
      maxx: x + width,
      maxy: y + height
    }
  },
  lineDimension(dom) {
    let x1 = this.toNum(dom.getAttribute('x1'))
    let y1 = this.toNum(dom.getAttribute('y1'))
    let x2 = this.toNum(dom.getAttribute('x2'))
    let y2 = this.toNum(dom.getAttribute('y2'))

    let ls = [
      { x: x1, y: y1 },
      { x: x2, y: y2 }
    ]

    let xlist = ls.map((v) => v.x)
    let ylist = ls.map((v) => v.y)

    return {
      minx: d3.min(xlist),
      miny: d3.min(ylist),
      maxx: d3.max(xlist),
      maxy: d3.max(ylist)
    }
  },
  polygonDimension(dom) {
    let points = dom.getAttribute('points').trim()

    let pointArr = []
    let pstrarr = points.split(' ')

    for (let i = 0; i < pstrarr.length; i++) {
      let arr = pstrarr[i].split(',')
      let x = this.toNum(arr[0])
      let y = this.toNum(arr[1])
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
  circleDimension(dom) {
    let cx = this.toNum(dom.getAttribute('cx'))
    let cy = this.toNum(dom.getAttribute('cy'))
    let r = this.toNum(dom.getAttribute('r'))

    let minx, miny, maxx, maxy
    minx = cx - r
    maxx = cx + r
    miny = cy - r
    maxy = cy + r

    return { minx, miny, maxx, maxy }
  },

  // 获取连接点坐标
  usePostion(dom) {
    let x = this.toNum(dom.getAttribute('x'))
    let y = this.toNum(dom.getAttribute('y'))
    return new Vector2(x, y)
  },
  symbolDimension(list) {
    let xlist = []
    let ylist = []

    for (let item of list) {
      xlist.push(item.minx, item.maxx)
      ylist.push(item.miny, item.maxy)
    }

    let ext_x = d3.extent(xlist)
    let ext_y = d3.extent(ylist)

    return {
      minx: ext_x[0],
      miny: ext_y[0],
      maxx: ext_x[1],
      maxy: ext_y[1]
    }
  },
  /**
   * 计算连接点在图元中的相对位置
   * @param pos
   * @param dimension
   * @returns {Vector2}
   */
  useRelativePostion(pos, dimension) {
    let { x, y } = pos
    let { minx, miny, maxx, maxy } = dimension
    let width = maxx - minx
    let height = maxy - miny
    let xratio = Math.abs(x - minx) / width
    let yratio = Math.abs(y - miny) / height
    return new Vector2(+xratio.toFixed(2), +yratio.toFixed(2))
  },
  /**
   * 计算连接点位置
   * @param list
   */
  touchPosition(list) {
    let obj = {}
    for (let item of list) {
      let { x, y } = item
      if (this.isPointInSymbol(item)) {
        // 图元内部
        obj.o = { x, y, flag: 'inner' }
      } else if (x < 0.3) {
        // 图元左侧
        obj.a = { x, y, flag: 'edge' }
      } else if (x > 0.7) {
        // 图元右侧
        obj.b = { x, y, flag: 'edge' }
      } else if (y < 0.3) {
        // 图元上侧
        obj.c = { x, y, flag: 'edge' }
      } else {
        obj.d = { x, y, flag: 'edge' }
      }
    }
    return obj
  },
    // 连接点坐标
    touchCor(dom) {
        let x = +dom.getAttribute('x');
        let y = +dom.getAttribute('y');
        return new Vector2(x, y);
    },
    /**
     * 计算图元属性信息
     * @param symbol
     * @param flag     ty、lg
     * @returns {GridSymbol}
     */
    getSymbolProps(symbol, flag) {
        let symbolObj = new GridSymbol();
        let id = symbol.getAttribute('id');
        if (id == 'terminal') // 只有这个特殊
        {
            let circleDom = symbol.children[0];
            let r = +circleDom.getAttribute('r');
            let width = r * 2;
            symbolObj.touchList = [{
                touch: 'o',
                x: .5,
                y: .5
            }];
            symbolObj.dom = symbol;
            symbolObj.initWidth = width;
            symbolObj.initHeight = width;
        }
        else
        {
            let childLs = symbol.children;
            let list = [];
            for (let item of childLs) {
                let nodeName = item.nodeName.toLowerCase();
                switch (nodeName) {
                    case 'rect':
                        list.push(this.rectDimension(item))
                        break;
                    case 'line':
                        list.push(this.lineDimension(item))
                        break;
                    case 'polygon':
                        list.push(this.polygonDimension(item))
                        break;
                    case 'ellipse':
                        list.push(this.ellipseDimension(item))
                        break;
                    case 'circle':
                        list.push(this.circleDimension(item))
                        break;
                    default:
                        console.log('Unknown symbol ->' + nodeName);
                }
            }
            // 计算图元坐标范围
            let {minx, miny, maxx, maxy} = this.symbolDimension(list);
            let width = maxx - minx;
            let height = maxy - miny;

            // 计算连接点位置
            let useLs = symbol.getElementsByTagName('use');


            let touchList = [];
            let touchPosList = []; // 用于力光计算中心点


            for (let useNode of useLs) {
                let vec = this.touchCor(useNode);
                touchPosList.push(vec)

                // 这里是连接点比率
                let ratio_x = (vec.x - minx) / width;
                let ratio_y = (vec.y - miny) / height;

                let touch = this.touchPosByRatio(ratio_x, ratio_y);
                touchList.push({
                    touch,
                    x: ratio_x,
                    y: ratio_y
                });
            }

            symbolObj.id = id;
            symbolObj.initWidth = width;
            symbolObj.initHeight = height;

            if (touchList.length == 0) {
                touchList = [{ x: 0.5, y: 0.5 }]
                touchPosList = [new Vector2((minx + maxx) / 2, (miny + maxy) / 2)]
            }

            // 计算中心点比率
            if (flag == 'ty') {
                symbolObj.xratio = Math.abs(minx) / width;
                symbolObj.yratio = Math.abs(miny) / height;
            } else {
                if (touchList.length == 1) {
                    let item = touchList[0];
                    // xratio = 0.5
                    // yratio = item.y; // 目前遇到的单连接点图元，中心

                    symbolObj.xratio = .5;
                    symbolObj.yratio = item.y;
                } else {
                    let p1 = touchPosList[0];
                    let p2 = touchPosList[1];

                    let co = mathutil.midPoint(p1, p2);
                    symbolObj.xratio = (co.x - minx) / width;
                    symbolObj.yratio = (co.y - miny) / height;
                }

            }

            symbolObj.touchList = touchList;
            symbolObj.dom = symbol;
            symbolObj.xmin = minx;
            symbolObj.ymin = miny;
        }

        return symbolObj;
    },
}
export default SymbolUtil
