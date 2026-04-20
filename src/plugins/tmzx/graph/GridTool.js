import geometric from '@/plugins/tmzx/geometric.js'
import mathutil from '@/plugins/tmzx/mathutil.js'


export default class GridTool {
    constructor() {
        this.gridSet = new Set()
    }

    setGridSize(size) {
        this.gridSize = size
    }

    setOrigin(originX, originY) {
        this.originX = originX
        this.originY = originY
    }

    init(gridSize, originX, originY, ) {
        this.gridSize = gridSize
        this.originX = originX
        this.originY = originY
        this.gridSet.clear();
    }



    isIntersec(poly1, poly2) {
        if (geometric.polygonIntersectsPolygon(poly1, poly2) || geometric.polygonInPolygon(poly1, poly2)) {
            return true;
        }
        return false;
    }

    /**
     * 根据像素坐标计算单元格坐标（grid右下角坐标）
     *
     * @param pixelX     grid x坐标
     * @param pixelY     grid y坐标
     * @returns {{x: number, y: number}}  grid坐标
     */
    getGridCoorByPixelCoor(pixelX, pixelY) {
        let { originX, originY, gridSize } = this

        let width = pixelX - originX
        let height = pixelY - originY

        if (width == 0) {
            width = width + 0.01;
        }

        if (height == 0) {
            height = height + 0.01;
        }

        let stepX = Math.ceil(Math.abs(width / gridSize))
        let stepY = Math.ceil(Math.abs(height / gridSize))

        return {
            x: width < 0 ? -stepX : stepX,
            y: height < 0 ? -stepY : stepY
        }
    }

    /**
     * 根据grid坐标求像素坐标
     * @param gridX >= 1
     * @param gridY >= 1
     * @returns {{x: number, y: number}}  grid 正方形右下角坐标
     */
    getPixelCoorByGridCoor(gridX, gridY) {
        let gridSize = this.gridSize
        let originX = this.originX
        let originY = this.originY

        let lenX = gridX * gridSize
        let lenY = gridY * gridSize

        let x = originX + lenX
        let y = originY + lenY

        return { x, y }
    }

    /**
     * 根据grid坐标获取grid构成的polygon坐标
     * @param gridObj
     * @returns {number[][]}
     */
    getGridPolygon(gridObj) {
        let gridSize = this.gridSize

        // grid右下角坐标
        let cor = this.getPixelCoorByGridCoor(gridObj.x, gridObj.y);

        let tmpPolygon = [
            [cor.x - gridSize, cor.y - gridSize], // 左上
            [cor.x,            cor.y - gridSize], // 右上
            [cor.x,            cor.y],            // 右下
            [cor.x - gridSize, cor.y],            // 左下
        ]

        return tmpPolygon;
    }

    /**
     * 根据像素坐标获取当前像素所在的grid占用的polygon
     * @param pixelX    x屏幕坐标
     * @param pixelY    y屏幕坐标
     * @returns {number[][]}
     */
    getGridPolygonByPixelCoor(pixelX, pixelY) {
        let gridObj = this.getGridCoorByPixelCoor(pixelX, pixelY)
        return this.getGridPolygon(gridObj.x, gridObj.y);
    }

    /**
     * 检查多边形区域内grid是否被占用
     * @param curSet
     * @param excludeSet     要排除的grid
     * @returns {boolean}
     */
    checkGridOfPolygonInnerOccupy(curSet, excludeSet) {
        let gridSet = this.gridSet

        let isFindOccupied = false;

        for(let str of curSet) {
            if (gridSet.has(str) && !excludeSet.has(str)) {
                isFindOccupied = true;
                break;
            }
        }

        return isFindOccupied ? false : true;
    }

