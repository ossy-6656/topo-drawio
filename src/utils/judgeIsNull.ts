import { isEmpty } from '@/utils/is'

// 如果为空，则展示'-'
export const judgeIsNull = (value, unit = null) => {
  if (isEmpty(value)) {
    if (unit) {
      return '-' + unit
    } else {
      return '-'
    }
  } else {
    if (unit) {
      return value + unit
    } else {
      return value
    }
  }
}
