class Node {
  constructor(position, g, h, parent = null) {
    this.position = position // 节点位置
    this.g = g // 从起点到当前节点的实际代价
    this.h = h // 启发式估算代价
    this.f = g + h // 总代价
    this.parent = parent // 父节点
  }

  compare(other) {
    return this.f - other.f // 用 f 值比较节点
  }
}

class MinHeap {
  constructor() {
    this.heap = []
    this.nodeMap = new Map() // For fast lookup
  }

  push(node) {
    this.heap.push(node)
    this.nodeMap.set(node.position.toString(), node)
    this._bubbleUp(this.heap.length - 1)
  }

  pop() {
    if (this.heap.length === 0) return null
    const root = this.heap[0]
    this.nodeMap.delete(root.position.toString())
    if (this.heap.length === 1) return this.heap.pop()
    ;[this.heap[0], this.heap[this.heap.length - 1]] = [
      this.heap[this.heap.length - 1],
      this.heap[0]
    ]
    this.heap.pop()
    this._bubbleDown(0)
    return root
  }

  updateNode(node) {
    this.nodeMap.set(node.position.toString(), node)
    this._bubbleUp(this.heap.indexOf(node))
  }

  size() {
    return this.heap.length
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2)
      if (this.heap[parentIdx].compare(this.heap[idx]) <= 0) break
      ;[this.heap[parentIdx], this.heap[idx]] = [this.heap[idx], this.heap[parentIdx]]
      idx = parentIdx
    }
  }

  _bubbleDown(idx) {
    const length = this.heap.length
    while (true) {
      let leftChildIdx = 2 * idx + 1
      let rightChildIdx = 2 * idx + 2
      let leftChild, rightChild
      let swap = null

      if (leftChildIdx < length) {
        leftChild = this.heap[leftChildIdx]
        if (leftChild.compare(this.heap[idx]) < 0) {
          swap = leftChildIdx
        }
      }

      if (rightChildIdx < length) {
        rightChild = this.heap[rightChildIdx]
        if (
          (swap === null && rightChild.compare(this.heap[idx]) < 0) ||
          (swap !== null && rightChild.compare(leftChild) < 0)
        ) {
          swap = rightChildIdx
        }
      }

      if (swap === null) break
      ;[this.heap[idx], this.heap[swap]] = [this.heap[swap], this.heap[idx]]
      idx = swap
    }
  }
}
const zoom = 1000 // 缩放比例，例如将坐标范围缩小到1000x1000
// 曼哈顿距离（可以调整为其他距离）
function heuristic(a, b, weight = 1) {
  return weight * (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]))
}
// function heuristic(a, b, weight = 1) {
//     const dx = Math.abs(a[0] - b[0]);
//     const dy = Math.abs(a[1] - b[1]);
//     return weight * Math.sqrt(dx * dx + dy * dy);
// }

// 获取邻居节点
function getNeighbors(position, grid) {
  const [x, y] = position
  const neighbors = []
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1] // 上下左右
  ]

  for (let [dx, dy] of directions) {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && ny >= 0 && nx < grid.length && ny < grid[0].length && grid[nx][ny] !== 1) {
      neighbors.push([nx, ny])
    }
  }

  return neighbors
}

// A* 算法
function a_star(start, goal, grid, heuristicScalingFactor = 1, timeout = null) {
  // 添加timeout参数
  const openList = new MinHeap()
  const closedList = new Map()
  const startNode = new Node(start, 0, heuristic(start, goal, heuristicScalingFactor))
  openList.push(startNode)
  const startTime = Date.now() // 记录开始时间

  while (openList.size() > 0) {
    if (timeout && Date.now() - startTime > timeout) {
      // 检查是否超时
      return null // 超时则退出循环并返回null
    }

    const currentNode = openList.pop()

    // Check if the goal is reached
    if (currentNode.position[0] === goal[0] && currentNode.position[1] === goal[1]) {
      return reconstructPath(currentNode)
    }

    closedList.set(currentNode.position.toString(), true)

    const neighbors = getNeighbors(currentNode.position, grid)
    for (let neighbor of neighbors) {
      if (closedList.has(neighbor.toString())) continue

      const gCost = currentNode.g + 1
      const hCost = heuristic(neighbor, goal, heuristicScalingFactor)
      const neighborNode = new Node(neighbor, gCost, hCost, currentNode)

      const existingNode = openList.nodeMap.get(neighbor.toString())
      if (!existingNode || existingNode.f > neighborNode.f) {
        openList.push(neighborNode)
      }
    }
  }

  return null // 如果没有找到路径且没有超时，则返回null
}
// 回溯路径
function reconstructPath(node) {
  const path = []
  let currentNode = node

  while (currentNode !== null) {
    path.push(currentNode.position)
    currentNode = currentNode.parent
  }

  return path.reverse().filter((item, index) => {
    return !index && path.length - 1 !== index
  })
}