    /**
     * 获取polygon占据的grid set
     * @param polygon
     * @returns {Set<any>}
     */
    getGridSetOfPolygon(polygon) {
        let sets = new Set;
        let gridSize = this.gridSize;

        let arr = [];
        for(let a of polygon) {
            arr.push(new Vector2(a[0], a[1]));
        }
        let bounds = mathutil.vecListBounds(arr)

        let xmin = bounds.xmin
        let ymin = bounds.ymin
        let xmax = bounds.xmax
        let ymax = bounds.ymax

        // 计算最小单元格与最大单元格坐标
        let minGridCoor = this.getGridCoorByPixelCoor(xmin, ymin)
        let maxGridCoor = this.getGridCoorByPixelCoor(xmax, ymax)


        for (let i = minGridCoor.x; i <= maxGridCoor.x; i++) {
            for (let j = minGridCoor.y; j <= maxGridCoor.y; j++) {
                let gridPolygon = this.getGridPolygon({x: i, y: j});
                if (geometric.polygonIntersectsPolygon(polygon, gridPolygon) || geometric.polygonInPolygon(gridPolygon, polygon)) {
                    sets.add(i +',' + j);
                }
            }
        }

        return sets;
    }

    /**
     * 设置线占用grid的位置
     * @param list
     */
    setGridOccupiedByLine(list) {
        let gridSet = this.gridSet
        let gridSize = this.gridSize;

        let step = gridSize / 4;

        let checkOccupiedFun = (p1, p2) => {
            let startLen = 0;
            let vec = p2.clone().sub(p1);
            let len = vec.length();
            let norVec = vec.normalize();
            let vecStart = p1.clone();

            while (startLen <= len) {
                let tmpVec = vecStart.clone().add(norVec.clone().multiplyScalar(startLen));
                let gridCoor = this.getGridCoorByPixelCoor(tmpVec.x, tmpVec.y);
                gridSet.add(gridCoor.x + ',' + gridCoor.y);
                startLen = startLen + step;
            }
        }

        for(let i = 0; i < list.length - 1; i++) {
            let p1 = list[i];
            let p2 = list[i+1];
            checkOccupiedFun(p1, p2);
        }
        return gridSet;
    }

    /**
     * 根据多边形计算grid占用情况，并返回占用的grid list
     * @param polygon
     * @returns {Set<*>}
     */
    setGridOccupiedByPolygon(polygon) {
        let gridSet = this.gridSet

        let set = this.getGridSetOfPolygon(polygon);

        for(let gridStr of set) {
            gridSet.add(gridStr);
        }

        return set;
    }

