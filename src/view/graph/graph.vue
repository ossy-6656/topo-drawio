<!-- 同源正交图 -->
<template>
  <div style="" class="dwControl">
    <div @click="rotateTermianl()" class="publish">校正终端头</div>
    <div class="attach">
      <label style="user-select: none">
        <input ref="poleEle" type="checkbox" @change="poleHelperHandler()" checked />
        柱上辅助
      </label>
    </div>
  </div>
  <div class="graphCon" id="graphCon">
    <!--        <div class="geEditor" id="geEditor"></div>-->
    <div class="geEditor" :id="geEditor"></div>
    <div id="geInfo">
      <div class="geBlock">
        <h1>图形编辑工具</h1>
        <h2 id="geStatus">加载中...</h2>
      </div>
    </div>
  </div>
  <Dialog
      :title="'多设备缩放'"
      :fullscreen="false"
      v-model="scaleDialogShow"
      :close-on-click-modal="false"
      width="300px"
      height="200px"
      :modal="false"
      class="zdy-drawer-class"
      @close="propsModelFrom = {}"
  >
    <table style="width: 100%">
      <tr>
        <td>缩放：</td>
        <td><input type="range" ref="scaleDom" style="width: 100%" min="1" max="100" step="1.1" value="10" @change="scaleCellsHandler($event)"/></td>
        <td><input type="text" v-model="scaleNum" style="width: 20px;" @keydown.enter="scaleKeyboardHandler($event)"/></td>
      </tr>
    </table>
  </Dialog>
</template>

<script setup>
import {useRoute} from "vue-router";
import {ref, onMounted, onActivated, onBeforeUnmount, onDeactivated} from 'vue';
import GraphUtil from '@/plugins/tmzx/graph/GraphUtil.js';

import '@/plugins/tmzx/graph/graph.js';
import '@/views/tmzx/graph/ty/override';
import TySvgParser from "@/views/tmzx/graph/ty/TySvgParser.js";
import App from "@/views/tmzx/graph/ty/App";
import {getZjtSvg} from "@/api/tmzx/svg/index.ts";
import $bus from '@/utils/bus';
import {checkEditZjtPermission} from "@/api/tmzx/abnormalchange/index.ts";
import {ElMessage} from "element-plus";
import LGSvgParser from "@/views/tmzx/graph/lg/LGSvgParser";
import customSymbolStr from "@/views/tmzx/graph/data/symbol";

mxGraphHandler.prototype.previewColor = '#fff';
let tysvgParser;
window['drawflag'] = 0;
window['disableOper'] = true; // 禁用操作
// import _svg from './data/data'; // 测试数据

window.App = App;
const route = useRoute();
let {id, taskId, name} = route.query;

if (name) {
  document.title = name;
}

defineOptions({
  name: "el-graph"
});

let uiEditor;
let poleEle = ref()
// 重新调整终端头到正确位置
function rotateTermianl() {
  let symbolMap = tysvgParser.getSymbolMap();
  GraphUtil.resetTerminalAll(tysvgParser.graph, symbolMap);
}

// --------------------------------多设备缩放开始--------------------------------
let scaleDialogShow = ref(false)
// 多设备缩放
let scaleDom = ref()
let scaleNum = ref(10)
let scaleMap, scaleList
$bus.on('multiScale_zjt', (obj) => {
  scaleDialogShow.value = true
  scaleMap = obj.scaleMap
  scaleList = obj.scaleList
})

function scaleCellsHandler() {
  let s = scaleDom.value.value
  if (s == 1) {
    return;
  }

  scaleNum.value = s;
  tysvgParser.scaleMulti(s, scaleMap, scaleList)
}
function scaleKeyboardHandler(evt) {
  let s = scaleDom.value.value = scaleNum.value;
  if (s == 1) {
    return;
  }

  tysvgParser.scaleMulti(s, scaleMap, scaleList)
}

let conid = 'geEditor_' + new Date().getTime();
let geEditor = ref(conid);
let init = (svgstr) =>
{
  tysvgParser = new TySvgParser(id);
  tysvgParser.taskId = taskId;
  tysvgParser.loadSvg(svgstr, () =>
  {
    tysvgParser.parseStencil(); // 先初始化图元
    initEditFun(svgstr, tysvgParser);
  });
}

