import Dimension from '@/plugins/tmzx/graph/Dimension.js'

let mathutil = {
    anglePerRad: 180 / Math.PI,
    radianPerAngle: Math.PI / 180,
    // 角度转弧度
    angle2Radian: function (angle) {
        return angle * this.radianPerAngle
    },
    // 弧度转角度
    radian2Angle: function (radian) {
        return radian * this.anglePerRad
    },
    // 像素长度
    pixelLen: function (p1, p2) {
        // v1.clone().sub(v2).length()
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
    },
    // 节点中心点
    cellCenter: function (cellGeometry) {
        return {
            x: cellGeometry.x + cellGeometry.width / 2,
            y: cellGeometry.y + cellGeometry.height / 2
        }
    },

    // 计算两个向量的正中间向量、Bisector平分线
    getBisectorVector(v1, v2) {
        let vmid = v1.clone().add(v2)
        return vmid.normalize()
    },

    // 中心点
    midPoint: function (v1, v2) {
        return new Vector2((v1.x + v2.x) / 2, (v1.y + v2.y) / 2)
    },

    // 负角度转正角度
    negativeAngle2Positive(angle) {
        return ((angle % 360) + 360) % 360
    },

    vecAngle(vec1, vec2) {
        let v_normal1 = vec1.normalize()
        let v_normal2 = vec2.normalize()
        let cosAngle = +v_normal1.clone().dot(v_normal2)
        return Math.acos(cosAngle) * this.anglePerRad
    },

    dirAngle(vec) {
        let radian = vec.angle()
        let angle = this.anglePerRad * radian
        return angle;
    },
    /**
     * 判断角度是水平还是垂直
     * @param angle       角度
     * @param tolerance   容差
     * @returns {string}
     */
    isHorizontalOrVertical(angle, tolerance = 5) {
        // 转化到0~360
        let normalizedAngle = ((angle % 360) + 360) % 360

        // 1、判断水平
        let nearZero = normalizedAngle <= tolerance || normalizedAngle >= 360 - tolerance
        let near180 = Math.abs(normalizedAngle - 180) <= tolerance

        let isHorizontal = nearZero || near180

        // 判断是否接近水平
        if (isHorizontal) {
            return 'H'
        }

        // 2、判断垂直
        let near90 = Math.abs(normalizedAngle - 90) <= tolerance
        let near270 = Math.abs(normalizedAngle - 270) <= tolerance

        let isVertical = near90 || near270
        // 判断是否接近垂直（90度或270度）
        if (isVertical) {
            return 'V'
        }

        return 'A'
    },
    snapAngle: function (angle, tolerance = 5) {
        angle = angle % 360
        if (angle < 0) {
            angle += 360
        }

        if (Math.abs(angle - 0) <= tolerance) {
            angle = 0
        } else if (Math.abs(angle - 90) <= tolerance) {
            angle = 90
        } else if (Math.abs(angle - 180) <= tolerance) {
            angle = 180
        } else if (Math.abs(angle - 270) <= tolerance) {
            angle = 270
        }
        return angle
    },

    /**
     * 直线角度
     * @param x1
     * @param y1
     * @param x2
     * @param y2
     * @returns {*|number} 0~180
     */
    lineAngle(x1, y1, x2, y2) {
        // 计算斜率
        let deltaX = x2 - x1
        let deltaY = y2 - y1

        // 处理垂直x轴情况
        if (deltaX == 0) {
            return 90
        }

        // 计算斜率
        let slope = deltaY / deltaX

        // 计算角度
        let angleRadians = Math.atan(slope)
        let angleDegrees = this.radian2Angle(angleRadians)

        // 确保角度在 0 到 180 之间
        if (angleDegrees < 0) {
            return angleDegrees + 180
        }
        return angleDegrees
    },
    // 直线斜率
    linerSlope(vec1, vec2) {
        // return Math.atan2(vec1.y - vec2.y, vec1.x - vec2.x);
        return (vec1.y - vec2.y) / (vec1.x - vec2.x)
    },
    /**
     * 通过叉乘计算两个向量的关系
     * @param v1
     * @param v2
     * @returns {number} 正：v1至v2 正坐标系旋转，负：逆坐标系旋转，0：则v1,v2共线
     */
    vecRelation(v1, v2) {
        // return v1.x * v2.y - v2.x * v1.y;
        return v1.clone().cross(v2)
    },
    // 求向量的垂直向量
    crossVector(vec) {
        return new Vector2(vec.y, -vec.x)
    },
    /**
     * 计算向量 va到vb 是顺时针还是逆时针
     * @param va
     * @param vb
     * @returns {number} 1：正旋转，2：负旋转，3：共线
     */
    crossProduct(va, vb) {
        let dot = va.clone().cross(vb)
        if (dot > 0) {
            return 1
        } else if (dot < 0) {
            return -1
        } else {
            return 0
        }
    },
    rgb2hex: function (r, g, b) {
        var hex = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
        return hex
    },

    /**
     * 点积
     * @param v1
     * @param v2
     * @returns {number}
     */
    dotProduct(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y
    },
    /**
     * 向量相减
     * @param v1
     * @param v2
     * @returns {{x: number, y: number}}
     */
    subtractVectors(v1, v2) {
        return new Vector2(v1.x - v2.x, v1.y - v2.y)
    },
    commonMatrix(tran, rad, scale) {
        let scaleM = null
        if (scale) {
            scaleM = new Matrix3()
            scaleM.scale(scale, scale)
        }

        let rotM = null
        if (rad || rad == 0) {
            rotM = new Matrix3()
            rotM.rotate(rad)
        }

        let tranM = null
        if (tran) {
            tranM = new Matrix3()
            tranM.translate(tran.x, tran.y)
        }

        if (tran && (rad || rad == 0) && scale) {
            return tranM.clone().multiply(scaleM).multiply(rotM)
        } else if (tran && (rad || rad == 0)) {
            return tranM.clone().multiply(rotM)
        } else if (tran && scale) {
            return tranM.clone().multiply(scaleM)
        } else if ((rad || rad == 0) && scale) {
            return rotM.clone().multiply(scaleM)
        } else if (tran) {
            return tranM
        } else if (rad || rad == 0) {
            return rotM
        } else if (scale) {
            return scaleM
        }
    },
    /**
     * 计算长度
     * @param vector {x: number, y: number}
     * @returns {number}
     */
    magnitude(vector) {
        return Math.sqrt(vector.x * vector.x + vector.y * vector.y)
    },

    // 根据两点求直线
    lineFromPoints(p1, p2) {
        let a = p2.y - p1.y;
        let b = p1.x - p2.x;
        let c = p2.x * p1.y - p1.x * p2.y;
        return {a, b, c};
    },
    /**
     * 检查点是否在线段上
     * @param p
     * @param a
     * @param b
     */
    isPointOnSegment(p, a, b) {
        let minX = Math.min(a.x, b.x);
        let maxX = Math.max(a.x, b.x);
        let minY = Math.min(a.y, b.y);
        let maxY = Math.max(a.y, b.y);

        let minNum = 1e-8;
        if (p.x < minX - minNum || p.x > maxX + minNum || p.y < minY - minNum || p.y > maxY + minNum ) {
            return false;
        }

        let cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        return Math.abs(cross) < minNum;
    },
    /**
     * 计算两条直线的交战
     * @param line1 {a, b, c}
     * @param line2 {a, b, c}
     * @returns {{x: number, y: number}|null}
     */
    getLineIntersection(line1, line2) {
        let denominator = line1.a * line2.b - line2.a * line1.b;
        if (Math.abs(denominator) < 1e-8) {
            return null;
        }

        // 计算交点坐标
        let x = (line1.b * line2.c - line2.b * line1.c) / denominator;
        let y = (line2.a * line1.c - line1.a * line2.c) / denominator;

        return {x, y}
    },
    /**
     * 计算两条线段的交战
     * @param a1
     * @param a2
     * @param b1
     * @param b2
     * @returns {{x: number, y: number}|null}
     */
    findSegmentIntersection(a1, a2, b1, b2) {
        let line1 = this.lineFromPoints(a1, a2);
        let line2 = this.lineFromPoints(b1, b2);

        let intersection = this.getLineIntersection(line1, line2);

        if (!intersection) {
            return null;
        }

        if (this.isPointOnSegment(intersection, a1, a2) && this.isPointOnSegment(intersection, b1, b2)) {
            return {
                x: parseFloat(intersection.x.toFixed(6)),
                y: parseFloat(intersection.y.toFixed(6)),
            }
        }

        return null;
    },
    /**
     * 点到线的最近点
     * @param point {x: number y: number}
     * @param lineStart {x: number y: number}
     * @param lineEnd {x: number, y: number}
     * @returns {{x: *, y: *}|*}
     */
    closestPointOnLineSegment(point, lineStart, lineEnd) {
        // 线段的向量表示
        const lineVector = this.subtractVectors(lineEnd, lineStart)
        // 点到线段起点的向量
        const pointVector = this.subtractVectors(point, lineStart)
        // 计算点向量在线段向量上的投影系数
        const projection =
            this.dotProduct(pointVector, lineVector) / this.dotProduct(lineVector, lineVector)

        // 投影点在线段上
        if (projection < 0) {
            // 如果投影点在线段起点的外侧，则起点即为最近点
            return lineStart
        } else if (projection > 1) {
            // 如果投影点在线段终点的外侧，则终点即为最近点
            return lineEnd
        } else {
            // 如果投影点在线段上，则计算确切的投影点坐标

            let x = lineStart.x + projection * lineVector.x
            let y = lineStart.y + projection * lineVector.y

            return new Vector2(x, y)
        }
    },

    closestPointOnLineSegmentStrict(point, lineStart, lineEnd) {
        // 线段的向量表示
        const lineVector = this.subtractVectors(lineEnd, lineStart)
        // 点到线段起点的向量
        const pointVector = this.subtractVectors(point, lineStart)
        // 计算点向量在线段向量上的投影系数
        const projection =
            this.dotProduct(pointVector, lineVector) / this.dotProduct(lineVector, lineVector)

        // 投影点在线段上
        if (projection < 0) {
            // 如果投影点在线段起点的外侧，则起点即为最近点
            return null
        } else if (projection > 1) {
            // 如果投影点在线段终点的外侧，则终点即为最近点
            return null
        } else {
            // 如果投影点在线段上，则计算确切的投影点坐标

            let x = lineStart.x + projection * lineVector.x
            let y = lineStart.y + projection * lineVector.y

            return new Vector2(x, y)
        }
    },

    // 线到圆的交点
    lineCircleIntersection(A, B, C, cx, cy, r) {
        // 将直线方程 Ax + By + C = 0 转换为斜截式 y = mx + c
        let m, c
        if (B !== 0) {
            m = -A / B // 斜率
            c = -C / B // 截距
        } else {
            // 如果直线是垂直于 x 轴的直线（x = constant）
            const x = -C / A
            // 代入圆的方程求 y
            const term = r * r - (x - cx) * (x - cx)
            if (term < 0) return [] // 无交点
            const y1 = cy + Math.sqrt(term)
            const y2 = cy - Math.sqrt(term)
            return [
                { x: x, y: y1 },
                { x: x, y: y2 }
            ]
        }

        // 将 y = mx + c 代入圆的方程 (x - cx)^2 + (y - cy)^2 = r^2
        const a = 1 + m * m
        const b = -2 * cx + 2 * m * (c - cy)
        const c_quad = cx * cx + (c - cy) * (c - cy) - r * r

        // 计算判别式
        const D = b * b - 4 * a * c_quad

        if (D < 0) {
            return [] // 无交点
        } else if (D === 0) {
            // 一个交点（相切）
            const x = -b / (2 * a)
            const y = m * x + c
            return [{ x: x, y: y }]
        } else {
            // 两个交点
            const x1 = (-b + Math.sqrt(D)) / (2 * a)
            const x2 = (-b - Math.sqrt(D)) / (2 * a)
            const y1 = m * x1 + c
            const y2 = m * x2 + c
            return [
                { x: x1, y: y1 },
                { x: x2, y: y2 }
            ]
        }
    },

    // 根据两点求直线方程 A、B、C
    lineEquationFromTwoPoints(x1, y1, x2, y2) {
        let A, B, C
        // if (x1 == x2) {
        if (Math.abs(x1 - x2) < 1) {
            // 垂直于x轴直线
            A = 1
            B = 0
            C = -x1
        } else {
            // 计算斜率
            let m = (y2 - y1) / (x2 - x1)
            // 转换为一般式 Ax + By + C = 0
            A = m
            B = -1
            C = y1 - m * x1
        }
        return { A, B, C }
    },

    /**
     * 计算点到线的垂直距离
     * @param point        {x: number y: number}
     * @param lineStart    {x: number y: number}
     * @param lineEnd      {x: number y: number}
     * @returns {number}
     */
    distancePointToLine(point, lineStart, lineEnd) {
        const lineVector = this.subtractVectors(lineEnd, lineStart)
        const pointVector = this.subtractVectors(point, lineStart)

        const projection =
            this.dotProduct(pointVector, lineVector) / this.dotProduct(lineVector, lineVector)

        const closestPoint = {
            x: lineStart.x + projection * lineVector.x,
            y: lineStart.y + projection * lineVector.y
        }

        const distanceVector = this.subtractVectors(point, closestPoint)
        const distance = this.magnitude(distanceVector)

        return distance
    },

    // 计算向量列表范围
    vecListBounds(list) {
        let xmin = Number.MAX_VALUE
        let ymin = Number.MAX_VALUE

        let xmax = Number.MIN_VALUE
        let ymax = Number.MIN_VALUE

        for (let vec of list) {
            if (vec.x < xmin) {
                xmin = vec.x
            }
            if (vec.x > xmax) {
                xmax = vec.x
            }
            if (vec.y < ymin) {
                ymin = vec.y
            }
            if (vec.y > ymax) {
                ymax = vec.y
            }
        }
        return { xmin, ymin, xmax, ymax, width: xmax - xmin, height: ymax - ymin }
    },

    vecListBounds2(list) {
        let xmin = Number.MAX_VALUE
        let ymin = Number.MAX_VALUE

        let xmax = Number.MIN_VALUE
        let ymax = Number.MIN_VALUE

        for (let vec of list) {
            if (vec.x < xmin) {
                xmin = vec.x
            }
            if (vec.x > xmax) {
                xmax = vec.x
            }
            if (vec.y < ymin) {
                ymin = vec.y
            }
            if (vec.y > ymax) {
                ymax = vec.y
            }
        }
        return { xmin, ymin, xmax, ymax }
    },
    dimensionListBounds(list) {
        let _xmin = -999,
            _ymin = -999,
            _xmax = -999,
            _ymax = -999
        for (let dimension of list) {
            let { xmin, ymin, xmax, ymax } = dimension

            if (_xmin == -999) {
                _xmin = xmin
            } else if (_xmin > xmin) {
                _xmin = xmin
            }

            if (_xmax == -999) {
                _xmax = xmax
            } else if (_xmax < xmax) {
                _xmax = xmax
            }

            if (_ymin == -999) {
                _ymin = ymin
            } else if (_ymin > ymin) {
                _ymin = ymin
            }

            if (_ymax == -999) {
                _ymax = ymax
            } else if (_ymax < ymax) {
                _ymax = ymax
            }
        }

        let dimention = new Dimension()
        dimention.init(_xmin, _ymin, _xmax, _ymax)

        return dimention
    },
    /**
     * 根据圆的半径和圆上两点计算圆心
     * @param {Object} p1 第一个点 {x, y}
     * @param {Object} p2 第二个点 {x, y}
     * @param {number} r 圆的半径
     * @returns {Array} 可能有两个解，返回两个圆心数组 [center1, center2]
     */
    findCircleCenter(p1, p2, r) {
        const {x: x1, y: y1} = p1;
        const {x: x2, y: y2} = p2;

        // 计算两点中点
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // 计算两点间距离
        const dx = x2 - x1;
        const dy = y2 - y1;
        const d = Math.sqrt(dx*dx + dy*dy);

        // 检查两点是否重合
        if (d === 0) {
            throw new Error("两点重合，无法确定圆");
        }

        // 检查半径是否足够大
        if (2 * r < d) {
            throw new Error(`半径太小（需要至少 ${d/2}）`);
        }

        // 计算垂直距离
        const h = Math.sqrt(r*r - (d/2)*(d/2));

        // 计算垂直向量（垂直于P1P2的向量）
        const nx = -dy / d;
        const ny = dx / d;

        // 计算两个可能的圆心
        const center1 = {
            x: midX + h * nx,
            y: midY + h * ny
        };

        const center2 = {
            x: midX - h * nx,
            y: midY - h * ny
        };

        return [center1, center2];
    },
}

export default mathutil