    /**
     * 1、向上查找是否有文本空间
     * @param excludeSet    cell自身的grid，要排除
     * @param polygon       cell的范围
     * @param angle         cell的角度，非真实角度
     * @param tran          cell平移向量
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     * @returns {boolean}
     */
    findEmptySpaceUp(excludeSet, polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let topLen = height_cell / 2 + step;

        // 向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = -topLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                topLen = topLen + step;
            } else {
                break;
            }
        }

        // 以第一个不相交的坐标为起始，扩展一个与文本面积一样大小的空间，并计算是否都没有被占用

        let lt = new Vector2(-width_txt / 2, -(topLen + height_txt)) // 左上
        let rt = new Vector2(width_txt / 2, -(topLen + height_txt)) // 右上
        let rb = new Vector2(width_txt / 2, -topLen)         // 右下
        let lb = new Vector2(-width_txt / 2, -topLen) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];
        // let isEmpty = this.checkGridOfPolygonInnerOccupy(poly);
        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }
    findVEmptySpaceUp(excludeSet, polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let m = mathutil.commonMatrix(tran, 0, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let topLen = width_cell / 2 + step;

        // 向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = -topLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                topLen = topLen + step;
            } else {
                break;
            }
        }

        // 以第一个不相交的坐标为起始，扩展一个与文本面积一样大小的空间，并计算是否都没有被占用

        let lt = new Vector2(-width_txt / 2, -(topLen + height_txt)) // 左上
        let rt = new Vector2(width_txt / 2, -(topLen + height_txt)) // 右上
        let rb = new Vector2(width_txt / 2, -topLen)         // 右下
        let lb = new Vector2(-width_txt / 2, -topLen) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];
        // let isEmpty = this.checkGridOfPolygonInnerOccupy(poly);
        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }

    /**
     * 2、向右查找是否有文本空间
     * @param excludeSet
     * @param polygon
     * @param angle
     * @param tran
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     * @returns {boolean}
     */
    findEmptySpaceRight(excludeSet, polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        let rightLen = width_cell / 2 + step;

        // 查找右边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = rightLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                rightLen = rightLen + step;
            } else {
                break;
            }
        }

        // 开辟出文本空间大小并验证是否被占用
        let lt = new Vector2(rightLen, -(height_txt / 2)) // 左上
        let rt = new Vector2(rightLen + width_txt, -(height_txt / 2)) // 右上
        let rb = new Vector2(rightLen + width_txt, height_txt / 2)         // 右下
        let lb = new Vector2(rightLen, height_txt / 2) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];
        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }
    findVEmptySpaceRight(excludeSet, polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let m = mathutil.commonMatrix(tran, 0, null)

        let rightLen = height_cell / 2 + step;

        // 查找右边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = rightLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                rightLen = rightLen + step;
            } else {
                break;
            }
        }

        // 开辟出文本空间大小并验证是否被占用
        let lt = new Vector2(rightLen, -(height_txt / 2)) // 左上
        let rt = new Vector2(rightLen + width_txt, -(height_txt / 2)) // 右上
        let rb = new Vector2(rightLen + width_txt, height_txt / 2)         // 右下
        let lb = new Vector2(rightLen, height_txt / 2) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];
        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }
    /**
     * 3、向下查找是否有文本空间
     * @param excludeSet
     * @param polygon
     * @param angle
     * @param tran
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     * @returns {boolean}
     */
    findEmptySpaceDown(excludeSet, polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        let bottomLen = height_cell / 2 + step;

        // 查找下边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = bottomLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                bottomLen = bottomLen + step;
            } else {
                break;
            }
        }

        // 以第一个不相交坐标开辟出文本空间大小并验证是否被占用
        let lt = new Vector2(-width_txt / 2, bottomLen) // 左上
        let rt = new Vector2(width_txt / 2, bottomLen) // 右上
        let rb = new Vector2(width_txt / 2, bottomLen + height_txt)         // 右下
        let lb = new Vector2(-width_txt / 2, bottomLen + height_txt) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];
        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }
    findVEmptySpaceDown(excludeSet, polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let m = mathutil.commonMatrix(tran, 0, null)

        let bottomLen = width_cell / 2 + step;

        // 查找下边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = bottomLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                bottomLen = bottomLen + step;
            } else {
                break;
            }
        }

        // 以第一个不相交坐标开辟出文本空间大小并验证是否被占用
        let lt = new Vector2(-width_txt / 2, bottomLen) // 左上
        let rt = new Vector2(width_txt / 2, bottomLen) // 右上
        let rb = new Vector2(width_txt / 2, bottomLen + height_txt)         // 右下
        let lb = new Vector2(-width_txt / 2, bottomLen + height_txt) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];
        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }
    /**
     * 4、向左查找是否有文本空间
     * @param excludeSet
     * @param polygon
     * @param angle
     * @param tran
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     * @returns {boolean}
     */
    findEmptySpaceLeft(excludeSet, polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)


        let leftLen = width_cell / 2 + step;

        // 查找左边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = -leftLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                leftLen = leftLen + step;
            } else {
                break;
            }
        }

        // 以第一个不相交坐标开辟出文本空间大小并验证是否被占用
        let lt = new Vector2(-(leftLen + width_txt), -(height_txt / 2)) // 左上
        let rt = new Vector2(-leftLen, -(height_txt / 2)) // 右上
        let rb = new Vector2(-leftLen, height_txt / 2)         // 右下
        let lb = new Vector2(-(leftLen + width_txt), height_txt / 2) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];

        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }
    findVEmptySpaceLeft(excludeSet, polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let m = mathutil.commonMatrix(tran, 0, null)


        let leftLen = height_cell / 2 + step;

        // 查找左边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = -leftLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                leftLen = leftLen + step;
            } else {
                break;
            }
        }

        // 以第一个不相交坐标开辟出文本空间大小并验证是否被占用
        let lt = new Vector2(-(leftLen + width_txt), -(height_txt / 2)) // 左上
        let rt = new Vector2(-leftLen, -(height_txt / 2)) // 右上
        let rb = new Vector2(-leftLen, height_txt / 2)         // 右下
        let lb = new Vector2(-(leftLen + width_txt), height_txt / 2) // 左下

        let lt_vec = lt.clone().applyMatrix3(m);
        let rt_vec = rt.clone().applyMatrix3(m);
        let rb_vec = rb.clone().applyMatrix3(m);
        let lb_vec = lb.clone().applyMatrix3(m);

        let poly = [[lt_vec.x, lt_vec.y], [rt_vec.x, rt_vec.y], [rb_vec.x, rb_vec.y], [lb_vec.x, lb_vec.y]];

        let cursets = this.getGridSetOfPolygon(poly);
        let isEmpty = this.checkGridOfPolygonInnerOccupy(cursets, excludeSet);

        return isEmpty ? true : false;
    }
    /**
     * 一、检查上下左右是否有空余位置
     * @param angle
     * @param tran
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     */
    findEmptySpaceOfText(excludeSet, cellPolygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {

        let set = new Set();

        // 1、查找设备上方空间
        let isFind = this.findEmptySpaceUp(excludeSet, cellPolygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('T');
        }

        // 2、查找设备右侧空间
        isFind = this.findEmptySpaceRight(excludeSet, cellPolygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('R');
        }

        // 3、查找设备下方空间
        isFind = this.findEmptySpaceDown(excludeSet, cellPolygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('B');
        }

        // 4、查找设备上方空间
        isFind = this.findEmptySpaceLeft(excludeSet, cellPolygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('L');
        }

        return set;
    }

    // 垂直设备空间查找
    findVEmptySpaceOfText(excludeSet, cellPolygon, tran, width_txt, height_txt, width_cell, height_cell) {

        let set = new Set();

        // 1、查找设备上方空间
        let isFind = this.findVEmptySpaceUp(excludeSet, cellPolygon, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('T');
        }

        // 2、查找设备右侧空间
        isFind = this.findVEmptySpaceRight(excludeSet, cellPolygon, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('R');
        }

        // 3、查找设备下方空间
        isFind = this.findVEmptySpaceDown(excludeSet, cellPolygon, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('B');
        }

        // 4、查找设备上方空间
        isFind = this.findVEmptySpaceLeft(excludeSet, cellPolygon, tran, width_txt, height_txt, width_cell, height_cell);
        if (isFind) {
            set.add('L');
        }

        return set;
    }
    /**
     * 1、向上查找最大空间
     * @param polygon
     * @param angle
     * @param tran
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     * @returns {Set<any>}
     */
    findMaxSizeSpaceUp(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let topLen = height_cell / 2 + step;


        let curSet = new Set();

        // 1、向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = -topLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                topLen = topLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;


        while(stepSum <= height_txt) {

            let counter = 0;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向右查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }


            if (counter == 0)
            {
                break;
            }

            topLen = topLen + step;
            stepSum = stepSum + step;
        }

        return curSet;
    }
    findVMaxSizeSpaceUp(polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let m = mathutil.commonMatrix(tran, 0, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let topLen = width_cell / 2 + step;


        let curSet = new Set();

        // 1、向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = -topLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                topLen = topLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;


        while(stepSum <= height_txt) {

            let counter = 0;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向右查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }


            if (counter == 0)
            {
                break;
            }

            topLen = topLen + step;
            stepSum = stepSum + step;
        }

        return curSet;
    }

    /**
     * 身上查找最大矩形空间
     * @param excludeSet
     * @param polygon
     * @param angle
     * @param tran
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     * @returns {{width: number, height: number}}
     */
    findMaxRectSpaceUp_Middle(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let topLen = height_cell / 2 + step;


        let curSet = new Set();

        // 1、向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找

        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;

            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);


                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = -topLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                topLen = topLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;

        // 以最大长度查找空间
        let maxLen = Math.max(...[width_txt, height_txt, width_cell, height_cell]);

        let preMinLen;
        let maxArea = null;

        let width_space = 0, height_space = 0;
        while(stepSum <= maxLen) {
            let counter = 0;
            let leftLen = -1; // 左侧最长距离
            let rightLen = -1; // 右侧最长距离

            // 向左查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = -i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;

                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                leftLen = i;
                counter++
                curSet.add(flag);
            }

            // 向右查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = i;
                let y1 = -topLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                rightLen = i;
                counter++
                curSet.add(flag);
            }

            if (counter == 0) // 如果空间全被占用，退出循环
            {
                break;
            }
            else
            {
                let minLen_tmp;
                if (leftLen != -1 && rightLen != -1) {
                    minLen_tmp = Math.min(leftLen, rightLen);
                }
                else // 空间残缺
                {
                    break;
                }

                if (!preMinLen) // 初次赋值
                {
                    preMinLen = minLen_tmp;
                }
                else if (minLen_tmp < preMinLen) // 寻找最小空间
                {
                    preMinLen = minLen_tmp;
                }

                let width = preMinLen * 2;
                let height = stepSum;

                let area = width * height;

                if (!maxArea) {
                    maxArea = area;
                } else if (area > maxArea) {
                    maxArea = area;
                    width_space = width;
                    height_space = height;
                }

                topLen = topLen + step;
                stepSum = stepSum + step;
            }
        }

        return {width: width_space, height: height_space};
    }

    findMaxSizeSpaceRight(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 2;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let rightLen = width_cell / 2 + step;

        let curSet = new Set();

        // 1、查找右边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = rightLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                rightLen = rightLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;
        while(stepSum < width_txt) {
            let counter = 0;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向下查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            if (counter == 0)
            {
                break;
            }

            rightLen = rightLen + step;
            stepSum = stepSum + step;
        }
        return curSet;
    }
    findVMaxSizeSpaceRight(polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 2;

        let m = mathutil.commonMatrix(tran, 0, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let rightLen = height_cell / 2 + step;

        let curSet = new Set();

        // 1、查找右边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = rightLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                rightLen = rightLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;
        while(stepSum < width_txt) {
            let counter = 0;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向下查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            if (counter == 0)
            {
                break;
            }

            rightLen = rightLen + step;
            stepSum = stepSum + step;
        }
        return curSet;
    }
    findMaxRectSpaceUp_Right(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向右，再向上，再向下
        let rightLen = width_cell / 2 + step;


        let curSet = new Set();

        // 1、向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;

            // 向上查找
            for(let i = step; i <= height_cell / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_cell / 2; i = i + step) {
                    let x1 = rightLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }

            if (isFindIntersectSelf) {
                rightLen = rightLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;

        // 以最大长度查找空间
        let maxLen = Math.max(...[width_txt, height_txt, width_cell, height_cell]);

        let preMinLen;
        let maxArea = null;

        let width_space = 0, height_space = 0;
        while(stepSum <= maxLen) {
            let counter = 0;
            let topLen = -1; // 上方最长距离
            let bottomLen = -1; // 下方最长距离

            // 向上查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;

                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                topLen = i;
                counter++
                curSet.add(flag);
            }

            // 向下查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = rightLen;
                let y1 = i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                bottomLen = i;
                counter++
                curSet.add(flag);
            }

            if (counter == 0) // 如果空间全被占用，退出循环
            {
                break;
            }
            else
            {
                let minLen_tmp;
                if (topLen != -1 && bottomLen != -1) {
                    minLen_tmp = Math.min(topLen, bottomLen);
                }
                else // 空间残缺
                {
                    break;
                }

                if (!preMinLen) // 初次赋值
                {
                    preMinLen = minLen_tmp;
                }
                else if (minLen_tmp < preMinLen) // 寻找最小空间
                {
                    preMinLen = minLen_tmp;
                }

                let width = stepSum;
                let height = preMinLen * 2;

                let area = width * height;

                if (!maxArea) {
                    maxArea = area;
                } else if (area > maxArea) {
                    maxArea = area;
                    width_space = width;
                    height_space = height;
                }

                topLen = topLen + step;
                stepSum = stepSum + step;
            }
        }

        return {width: width_space, height: height_space};
    }

    findMaxSizeSpaceDown(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 2;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let bottomLen = height_cell / 2 + step;

        let curSet = new Set();

        // 1、查找下边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = bottomLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                bottomLen = bottomLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;
        while(stepSum < height_txt) {
            let counter = 0;

            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向右查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            if (counter == 0)
            {
                break;
            }

            bottomLen = bottomLen + step;
            stepSum = stepSum + step;
        }

        return curSet;
    }
    findVMaxSizeSpaceDown(polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 2;

        let m = mathutil.commonMatrix(tran, 0, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let bottomLen = width_cell / 2 + step;

        let curSet = new Set();

        // 1、查找下边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = bottomLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                bottomLen = bottomLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;
        while(stepSum < height_txt) {
            let counter = 0;

            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向右查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            if (counter == 0)
            {
                break;
            }

            bottomLen = bottomLen + step;
            stepSum = stepSum + step;
        }

        return curSet;
    }
    findMaxRectSpaceDown_Middle(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let bottomLen = height_cell / 2 + step;


        let curSet = new Set();

        // 1、向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找

        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;

            // 向左查找
            for(let i = step; i <= width_txt / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);


                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向右查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= width_txt / 2; i = i + step) {
                    let x1 = i;
                    let y1 = bottomLen;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }

            if (isFindIntersectSelf) {
                bottomLen = bottomLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;

        // 以最大长度查找空间
        let maxLen = Math.max(...[width_txt, height_txt, width_cell, height_cell]);

        let preMinLen;
        let maxArea = null;

        let width_space = 0, height_space = 0;
        while(stepSum <= maxLen) {
            let counter = 0;
            let leftLen = -1; // 左侧最长距离
            let rightLen = -1; // 右侧最长距离

            // 向左查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = -i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;

                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }

                leftLen = i;
                counter++
                curSet.add(flag);
            }

            // 向右查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = i;
                let y1 = bottomLen;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                rightLen = i;
                counter++
                curSet.add(flag);
            }

            if (counter == 0) // 如果空间全被占用，退出循环
            {
                break;
            }
            else
            {
                let minLen_tmp;
                if (leftLen != -1 && rightLen != -1) {
                    minLen_tmp = Math.min(leftLen, rightLen);
                }
                else // 空间残缺
                {
                    break;
                }

                if (!preMinLen) // 初次赋值
                {
                    preMinLen = minLen_tmp;
                }
                else if (minLen_tmp < preMinLen) // 寻找最小空间
                {
                    preMinLen = minLen_tmp;
                }

                let width = preMinLen * 2;
                let height = stepSum;

                let area = width * height;

                if (!maxArea) {
                    maxArea = area;
                } else if (area > maxArea) {
                    maxArea = area;
                    width_space = width;
                    height_space = height;
                }

                bottomLen = bottomLen + step;
                stepSum = stepSum + step;
            }
        }

        return {width: width_space, height: height_space};
    }

    findMaxSizeSpaceLeft(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 2;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let leftLen = width_cell / 2 + step;

        let curSet = new Set();

        // 1、查找左边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = -leftLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                leftLen = leftLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;
        while(stepSum <= width_txt) {
            let counter = 0;

            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向下查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            if (counter == 0)
            {
                break;
            }

            leftLen = leftLen + step;
            stepSum = stepSum + step;
        }

        return curSet;
    }
    findVMaxSizeSpaceLeft(polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 2;

        let m = mathutil.commonMatrix(tran, 0, null)

        // 如果方块与自个相交，不算
        // 先向上，再向左，再向右
        let leftLen = height_cell / 2 + step;

        let curSet = new Set();

        // 1、查找左边第一个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;
            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_txt / 2; i = i + step) {
                    let x1 = -leftLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }
            if (isFindIntersectSelf) {
                leftLen = leftLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;
        while(stepSum <= width_txt) {
            let counter = 0;

            // 向上查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            // 向下查找
            for(let i = step; i <= height_txt / 2; i = i + step) {
                let x1 = -leftLen;
                let y1 = i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                counter++
                curSet.add(flag);
            }

            if (counter == 0)
            {
                break;
            }

            leftLen = leftLen + step;
            stepSum = stepSum + step;
        }


        return curSet;
    }
    findMaxRectSpaceUp_Left(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSet = this.gridSet;
        let gridSize = this.gridSize;
        let step = gridSize / 3;

        let rad = mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(tran, -rad, null)

        // 如果方块与自个相交，不算
        // 先向右，再向上，再向下
        let leftLen = width_cell / 2 + step;

        let curSet = new Set();

        // 1、向上查找首个不与自身相交的坐标
        let isIntersectSelf = true; // 假设topLen位置与自个相交，然后扩展查找
        while(isIntersectSelf) {
            let p1, p2, gridObj, poly;

            let isFindIntersectSelf = false;

            // 向上查找
            for(let i = step; i <= height_cell / 2; i = i + step) {
                let x1 = leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                poly = this.getGridPolygon(gridObj);

                // 如果与原设备相交退出
                if (this.isIntersec(polygon, poly))
                {
                    isFindIntersectSelf = true;
                    break;
                }
            }

            // 向下查找
            if (!isFindIntersectSelf) {
                for(let i = step; i <= height_cell / 2; i = i + step) {
                    let x1 = leftLen;
                    let y1 = i;

                    p1 = new Vector2(x1, y1);
                    p2 = p1.clone().applyMatrix3(m);
                    gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                    poly = this.getGridPolygon(gridObj);

                    if (this.isIntersec(polygon, poly)) {
                        isFindIntersectSelf = true;
                        break;
                    }
                }
            }

            if (isFindIntersectSelf) {
                leftLen = leftLen + step;
            } else {
                break;
            }
        }

        // 2、空间查找
        let stepSum = step;
        let p1, p2, gridObj;

        // 以最大长度查找空间
        let maxLen = Math.max(...[width_txt, height_txt, width_cell, height_cell]);

        let preMinLen;
        let maxArea = null;

        let width_space = 0, height_space = 0;
        while(stepSum <= maxLen) {
            let counter = 0;
            let topLen = -1; // 上方最长距离
            let bottomLen = -1; // 下方最长距离

            // 向上查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = leftLen;
                let y1 = -i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;

                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                topLen = i;
                counter++
                curSet.add(flag);
            }

            // 向下查找
            for(let i = step; i <= maxLen / 2; i = i + step) {
                let x1 = leftLen;
                let y1 = i;

                p1 = new Vector2(x1, y1);
                p2 = p1.clone().applyMatrix3(m);
                gridObj = this.getGridCoorByPixelCoor(p2.x, p2.y);
                let flag = gridObj.x + ',' + gridObj.y;
                if (gridSet.has(flag)) // 当前单元格被占用退出当前循环
                {
                    break;
                }
                bottomLen = i;
                counter++
                curSet.add(flag);
            }

            if (counter == 0) // 如果空间全被占用，退出循环
            {
                break;
            }
            else
            {
                let minLen_tmp;
                if (topLen != -1 && bottomLen != -1) {
                    minLen_tmp = Math.min(topLen, bottomLen);
                }
                else // 空间残缺
                {
                    break;
                }

                if (!preMinLen) // 初次赋值
                {
                    preMinLen = minLen_tmp;
                }
                else if (minLen_tmp < preMinLen) // 寻找最小空间
                {
                    preMinLen = minLen_tmp;
                }

                let width = stepSum;
                let height = preMinLen * 2;

                let area = width * height;

                if (!maxArea) {
                    maxArea = area;
                } else if (area > maxArea) {
                    maxArea = area;
                    width_space = width;
                    height_space = height;
                }

                topLen = topLen + step;
                stepSum = stepSum + step;
            }
        }

        return {width: width_space, height: height_space};
    }


    /**
     * 如果可用空间不够，查找设备四周最大空间
     * @param polygon
     * @param angle
     * @param tran
     * @param width_txt
     * @param height_txt
     * @param width_cell
     * @param height_cell
     * @returns {string|*|null}
     */
    findMaxsizeSpace(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let area = width_txt * height_txt;
        let gridArea = gridSize * gridSize;

        let upSet = this.findMaxSizeSpaceUp(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        let rightSet = this.findMaxSizeSpaceRight(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        let bottomSet = this.findMaxSizeSpaceDown(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        let leftSet = this.findMaxSizeSpaceLeft(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);

        let ls = [{data: upSet, flag: 'T'}, {data: rightSet, flag: 'R'}, {data: bottomSet, flag: 'B'},  {data: leftSet, flag: 'L'}];

        let curObj = ls.reduce(
            (pre, cur) => {
                return pre.data.size > cur.data.size ? pre: cur;
            },
            {data: {size: Number.MIN_VALUE}}
        );

        if (!curObj || !curObj.flag) {
            return null;
        } else {
            return curObj.flag;
        }
    }

    findVMaxsizeSpace(polygon, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let area = width_txt * height_txt;
        let gridArea = gridSize * gridSize;

        let upSet = this.findVMaxSizeSpaceUp(polygon, tran, width_txt, height_txt, width_cell, height_cell);
        let rightSet = this.findVMaxSizeSpaceRight(polygon, tran, width_txt, height_txt, width_cell, height_cell);
        let bottomSet = this.findVMaxSizeSpaceDown(polygon, tran, width_txt, height_txt, width_cell, height_cell);
        let leftSet = this.findVMaxSizeSpaceLeft(polygon, tran, width_txt, height_txt, width_cell, height_cell);

        let ls = [{data: upSet, flag: 'T'}, {data: rightSet, flag: 'R'}, {data: bottomSet, flag: 'B'},  {data: leftSet, flag: 'L'}];

        let curObj = ls.reduce(
            (pre, cur) => {
                return pre.data.size > cur.data.size ? pre: cur;
            },
            {data: {size: Number.MIN_VALUE}}
        );

        if (!curObj || !curObj.flag) {
            return null;
        } else {
            return curObj.flag;
        }
    }

    findMaxRectSpace(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell) {
        let gridSize = this.gridSize;
        let area = width_txt * height_txt;
        let gridArea = gridSize * gridSize;

        let upSet = this.findMaxSizeSpaceUp(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        let rightSet = this.findMaxSizeSpaceRight(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        let bottomSet = this.findMaxSizeSpaceDown(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);
        let leftSet = this.findMaxSizeSpaceLeft(polygon, angle, tran, width_txt, height_txt, width_cell, height_cell);

        let ls = [{data: upSet, flag: 'T'}, {data: rightSet, flag: 'R'}, {data: bottomSet, flag: 'B'},  {data: leftSet, flag: 'L'}];

        let curObj = ls.reduce(
            (pre, cur) => {
                return pre.data.size > cur.data.size ? pre: cur;
            },
            {data: {size: Number.MIN_VALUE}}
        );

        if (!curObj || !curObj.flag) {
            return null;
        } else {
            return curObj.flag;
        }
    }
}