let initEditFun = (svgstr, tysvgParser) =>
{
  App['main']((ui) =>
  {
    tysvgParser.ui = ui;
    let svgTxtObj = tysvgParser.getSvgSymbolStyle(svgstr);
    ui.setSvgTxtObj(svgTxtObj);
    ui.setBackgroundColor('#000');
    // uiEditor = ui;
  }, null, conid, tysvgParser);
}

function poleHelperHandler() {
  let ele = poleEle.value
  let ch = ele.checked
  if (tysvgParser) {
    tysvgParser.poleHelper = ch
  }
}
onMounted(() =>
{

  const params = {
    psrId: id,
    id: taskId
  }

  checkEditZjtPermission(params)
      .then((data) => {
        if(!data){
          ElMessage.error('当前正交图不可编辑')
          return;
        }else{
          App.isMainCalled = false;
          if (uiEditor)
          {
            uiEditor.destroy();
            uiEditor = null;
          }
          getZjtSvg(id, taskId)
              .then((res) => {
                if(!res.msg){
                  let obj = res.data;
                  let svgstr = obj.svgstr;
                  init(svgstr);
                  //   init(_svg);
                } else {
                  ElMessage.error('正交图打开失败:' + res.msg)
                }
              });
        }
      });

  // 这个用于测试
  // init(_svg);
});

onBeforeUnmount(() => {
  $bus.off('multiScale_zjt')
  try
  {
    if (uiEditor)
    {
      uiEditor.destroy();
      uiEditor = null;
    }
  } catch (e)
  {
    console.log('图形编辑器：', '销毁异常...');
  }
});
let scrollLeft = 500, scrollTop = 500;

// onDeactivated(() => {
//     if (uiEditor)
//     {
//         let obj = uiEditor.getCurrentScrollPosition();
//         let id = 1;
//         // let con = document.querySelector('#graphCon');
//         // let con = uiEditor.parentNode;
//         // scrollLeft = con.scrollLeft;
//         // scrollTop = con.scrollTop;
//     }
//     console.log('graph onDeactivated', Math.random());
// });
onActivated(() => {
  window['drawflag'] = 0;
  window.App = App;
  if (uiEditor)
  {
    window.setTimeout(function () {
      uiEditor.editor.graph.container.scrollLeft = uiEditor.scrollLeft;
      uiEditor.editor.graph.container.scrollTop = uiEditor.scrollTop;
    }, 200);
  }
  console.log('graph onActivated', Math.random());
});


// onActivated(() =>
// {
//     if (uiEditor)
//     {
//         let action = uiEditor.actions.get('fitWindow');
//         if (action)
//         {
//             action.funct();
//         }
//     }
//     // console.log('drawio actived...', Math.random());
// });
</script>

<style scoped lang="scss">
::v-deep *,
::v-deep *::before,
::v-deep *::after {
  box-sizing: content-box; // 这个本应该是个默认值，但被项目给覆盖，需要重设
}

.graphCon {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  line-height: normal;

  ::v-deep>a.geToolbarButton {
    box-sizing: border-box;
  }
}

.geEditor {
  position: absolute;
  width: 100%;
  height: 100%;
  //height: calc(100% - 40px);
}

//::v-deep .geDiagramContainer svg {
//	background-color: rgba(0, 0, 0, 0.66) !important;
//}
.dwControl {
  position: absolute;
  z-index: 10;
  left: 5px;
  top: 80px;
  display: flex;
  width: 180px;
  justify-content: space-around;
  font-size: 12px;
  color: #000;

  div {
    height: 20px;
    line-height: 20px;
    border-radius: 3px;
    text-align: center;
    padding: 2px 5px;
    cursor: pointer;
    font-size: 12px;
    width: 60px;
    background-color: #fff;
    border: 1px #bdbdbd solid;
  }

  div.trunk {
    width: 80px;
    //box-shadow: 0px 0px 1px 2px rgba(39, 225, 0, 0.75);
    //background-color: rgb(62 153 42 / 60%);
  }
  .txt {
    width: 60px;
  }
  .attach {
    width: 70px;
    label {
      cursor: pointer;
      display: flex;
      align-items: center;

      input {
        margin-right: 2px;
      }
    }
  }
}
</style>
