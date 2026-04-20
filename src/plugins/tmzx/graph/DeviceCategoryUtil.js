import TextUtil from './TextUtil.js'

let DeviceCategoryUtil = {
  POLE: '0103', // 杆塔,

  // 是否是母线
  isBusCell(cell) {
    let styleObj = TextUtil.parseDrawioStyle(cell.style)
    let f1 = cell.symbol == 'busbar'
    let f2 = styleObj.flag == 'busbar'

    return f1 || f2
  },
  // 是否是杆塔：0103
  isPole(psrtype) {
    return psrtype == this.POLE
  },
  isPoleCell(cell) {
    return cell && this.isPole(cell.psrtype)
  },

  // 是否是终端头  - cable terminal head
  isCableTerminal(psrtype) {
    return psrtype == '0202'
  },
  isCableTerminalCell(cell) {
    return cell && this.isCableTerminal(cell.psrtype)
  },

  // 是否用户接入点
  isJrdTerminal(psrtype) {
    return psrtype == '370000'
  },
  isJrdTerminalCell(cell) {
    return cell && this.isJrdTerminal(cell.psrtype)
  },

  // 是否是避雷器
  isArrester(psrtype) {
    return psrtype == '0116'
  },
  // 不能是避雷器
  isArresterCell(cell) {
    return cell && this.isArrester(cell.psrtype)
  },

  // 是否是文本
  isTextCell(cell) {
    if (!cell) {
      return false
    }
    let styleObj = TextUtil.parseDrawioStyle(cell.style)
    return cell.isText == true || styleObj['flag'] == 'text'
  },
  // 是否是测点
  isPointCell(cell) {
    if (!cell) {
      return false
    }
    let styleObj = TextUtil.parseDrawioStyle(cell.style)
    return cell.isPoint == true
  },
  // 是否是主干设备
  isTrunkCell(cell) {
    return cell && cell['lineType'] == 'Trunk'
  },
  // 根据ID判断线是否为连接线
  isLjx(id) {
    // ['36000000', '13000000', '14000000']
    if (
      id.indexOf('36000000') != -1 ||
      id.indexOf('13000000') != -1 ||
      id.indexOf('14000000') != -1
    ) {
      return true
    }
    return false
  },
  // cell是否为测点连接线
  isPointLine(cell) {
    return cell && cell['flag'] == 'pointline'
  },
  // 无用的线
  isUselessLine(cell) {
    if (!cell) {
      return false
    }
    let styleObj = TextUtil.parseDrawioStyle(cell.style)
    return (
      cell['flag'] == 'pointline' ||
      cell['flag'] == 'tmpLine' ||
      styleObj['flag'] == 'pointline' ||
      styleObj['flag'] == 'tmpLine'
    )
  },
  // 是否是电站 zf01
  isSubstation(psrtype) {
    return psrtype == 'zf01' || psrtype == 'zf04'
  },
  // 是否是电站 zf01
  isSubstationCell(cell) {
    if (!cell) {
      return false
    }
    return cell.psrtype == 'zf01' || cell.id.indexOf('_30000000_') != -1
  },
  isStationCell(cell) {
    if (!cell) {
      return false
    }
    let styleObj = TextUtil.parseDrawioStyle(cell.style)
    return cell.symbol == 'station' || styleObj.flag == 'station'
  },
    isGroupCell(cell) {
        if (!cell) {
            return false
        }
        let styleObj = TextUtil.parseDrawioStyle(cell.style)
        return cell.symbol == 'group' || styleObj.flag == 'group'
    },
  // 是否是叶子节点
  isLeaf(cell) {}
}

export default DeviceCategoryUtil