// 路径平滑处理：可以用贝塞尔曲线或简化路径
function smoothPath(points, epsilon = 0.5) {
  // 计算点到线段的垂直距离
  const perpendicularDistance = function (point, lineStart, lineEnd) {
    const x0 = point[0],
      y0 = point[1]
    const x1 = lineStart[0],
      y1 = lineStart[1]
    const x2 = lineEnd[0],
      y2 = lineEnd[1]

    // 线段的长度
    const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    if (lineLength === 0) return Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2) // 线段退化成一个点

    // 点到线段的距离公式
    const distance = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1) / lineLength
    return distance
  }

  // Ramer-Douglas-Peucker 算法
  const rdp = function (points, epsilon) {
    const first = points[0]
    const last = points[points.length - 1]

    // 找到最大距离点
    let maxDistance = 0
    let index = 0
    for (let i = 1; i < points.length - 1; i++) {
      const distance = perpendicularDistance(points[i], first, last)
      if (distance > maxDistance) {
        maxDistance = distance
        index = i
      }
    }

    // 如果最大距离大于阈值，递归简化
    if (maxDistance > epsilon) {
      // 递归简化路径
      const left = rdp(points.slice(0, index + 1), epsilon)
      const right = rdp(points.slice(index), epsilon)

      // 合并两部分，去掉重复的点
      return [...left.slice(0, left.length - 1), ...right]
    } else {
      // 否则，只保留端点
      return [first, last]
    }
  }

  // 这里可以使用贝塞尔曲线或其他平滑算法进行优化
  return rdp(points, epsilon)
}

// 创建网格
function createGridFromObstacles(obstacles, maxCoord) {
  const grid = Array.from(
    {
      length: maxCoord
    },
    () => Array(maxCoord).fill(0)
  )

  for (const [x, y] of obstacles) {
    grid[x][y] = 1 // Mark obstacles
  }

  return grid
}

// 生成一个随机整数，范围在 [min, max) 内
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

// 随机生成障碍物坐标
function generateRandomObstacles(count, maxCoord) {
  const obstacles = new Set() // 使用 Set 避免重复的障碍物

  while (obstacles.size < count) {
    const x = getRandomInt(0, maxCoord)
    const y = getRandomInt(0, maxCoord)
    obstacles.add(`${x},${y}`) // 用 "x,y" 字符串表示坐标，避免重复
  }

  return Array.from(obstacles).map((item) => item.split(',').map(Number))
}

// ----------------压缩坐标
//  收集坐标范围
function getCoordinateRange(coordinates) {
  let minX = Infinity,
    minY = Infinity
  let maxX = -Infinity,
    maxY = -Infinity

  coordinates.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  return {
    minX,
    minY,
    maxX,
    maxY
  }
}

// 建立坐标映射
function compressCoordinates(coordinates, minX, minY) {
  return coordinates.map(([x, y]) => [x - minX, y - minY])
}
// 映射到一个固定大小的坐标网格
function scaleCoordinates(coordinates, scaleX, scaleY) {
  return coordinates.map(([x, y]) => [Math.floor(x / scaleX), Math.floor(y / scaleY)])
}

// 还原缩放坐标（通过乘回 scaleX 和 scaleY）
function restoreScaleCoordinates(scaledCoordinates, scaleX, scaleY) {
  return scaledCoordinates.map(([x, y]) => [x * scaleX, y * scaleY])
}
// 还原压缩坐标（通过加回 minX 和 minY）
function decompressCoordinates(compressedCoordinates, minX, minY) {
  return compressedCoordinates.map(([x, y]) => [x + minX, y + minY])
}

