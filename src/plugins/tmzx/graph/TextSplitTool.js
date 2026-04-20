// 文字加数字，其它匹配模式
let commonStrReg = /(?:[^\d]+?\d+)/

// 匹配除特殊字符及数字外的所有字符（这个不再使用）
// let reg6 = /(?:[^-()（）#ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ\d]+)/;

// 只匹配特殊字段，然后二分法转化为数组,|(?:#?\d+\*\d+(?:kva|kv))
let specialStrReg =
  /(?:#?\d+-#?\d+)|(?:[（(][^）)]+[)）])|(?:#\d+?\*?\d*?(?:kva|kv|号|杆))|(?:\d+?\*?\d*?(?:kva|kv|号|杆))|(?:#\d+)|(?:\d+#)|(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+)|开关|公变|箱式变|箱变|断路器|变压器|VIII|VII|VI|IV|IX|V|III|II|I/gi

// 用于处理汉字全竖排显示
let ctxtReg1 = /#?\d+#?/g
let ctxtReg2 = /./g
let TextSplitTool = {
  split(text) {
    let matchHandler = (str) => {
      // let matchSpecial = specialStrReg.exec(str); // 返回第一个匹配结果
      // let matchCommon = commonStrReg.exec(str);
      let matchSpecial = str.match(specialStrReg)
      let matchCommon = str.match(commonStrReg)

      let list = []
      if (matchSpecial) {
        // 如果找到了第一个匹配
        let s = matchSpecial[0]
        let index = str.indexOf(s)

        let strLeft = str.substring(0, index)
        let strMid = s
        let strRight = str.substring(index + s.length)

        let list_left
        if (strLeft) {
          list_left = matchHandler(strLeft)
        }

        let list_right
        if (strRight) {
          list_right = matchHandler(strRight)
        }

        if (list_left) {
          list.push(...list_left)
        }

        list.push(strMid)

        if (list_right) {
          list.push(...list_right)
        }
      } else if (matchCommon) {
        // 其它匹配模式
        let s = matchCommon[0]
        let index = str.indexOf(s)

        let strLeft = str.substring(0, index)
        let strMid = s
        let strRight = str.substring(index + s.length)

        let list_left
        if (strLeft) {
          list_left = matchHandler(strLeft)
        }

        let list_right
        if (strRight) {
          list_right = matchHandler(strRight)
        }

        if (list_left) {
          list.push(...list_left)
        }

        list.push(strMid)

        if (list_right) {
          list.push(...list_right)
        }
      } else {
        list.push(str)
      }
      return list
    }

    let list = matchHandler(text)
    return list
  },
  // 仅处理数字
  csplit(text) {
    let matchHandler = (str) => {
      let matchSpecial = str.match(specialStrReg)
      let matchCommon1 = str.match(ctxtReg1)
      let matchCommon2 = str.match(ctxtReg2)

      let list = []
      if (matchSpecial) {
        // 如果找到了第一个匹配
        let s = matchSpecial[0]
        let index = str.indexOf(s)

        let strLeft = str.substring(0, index)
        let strMid = s
        let strRight = str.substring(index + s.length)

        let list_left
        if (strLeft) {
          list_left = matchHandler(strLeft)
        }

        let list_right
        if (strRight) {
          list_right = matchHandler(strRight)
        }

        if (list_left) {
          list.push(...list_left)
        }

        list.push(strMid)

        if (list_right) {
          list.push(...list_right)
        }
      } else if (matchCommon1) {
        // 其它匹配模式
        let s = matchCommon1[0]
        let index = str.indexOf(s)

        let strLeft = str.substring(0, index)
        let strMid = s
        let strRight = str.substring(index + s.length)

        let list_left
        if (strLeft) {
          list_left = matchHandler(strLeft)
        }

        let list_right
        if (strRight) {
          list_right = matchHandler(strRight)
        }

        if (list_left) {
          list.push(...list_left)
        }

        list.push(strMid)

        if (list_right) {
          list.push(...list_right)
        }
      } else if (matchCommon2) {
        // 其它匹配模式
        let s = matchCommon2[0]
        let index = str.indexOf(s)

        let strLeft = str.substring(0, index)
        let strMid = s
        let strRight = str.substring(index + s.length)

        let list_left
        if (strLeft) {
          list_left = matchHandler(strLeft)
        }

        let list_right
        if (strRight) {
          list_right = matchHandler(strRight)
        }

        if (list_left) {
          list.push(...list_left)
        }

        list.push(strMid)

        if (list_right) {
          list.push(...list_right)
        }
      } else {
        list.push(str)
      }
      return list
    }

    let list = matchHandler(text)
    return list
  }
}

export default TextSplitTool
