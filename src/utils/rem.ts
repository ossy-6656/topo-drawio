const baseSize = 22 //32
// 设置 rem 函数
function setRem() {
  const basePc = baseSize / 192 // 表示1920的设计图,使用100PX的默认值
  let vW = window.innerWidth // 当前窗口的宽度
  const vH = window.innerHeight // 当前窗口的高度
  // 非正常屏幕下的尺寸换算
  const dueH = (vW * 1080) / 1920
  console.log(dueH)
  if (vH < dueH) {
    // 当前屏幕高度小于应有的屏幕高度，就需要根据当前屏幕高度重新计算屏幕宽度
    vW = (vH * 1920) / 1080
  }
  const rem = vW * basePc // 以默认比例值乘以当前窗口宽度,得到该宽度下的相应font-size值
  console.log(rem, 'rem')
  document.documentElement.style.fontSize = rem + 'px'
} // 初始化
setRem()
// 改变窗口大小时重新设置 rem
window.onresize = function () {
  setRem()
}
