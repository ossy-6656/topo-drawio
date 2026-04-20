import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'

let Line2LineUtil = {
    /**
     * 计算edge1与edges两线的连接点信息
     * @param graph
     * @param cellLinkMap
     * @param edge1
     * @param edge2
     * @returns {{selfTouch: string, targetTouch: string}}
     */
    getConnectionInfo(graph, cellLinkMap, edge1, edge2) {
        let model = graph.getModel()
        let linkList = cellLinkMap.get(edge1.id)

        let geo1 = model.getGeometry(edge1)
        let geo2 = model.getGeometry(edge2)

        // 注意sourcePoint、targetPoint在初始化时为真实坐标，如果移动后就可以不再是真实点
        let p1_edge1 = new Vector2(geo1.sourcePoint.x, geo1.sourcePoint.y)
        let p2_edge1 = new Vector2(geo1.targetPoint.x, geo1.targetPoint.y)

        let p1_edge2 = new Vector2(geo2.sourcePoint.x, geo2.sourcePoint.y)
        let p2_edge2 = new Vector2(geo2.targetPoint.x, geo2.targetPoint.y)

        let touch1 = '0'
        let touch2 = '0'
        let p = geo1.sourcePoint
        let minLen = p1_edge1.clone().sub(p1_edge2).length()

        let len2 = p2_edge1.clone().sub(p1_edge2).length()
        if (len2 < minLen) {
            minLen = len2
            touch1 = '1'
            touch2 = '0'
            p = geo1.targetPoint
        }

        let len3 = p1_edge1.clone().sub(p2_edge2).length()
        if (len3 < minLen) {
            minLen = len3
            touch1 = '0'
            touch2 = '1'
            p = geo1.sourcePoint
        }

        let len4 = p2_edge1.clone().sub(p2_edge2).length()
        if (len4 < minLen) {
            touch1 = '1'
            touch2 = '1'
            p = geo1.targetPoint
        }

        return {
            selfTouch: touch1,
            targetTouch: touch2,
            p
        }
    },
    /**
     * 创建虚拟点，连接线与线
     * @param graph
     * @param cellLinkMap       连接关系map
     * @param edge1             起始线
     * @param edge2             结束线
     * @param r                 虚拟点半径
     * @param cell          可能连接的设备 如果两端设备齐全不会到这一步
     * @returns {null}
     */
    connectLine(graph, cellLinkMap, edge1, edge2, r) {
        let model = graph.getModel()

        let virtualCell = null
        let parent = graph.getDefaultParent()

        let sourceCell_edge1 = model.getTerminal(edge1, true)
        let targetCell_edge1 = model.getTerminal(edge1, false)

        let sourceCell_edge2 = model.getTerminal(edge2, true)
        let targetCell_edge2 = model.getTerminal(edge2, false)

        let { selfTouch, targetTouch, p } = this.getConnectionInfo(graph, cellLinkMap, edge1, edge2)


        let sb = []
        let key1 = edge1.id + '_' + edge2.id
        let ObjectID = 'virtual-cell-' + key1

        sb.push(`id=${ObjectID};`)
        sb.push(`shape=terminal;`)
        sb.push('whiteSpace=wrap;aspect=fixed;')
        sb.push('resizable=0;rotatable=0;')

        if (selfTouch == '0' && targetTouch == '0')
        {
            // 如果edge1起点连接edge2起点
            if (!sourceCell_edge1 && !sourceCell_edge2)
            {
                // 如果没有连接点
                virtualCell = graph.insertVertex(
                    parent,
                    ObjectID,
                    null,
                    p.x - r,
                    p.y - r,
                    r * 2,
                    r * 2,
                    sb.join('')
                )
                virtualCell.flag = 'virtualCell'

                // edge1.source = virtualCell;
                // edge2.source = virtualCell;

                model.setTerminal(edge1, virtualCell, true)
                model.setTerminal(edge2, virtualCell, true)

                graph.setCellStyles('exitX', 0.5, [edge1, edge2])
                graph.setCellStyles('exitY', 0.5, [edge1, edge2])

                graph.setCellStyles('exitPerimeter', 0, [edge1, edge2])

                edge1.id_sc = virtualCell.id
                edge1.exitX_sc = 0.5
                edge1.exitY_sc = 0.5

                edge2.id_sc = virtualCell.id
                edge2.exitX_sc = 0.5
                edge2.exitY_sc = 0.5
            }
            else if (sourceCell_edge1 && sourceCell_edge1.flag == 'virtualCell')
            {
                // 有cell存在，且不是虚拟
                // edge2.source = sourceCell_edge1;
                model.setTerminal(edge2, sourceCell_edge1, true)

                graph.setCellStyles('exitX', 0.5, [edge2])
                graph.setCellStyles('exitY', 0.5, [edge2])
                graph.setCellStyles('exitPerimeter', 0, [edge2])

                edge2.id_sc = sourceCell_edge1.id
                edge2.exitX_sc = 0.5
                edge2.exitY_sc = 0.5
            }
            else if (sourceCell_edge2 && sourceCell_edge2.flag == 'virtualCell')
            {
                // edge1.source = sourceCell_edge2;
                model.setTerminal(edge1, sourceCell_edge2, true)

                graph.setCellStyles('exitX', 0.5, [edge1])
                graph.setCellStyles('exitY', 0.5, [edge1])
                graph.setCellStyles('exitPerimeter', 0, [edge1])

                edge1.id_sc = sourceCell_edge2.id
                edge1.exitX_sc = 0.5
                edge1.exitY_sc = 0.5
            }
        }
        else if (selfTouch == '0' && targetTouch == '1')
        {
            // 如果edge1起点连接edge2末点
            if (!sourceCell_edge1 && !targetCell_edge2) {
                // 如果没有创建连接点
                virtualCell = graph.insertVertex(
                    parent,
                    ObjectID,
                    null,
                    p.x - r,
                    p.y - r,
                    r * 2,
                    r * 2,
                    sb.join('')
                )
                virtualCell.flag = 'virtualCell'

                // edge1.source = virtualCell;
                // edge2.target = virtualCell;

                model.setTerminal(edge1, virtualCell, true)
                model.setTerminal(edge2, virtualCell, false)

                graph.setCellStyles('exitX', 0.5, [edge1])
                graph.setCellStyles('exitY', 0.5, [edge1])
                graph.setCellStyles('exitPerimeter', 0, [edge1])

                graph.setCellStyles('entryX', 0.5, [edge2])
                graph.setCellStyles('entryY', 0.5, [edge2])
                graph.setCellStyles('entryPerimeter', 0, [edge2])

                edge1.id_sc = virtualCell.id
                edge1.exitX_sc = 0.5
                edge1.exitY_sc = 0.5

                edge2.id_tc = virtualCell.id
                edge2.entryX_tc = 0.5
                edge2.entryY_tc = 0.5
            } else if (sourceCell_edge1 && sourceCell_edge1.flag == 'virtualCell') {
                // 有一个存在
                // edge2.target = sourceCell_edge1;
                model.setTerminal(edge2, sourceCell_edge1, false)

                graph.setCellStyles('entryX', 0.5, [edge2])
                graph.setCellStyles('entryY', 0.5, [edge2])
                graph.setCellStyles('entryPerimeter', 0, [edge2])

                edge2.id_tc = sourceCell_edge1.id
                edge2.entryX_tc = 0.5
                edge2.entryY_tc = 0.5
            } else if (targetCell_edge2 && targetCell_edge2.flag == 'virtualCell') {
                // edge1.source = targetCell_edge2;
                model.setTerminal(edge1, targetCell_edge2, true)

                graph.setCellStyles('exitX', 0.5, [edge1])
                graph.setCellStyles('exitY', 0.5, [edge1])
                graph.setCellStyles('exitPerimeter', 0, [edge1])

                edge1.id_sc = targetCell_edge2.id
                edge1.exitX_sc = 0.5
                edge1.exitY_sc = 0.5
            }
        }
        else if (selfTouch == '1' && targetTouch == '0')
        {
            // 如果edge1末点连接edge2起点
            if (!targetCell_edge1 && !sourceCell_edge2) {
                // 如果没有创建连接点
                virtualCell = graph.insertVertex(
                    parent,
                    ObjectID,
                    null,
                    p.x - r,
                    p.y - r,
                    r * 2,
                    r * 2,
                    sb.join('')
                )
                virtualCell.flag = 'virtualCell'

                // edge1.target = virtualCell;
                // edge2.source = virtualCell;
                model.setTerminal(edge1, virtualCell, false)
                model.setTerminal(edge2, virtualCell, true)

                graph.setCellStyles('entryX', 0.5, [edge1])
                graph.setCellStyles('entryY', 0.5, [edge1])
                graph.setCellStyles('entryPerimeter', 0, [edge1])

                graph.setCellStyles('exitX', 0.5, [edge2])
                graph.setCellStyles('exitY', 0.5, [edge2])
                graph.setCellStyles('exitPerimeter', 0, [edge2])

                edge1.id_tc = virtualCell.id
                edge1.entryX_tc = 0.5
                edge1.entryY_tc = 0.5

                edge2.id_sc = virtualCell.id
                edge2.exitX_sc = 0.5
                edge2.exitY_sc = 0.5
            } else if (targetCell_edge1 && targetCell_edge1.flag == 'virtualCell') {
                // 有一个存在
                // edge2.source = targetCell_edge1;
                model.setTerminal(edge2, targetCell_edge1, true)

                graph.setCellStyles('exitX', 0.5, [edge2])
                graph.setCellStyles('exitY', 0.5, [edge2])
                graph.setCellStyles('exitPerimeter', 0, [edge2])

                edge2.id_sc = targetCell_edge1.id
                edge2.exitX_sc = 0.5
                edge2.exitY_sc = 0.5
            } else if (sourceCell_edge2 && sourceCell_edge2.flag == 'virtualCell') {
                // edge1.target = sourceCell_edge2;
                model.setTerminal(edge1, sourceCell_edge2, false)

                graph.setCellStyles('entryX', 0.5, [edge1])
                graph.setCellStyles('entryY', 0.5, [edge1])
                graph.setCellStyles('entryPerimeter', 0, [edge1])

                edge1.id_tc = sourceCell_edge2.id
                edge1.entryX_tc = 0.5
                edge1.entryY_tc = 0.5
            }
        }
        else if (selfTouch == '1' && targetTouch == '1')
        {
            // 如果edge1末点连接edge2末点
            if (!targetCell_edge1 && !targetCell_edge2)
            {
                // 如果没有创建连接点
                virtualCell = graph.insertVertex(
                    parent,
                    ObjectID,
                    null,
                    p.x - r,
                    p.y - r,
                    r * 2,
                    r * 2,
                    sb.join('')
                )
                virtualCell.flag = 'virtualCell'
                // edge1.target = virtualCell;
                // edge2.target = virtualCell;
                model.setTerminal(edge1, virtualCell, false)
                model.setTerminal(edge2, virtualCell, false)

                graph.setCellStyles('entryX', 0.5, [edge1, edge2])
                graph.setCellStyles('entryY', 0.5, [edge1, edge2])
                graph.setCellStyles('entryPerimeter', 0, [edge1, edge2])

                edge1.id_tc = virtualCell.id
                edge1.entryX_tc = 0.5
                edge1.entryY_tc = 0.5

                edge2.id_tc = virtualCell.id
                edge2.entryX_tc = 0.5
                edge2.entryY_tc = 0.5
            }
            else if (targetCell_edge1 && targetCell_edge1.flag == 'virtualCell')
            {
                // 有一个存在
                // edge2.target = targetCell_edge1;
                model.setTerminal(edge2, targetCell_edge1, false)

                graph.setCellStyles('entryX', 0.5, [edge2])
                graph.setCellStyles('entryY', 0.5, [edge2])
                graph.setCellStyles('entryPerimeter', 0, [edge2])

                edge2.id_tc = targetCell_edge1.id
                edge2.entryX_tc = 0.5
                edge2.entryY_tc = 0.5
            }
            else if (targetCell_edge2 && targetCell_edge2.flag == 'virtualCell')
            {
                // edge1.target = targetCell_edge2;
                model.setTerminal(edge1, targetCell_edge2, false)

                graph.setCellStyles('entryX', 0.5, [edge1])
                graph.setCellStyles('entryY', 0.5, [edge1])
                graph.setCellStyles('entryPerimeter', 0, [edge1])

                edge1.id_tc = targetCell_edge2.id
                edge1.entryX_tc = 0.5
                edge1.entryY_tc = 0.5
            }
        }

        return virtualCell
    }
}

export default Line2LineUtil;