// 获取矩形边界，考虑节点的宽度和高度
function getRectangleBoundsWithSize(node1, node2) {
  // 获取节点的坐标和尺寸
  const x1 = node1.x
  const y1 = node1.y
  const x2 = node2.x
  const y2 = node2.y

  // 节点宽度和高度
  const w1 = node1.width
  const h1 = node1.height
  const w2 = node2.width
  const h2 = node2.height

  // 计算矩形的最小和最大值，考虑节点的宽度和高度
  // const minX = Math.min(x1, x2) - Math.min(w1, w2) / 2;
  // const minY = Math.min(y1, y2) - Math.min(h1, h2) / 2;
  // const maxX = Math.max(x1 + w1, x2 + w2);
  // const maxY = Math.max(y1 + h1, y2 + h2);
  const minX = Math.min(x1, x2)
  const minY = Math.min(y1, y2)
  const maxX = Math.max(x1, x2)
  const maxY = Math.max(y1, y2)

  return {
    minX,
    minY,
    maxX,
    maxY
  }
}

// 获取矩形范围内的所有节点，按层级筛选
function getNodesInRectangle(nodes, rectBounds, targetLayer = null) {
  const { minX, minY, maxX, maxY } = rectBounds

  // 遍历所有节点，检查它们是否在矩形范围内
  return nodes.filter((node) => {
    const { x, y, width, height, layer } = node

    // 判断节点是否在矩形区域内，考虑节点的大小
    // const nodeInRect =
    //   x - width / 2 >= minX &&
    //   x + width / 2 <= maxX &&
    //   y - height / 2 >= minY &&
    //   y + height / 2 <= maxY
    const nodeInRect = x >= minX && x <= maxX && y >= minY && y <= maxY

    // 如果指定了层级，检查层级是否匹配
    // return nodeInRect && (targetLayer === null || layer === targetLayer)
    return nodeInRect
  })
}

// 获取矩形范围内的所有节点，忽略层级
const getNodesInRect = function (nodes = [], node1, node2, targetLayer = null) {
  // 获取矩形区域
  const rectBounds = getRectangleBoundsWithSize(node1, node2)
  // 获取矩形区域内所有节点，忽略图层
  return getNodesInRectangle(nodes, rectBounds, targetLayer)
}

// export default
export default function astar(config) {
  let {
    timeout = 15000, // Set timeout to 5 seconds
    epsilon = 0.75, // 设定误差阈值
    obstacleCount = 100, // 障碍物数量
    maxCoord = 100000, // 坐标的最大值（百万级别）
    obstacles = generateRandomObstacles(obstacleCount, maxCoord), // 随机生成障碍物
    start = [0, 0], // 起点
    goal = [maxCoord - 1005000, maxCoord - 1012000] // 终点
  } = config

  // start = [start.x, start.y]
  // goal = [goal.x, goal.y]
  // obstacles = obstacles.map((item) => {
  //   console.log(item)
  //   return [item.x, item.y]
  // })
  // 主程序
  // 1. 获取坐标范围
  const { minX, minY, maxX, maxY } = getCoordinateRange([
    ...obstacles,
    [0, 0],
    [maxCoord, maxCoord]
  ])
  // 2. 压缩坐标
  const compressedCoordinates = compressCoordinates(obstacles, minX, minY)
  // 3. 计算比例并缩放坐标
  const scaleX = (maxX - minX) / zoom
  const scaleY = (maxY - minY) / zoom

  const scaledCoordinates = scaleCoordinates(compressedCoordinates, scaleX, scaleY)
  // 处理起点和终点缩放网格坐标
  const startScaled = scaleCoordinates([start], scaleX, scaleY)[0]
  const goalScaled = scaleCoordinates([goal], scaleX, scaleY)[0]
  const nodesInRect = getNodesInRect(
    scaledCoordinates.map((item) => {
      return { x: item[0], y: item[1] }
    }),
    { x: startScaled[0], y: startScaled[1] },
    { x: goalScaled[0], y: goalScaled[1] }
  ).map((item) => {
    return [item.x, item.y]
  })
  // 根据障碍物自动生成网格
  const grid = createGridFromObstacles(nodesInRect, zoom)
  // 调用 A* 算法，设置启发式加权为 1.5
  const path = a_star(startScaled, goalScaled, grid, 1.5, timeout)
  // 对路径进行平滑处理
  const smoothedPath = path && smoothPath(path, epsilon)

  // 还原缩放
  const restoredScaledCoordinates =
    smoothedPath && restoreScaleCoordinates(smoothedPath, scaleX, scaleY)
  // 还原压缩坐标
  const restoredCoordinates =
    restoredScaledCoordinates && decompressCoordinates(restoredScaledCoordinates, minX, minY)
  return {
    s: start,
    g: goal,
    restoredCoordinates
  }
}

// console.log('Path:', astar({})) // 输出路径
