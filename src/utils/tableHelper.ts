// ----------------------表格合并行-------------------
const setTableRowSpan = (tableData: any, colFields: any) => {
  let lastItem: any = []
  // 循环需要合并的列
  colFields.forEach((field: any, index: any) => {
    tableData.forEach((item: any) => {
      // 存值，把合并字段存入行，为了合并单元格时检索列是否含有该字段
      item.mergeCell = colFields
      // 合并的字段出现的次数
      const rowSpan = `rowspan_${field}`
      // 比较上一次的存值和该轮的合并字段，判断是否合并到上个单元格
      if (colFields.slice(0, index + 1).every((e) => lastItem[e] === item[e])) {
        // 如果是，合并行；
        item[rowSpan] = 0 // 该轮合并字段数量存0
        // 上轮合并字段数量+1
        lastItem[rowSpan] += 1
      } else {
        //初始化进入&& 如果不是，完成一次同类合并，lastItem重新赋值，进入下一次计算
        item[rowSpan] = 1 // 该轮合并字段第一次出现，数量存1
        // 改变比较对象，重新赋值，进行下一次计算
        lastItem = item
      }
    })
  })
}

const objectSpanMethod = ({ row, column, rowIndex, columnIndex }) => {
  if (row.mergeCell.includes(column.property)) {
    const rowspan = row[`rowspan_${column.property}`]
    if (rowspan) {
      return { rowspan: rowspan, colspan: 1 }
    } else {
      return { rowspan: 0, colspan: 0 }
    }
  }
}

export function tableMergeColFun() {
  return {
    setTableRowSpan,
    objectSpanMethod
  }
}
