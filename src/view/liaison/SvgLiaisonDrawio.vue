<template>
  <div class="svg-liaison-drawio-demo">
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="label">SVG 站间联络 JSON</span>
        <select v-model="selectedFile" class="file-select">
          <option v-for="item in sampleFiles" :key="item.path" :value="item.path">
            {{ item.label }}
          </option>
        </select>
        <button class="action-btn" :disabled="loading" @click="loadSelectedFile">
          {{ loading ? '加载中...' : '重新加载' }}
        </button>
        <button class="action-btn primary" type="button" :disabled="!liaisonDoc || !uiEditor" @click="saveLiaisonWork">
          保存图形与 JSON
        </button>
        <button class="action-btn" type="button" :disabled="!liaisonDoc || !uiEditor" @click="regenerateFromJson">
          重新算法成图
        </button>
        <button
          class="action-btn"
          type="button"
          :disabled="!canUndo || loading"
          title="撤销 JSON 编辑（Ctrl+Z）"
          @click="undoLiaisonEdit"
          v-if="false"
        >
          撤销
        </button>
        <button
          class="action-btn"
          type="button"
          :disabled="!canRedo || loading"
          title="重做 JSON 编辑（Ctrl+Shift+Z）"
          @click="redoLiaisonEdit"
           v-if="false"
        >
          重做
        </button>
        <button
          class="action-btn"
          type="button"
          :disabled="!liaisonDoc || !uiEditor || loading"
          title="保留已保存布局，仅从 JSON 刷新 P/Q、潮流箭头与开关状态"
          @click="refreshMeasurementsFromJson"
        >
          刷新量测
        </button>
      </div>
      <div class="toolbar-right">
        <button class="toolbar-add-btn station" type="button" :disabled="!liaisonDoc" @click="openAddStationDialog">
          <span class="toolbar-add-icon" aria-hidden="true">◎</span>
          新增变电站
        </button>
        <button class="toolbar-add-btn channel" type="button" :disabled="!liaisonDoc" @click="openAddChannelDialog">
          <span class="toolbar-add-icon" aria-hidden="true">━</span>
          新增线路
        </button>
        <div class="theme-toggle" role="group" aria-label="画布主题">
          <button
            type="button"
            class="theme-toggle-btn"
            :class="{ active: canvasTheme === 'dark' }"
            :disabled="!liaisonDoc"
            @click="applyCanvasTheme('dark')"
          >
            暗色
          </button>
          <button
            type="button"
            class="theme-toggle-btn"
            :class="{ active: canvasTheme === 'light' }"
            :disabled="!liaisonDoc"
            @click="applyCanvasTheme('light')"
          >
            亮色
          </button>
        </div>
      </div>
    </div>

    <div class="content-wrap">
      <div id="graphCon" class="canvas-wrapper" :class="[`canvas-theme-${canvasTheme}`, { 'editor-booting': !editorReady }]">
        <div class="geEditor liaison-drawio-root" :id="editorId"></div>
        <div v-show="loading" class="loading-mask">正在生成 draw.io 站间联络图...</div>
      </div>

      <aside class="info-panel">
        <header class="info-panel-head">
          <h3 class="info-title">设备信息与编辑</h3>
          <p class="info-subtitle">选中图元后可查看概要并修改关联 JSON</p>
        </header>

        <div v-if="!selectedInfo" class="empty-tip">
          <div class="empty-tip-card">
            <p class="empty-tip-lead">尚未选中设备</p>
            <ul class="empty-tip-list">
              <li>点击<strong>变电站</strong>、<strong>线路</strong>或<strong>开关</strong>查看属性</li>
              <li>在本面板修改字段会同步到 JSON 与图形</li>
              <li>拖拽<strong>变电站</strong>、<strong>开关</strong>或<strong>线路名称</strong>可微调布局；使用「保存图形与 JSON」持久化</li>
              <li>选中<strong>变电站</strong>或<strong>线路名称</strong>后可用<strong>方向键</strong>精确微移（Shift 加大步长）</li>
            </ul>
          </div>
        </div>

        <div v-else class="info-body">
          <span class="info-type-badge" :class="`kind-${selectedInfo.kind || 'unknown'}`">
            {{ selectedInfo.typeLabel }}
          </span>

          <section v-if="selectedInfo.fields && Object.keys(selectedInfo.fields).length" class="info-section summary-card">
            <h4 class="section-title">概要</h4>
            <dl class="kv-list">
              <template v-for="(val, key) in selectedInfo.fields" :key="key">
                <dt class="kv-key">{{ key }}</dt>
                <dd class="kv-val">{{ val }}</dd>
              </template>
            </dl>
          </section>

          <section
            v-if="editSelection?.kind === 'station' && stationEditRow"
            class="info-section edit-section"
          >
            <h4 class="section-title">编辑变电站</h4>
            <div class="edit-form">
              <label class="field">
                <span class="field-label">站点名称</span>
                <el-input
                  v-model="stationEditRow.station_name"
                  placeholder="站点名称"
                  clearable
                  @change="applyStationGraphEdit"
                />
              </label>
              <label class="field">
                <span class="field-label">电压等级 (kV)</span>
                <el-select
                  v-model="stationEditRow.vn_kv"
                  placeholder="电压"
                  @change="applyStationGraphEdit"
                >
                  <el-option v-for="kv in voltageOptions" :key="kv" :label="`${kv} kV`" :value="kv" />
                </el-select>
              </label>
              <label class="field">
                <span class="field-label">站点 ID</span>
                <el-input
                  v-model="stationEditRow.station_id"
                  placeholder="station_id"
                  clearable
                  @blur="onStationIdBlur"
                />
              </label>
            </div>
            <div class="bus-list-editor station-edit-bus">
              <div class="field-label bus-list-title">母线列表（至少 1 条）</div>
              <p class="hint-line">线路连接母线；重命名会同步到相关线路。</p>
              <div
                v-for="(_, idx) in stationEditRow.bus_name_list"
                :key="`station-bus-${idx}`"
                class="bus-list-row"
              >
                <el-input
                  v-model="stationEditRow.bus_name_list[idx]"
                  :placeholder="suggestedBusName(stationEditRow.station_name, stationEditRow.vn_kv, idx + 2)"
                  clearable
                  @change="applyStationBusListEdit(idx)"
                />
                <button
                  class="bus-list-remove"
                  type="button"
                  :disabled="stationEditRow.bus_name_list.length <= 1"
                  @click="removeStationEditBus(idx)"
                >
                  删除
                </button>
              </div>
              <button class="btn-secondary btn-block" type="button" @click="addStationEditBus">+ 新增母线</button>
            </div>
            <div class="trafo-list-editor">
              <div class="field-label trafo-list-title">主变列表</div>
              <p class="hint-line">名称取自 trafo_name_list（仅编辑展示，图上不显示）；P/Q 对应 trafo_display_list。</p>
              <div
                v-for="idx in stationTrafoEditCount"
                :key="`station-trafo-${idx - 1}`"
                class="trafo-list-row"
              >
                <span class="trafo-list-index">#{{ idx }}</span>
                <el-input
                  v-model="stationEditRow.trafo_name_list[idx - 1]"
                  placeholder="主变名称"
                  clearable
                  @change="applyStationTrafoEdit"
                />
                <el-input
                  v-model="stationEditRow.trafo_display_list[idx - 1].p_mw"
                  placeholder="P (MW)"
                  clearable
                  @change="applyStationTrafoEdit"
                />
                <el-input
                  v-model="stationEditRow.trafo_display_list[idx - 1].q_mvar"
                  placeholder="Q (Mvar)"
                  clearable
                  @change="applyStationTrafoEdit"
                />
                <button class="bus-list-remove" type="button" @click="removeStationEditTrafo(idx - 1)">删除</button>
              </div>
              <button class="btn-secondary btn-block" type="button" @click="addStationEditTrafo">+ 新增主变</button>
            </div>
            <div class="readonly-block">
              <h5 class="readonly-title">其它数据（只读）</h5>
              <dl class="kv-list kv-list-compact">
                <dt>经度 lon</dt>
                <dd>{{ stationReadonlyExtra.lon }}</dd>
                <dt>纬度 lat</dt>
                <dd>{{ stationReadonlyExtra.lat }}</dd>
              </dl>
            </div>
            <button class="btn-danger btn-block" type="button" @click="deleteSelectedStation">删除此站</button>
          </section>

          <section
            v-else-if="editSelection?.kind === 'line' && channelEditRow"
            class="info-section edit-section"
          >
            <h4 class="section-title">编辑线路</h4>
            <p v-if="channelEditRow.channel_name" class="hint-line">
              所属通道：{{ channelEditRow.channel_name }}（同起终点站间多条线路共用）
            </p>
            <p v-if="channelLineCount > 1" class="hint-line">
              当前编辑第 {{ (editSelection.line_index ?? 0) + 1 }} / {{ channelLineCount }} 条线路
            </p>
            <div class="edit-form">
              <label class="field">
                <span class="field-label">起点站</span>
                <el-select v-model="channelEditRow.from_station" filterable @change="applyChannelGraphEdit">
                  <el-option v-for="s in stationOptions" :key="s.id" :label="s.label" :value="s.id" />
                </el-select>
              </label>
              <label class="field">
                <span class="field-label">起点母线</span>
                <el-select
                  v-if="selectedLineRow"
                  v-model="selectedLineRow.from_bus_name"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选择或输入母线"
                  @change="applyLineBusEdit"
                >
                  <el-option v-for="b in editFromBusOptions" :key="b" :label="b" :value="b" />
                </el-select>
              </label>
              <label class="field">
                <span class="field-label">终点站</span>
                <el-select v-model="channelEditRow.to_station" filterable @change="applyChannelGraphEdit">
                  <el-option v-for="s in stationOptions" :key="s.id" :label="s.label" :value="s.id" />
                </el-select>
              </label>
              <label class="field">
                <span class="field-label">终点母线</span>
                <el-select
                  v-if="selectedLineRow"
                  v-model="selectedLineRow.to_bus_name"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选择或输入母线"
                  @change="applyLineBusEdit"
                >
                  <el-option v-for="b in editToBusOptions" :key="b" :label="b" :value="b" />
                </el-select>
              </label>
              <div v-if="selectedLineRow" class="line-metrics-block">
                <dl class="kv-list kv-list-compact">
                  <dt>额定电压 vn_kv (kV)</dt>
                  <dd>{{ channelReadonlyExtra.ratedVn }}</dd>
                  <dt>有功 p_from_MW</dt>
                  <dd>{{ channelReadonlyExtra.pMw }}</dd>
                  <dt>无功 q_from_MVar</dt>
                  <dd>{{ channelReadonlyExtra.qMvar }}</dd>
                  <dt>线路总负载率 loading_percent (%)</dt>
                  <dd>{{ channelReadonlyExtra.loadingPercent }}</dd>
                  <dt>线路总电流 i_ka (kA)</dt>
                  <dd>{{ channelReadonlyExtra.iKa }}</dd>
                  <dt>在运 in_service</dt>
                  <dd>{{ channelReadonlyExtra.inService }}</dd>
                </dl>
              </div>
              <label v-if="selectedLineRow" class="field">
                <span class="field-label">线路名称</span>
                <el-input
                  v-model="selectedLineRow.name"
                  placeholder="线路名称"
                  clearable
                  @change="applyChannelLabelEdit"
                />
              </label>
              <template v-if="selectedLineRow">
                <h5 class="line-params-title">线路参数</h5>
                <p class="hint-line">不参与成图，写入 line_data 供编辑与导出。</p>
                <label class="field">
                  <span class="field-label">型号 (type)</span>
                  <el-input
                    v-model="selectedLineRow.type"
                    placeholder="如 ac_line"
                    clearable
                    @change="applyLineParamsEdit"
                  />
                </label>
                <label class="field">
                  <span class="field-label">电阻 r_ohm_per_km (Ω/km)</span>
                  <el-input
                    v-model="selectedLineRow.r_ohm_per_km"
                    placeholder="Ω/km"
                    clearable
                    @change="applyLineParamsEdit"
                  />
                </label>
                <label class="field">
                  <span class="field-label">电抗 x_ohm_per_km (Ω/km)</span>
                  <el-input
                    v-model="selectedLineRow.x_ohm_per_km"
                    placeholder="Ω/km"
                    clearable
                    @change="applyLineParamsEdit"
                  />
                </label>
                <label class="field">
                  <span class="field-label">电导 g_us_per_km (μS/km)</span>
                  <el-input
                    v-model="selectedLineRow.g_us_per_km"
                    placeholder="μS/km"
                    clearable
                    @change="applyLineParamsEdit"
                  />
                </label>
                <label class="field">
                  <span class="field-label">电纳 c_nf_per_km (nF/km)</span>
                  <el-input
                    v-model="selectedLineRow.c_nf_per_km"
                    placeholder="nF/km"
                    clearable
                    @change="applyLineParamsEdit"
                  />
                </label>
                <label class="field">
                  <span class="field-label">额定载流量 max_i_ka (kA)</span>
                  <el-input
                    v-model="selectedLineRow.max_i_ka"
                    placeholder="kA"
                    clearable
                    @change="applyLineParamsEdit"
                  />
                </label>
                <label class="field">
                  <span class="field-label">长度 length_km (km)</span>
                  <el-input
                    v-model="selectedLineRow.length_km"
                    placeholder="km"
                    clearable
                    @change="applyLineParamsEdit"
                  />
                </label>
              </template>
            </div>
            <div class="switch-manage-block">
              <h5 class="readonly-title">开关</h5>
              <p class="hint-line">每条线路最多 2 个：第 1 个在送端（近起点站），第 2 个在受端（近终点站）。</p>
              <ul v-if="channelSwitchList.length" class="switch-list">
                <li v-for="(sw, idx) in channelSwitchList" :key="idx">
                  <span class="switch-end-tag">{{ idx === 0 ? '送端' : '受端' }}</span>
                  <span>{{ sw.name || '—' }}</span>
                  <span class="switch-state-tag">{{ sw.closed !== false ? '闭合' : '断开' }}</span>
                </li>
              </ul>
              <p v-else class="hint-line">暂无 switch_data；图上为线路投运状态推断的单侧占位开关，可点「新增开关」写入记录。</p>
              <button
                class="btn-secondary btn-block"
                type="button"
                :disabled="!canAddSwitchOnChannel"
                @click="addSwitchToSelectedChannel"
              >
                新增开关
              </button>
            </div>
            <div
              v-if="channelReadonlyExtra.extraLineDataJson || channelReadonlyExtra.switchJson"
              class="readonly-block"
            >
              <h5 class="readonly-title">其它数据（只读）</h5>
              <template v-if="channelReadonlyExtra.extraLineDataJson">
                <p class="readonly-subtitle">其它 line_data 条目</p>
                <pre class="readonly-pre">{{ channelReadonlyExtra.extraLineDataJson }}</pre>
              </template>
              <template v-if="channelReadonlyExtra.switchJson">
                <p class="readonly-subtitle">switch_data</p>
                <pre class="readonly-pre">{{ channelReadonlyExtra.switchJson }}</pre>
              </template>
            </div>
            <button class="btn-danger btn-block" type="button" @click="deleteSelectedChannel">
              {{ deleteLineButtonLabel }}
            </button>
          </section>

          <section
            v-else-if="editSelection?.kind === 'switch' && channelEditRow"
            class="info-section edit-section"
          >
            <h4 class="section-title">编辑开关</h4>
            <div v-if="switchEditRow" class="edit-form">
              <dl class="kv-list kv-list-compact">
                <dt>位置</dt>
                <dd>{{ switchEndLabel }}</dd>
                <dt>线路</dt>
                <dd>{{ channelLineNameForSwitch }}</dd>
              </dl>
              <label class="field">
                <span class="field-label">开关名称</span>
                <el-input
                  v-model="switchEditRow.name"
                  placeholder="开关名称"
                  clearable
                  @change="applySwitchGraphEdit"
                />
              </label>
              <label class="field field-check">
                <el-checkbox v-model="switchEditRow.closed" @change="applySwitchGraphEdit">闭合（closed）</el-checkbox>
              </label>
              <button
                class="btn-danger btn-block"
                type="button"
                :disabled="!canDeleteSelectedSwitch"
                @click="deleteSelectedSwitch"
              >
                删除此开关
              </button>
              <p v-if="!canDeleteSelectedSwitch" class="hint-line">该线路仅有一个开关时不可删除。</p>
            </div>
            <p v-else class="hint-card">
              该开关由线路投运状态推断，无独立 switch_data 记录。请通过「新增线路」或在 JSON 中补充 switch_data。
            </p>
          </section>

          <details class="json-details">
            <summary class="json-details-summary">完整 JSON 字段</summary>
            <pre class="info-json">{{ selectedInfo.pretty }}</pre>
          </details>
        </div>
      </aside>
    </div>

    <el-dialog
      v-model="stationDialogVisible"
      title="新增变电站"
      width="480px"
      destroy-on-close
      align-center
      @closed="resetStationDialogForm"
    >
      <div class="dialog-form">
        <label class="field"
          >站点名称
          <el-input
            v-model="stationDialogForm.station_name"
            placeholder="请输入名称"
            clearable
            @change="onStationDialogMetaChange"
          />
        </label>
        <label class="field"
          >电压等级 (kV)
          <el-select
            v-model="stationDialogForm.vn_kv"
            placeholder="选择电压等级"
            style="width: 100%"
            @change="onStationDialogMetaChange"
          >
            <el-option v-for="kv in voltageOptions" :key="kv" :label="`${kv} kV`" :value="kv" />
          </el-select>
        </label>
        <label class="field"
          >站点 ID（可改）
          <el-input v-model="stationDialogForm.station_id" placeholder="自动生成" clearable
        /></label>
        <div class="bus-list-editor">
          <div class="field-label bus-list-title">母线列表（至少 1 条）</div>
          <p class="hint-line dialog-hint">线路连接母线而非直连变电站；命名如「庆丰站.115.2」。</p>
          <div v-for="(_, idx) in stationDialogForm.bus_names" :key="idx" class="bus-list-row">
            <el-input
              v-model="stationDialogForm.bus_names[idx]"
              :placeholder="suggestedBusName(stationDialogForm.station_name, stationDialogForm.vn_kv, idx + 2)"
              clearable
            />
            <button
              class="bus-list-remove"
              type="button"
              :disabled="stationDialogForm.bus_names.length <= 1"
              @click="removeStationDialogBus(idx)"
            >
              删除
            </button>
          </div>
          <button class="btn-secondary btn-block" type="button" @click="addStationDialogBus">+ 新增母线</button>
        </div>
      </div>
      <template #footer>
        <el-button @click="stationDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddStation">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="channelDialogVisible"
      title="新增线路"
      width="480px"
      destroy-on-close
      align-center
      @closed="resetChannelDialogForm"
    >
      <div class="dialog-form">
        <p class="hint-line dialog-hint">线路连接变电站母线；同起终点站间多条线路归入同一通道。</p>
        <label class="field"
          >起点站
          <el-select
            v-model="channelDialogForm.from_station"
            placeholder="起点站"
            filterable
            style="width: 100%"
            @change="onChannelDialogStationChange"
          >
            <el-option v-for="s in stationOptions" :key="s.id" :label="s.label" :value="s.id" />
          </el-select>
        </label>
        <label class="field"
          >起点母线
          <el-select
            v-model="channelDialogForm.from_bus_name"
            placeholder="选择或输入母线"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option v-for="b in channelDialogFromBusOptions" :key="b" :label="b" :value="b" />
          </el-select>
        </label>
        <label class="field"
          >终点站
          <el-select
            v-model="channelDialogForm.to_station"
            placeholder="终点站"
            filterable
            style="width: 100%"
            @change="onChannelDialogStationChange"
          >
            <el-option v-for="s in stationOptions" :key="s.id" :label="s.label" :value="s.id" />
          </el-select>
        </label>
        <label class="field"
          >终点母线
          <el-select
            v-model="channelDialogForm.to_bus_name"
            placeholder="选择或输入母线"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option v-for="b in channelDialogToBusOptions" :key="b" :label="b" :value="b" />
          </el-select>
        </label>
        <label class="field">线路名称 <el-input v-model="channelDialogForm.line_name" placeholder="线路名称" clearable /></label>
        <label class="field"
          >送端开关名称（可选，近起点站）
          <el-input v-model="channelDialogForm.switch_from_name" placeholder="不填则不创建送端开关" clearable />
        </label>
        <label class="field"
          >受端开关名称（可选，近终点站）
          <el-input
            v-model="channelDialogForm.switch_to_name"
            placeholder="不填则不创建受端开关"
            clearable
            :disabled="!channelDialogForm.switch_from_name?.trim()"
          />
        </label>
        <p class="hint-line dialog-hint">受端开关需先填写送端名称；每条线路最多两个开关。</p>
      </div>
      <template #footer>
        <el-button @click="channelDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddChannel">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="stationNavDialogVisible"
      title="请选择跳转目标"
      width="380px"
      append-to-body
      align-center
      :close-on-click-modal="false"
      class="station-nav-dialog"
      :show-close="true"
    >
      <div class="station-nav-options">
        <button type="button" class="station-nav-option primary" @click="goStationNavLv2">
          区域级高压配网联络图
        </button>
        <button type="button" class="station-nav-option" @click="goStationNavPgrsd">
          区域级中压配网系统图
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import '@/plugins/tmzx/graph/graph.js'
import '@/view/graph/lg/override.js'
import App from '@/view/graph/lg/App'
import SvgLiaisonDrawioParser, { applyLiaisonFlowMotionArrows } from './SvgLiaisonDrawioParser'
import {
  captureGraphViewState,
  clearLiaisonBundle,
  downloadLiaisonBundle,
  exportEditorGraphXml,
  fitLiaisonGraphToWindow,
  importEditorGraphXml,
  loadLiaisonBundleWithFallback,
  saveLiaisonBundle,
} from './SvgLiaisonGraphPersistence'
import { normalizeAndSlimLiaisonEnvelope } from './SvgLiaisonJsonSlim'

const router = useRouter()
const route = useRoute()

/** Element Plus 确认框按钮中文 */
const msgboxConfirmOpts = {
  confirmButtonText: '确定',
  cancelButtonText: '取消',
}

/** 两级站间图示例：lv1 区域概览，lv2 站内展开 */
const LIAISON_LEVEL_FILES = {
  lv1: '/svgLiaisonJson/新乡220-500.json',
  lv2: '/svgLiaisonJson/府城站.json',
}

function resolveLiaisonLevelFromRoute(r = route) {
  const type = String(r.query?.type || 'lv1').toLowerCase()
  return type === 'lv2' ? 'lv2' : 'lv1'
}

function resolveLiaisonFileFromRoute(r = route) {
  return LIAISON_LEVEL_FILES[resolveLiaisonLevelFromRoute(r)]
}

const liaisonDemoLevel = computed(() => resolveLiaisonLevelFromRoute())

/** Parser 选项：演示默认不展示量测与潮流箭头，点「刷新量测」后再开 */
function liaisonParserOptions() {
  return {
    showLabels: true,
    showMeasurements: false,
    theme: canvasTheme.value,
  }
}

const sampleFiles = [
  { label: '新乡220-500.json', path: LIAISON_LEVEL_FILES.lv1 },
  { label: '府城站.json', path: LIAISON_LEVEL_FILES.lv2 },
  { label: '庆丰站.json', path: '/svgLiaisonJson/庆丰站.json' },
  { label: '滨河站.json', path: '/svgLiaisonJson/滨河站.json' },
  { label: '原武站.json', path: '/svgLiaisonJson/原武站.json' },
  { label: '兰湾站.json', path: '/svgLiaisonJson/兰湾站.json' },
  { label: '人民.json', path: '/svgLiaisonJson/人民.json' },
  { label: '徐庄.json', path: '/svgLiaisonJson/徐庄.json' },
]

const selectedFile = ref(resolveLiaisonFileFromRoute())
const loading = ref(false)
const canvasTheme = ref('light')

const CANVAS_THEMES = {
  dark: { bg: '#000000', grid: '#252525' },
  light: { bg: '#ffffff', grid: '#e5e7eb' },
}
const selectedInfo = ref(null)
const canUndo = ref(false)
const canRedo = ref(false)
/** @type {import('vue').Ref<{ kind: 'station'|'line'|'switch', doc_station_index?: number, doc_channel_index?: number, switch_doc_index?: number|null, switch_end?: string } | null>} */
const editSelection = ref(null)
const editorId = ref(`svg_liaison_drawio_${Date.now()}`)
/** draw.io 初始化完成前隐藏画布，避免侧栏/样式面板闪烁 */
const editorReady = ref(false)

let panelHideObserver = null
/** 与保存、解析共用同一引用（中心化文档） */
const liaisonDoc = ref(null)
const liaisonParser = shallowRef(null)
/** 待载入的已保存图形 XML（有则跳过首次 parseSvg） */
const pendingSavedGraphXml = ref(null)
/** 与 graphXml 配套的缩放/平移（setGraphXml 会重置视口） */
const pendingSavedViewState = ref(null)

/** 成图常用电压（kV），与解析器 ≥35kV 过滤一致 */
const voltageOptions = [330, 220, 230, 115, 110, 66, 35]

const stationDialogVisible = ref(false)
const stationDialogForm = ref({ station_name: '', vn_kv: 110, station_id: '', bus_names: [''] })
/** 选中变电站时母线列表快照，用于重命名时同步通道 */
const stationBusEditSnapshot = ref([])

const channelDialogVisible = ref(false)
const stationNavDialogVisible = ref(false)
/** @type {import('vue').Ref<{ station_id: string, station_name: string } | null>} */
const stationNavTarget = ref(null)
const channelDialogForm = ref({
  from_station: '',
  to_station: '',
  from_bus_name: '',
  to_bus_name: '',
  line_name: '',
  switch_from_name: '',
  switch_to_name: '',
})

/** 选中变电站后用于 station_id 修改时回写通道引用 */
const stationIdSnapshot = ref('')

function genStationId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `st_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

let uiEditor = null
window.drawflag = 0
window.disableOper = false
window.customShape = false
window.App = App

const undoStack = []
const redoStack = []
const UNDO_STACK_LIMIT = 50
let lastHistoryData = null

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function updateUndoRedoFlags() {
  canUndo.value = undoStack.length > 0
  canRedo.value = redoStack.length > 0
}

function clearUndoRedoHistory() {
  undoStack.length = 0
  redoStack.length = 0
  lastHistoryData = liaisonDoc.value?.data ? cloneJson(liaisonDoc.value.data) : null
  updateUndoRedoFlags()
}

function pushUndoSnapshot(label = '') {
  if (!liaisonDoc.value?.data) return
  const snapshot = lastHistoryData ? cloneJson(lastHistoryData) : cloneJson(liaisonDoc.value.data)
  undoStack.push({ label, data: snapshot })
  if (undoStack.length > UNDO_STACK_LIMIT) undoStack.shift()
  redoStack.length = 0
  window.setTimeout(() => {
    if (liaisonDoc.value?.data) lastHistoryData = cloneJson(liaisonDoc.value.data)
  }, 0)
  updateUndoRedoFlags()
}

async function refreshGraphAfterHistoryRestore() {
  selectedInfo.value = null
  editSelection.value = null
  if (!liaisonDoc.value) return
  liaisonParser.value = new SvgLiaisonDrawioParser(liaisonDoc.value, liaisonParserOptions())
  liaisonParser.value.skipInitialParseSvg = false
  destroyEditor()
  await nextTick()
  mountEditor(liaisonParser.value)
}

async function undoLiaisonEdit() {
  if (!liaisonDoc.value?.data || undoStack.length === 0) return
  redoStack.push({ label: 'redo', data: cloneJson(liaisonDoc.value.data) })
  const prev = undoStack.pop()
  liaisonDoc.value.data = cloneJson(prev.data)
  lastHistoryData = cloneJson(liaisonDoc.value.data)
  await refreshGraphAfterHistoryRestore()
  updateUndoRedoFlags()
  ElMessage.success('已撤销')
}

async function redoLiaisonEdit() {
  if (!liaisonDoc.value?.data || redoStack.length === 0) return
  undoStack.push({ label: 'undo', data: cloneJson(liaisonDoc.value.data) })
  const next = redoStack.pop()
  liaisonDoc.value.data = cloneJson(next.data)
  lastHistoryData = cloneJson(liaisonDoc.value.data)
  await refreshGraphAfterHistoryRestore()
  updateUndoRedoFlags()
  ElMessage.success('已重做')
}

function handleLiaisonUndoRedoShortcut(event) {
  if (!(event.ctrlKey || event.metaKey)) return
  const key = String(event.key || '').toLowerCase()
  if (key !== 'z' && key !== 'y') return
  const active = document.activeElement
  const tag = String(active?.tagName || '').toLowerCase()
  const isTyping = tag === 'input' || tag === 'textarea' || active?.isContentEditable
  if (isTyping) return
  if (key === 'z' && event.shiftKey) {
    event.preventDefault()
    redoLiaisonEdit()
  } else if (key === 'z') {
    event.preventDefault()
    undoLiaisonEdit()
  } else if (key === 'y') {
    event.preventDefault()
    redoLiaisonEdit()
  }
}

function normalizeLiaisonEnvelope(raw, opts) {
  const doc = normalizeAndSlimLiaisonEnvelope(raw, opts)
  if (doc._slimmed) {
    console.info('[liaison] 已自动精简 JSON（剔除未成图字段与 <35kV 站）')
  }
  return doc
}

function destroyEditor() {
  App.isMainCalled = false
  panelHideObserverPaused = false
  if (panelHideObserver) {
    panelHideObserver.disconnect()
    panelHideObserver = null
  }
  if (uiEditor) {
    uiEditor.destroy()
    uiEditor = null
  }
}

/** draw.io 默认工具条高度（缩放、适应窗口等） */
function liaisonToolbarHeight() {
  if (typeof EditorUi !== 'undefined' && EditorUi.prototype?.toolbarHeight != null) {
    return EditorUi.prototype.toolbarHeight
  }
  return 38
}

/** 站间联络只保留缩放与撤销/重做，隐藏格式侧栏、删除、图层、填色、连线样式等 */
const LIAISON_TOOLBAR_HIDE_RE =
  /geSprite-formatpanel|geSprite-delete|geSprite-tofront|geSprite-toback|geSprite-fillcolor|geSprite-strokecolor|geSprite-shadow|geSprite-connection|geSprite-orthogonal|geSprite-straight|geSprite-horizontalelbow|geSprite-verticalelbow|geSprite-linkedge|geSprite-arrow|geSprite-simplearrow|geSprite-curved|geSprite-entity|geSprite-plus|geSprite-table|geSprite-pencil|geSprite-freestyle/i

function pruneLiaisonToolbar(container, editor) {
  if (editor?.toggleFormatElement) {
    editor.toggleFormatElement.style.display = 'none'
    editor.toggleFormatElement.style.visibility = 'hidden'
    editor.toggleFormatElement.style.pointerEvents = 'none'
  }
  const bar = container?.querySelector('.geToolbar')
  if (!bar) return
  const hideToolbarChild = (child) => {
    child.style.display = 'none'
    child.style.visibility = 'hidden'
    child.style.pointerEvents = 'none'
    child.style.width = '0'
    child.style.minWidth = '0'
    child.style.margin = '0'
    child.style.padding = '0'
  }
  Array.from(bar.children).forEach((child) => {
    const cls = child.className || ''
    if (/\bgeSeparator\b/.test(cls)) {
      hideToolbarChild(child)
      return
    }
    const blob = `${cls} ${child.innerHTML || ''}`
    if (LIAISON_TOOLBAR_HIDE_RE.test(blob)) {
      hideToolbarChild(child)
    }
  })
}

function hideBuiltinPanels() {
  const container = document.getElementById(editorId.value)
  if (!container) return

  const menubar = container.querySelector('.geMenubarContainer')
  const sidebar = container.querySelector('.geSidebarContainer') || container.querySelector('.geSidebar')
  const hsplit = container.querySelector('.geHsplit')
  const format = container.querySelector('.geFormatContainer')
  const split2 = container.querySelector('.geVsplit')
  const diagramContainer = container.querySelector('.geDiagramContainer')
  const toolbar = container.querySelector('.geToolbarContainer')
  const footer = container.querySelector('.geFooterContainer')
  const tabBar = container.querySelector('.geTabContainer')

  const hideEl = (el) => {
    if (!el) return
    el.style.display = 'none'
    el.style.height = '0'
    el.style.maxHeight = '0'
    el.style.overflow = 'hidden'
  }

  hideEl(menubar)
  hideEl(sidebar)
  hideEl(hsplit)
  hideEl(format)
  hideEl(split2)
  hideEl(footer)
  hideEl(tabBar)

  if (sidebar) sidebar.style.width = '0'
  if (format) format.style.width = '0'

  const tbH = liaisonToolbarHeight()
  if (toolbar) {
    toolbar.style.display = ''
    toolbar.style.visibility = 'visible'
    toolbar.style.height = `${tbH}px`
    toolbar.style.maxHeight = ''
    toolbar.style.overflow = 'visible'
    toolbar.style.width = ''
    toolbar.style.maxWidth = ''
    toolbar.style.pointerEvents = ''
    toolbar.style.top = '0'
    toolbar.style.left = '0'
    toolbar.style.right = '0'
  }

  if (uiEditor) {
    const needRefresh =
      uiEditor.menubarHeight !== 0 ||
      uiEditor.toolbarHeight !== tbH ||
      uiEditor.footerHeight !== 0
    uiEditor.menubarHeight = 0
    uiEditor.toolbarHeight = tbH
    uiEditor.footerHeight = 0
    if (needRefresh && typeof uiEditor.refresh === 'function') {
      uiEditor.refresh(false)
    }
  }

  pruneLiaisonToolbar(container, uiEditor)

  if (diagramContainer) {
    diagramContainer.style.left = '0'
    diagramContainer.style.right = '0'
  }
}

/** 成图/导入 XML 期间暂停：避免数千次 DOM 变更各触发一次 hideBuiltinPanels */
let panelHideObserverPaused = false

function pauseBuiltinPanelHideObserver() {
  panelHideObserverPaused = true
  if (panelHideObserver) {
    panelHideObserver.disconnect()
    panelHideObserver = null
  }
}

function resumeBuiltinPanelHideObserver() {
  panelHideObserverPaused = false
  installBuiltinPanelHideObserver()
}

/** draw.io 异步插入侧栏时持续压制，避免首屏闪烁 */
function installBuiltinPanelHideObserver() {
  if (panelHideObserverPaused) return
  if (panelHideObserver) {
    panelHideObserver.disconnect()
    panelHideObserver = null
  }
  const root = document.getElementById(editorId.value)
  if (!root) return
  hideBuiltinPanels()
  panelHideObserver = new MutationObserver(() => hideBuiltinPanels())
  panelHideObserver.observe(root, { childList: true, subtree: true })
}

function markEditorReady() {
  hideBuiltinPanels()
  resumeBuiltinPanelHideObserver()
  editorReady.value = true
  loading.value = false
}

/** 关闭 draw.io 右键菜单（线段/图元/画布），并屏蔽画布上的浏览器右键菜单 */
function disableLiaisonDrawioContextMenus(graph) {
  if (!graph?.popupMenuHandler) return
  if (typeof graph.popupMenuHandler.setEnabled === 'function') {
    graph.popupMenuHandler.setEnabled(false)
  }
  graph.popupMenuHandler.factoryMethod = function () {}
  if (graph.container && typeof mxEvent !== 'undefined' && typeof mxEvent.disableContextMenu === 'function') {
    mxEvent.disableContextMenu(graph.container)
  }
}

function getParser() {
  return liaisonParser.value
}

function getGraph() {
  return uiEditor?.editor?.graph
}

/**
 * 视口稳定后再居中并刷新量测/运动箭头（setGraphXml 会重置 scale；保存的 translate 在 remount 后易偏位）。
 */
function finishLiaisonEditorAfterGraphReady(
  ui,
  graph,
  parser,
  { loadedFromSavedLayout = false } = {}
) {
  parser.enableManualEdit()

  const finalize = () => {
    disableLiaisonDrawioContextMenus(graph)
    if (ui.editor) {
      ui.editor.setModified(false)
      if (ui.editor.undoManager?.clear) ui.editor.undoManager.clear()
    }
    applyCanvasTheme(canvasTheme.value)
    markEditorReady()

    requestAnimationFrame(() => {
      fitLiaisonGraphToWindow(ui)
      if (graph.view?.validate) graph.view.validate()
      parser.syncMeasurementsFromDoc()
    })
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(finalize)
  })
}

/** 编辑器就绪：载入已保存图形，或沿用 App 已执行的首次算法成图 */
function finalizeEditorMount(ui) {
  const graph = ui.editor?.graph
  const parser = getParser()
  if (!graph || !parser) return

  parser.setGraph(graph)
  parser.setData(liaisonDoc.value)
  parser.options.showLabels = true
  parser.options.theme = canvasTheme.value

  if (pendingSavedGraphXml.value) {
    const xml = pendingSavedGraphXml.value
    pendingSavedGraphXml.value = null
    pendingSavedViewState.value = null
    const ok = importEditorGraphXml(ui.editor, xml)
    if (!ok) {
      ElMessage.warning('已保存图形无法解析，将按 JSON 重新算法成图')
      parser.skipInitialParseSvg = false
      parser.parseSvg()
      finishLiaisonEditorAfterGraphReady(ui, graph, parser, { loadedFromSavedLayout: false })
    } else {
      parser.rebindEntityInfo()
      finishLiaisonEditorAfterGraphReady(ui, graph, parser, {
        loadedFromSavedLayout: true,
      })
    }
    return
  }

  finishLiaisonEditorAfterGraphReady(ui, graph, parser, { loadedFromSavedLayout: false })
}

function mountEditor(parser) {
  editorReady.value = false
  loading.value = true
  pauseBuiltinPanelHideObserver()
  hideBuiltinPanels()

  App.main(
    (ui) => {
      uiEditor = ui
      ui.setSvgTxtObj({})
      applyCanvasTheme(canvasTheme.value, { skipParser: true })
      const graph = ui.editor?.graph
      if (graph && typeof graph.setGridEnabled === 'function') {
        graph.setGridEnabled(false)
      }
      disableLiaisonDrawioContextMenus(graph)
      bindClickInfo(ui.editor.graph)
      bindStationDoubleClick(ui.editor.graph)
      hideBuiltinPanels()

      const finishMount = () => {
        hideBuiltinPanels()
        const g = ui.editor?.graph
        if (g && typeof g.setGridEnabled === 'function') {
          g.setGridEnabled(false)
        }
        finalizeEditorMount(ui)
      }

      if (document.getElementById(editorId.value)?.querySelector('.geDiagramContainer')) {
        finishMount()
      } else {
        requestAnimationFrame(() => requestAnimationFrame(finishMount))
      }
    },
    null,
    editorId.value,
    parser
  )
}

function applyStationGraphEdit() {
  const i = editSelection.value?.doc_station_index
  const parser = getParser()
  if (i == null || i < 0 || !parser) return
  pushUndoSnapshot('编辑变电站')
  parser.setData(liaisonDoc.value)
  parser.updateStationFromDoc(i)
}

function ensureStationEditLists(row) {
  if (!row) return
  if (!Array.isArray(row.bus_name_list) || row.bus_name_list.length === 0) {
    row.bus_name_list = [suggestedBusName(row.station_name, row.vn_kv, 2)]
  }
  if (!Array.isArray(row.trafo_display_list)) {
    row.trafo_display_list = []
  }
  if (!Array.isArray(row.trafo_name_list)) {
    row.trafo_name_list = []
  }
  migrateTrafoNamesFromDisplayList(row)
  syncStationTrafoRowSlots(row)
}

function migrateTrafoNamesFromDisplayList(row) {
  if (!row || row.trafo_name_list.length > 0) return
  const display = row.trafo_display_list || []
  if (!display.length) return
  const fromDisplay = display.map((t) => String(t?.name || t?.trafo_name || '').trim())
  if (fromDisplay.some(Boolean)) {
    row.trafo_name_list = fromDisplay
  }
}

function stationTrafoRowCount(row) {
  if (!row) return 0
  const dl = Array.isArray(row.trafo_display_list) ? row.trafo_display_list.length : 0
  const nl = Array.isArray(row.trafo_name_list) ? row.trafo_name_list.length : 0
  return Math.max(dl, nl)
}

function syncStationTrafoRowSlots(row) {
  if (!row) return
  const n = stationTrafoRowCount(row)
  for (let i = 0; i < n; i++) {
    if (row.trafo_name_list[i] == null) row.trafo_name_list[i] = ''
    if (!row.trafo_display_list[i]) {
      row.trafo_display_list[i] = { p_mw: null, q_mvar: null }
    }
  }
}

function syncStationBusEditSnapshot() {
  const row = stationEditRow.value
  stationBusEditSnapshot.value = Array.isArray(row?.bus_name_list)
    ? row.bus_name_list.map((b) => String(b || '').trim())
    : []
}

function isBusUsedByStation(stationId, busName) {
  const name = String(busName || '').trim()
  if (!stationId || !name) return false
  return (liaisonDoc.value?.data?.channel_data || []).some((ch) =>
    (ch.line_data || []).some(
      (line) =>
        (ch.from_station === stationId && String(line.from_bus_name || '').trim() === name) ||
        (ch.to_station === stationId && String(line.to_bus_name || '').trim() === name)
    )
  )
}

function renameBusInChannels(stationId, oldName, newName) {
  const oldN = String(oldName || '').trim()
  const newN = String(newName || '').trim()
  if (!oldN || !newN || oldN === newN) return []
  const affected = []
  ;(liaisonDoc.value?.data?.channel_data || []).forEach((ch, idx) => {
    let changed = false
    ;(ch.line_data || []).forEach((line) => {
      if (ch.from_station === stationId && String(line.from_bus_name || '').trim() === oldN) {
        line.from_bus_name = newN
        changed = true
      }
      if (ch.to_station === stationId && String(line.to_bus_name || '').trim() === oldN) {
        line.to_bus_name = newN
        changed = true
      }
    })
    if (changed) affected.push(idx)
  })
  return affected
}

function applyStationBusListEdit(changedIdx) {
  const i = editSelection.value?.doc_station_index
  const row = stationEditRow.value
  const parser = getParser()
  if (i == null || i < 0 || !row || !parser) return

  ensureStationEditLists(row)
  const snapshot = stationBusEditSnapshot.value
  const busNames = row.bus_name_list.map((b) => String(b || '').trim()).filter(Boolean)

  if (busNames.length === 0) {
    const fallback = snapshot[changedIdx] || suggestedBusName(row.station_name, row.vn_kv, 2)
    row.bus_name_list[changedIdx ?? 0] = fallback
    ElMessage.warning('母线名称不能为空')
    return
  }

  const seen = new Set()
  for (const name of busNames) {
    if (seen.has(name)) {
      if (changedIdx != null && snapshot[changedIdx]) {
        row.bus_name_list[changedIdx] = snapshot[changedIdx]
      }
      ElMessage.warning('母线名称不能重复')
      return
    }
    seen.add(name)
  }

  row.bus_name_list = busNames

  const affectedChannels = new Set()
  for (let j = 0; j < Math.max(snapshot.length, busNames.length); j++) {
    const oldName = String(snapshot[j] || '').trim()
    const newName = String(busNames[j] || '').trim()
    if (oldName && newName && oldName !== newName) {
      renameBusInChannels(row.station_id, oldName, newName).forEach((ci) => affectedChannels.add(ci))
    }
  }

  stationBusEditSnapshot.value = [...busNames]
  pushUndoSnapshot('编辑母线')
  parser.setData(liaisonDoc.value)
  affectedChannels.forEach((ci) => parser.updateChannelFromDoc(ci))
}

function addStationEditBus() {
  const row = stationEditRow.value
  if (!row) return
  ensureStationEditLists(row)
  let suffix = 2
  row.bus_name_list.forEach((b) => {
    const m = String(b || '').match(/\.(\d+)$/)
    if (m) suffix = Math.max(suffix, Number(m[1]) + 1)
  })
  row.bus_name_list = [...row.bus_name_list, suggestedBusName(row.station_name, row.vn_kv, suffix)]
  stationBusEditSnapshot.value = [...row.bus_name_list]
}

function removeStationEditBus(idx) {
  const row = stationEditRow.value
  if (!row || !Array.isArray(row.bus_name_list) || row.bus_name_list.length <= 1) return
  const name = String(row.bus_name_list[idx] || '').trim()
  if (isBusUsedByStation(row.station_id, name)) {
    ElMessage.warning('该母线已被线路引用，无法删除')
    return
  }
  pushUndoSnapshot('删除母线')
  row.bus_name_list.splice(idx, 1)
  stationBusEditSnapshot.value = [...row.bus_name_list]
  const parser = getParser()
  if (parser) parser.setData(liaisonDoc.value)
}

function applyStationTrafoEdit(opts = {}) {
  const i = editSelection.value?.doc_station_index
  const row = stationEditRow.value
  const parser = getParser()
  if (i == null || i < 0 || !row || !parser) return

  ensureStationEditLists(row)
  row.trafo_name_list = (row.trafo_name_list || []).map((n) => String(n ?? '').trim())
  row.trafo_display_list = (row.trafo_display_list || []).map((t) => {
    const p = t?.p_mw
    const q = t?.q_mvar
    const pNum = p === '' || p == null || Number.isNaN(Number(p)) ? null : Number(p)
    const qNum = q === '' || q == null || Number.isNaN(Number(q)) ? null : Number(q)
    return { p_mw: pNum, q_mvar: qNum }
  })

  if (opts.trimEmpty !== false) {
    while (row.trafo_name_list.length > 0 && row.trafo_display_list.length > 0) {
      const li = row.trafo_name_list.length - 1
      const lastName = row.trafo_name_list[li]
      const lastD = row.trafo_display_list[li]
      const pEmpty = lastD?.p_mw == null && lastD?.q_mvar == null
      if (!lastName && pEmpty && row.trafo_name_list.length === row.trafo_display_list.length) {
        row.trafo_name_list.pop()
        row.trafo_display_list.pop()
      } else {
        break
      }
    }
  }

  syncStationTrafoRowSlots(row)

  pushUndoSnapshot('编辑主变')
  parser.setData(liaisonDoc.value)
  parser.updateStationFromDoc(i)
}

function addStationEditTrafo() {
  const row = stationEditRow.value
  if (!row) return
  ensureStationEditLists(row)
  row.trafo_name_list = [...row.trafo_name_list, '']
  row.trafo_display_list = [...row.trafo_display_list, { p_mw: null, q_mvar: null }]
}

function removeStationEditTrafo(idx) {
  const row = stationEditRow.value
  if (!row || !Array.isArray(row.trafo_display_list)) return
  if (row.trafo_name_list) row.trafo_name_list.splice(idx, 1)
  row.trafo_display_list.splice(idx, 1)
  applyStationTrafoEdit()
}

function applyChannelGraphEdit() {
  const i = editSelection.value?.doc_channel_index
  const ch = channelEditRow.value
  const parser = getParser()
  if (i == null || i < 0 || !ch || !parser) return
  pushUndoSnapshot('编辑线路')
  const fromSt = liaisonDoc.value?.data?.station_data?.find((s) => s.station_id === ch.from_station)
  const toSt = liaisonDoc.value?.data?.station_data?.find((s) => s.station_id === ch.to_station)
  ch.min_vn_kv = Math.min(Number(fromSt?.vn_kv) || 0, Number(toSt?.vn_kv) || 0) || 110
  syncChannelMeta(ch, fromSt, toSt)
  parser.setData(liaisonDoc.value)
  parser.updateChannelFromDoc(i)
}

function applyLineBusEdit() {
  const i = editSelection.value?.doc_channel_index
  const line = selectedLineRow.value
  const ch = channelEditRow.value
  const parser = getParser()
  if (i == null || i < 0 || !line || !ch || !parser) return
  if (!String(line.from_bus_name || '').trim() || !String(line.to_bus_name || '').trim()) {
    ElMessage.warning('起点母线与终点母线不能为空')
    return
  }
  line.from_bus_name = String(line.from_bus_name).trim()
  line.to_bus_name = String(line.to_bus_name).trim()
  pushUndoSnapshot('编辑线路母线')
  const fromSt = liaisonDoc.value?.data?.station_data?.find((s) => s.station_id === ch.from_station)
  const toSt = liaisonDoc.value?.data?.station_data?.find((s) => s.station_id === ch.to_station)
  syncChannelMeta(ch, fromSt, toSt)
  parser.setData(liaisonDoc.value)
  parser.updateChannelFromDoc(i)
}

const LINE_PARAM_NUMERIC_KEYS = [
  'r_ohm_per_km',
  'x_ohm_per_km',
  'g_us_per_km',
  'c_nf_per_km',
  'max_i_ka',
  'length_km',
]

function normalizeLineParamFields(line) {
  if (!line) return
  if (line.type != null) {
    const t = String(line.type).trim()
    if (t) line.type = t
    else delete line.type
  }
  LINE_PARAM_NUMERIC_KEYS.forEach((key) => {
    const v = line[key]
    if (v === '' || v == null) {
      delete line[key]
      return
    }
    const n = Number(v)
    if (!Number.isNaN(n)) line[key] = n
  })
}

function applyLineParamsEdit() {
  const line = selectedLineRow.value
  if (!line || editSelection.value?.kind !== 'line') return
  normalizeLineParamFields(line)
  pushUndoSnapshot('编辑线路参数')
  const parser = getParser()
  if (parser) parser.setData(liaisonDoc.value)
  refreshSelectedLineSummary()
}

function refreshSelectedLineSummary() {
  if (editSelection.value?.kind !== 'line' || !selectedInfo.value) return
  const ch = channelEditRow.value
  if (!ch) return
  const li = editSelection.value.line_index ?? 0
  const line = ch.line_data?.[li]
  const fromSt = liaisonDoc.value?.data?.station_data?.find((s) => s.station_id === ch.from_station)
  const toSt = liaisonDoc.value?.data?.station_data?.find((s) => s.station_id === ch.to_station)
  const info = {
    type: 'line',
    line_index: li,
    line_data: ch.line_data,
    channel_name: ch.channel_name,
    from_station: ch.from_station,
    to_station: ch.to_station,
    from_station_name: fromSt?.station_name,
    to_station_name: toSt?.station_name,
    from_bus_name: line?.from_bus_name,
    to_bus_name: line?.to_bus_name,
    p_from_mw: line?.p_from_mw,
    q_from_mvar: line?.q_from_mvar,
    raw: ch,
  }
  const data = pickKeyFields(info)
  selectedInfo.value = {
    ...selectedInfo.value,
    fields: data,
    pretty: JSON.stringify(data, null, 2),
  }
}

function applyChannelLabelEdit() {
  const i = editSelection.value?.doc_channel_index
  const parser = getParser()
  if (i == null || i < 0 || !parser) return
  pushUndoSnapshot('编辑线路名称')
  parser.setData(liaisonDoc.value)
  const ch = liaisonDoc.value?.data?.channel_data?.[i]
  const li = editSelection.value?.line_index ?? 0
  if ((ch?.line_data?.length || 0) > 1 || li > 0) {
    parser.updateChannelFromDoc(i)
  } else {
    parser.updateChannelLabelOnly(i)
  }
}

function applySwitchGraphEdit() {
  const i = editSelection.value?.doc_channel_index
  if (i == null || i < 0 || editSelection.value?.kind !== 'switch' || !switchEditRow.value) return
  pushUndoSnapshot('编辑开关')
  refreshChannelGraph(i)
}

function addSwitchToSelectedChannel() {
  if (editSelection.value?.kind !== 'line' || !channelEditRow.value) return
  const ch = channelEditRow.value
  if (!Array.isArray(ch.switch_data)) ch.switch_data = []
  if (ch.switch_data.length >= 2) {
    ElMessage.warning('每条线路最多两个开关')
    return
  }
  const lineName = String(selectedLineRow.value?.name || ch.line_data?.[0]?.name || '').trim() || '新线'
  const isToEnd = ch.switch_data.length === 1
  const defaultName = isToEnd ? `${lineName}-受端开关` : `${lineName}-送端开关`
  pushUndoSnapshot('新增开关')
  ch.switch_data.push(createSwitchDataItem(defaultName))
  const ci = editSelection.value.doc_channel_index
  refreshChannelGraph(ci, { fullRedraw: false })
  ElMessage.success(isToEnd ? '已添加受端开关' : '已添加送端开关')
}

/**
 * 与「清空本地缓存 + 重新加载」一致：丢弃已保存 graphXml，从 JSON 文件重新算法成图并重建画布。
 * （不会在旧 graph 实例上仅 parseSvg，避免与 localStorage 缓存、监听器状态不一致。）
 */
async function regenerateFromJson() {
  if (!liaisonDoc.value) return
  try {
    await ElMessageBox.confirm(
      '将清除本页本地保存的图形缓存，并从 JSON 重新算法成图（效果等同清空浏览器缓存后点「重新加载」）。当前手动调整的图形位置会丢失。是否继续？',
      '重新算法成图',
      { type: 'warning', ...msgboxConfirmOpts }
    )
  } catch {
    return
  }

  clearLiaisonBundle(selectedFile.value)
  clearUndoRedoHistory()
  pendingSavedGraphXml.value = null
  pendingSavedViewState.value = null
  selectedInfo.value = null
  editSelection.value = null

  loading.value = true
  try {
    const response = await fetch(encodeURI(selectedFile.value))
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`)
    }
    liaisonDoc.value = normalizeLiaisonEnvelope(await response.json())
    lastHistoryData = cloneJson(liaisonDoc.value.data)

    liaisonParser.value = new SvgLiaisonDrawioParser(liaisonDoc.value, liaisonParserOptions())
    liaisonParser.value.skipInitialParseSvg = false

    destroyEditor()
    await nextTick()
    mountEditor(liaisonParser.value)
    ElMessage.success('已清除本地缓存并按 JSON 重新成图')
  } catch (error) {
    console.error(error)
    ElMessage.error(`重新算法成图失败：${error.message || '未知错误'}`)
    loading.value = false
    editorReady.value = false
  }
}

function formatPFromMw(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const t = Math.round(n * 1000) / 1000
  return String(t)
}

function formatQFromMvar(v) {
  return formatPFromMw(v)
}

function formatLineIKa(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const t = Math.round(n * 10000) / 10000
  return String(t)
}

function formatLineLoadingPercent(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const t = Math.round(n * 1000) / 1000
  return String(t)
}

function pickLineRatedVnKv(line, channel) {
  if (line?.vn_kv != null && !Number.isNaN(Number(line.vn_kv))) return Number(line.vn_kv)
  if (channel?.min_vn_kv != null && !Number.isNaN(Number(channel.min_vn_kv))) return Number(channel.min_vn_kv)
  return null
}

function pickLineIKa(line, channel) {
  if (line?.i_ka != null && !Number.isNaN(Number(line.i_ka))) return Number(line.i_ka)
  if (channel?.res_line_sum_i_ka != null && !Number.isNaN(Number(channel.res_line_sum_i_ka))) {
    return Number(channel.res_line_sum_i_ka)
  }
  return null
}

function pickLineLoadingPercent(line, channel) {
  if (line?.loading_percent != null && !Number.isNaN(Number(line.loading_percent))) {
    return Number(line.loading_percent)
  }
  if (
    channel?.res_line_sum_loading_percent != null &&
    !Number.isNaN(Number(channel.res_line_sum_loading_percent))
  ) {
    return Number(channel.res_line_sum_loading_percent)
  }
  return null
}

function toTypeLabel(type, info) {
  if (type === 'station') return info?.is_virtual ? '虚拟站(T10)' : '变电站'
  if (type === 'busnode') return 'T接母线'
  if (type === 'switch') return '开关'
  if (type === 'line') return '线路'
  return '未知'
}

function pickKeyFields(info) {
  if (!info) return {}

  if (info.type === 'station') {
    const buses = Array.isArray(info.bus_name_list)
      ? info.bus_name_list
      : Array.isArray(info.raw?.bus_name_list)
        ? info.raw.bus_name_list
        : []
    return {
      类型: info.is_virtual ? '虚拟站(T10)' : '变电站',
      站点名称: info.station_name,
      站点ID: info.station_id,
      电压等级_kV: info.vn_kv,
      母线列表: buses.length ? buses.join('、') : '—',
    }
  }

  if (info.type === 'busnode') {
    return {
      类型: 'T接母线',
      所属虚拟站: info.station_name || info.raw?.station_name || '—',
      母线名称: info.bus_name || '—',
      电压等级_kV: info.vn_kv,
    }
  }

  if (info.type === 'switch') {
    const swItem =
      info.switch_item ||
      (Array.isArray(info.switch_data) && info.switch_data.length > 0 ? info.switch_data[0] : null)
    const endLabel =
      info.switch_end === 'to'
        ? `受端（${info.to_station_name || '对侧站'}侧）`
        : `送端（${info.from_station_name || '本侧站'}侧）`
    return {
      类型: '开关',
      位置: endLabel,
      开关名称: swItem?.name || info.switch_name || '-',
      开关状态: info.closed ? '闭合(实心)' : '断开(空心)',
      线色: info.link_color || '-',
      线宽_px: info.link_width_px != null ? info.link_width_px : '-',
      聚合有功_p_from_MW: formatPFromMw(info.p_from_mw),
      聚合无功_q_from_Mvar: formatQFromMvar(info.q_from_mvar),
      所属通道: info.channel_name || '-',
      起点站: info.from_station_name || info.from_station,
      终点站: info.to_station_name || info.to_station,
    }
  }

  if (info.type === 'line') {
    const li = info.line_index ?? 0
    const lines = Array.isArray(info.line_data) ? info.line_data : []
    const line = lines[li] || lines[0] || null
    const channel = info.raw || null
    const fields = {
      类型: '线路',
      起点站: info.from_station_name || info.from_station,
      终点站: info.to_station_name || info.to_station,
      起点母线: info.from_bus_name || line?.from_bus_name || '-',
      终点母线: info.to_bus_name || line?.to_bus_name || '-',
      额定电压_kV: formatPFromMw(pickLineRatedVnKv(line, channel)),
      有功_p_from_MW: formatPFromMw(info.p_from_mw ?? line?.p_from_mw),
      无功_q_from_MVar: formatQFromMvar(info.q_from_mvar ?? line?.q_from_mvar),
      线路总负载率_percent: formatLineLoadingPercent(pickLineLoadingPercent(line, channel)),
      线路总电流_kA: formatLineIKa(pickLineIKa(line, channel)),
      线路名称: line?.name || info.channel_name || '-',
      所属通道: info.channel_name || '-',
      投运状态: line?.in_service === false ? '退出' : '在运',
      通道内序号: li + 1,
    }
    if (line?.type) fields['型号'] = line.type
    if (line?.r_ohm_per_km != null) fields['电阻_Ω_per_km'] = String(line.r_ohm_per_km)
    if (line?.x_ohm_per_km != null) fields['电抗_Ω_per_km'] = String(line.x_ohm_per_km)
    if (line?.g_us_per_km != null) fields['电导_μS_per_km'] = String(line.g_us_per_km)
    if (line?.c_nf_per_km != null) fields['电纳_nF_per_km'] = String(line.c_nf_per_km)
    if (line?.max_i_ka != null) fields['额定载流量_kA'] = String(line.max_i_ka)
    if (line?.length_km != null) fields['长度_km'] = String(line.length_km)
    return fields
  }

  return info
}

function ensureChannelPrimaryLine(channel) {
  if (!channel) return
  if (!Array.isArray(channel.line_data)) channel.line_data = []
  if (channel.line_data.length === 0) {
    channel.line_data.push({ name: '新线', in_service: true, p_from_mw: 0, q_from_mvar: 0 })
  }
}

function normalizeBusKv(v) {
  const n = Number(v) || 0
  if (n >= 225 && n <= 235) return 230
  if (n >= 112 && n <= 118) return 115
  return n
}

function busOptionsForStation(doc, stationId) {
  if (!doc?.data || !stationId) return []
  const set = new Set()
  const st = doc.data.station_data?.find((s) => s.station_id === stationId)
  if (Array.isArray(st?.bus_name_list)) {
    st.bus_name_list.forEach((b) => {
      const t = String(b || '').trim()
      if (t) set.add(t)
    })
  }
  ;(doc.data.channel_data || []).forEach((ch) => {
    ;(ch.line_data || []).forEach((line) => {
      if (ch.from_station === stationId && line?.from_bus_name) {
        set.add(String(line.from_bus_name).trim())
      }
      if (ch.to_station === stationId && line?.to_bus_name) {
        set.add(String(line.to_bus_name).trim())
      }
    })
  })
  return [...set].sort()
}

function defaultBusForStation(st, buses) {
  if (Array.isArray(buses) && buses.length > 0) {
    const kv = normalizeBusKv(st?.vn_kv)
    const prefer = buses.find((b) => b.includes(`.${kv}.`) || b.includes(`.${Math.round(kv)}.`))
    return prefer || buses[0]
  }
  return suggestedBusName(st?.station_name, st?.vn_kv, 2)
}

function suggestedBusName(stationName, kv, suffix = 2) {
  const name = String(stationName || '新站').trim() || '新站'
  const k = normalizeBusKv(kv) || 110
  return `${name}.${k}.${suffix}`
}

function collectStationDialogBusNames(form) {
  const names = (form.bus_names || []).map((b) => String(b || '').trim()).filter(Boolean)
  if (names.length > 0) return names
  return [suggestedBusName(form.station_name, form.vn_kv, 2)]
}

function buildChannelName(fromBusName, toBusName) {
  return `${String(fromBusName || '').trim()}_${String(toBusName || '').trim()}`
}

function findChannelIndexBetween(doc, fromId, toId) {
  if (!doc?.data?.channel_data) return -1
  return doc.data.channel_data.findIndex((c) => c.from_station === fromId && c.to_station === toId)
}

function syncChannelMeta(channel, fromSt, toSt) {
  if (!channel) return
  channel.min_vn_kv = Math.min(Number(fromSt?.vn_kv) || 0, Number(toSt?.vn_kv) || 0) || 110
  const first = channel.line_data?.[0]
  if (first?.from_bus_name && first?.to_bus_name && !channel.channel_name) {
    channel.channel_name = buildChannelName(first.from_bus_name, first.to_bus_name)
  }
}

function createLineDataItem({ name, from_bus_name, to_bus_name }) {
  return {
    name: String(name || '').trim() || '新线路',
    type: 'ac_line',
    from_bus_name: String(from_bus_name || '').trim(),
    to_bus_name: String(to_bus_name || '').trim(),
    in_service: true,
    p_from_mw: 0,
    q_from_mvar: 0,
  }
}

function ensureLineBusFields(channel, lineIndex, doc) {
  if (!channel?.line_data?.length || !doc?.data) return
  const line = channel.line_data[lineIndex] || channel.line_data[0]
  if (!line) return
  const fromSt = doc.data.station_data?.find((s) => s.station_id === channel.from_station)
  const toSt = doc.data.station_data?.find((s) => s.station_id === channel.to_station)
  if (!String(line.from_bus_name || '').trim() && fromSt) {
    line.from_bus_name = defaultBusForStation(fromSt, busOptionsForStation(doc, channel.from_station))
  }
  if (!String(line.to_bus_name || '').trim() && toSt) {
    line.to_bus_name = defaultBusForStation(toSt, busOptionsForStation(doc, channel.to_station))
  }
}

function createSwitchDataItem(name) {
  return {
    name: String(name || '').trim() || '新开关',
    closed: true,
    color: '',
    in_ka: null,
    line_types: 'solid',
    index: null,
  }
}

function buildSwitchDataFromDialogForm(form, lineName) {
  const fromName = String(form.switch_from_name || '').trim()
  const toName = String(form.switch_to_name || '').trim()
  const base = String(lineName || '新线').trim() || '新线'
  const list = []
  if (fromName) list.push(createSwitchDataItem(fromName))
  if (toName) {
    if (!fromName) return { error: '填写受端开关前请先填写送端开关名称' }
    if (list.length >= 2) return { error: '每条线路最多两个开关' }
    list.push(createSwitchDataItem(toName))
  }
  return { list }
}

function refreshChannelGraph(docChannelIndex, { fullRedraw = false } = {}) {
  const parser = getParser()
  if (docChannelIndex == null || docChannelIndex < 0 || !parser) return
  parser.setData(liaisonDoc.value)
  if (fullRedraw) {
    parser.updateChannelFromDoc(docChannelIndex)
  } else {
    parser.updateChannelSwitchesFromDoc(docChannelIndex)
  }
  const g = getGraph()
  if (g) applyLiaisonFlowMotionArrows(g)
}

/**
 * 策略 B：后台仅更新 JSON 量测、graphXml 不变时调用。
 * 演示：重新拉取当前样例 JSON，合并进内存并刷新画布量测层（不改动布局 XML）。
 */
async function refreshMeasurementsFromJson() {
  const parser = getParser()
  const graph = getGraph()
  if (!parser || !graph || !liaisonDoc.value) return

  try {
    const response = await fetch(encodeURI(selectedFile.value))
    if (!response.ok) throw new Error(`请求失败: ${response.status}`)
    const remote = normalizeLiaisonEnvelope(await response.json())
    mergeMeasurementFieldsIntoDoc(liaisonDoc.value, remote)
    parser.setData(liaisonDoc.value)
    parser.options.showMeasurements = true
    parser.syncMeasurementsFromDoc()
    ElMessage.success('已刷新量测（布局未改）')
  } catch (error) {
    console.error(error)
    ElMessage.error(`刷新量测失败：${error.message || '未知错误'}`)
  }
}

/** 将远端 JSON 中的量测字段合并进当前 doc（拓扑结构不变） */
function mergeMeasurementFieldsIntoDoc(target, source) {
  if (!target?.data || !source?.data) return
  const srcStations = source.data.station_data || []
  const tgtStations = target.data.station_data || []
  const stById = new Map(srcStations.map((s) => [s.station_id, s]))
  tgtStations.forEach((st) => {
    const src = stById.get(st.station_id)
    if (!src) return
    if (Array.isArray(src.trafo_display_list)) {
      st.trafo_display_list = JSON.parse(JSON.stringify(src.trafo_display_list))
    }
  })

  const channelKey = (c) =>
    `${c.from_station}__${c.to_station}__${(c.line_data || []).map((l) => l?.name || '').join('|')}`
  const srcChByKey = new Map((source.data.channel_data || []).map((c) => [channelKey(c), c]))
  ;(target.data.channel_data || []).forEach((ch) => {
    const src = srcChByKey.get(channelKey(ch))
    if (!src) return
    if (Array.isArray(src.line_data) && Array.isArray(ch.line_data)) {
      ch.line_data.forEach((line, i) => {
        const sl = src.line_data[i]
        if (!line || !sl) return
        if (sl.p_from_mw !== undefined) line.p_from_mw = sl.p_from_mw
        if (sl.q_from_mvar !== undefined) line.q_from_mvar = sl.q_from_mvar
        if (sl.in_service !== undefined) line.in_service = sl.in_service
      })
    }
    if (Array.isArray(src.switch_data)) {
      ch.switch_data = JSON.parse(JSON.stringify(src.switch_data))
    }
  })
}

const stationEditRow = computed(() => {
  if (editSelection.value?.kind !== 'station' || !liaisonDoc.value) return null
  const i = editSelection.value.doc_station_index
  if (i == null || i < 0) return null
  return liaisonDoc.value.data.station_data[i] || null
})

const stationTrafoEditCount = computed(() => stationTrafoRowCount(stationEditRow.value))

const channelEditRow = computed(() => {
  if (!liaisonDoc.value) return null
  if (editSelection.value?.kind !== 'line' && editSelection.value?.kind !== 'switch') return null
  const i = editSelection.value.doc_channel_index
  if (i == null || i < 0) return null
  return liaisonDoc.value.data.channel_data[i] || null
})

const selectedLineRow = computed(() => {
  if (editSelection.value?.kind !== 'line' || !liaisonDoc.value) return null
  const ch = liaisonDoc.value.data.channel_data[editSelection.value.doc_channel_index]
  if (!ch || !Array.isArray(ch.line_data) || ch.line_data.length === 0) return null
  const li = editSelection.value.line_index ?? 0
  return ch.line_data[li] || ch.line_data[0]
})

const channelLineCount = computed(() => {
  const ch = channelEditRow.value
  return Array.isArray(ch?.line_data) ? ch.line_data.length : 0
})

const deleteLineButtonLabel = computed(() =>
  channelLineCount.value > 1 ? '删除此线路' : '删除此通道（最后一条线路）'
)

const channelDialogFromBusOptions = computed(() =>
  busOptionsForStation(liaisonDoc.value, channelDialogForm.value.from_station)
)

const channelDialogToBusOptions = computed(() =>
  busOptionsForStation(liaisonDoc.value, channelDialogForm.value.to_station)
)

const editFromBusOptions = computed(() =>
  busOptionsForStation(liaisonDoc.value, channelEditRow.value?.from_station)
)

const editToBusOptions = computed(() =>
  busOptionsForStation(liaisonDoc.value, channelEditRow.value?.to_station)
)

const switchEditRow = computed(() => {
  if (editSelection.value?.kind !== 'switch' || !liaisonDoc.value) return null
  const j = editSelection.value.switch_doc_index
  if (j == null || j < 0) return null
  const ch = liaisonDoc.value.data.channel_data[editSelection.value.doc_channel_index]
  if (!ch || !Array.isArray(ch.switch_data)) return null
  return ch.switch_data[j] || null
})

const channelSwitchList = computed(() => {
  if (editSelection.value?.kind !== 'line' || !channelEditRow.value) return []
  const sd = channelEditRow.value.switch_data
  return Array.isArray(sd) ? sd : []
})

const canAddSwitchOnChannel = computed(() => channelSwitchList.value.length < 2)

const canDeleteSelectedSwitch = computed(() => {
  if (editSelection.value?.kind !== 'switch' || !switchEditRow.value) return false
  const ch = channelEditRow.value
  return Array.isArray(ch?.switch_data) && ch.switch_data.length > 1
})

const switchEndLabel = computed(() => {
  const j = editSelection.value?.switch_doc_index
  if (j === 1) return '受端（近终点站）'
  if (j === 0) return '送端（近起点站）'
  const end = editSelection.value?.switch_end
  if (end === 'to') return '受端（近终点站）'
  return '送端（近起点站）'
})

const channelLineNameForSwitch = computed(() => {
  const ch = channelEditRow.value
  if (!ch?.line_data?.length) return '—'
  return String(ch.line_data[0]?.name || '').trim() || '—'
})

const stationOptions = computed(() => {
  if (!liaisonDoc.value?.data?.station_data) return []
  return liaisonDoc.value.data.station_data
    .filter((s) => {
      const kv = Number(s.vn_kv || 0)
      return kv >= 35 && kv <= 230
    })
    .map((s) => ({
      id: s.station_id,
      label: s.station_name || s.station_id,
    }))
})

const stationReadonlyExtra = computed(() => {
  const row = stationEditRow.value
  if (!row) return { lon: '—', lat: '—' }
  const lon = row.lon != null && row.lon !== '' && !Number.isNaN(Number(row.lon)) ? String(row.lon) : '—'
  const lat = row.lat != null && row.lat !== '' && !Number.isNaN(Number(row.lat)) ? String(row.lat) : '—'
  return { lon, lat }
})

watch(
  () => [editSelection.value?.kind, editSelection.value?.doc_station_index],
  () => {
    if (editSelection.value?.kind !== 'station') return
    const row = stationEditRow.value
    if (!row) return
    ensureStationEditLists(row)
    syncStationBusEditSnapshot()
  }
)

const channelReadonlyExtra = computed(() => {
  const ch = channelEditRow.value
  if (!ch || editSelection.value?.kind !== 'line') {
    return {
      ratedVn: '—',
      pMw: '—',
      qMvar: '—',
      inService: '—',
      loadingPercent: '—',
      iKa: '—',
      extraLineDataJson: '',
      switchJson: '',
    }
  }
  const lines = ch.line_data || []
  const li = editSelection.value.line_index ?? 0
  const line = lines[li] || lines[0]
  const rest = lines.filter((_, idx) => idx !== li)
  let pSum = 0
  let qSum = 0
  let anyP = false
  let anyQ = false
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (ln?.p_from_mw != null && !Number.isNaN(Number(ln.p_from_mw))) {
      pSum += Number(ln.p_from_mw)
      anyP = true
    }
    if (ln?.q_from_mvar != null && !Number.isNaN(Number(ln.q_from_mvar))) {
      qSum += Number(ln.q_from_mvar)
      anyQ = true
    }
  }
  return {
    ratedVn: formatPFromMw(pickLineRatedVnKv(line, ch)),
    pMw: anyP ? formatPFromMw(pSum) : '—',
    qMvar: anyQ ? formatQFromMvar(qSum) : '—',
    inService: line?.in_service === false ? '否' : '是',
    loadingPercent: formatLineLoadingPercent(pickLineLoadingPercent(line, ch)),
    iKa: formatLineIKa(pickLineIKa(line, ch)),
    extraLineDataJson: rest.length ? JSON.stringify(rest, null, 2) : '',
    switchJson:
      Array.isArray(ch.switch_data) && ch.switch_data.length > 0 ? JSON.stringify(ch.switch_data, null, 2) : '',
  }
})

function onStationIdBlur() {
  const row = stationEditRow.value
  const doc = liaisonDoc.value
  if (!row || !doc || editSelection.value?.kind !== 'station') return
  const oldId = stationIdSnapshot.value
  const newId = String(row.station_id || '').trim()
  if (!newId) {
    row.station_id = oldId
    ElMessage.warning('站点 ID 不能为空')
    return
  }
  if (newId === oldId) return
  const idx = editSelection.value.doc_station_index
  const duplicate = doc.data.station_data.some((s, i) => s.station_id === newId && i !== idx)
  if (duplicate) {
    row.station_id = oldId
    ElMessage.warning('站点 ID 已存在')
    return
  }
  pushUndoSnapshot('修改站点 ID')
  doc.data.channel_data.forEach((c) => {
    if (c.from_station === oldId) c.from_station = newId
    if (c.to_station === oldId) c.to_station = newId
  })
  stationIdSnapshot.value = newId
  const parser = getParser()
  if (parser) {
    parser.setData(liaisonDoc.value)
    parser.renameStationCellId(oldId, newId)
    parser.resyncChannelCellIdsToDoc()
  }
}

function bindClickInfo(graph) {
  graph.addListener(mxEvent.CLICK, (_sender, evt) => {
    const cell = evt.getProperty('cell')
    if (!cell || !cell.entityInfo) {
      selectedInfo.value = null
      editSelection.value = null
      return
    }

    let info = cell.entityInfo

    if (info.type === 'station' && info.doc_station_index != null) {
      stationIdSnapshot.value = info.station_id
      editSelection.value = { kind: 'station', doc_station_index: info.doc_station_index }
    } else if (
      info.type === 'line' ||
      info.type === 'switch' ||
      cell.entityType === 'line' ||
      cell.entityType === 'switch' ||
      cell.entityType === 'junction'
    ) {
      const parser = getParser()
      const resolved = parser?.resolveDocChannelFromCell(cell)
      const docIdx = resolved?.docChannelIndex ?? parser?.resolveDocChannelIndexFromCell(cell) ?? info.doc_channel_index
      if (docIdx == null || docIdx < 0) {
        editSelection.value = null
        selectedInfo.value = null
        return
      }
      if (parser) parser.rebindEntityInfo()
      info = cell.entityInfo || info
      const ch = liaisonDoc.value?.data?.channel_data?.[docIdx]
      if (ch) {
        ensureChannelPrimaryLine(ch)
        const li = resolved?.lineIndex ?? info.line_index ?? 0
        ensureLineBusFields(ch, li, liaisonDoc.value)
      }
      if (info.type === 'switch' || cell.entityType === 'switch') {
        editSelection.value = {
          kind: 'switch',
          doc_channel_index: docIdx,
          switch_doc_index: info.switch_doc_index,
          switch_end: info.switch_end,
        }
      } else {
        editSelection.value = {
          kind: 'line',
          doc_channel_index: docIdx,
          line_index: resolved?.lineIndex ?? info.line_index ?? 0,
        }
      }
    } else {
      editSelection.value = null
    }

    const data = pickKeyFields(info)
    const entityType = info.type || cell.entityType
    selectedInfo.value = {
      kind: entityType === 'junction' ? 'line' : entityType,
      typeLabel: toTypeLabel(entityType, info),
      fields: data,
      pretty: JSON.stringify(data, null, 2),
    }
  })
}

function handleStationDoubleClick(stationInfo) {
  if (!stationInfo?.station_id || !stationInfo?.station_name) return
  if (liaisonDemoLevel.value === 'lv1') {
    stationNavTarget.value = {
      station_id: stationInfo.station_id,
      station_name: stationInfo.station_name,
    }
    stationNavDialogVisible.value = true
    return
  }
  router.push({
    path: '/in-site-svg',
    query: {
      id: stationInfo.station_id,
      name: stationInfo.station_name,
    },
  })
}

function goStationNavLv2() {
  const target = stationNavTarget.value
  if (!target) return
  stationNavDialogVisible.value = false
  router.push({
    path: '/svg-liaison-drawio',
    query: {
      type: 'lv2',
      id: target.station_id,
      name: target.station_name,
    },
  })
}

function goStationNavPgrsd() {
  stationNavDialogVisible.value = false
  router.push({ path: '/region-system-svg' })
}

function bindStationDoubleClick(graph) {
  if (!graph || typeof mxEvent === 'undefined') return
  graph.addListener(mxEvent.DOUBLE_CLICK, (_sender, evt) => {
    const cell = evt.getProperty('cell')
    if (!cell || !cell.entityInfo) return
    const info = cell.entityInfo
    if (info.type === 'station' && info.station_id) {
      evt.consume()
      handleStationDoubleClick(info)
    }
  })
}

function applyCanvasTheme(theme, opts = {}) {
  const next = theme === 'light' ? 'light' : 'dark'
  canvasTheme.value = next
  const cfg = CANVAS_THEMES[next]
  if (uiEditor) {
    uiEditor.setBackgroundColor(cfg.bg)
    const graph = uiEditor.editor?.graph
    if (graph && typeof graph.setGridEnabled === 'function') {
      graph.setGridEnabled(false)
    }
  }
  if (opts.skipParser) return
  const parser = getParser()
  if (parser) {
    parser.options.theme = next
    parser.applyLineTextTheme(next)
  }
}

function saveLiaisonWork() {
  if (!liaisonDoc.value || !uiEditor?.editor) return
  const graphXml = exportEditorGraphXml(uiEditor.editor)
  if (!graphXml?.trim()) {
    ElMessage.warning('当前无图形可保存')
    return
  }
  const viewState = captureGraphViewState(uiEditor.editor.graph)
  saveLiaisonBundle(selectedFile.value, liaisonDoc.value, graphXml, viewState)
  const base = selectedFile.value.split('/').pop() || 'liaison.json'
  downloadLiaisonBundle(base, liaisonDoc.value, graphXml, viewState)
  uiEditor.editor.setModified(false)
  if (uiEditor.editor.undoManager?.clear) uiEditor.editor.undoManager.clear()
  ElMessage.success('已保存图形与 JSON（浏览器本地 + 已下载 bundle 文件）')
}

function resetStationDialogForm() {
  stationDialogForm.value = { station_name: '', vn_kv: 110, station_id: '', bus_names: [''] }
}

function onStationDialogMetaChange() {
  const form = stationDialogForm.value
  if (!Array.isArray(form.bus_names) || form.bus_names.length === 0) {
    form.bus_names = [suggestedBusName(form.station_name, form.vn_kv, 2)]
    return
  }
  if (!String(form.bus_names[0] || '').trim()) {
    form.bus_names[0] = suggestedBusName(form.station_name, form.vn_kv, 2)
  }
}

function addStationDialogBus() {
  const form = stationDialogForm.value
  if (!Array.isArray(form.bus_names)) form.bus_names = ['']
  let suffix = 2
  form.bus_names.forEach((b) => {
    const m = String(b || '').match(/\.(\d+)$/)
    if (m) suffix = Math.max(suffix, Number(m[1]) + 1)
  })
  form.bus_names.push(suggestedBusName(form.station_name, form.vn_kv, suffix))
}

function removeStationDialogBus(idx) {
  const list = stationDialogForm.value.bus_names
  if (!Array.isArray(list) || list.length <= 1) return
  list.splice(idx, 1)
}

function openAddStationDialog() {
  if (!liaisonDoc.value) return
  stationDialogForm.value = {
    station_name: '',
    vn_kv: 110,
    station_id: genStationId(),
    bus_names: [suggestedBusName('', 110, 2)],
  }
  stationDialogVisible.value = true
}

function confirmAddStation() {
  if (!liaisonDoc.value) return
  const name = String(stationDialogForm.value.station_name || '').trim()
  if (!name) {
    ElMessage.warning('请填写站点名称')
    return
  }
  let id = String(stationDialogForm.value.station_id || '').trim()
  if (!id) id = genStationId()
  if (liaisonDoc.value.data.station_data.some((s) => s.station_id === id)) {
    ElMessage.warning('站点 ID 已存在，请修改')
    return
  }
  const kv = Number(stationDialogForm.value.vn_kv)
  let busNames = collectStationDialogBusNames(stationDialogForm.value)
  const seen = new Set()
  for (let i = 0; i < busNames.length; i++) {
    if (seen.has(busNames[i])) {
      ElMessage.warning('母线名称不能重复')
      return
    }
    seen.add(busNames[i])
  }
  pushUndoSnapshot('新增变电站')
  liaisonDoc.value.data.station_data.push({
    station_id: id,
    station_name: name,
    vn_kv: Number.isNaN(kv) ? 110 : kv,
    lon: 0,
    lat: 0,
    bus_name_list: busNames,
    bus_id_list: [],
    trafo_display_list: [],
    trafo_name_list: [],
  })
  const idx = liaisonDoc.value.data.station_data.length - 1
  editSelection.value = { kind: 'station', doc_station_index: idx }
  stationIdSnapshot.value = id
  selectedInfo.value = {
    typeLabel: '变电站',
    pretty: JSON.stringify(
      pickKeyFields({
        type: 'station',
        station_name: name,
        station_id: id,
        vn_kv: stationDialogForm.value.vn_kv,
        bus_name_list: busNames,
        is_virtual: false,
      }),
      null,
      2
    ),
  }
  stationDialogVisible.value = false
  const parser = getParser()
  if (parser) {
    parser.setData(liaisonDoc.value)
    parser.insertStationAtDocIndex(idx)
    const g = getGraph()
    if (g) applyLiaisonFlowMotionArrows(g)
  }
  ElMessage.success('已添加变电站')
}

function resetChannelDialogForm() {
  channelDialogForm.value = {
    from_station: '',
    to_station: '',
    from_bus_name: '',
    to_bus_name: '',
    line_name: '',
    switch_from_name: '',
    switch_to_name: '',
  }
}

function onChannelDialogStationChange() {
  if (!liaisonDoc.value) return
  const form = channelDialogForm.value
  const fromSt = liaisonDoc.value.data.station_data.find((s) => s.station_id === form.from_station)
  const toSt = liaisonDoc.value.data.station_data.find((s) => s.station_id === form.to_station)
  const fromBuses = busOptionsForStation(liaisonDoc.value, form.from_station)
  const toBuses = busOptionsForStation(liaisonDoc.value, form.to_station)
  if (fromSt) {
    const cur = String(form.from_bus_name || '').trim()
    if (!cur || !fromBuses.includes(cur)) {
      form.from_bus_name = defaultBusForStation(fromSt, fromBuses)
    }
  }
  if (toSt) {
    const cur = String(form.to_bus_name || '').trim()
    if (!cur || !toBuses.includes(cur)) {
      form.to_bus_name = defaultBusForStation(toSt, toBuses)
    }
  }
}

function openAddChannelDialog() {
  if (!liaisonDoc.value) return
  const stations = liaisonDoc.value.data.station_data
  if (stations.length < 2) {
    ElMessage.warning('至少需要两个变电站才能添加线路')
    return
  }
  const fromId = stations[0].station_id
  const toId = stations[1].station_id
  const fromSt = stations[0]
  const toSt = stations[1]
  const fromBuses = busOptionsForStation(liaisonDoc.value, fromId)
  const toBuses = busOptionsForStation(liaisonDoc.value, toId)
  channelDialogForm.value = {
    from_station: fromId,
    to_station: toId,
    from_bus_name: defaultBusForStation(fromSt, fromBuses),
    to_bus_name: defaultBusForStation(toSt, toBuses),
    line_name: '新线路',
    switch_from_name: '',
    switch_to_name: '',
  }
  channelDialogVisible.value = true
}

function confirmAddChannel() {
  if (!liaisonDoc.value) return
  const { from_station, to_station, from_bus_name, to_bus_name, line_name } = channelDialogForm.value
  if (!from_station || !to_station) {
    ElMessage.warning('请选择起点站和终点站')
    return
  }
  if (from_station === to_station) {
    ElMessage.warning('起点与终点不能相同')
    return
  }
  const fromBus = String(from_bus_name || '').trim()
  const toBus = String(to_bus_name || '').trim()
  if (!fromBus || !toBus) {
    ElMessage.warning('请选择起点母线与终点母线')
    return
  }
  const name = String(line_name || '').trim()
  if (!name) {
    ElMessage.warning('请填写线路名称')
    return
  }
  const fromSt = liaisonDoc.value.data.station_data.find((s) => s.station_id === from_station)
  const toSt = liaisonDoc.value.data.station_data.find((s) => s.station_id === to_station)
  const minKv = Math.min(Number(fromSt?.vn_kv) || 0, Number(toSt?.vn_kv) || 0) || 110
  const lineItem = createLineDataItem({ name, from_bus_name: fromBus, to_bus_name: toBus })

  const existingIdx = findChannelIndexBetween(liaisonDoc.value, from_station, to_station)
  const isNewChannel = existingIdx < 0

  if (isNewChannel) {
    const swBuild = buildSwitchDataFromDialogForm(channelDialogForm.value, name)
    if (swBuild.error) {
      ElMessage.warning(swBuild.error)
      return
    }
    pushUndoSnapshot('新增线路')
    liaisonDoc.value.data.channel_data.push({
      from_station,
      to_station,
      min_vn_kv: minKv,
      channel_name: buildChannelName(fromBus, toBus),
      line_data: [lineItem],
      switch_data: swBuild.list,
    })
  } else {
    pushUndoSnapshot('新增线路')
    const ch = liaisonDoc.value.data.channel_data[existingIdx]
    if (!Array.isArray(ch.line_data)) ch.line_data = []
    ch.line_data.push(lineItem)
    syncChannelMeta(ch, fromSt, toSt)
  }

  const docIdx = isNewChannel ? liaisonDoc.value.data.channel_data.length - 1 : existingIdx
  const ch = liaisonDoc.value.data.channel_data[docIdx]
  const lineIndex = isNewChannel ? 0 : ch.line_data.length - 1
  editSelection.value = { kind: 'line', doc_channel_index: docIdx, line_index: lineIndex }
  selectedInfo.value = {
    typeLabel: '线路',
    pretty: JSON.stringify(
      pickKeyFields({
        type: 'line',
        line_index: lineIndex,
        line_data: [lineItem],
        channel_name: ch.channel_name,
        from_station,
        to_station,
        from_station_name: fromSt?.station_name,
        to_station_name: toSt?.station_name,
        from_bus_name: fromBus,
        to_bus_name: toBus,
        from_kv: fromSt?.vn_kv,
        to_kv: toSt?.vn_kv,
        min_vn_kv: ch.min_vn_kv,
        max_vn_kv: ch.max_vn_kv,
        p_from_mw: lineItem.p_from_mw,
        q_from_mvar: lineItem.q_from_mvar,
      }),
      null,
      2
    ),
  }
  channelDialogVisible.value = false
  const parser = getParser()
  if (parser) {
    parser.setData(liaisonDoc.value)
    if (isNewChannel) {
      parser.insertChannelAtDocIndex(docIdx)
    } else {
      parser.updateChannelFromDoc(docIdx)
    }
    const g = getGraph()
    if (g) applyLiaisonFlowMotionArrows(g)
  }
  ElMessage.success(isNewChannel ? '已添加线路' : '已添加线路至现有通道')
}

async function deleteSelectedStation() {
  if (!liaisonDoc.value || editSelection.value?.kind !== 'station') return
  const i = editSelection.value.doc_station_index
  const row = liaisonDoc.value.data.station_data[i]
  if (!row) return
  try {
    await ElMessageBox.confirm(`确定删除变电站「${row.station_name || row.station_id}」？相关通道将一并删除。`, '确认删除', {
      type: 'warning',
      ...msgboxConfirmOpts,
    })
  } catch {
    return
  }
  const id = row.station_id
  const channels = liaisonDoc.value.data.channel_data
  const removeChannelIndices = []
  for (let ci = 0; ci < channels.length; ci++) {
    const ch = channels[ci]
    if (ch.from_station === id || ch.to_station === id) removeChannelIndices.push(ci)
  }

  pushUndoSnapshot('删除变电站')

  const parser = getParser()
  if (parser) {
    parser.removeStationAndChannelsFromGraph(id, removeChannelIndices)
  }

  liaisonDoc.value.data.station_data.splice(i, 1)
  liaisonDoc.value.data.channel_data = channels.filter(
    (c) => c.from_station !== id && c.to_station !== id
  )

  if (parser) {
    parser.setData(liaisonDoc.value)
    parser.resyncChannelCellIdsToDoc()
    parser.purgeOrphanChannelGraphCells()
    parser.enableManualEdit()
    const g = getGraph()
    if (g) applyLiaisonFlowMotionArrows(g)
  }
  selectedInfo.value = null
  editSelection.value = null
  ElMessage.success('已删除')
}

async function deleteSelectedChannel() {
  if (!liaisonDoc.value || editSelection.value?.kind !== 'line') return
  const i = editSelection.value.doc_channel_index
  const ch = liaisonDoc.value.data.channel_data[i]
  if (!ch) return
  const li = editSelection.value.line_index ?? 0
  const lineCount = ch.line_data?.length || 0

  if (lineCount > 1) {
    const lineName = String(ch.line_data[li]?.name || '').trim() || `第 ${li + 1} 条线路`
    try {
      await ElMessageBox.confirm(`确定删除线路「${lineName}」？`, '确认删除', {
        type: 'warning',
        ...msgboxConfirmOpts,
      })
    } catch {
      return
    }
    pushUndoSnapshot('删除线路')
    const parser = getParser()
    ch.line_data.splice(li, 1)
    if (parser) {
      parser.setData(liaisonDoc.value)
      parser.updateChannelFromDoc(i)
      const g = getGraph()
      if (g) applyLiaisonFlowMotionArrows(g)
    }
    const newLi = Math.min(li, ch.line_data.length - 1)
    editSelection.value = { kind: 'line', doc_channel_index: i, line_index: Math.max(0, newLi) }
    ElMessage.success('已删除线路')
    return
  }

  try {
    await ElMessageBox.confirm('确定删除该通道（含最后一条线路）？', '确认删除', {
      type: 'warning',
      ...msgboxConfirmOpts,
    })
  } catch {
    return
  }
  pushUndoSnapshot('删除通道')
  const parser = getParser()
  if (parser) {
    parser.setData(liaisonDoc.value)
    parser.removeChannelGraphCells(i)
  }
  liaisonDoc.value.data.channel_data.splice(i, 1)
  if (parser) {
    parser.setData(liaisonDoc.value)
    parser.reindexChannelCellIdsAfterDelete()
    parser.purgeOrphanChannelGraphCells()
    parser.enableManualEdit()
    const g = getGraph()
    if (g) applyLiaisonFlowMotionArrows(g)
  }
  selectedInfo.value = null
  editSelection.value = null
  ElMessage.success('已删除通道')
}

async function deleteSelectedSwitch() {
  if (!liaisonDoc.value || editSelection.value?.kind !== 'switch') return
  const j = editSelection.value.switch_doc_index
  if (j == null || j < 0) return
  const ci = editSelection.value.doc_channel_index
  const ch = liaisonDoc.value.data.channel_data[ci]
  if (!ch?.switch_data) return
  if (ch.switch_data.length <= 1) {
    ElMessage.warning('该线路仅有一个开关时不可删除')
    return
  }
  try {
    await ElMessageBox.confirm('确定删除该开关？删除后将重绘该线路。', '确认删除', {
      type: 'warning',
      ...msgboxConfirmOpts,
    })
  } catch {
    return
  }
  pushUndoSnapshot('删除开关')
  ch.switch_data.splice(j, 1)
  refreshChannelGraph(ci)
  selectedInfo.value = null
  editSelection.value = { kind: 'line', doc_channel_index: ci, line_index: editSelection.value?.line_index ?? 0 }
  ElMessage.success('已删除开关')
}

async function loadSelectedFile() {
  loading.value = true
  selectedInfo.value = null
  editSelection.value = null
  clearUndoRedoHistory()
  pendingSavedGraphXml.value = null
  pendingSavedViewState.value = null
  try {
    const response = await fetch(encodeURI(selectedFile.value))
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`)
    }

    const jsonData = await response.json()
    let doc = normalizeLiaisonEnvelope(jsonData)
    const preferStatic = String(route.query?.bundle || '').toLowerCase() === 'static'
    const bundle = await loadLiaisonBundleWithFallback(selectedFile.value, { preferStatic })
    if (bundle?.json) {
      doc = normalizeLiaisonEnvelope(bundle.json)
    }
    liaisonDoc.value = doc
    lastHistoryData = cloneJson(liaisonDoc.value.data)
    pendingSavedGraphXml.value = bundle?.graphXml || null
    pendingSavedViewState.value = bundle?.viewState || null

    liaisonParser.value = new SvgLiaisonDrawioParser(liaisonDoc.value, liaisonParserOptions())
    liaisonParser.value.skipInitialParseSvg = Boolean(pendingSavedGraphXml.value)

    destroyEditor()
    await nextTick()
    mountEditor(liaisonParser.value)
    if (doc._slimmed) {
      const st = doc.data?.station_data?.length ?? 0
      const ch = doc.data?.channel_data?.length ?? 0
      ElMessage.info(`全量 JSON 已自动精简为成图数据（${st} 站、${ch} 通道）`)
    }
  } catch (error) {
    console.error(error)
    ElMessage.error(`加载联络图失败：${error.message || '未知错误'}`)
    loading.value = false
    editorReady.value = false
  }
}

watch(
  () => route.query.type,
  () => {
    const nextFile = resolveLiaisonFileFromRoute()
    if (nextFile === selectedFile.value) return
    selectedFile.value = nextFile
    loadSelectedFile()
  }
)

onMounted(() => {
  window.addEventListener('keydown', handleLiaisonUndoRedoShortcut)
  selectedFile.value = resolveLiaisonFileFromRoute()
  loadSelectedFile()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleLiaisonUndoRedoShortcut)
  destroyEditor()
})
</script>

<style scoped lang="scss">
.svg-liaison-drawio-demo {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f1f5f9;
  color: #0f172a;
  /* 覆盖 #app { text-align: center }，侧栏与工具栏须左对齐 */
  text-align: left;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #e2e8f0;
  border-bottom: 1px solid #cbd5e1;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.label {
  font-size: 13px;
  color: #334155;
}

.file-select,
.action-btn {
  height: 32px;
  border-radius: 6px;
  border: 1px solid #94a3b8;
  background: #ffffff;
  color: #0f172a;
}

.file-select {
  min-width: 280px;
  padding: 0 10px;
}

.action-btn {
  padding: 0 12px;
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rule-tag {
  font-size: 12px;
  color: #1e3a8a;
  background: #dbeafe;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 4px 10px;
}

.canvas-wrapper.canvas-theme-dark {
  background: #000000;
}

.canvas-wrapper.canvas-theme-light {
  background: #ffffff;
}

.theme-toggle {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  overflow: hidden;
  background: #e2e8f0;
}

.theme-toggle-btn {
  border: none;
  background: transparent;
  color: #475569;
  font-size: 12px;
  line-height: 1;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.theme-toggle-btn.active {
  background: #0f172a;
  color: #f8fafc;
}

.theme-toggle-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.canvas-wrapper {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

/* 初始化完成前不显示 draw.io 容器，避免通用侧栏闪一下 */
.canvas-wrapper.editor-booting .geEditor {
  visibility: hidden;
  pointer-events: none;
}

/* 菜单栏/侧栏/样式面板在 DOM 插入瞬间即隐藏；保留顶部缩放工具条 */
.svg-liaison-drawio-demo :deep(.geMenubarContainer),
.svg-liaison-drawio-demo :deep(.geSidebarContainer),
.svg-liaison-drawio-demo :deep(.geSidebar),
.svg-liaison-drawio-demo :deep(.geFormatContainer),
.svg-liaison-drawio-demo :deep(.geHsplit),
.svg-liaison-drawio-demo :deep(.geVsplit),
.svg-liaison-drawio-demo :deep(.geFooterContainer),
.svg-liaison-drawio-demo :deep(.geTabContainer) {
  display: none !important;
  height: 0 !important;
  max-height: 0 !important;
  width: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
}

/* 工具条仅保留缩放与撤销/重做（与 pruneLiaisonToolbar 一致） */
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-formatpanel)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-delete)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-tofront)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-toback)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-fillcolor)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-strokecolor)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-shadow)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-connection)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-orthogonal)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-straight)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-horizontalelbow)),
.svg-liaison-drawio-demo :deep(.geToolbar > *:has(.geSprite-verticalelbow)) {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.svg-liaison-drawio-demo :deep(.geToolbar .geSeparator) {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  pointer-events: none !important;
}

.svg-liaison-drawio-demo :deep(.geToolbarContainer > a.geButton.geAdaptiveAsset) {
  display: none !important;
}

.svg-liaison-drawio-demo :deep(.geToolbarContainer) {
  display: block !important;
  left: 0 !important;
  right: 0 !important;
  top: 0 !important;
  width: auto !important;
  max-width: none !important;
  overflow: visible !important;
  pointer-events: auto !important;
}

.svg-liaison-drawio-demo :deep(.geDiagramContainer) {
  left: 0 !important;
  right: 0 !important;
}

.content-wrap {
  display: flex;
  flex: 1;
  min-height: 0;
}

.info-panel {
  display: flex;
  flex-direction: column;
  width: 320px;
  flex: 0 0 320px;
  border-left: 1px solid #e2e8f0;
  background: #ffffff;
  box-sizing: border-box;
  overflow: hidden;
  text-align: left;

  h3,
  h4,
  h5,
  p,
  ul,
  dl,
  dt,
  dd,
  label,
  summary {
    text-align: left;
  }
}

.info-panel-head {
  flex-shrink: 0;
  padding: 14px 14px 10px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.info-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.02em;
}

.info-subtitle {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: #64748b;
}

.info-body,
.empty-tip {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px 16px;
}

.info-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 12px;
}

.empty-tip {
  color: #64748b;
}

.empty-tip-card {
  padding: 14px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.empty-tip-lead {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.empty-tip-list {
  margin: 0;
  padding-left: 1.15em;
  font-size: 12px;
  line-height: 1.65;
  color: #64748b;
  list-style: disc;

  li {
    text-align: left;
  }

  li + li {
    margin-top: 8px;
  }

  strong {
    font-weight: 600;
    color: #0f172a;
  }
}

.info-type-badge {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  border: 1px solid transparent;
}

.info-type-badge.kind-station {
  color: #0f766e;
  background: #ccfbf1;
  border-color: #99f6e4;
}

.info-type-badge.kind-line {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #bfdbfe;
}

.info-type-badge.kind-switch {
  color: #b45309;
  background: #fef3c7;
  border-color: #fde68a;
}

.info-type-badge.kind-unknown {
  color: #475569;
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.summary-card {
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.kv-list {
  display: grid;
  grid-template-columns: minmax(88px, 38%) 1fr;
  gap: 6px 10px;
  margin: 0;
}

.kv-list dt,
.kv-list dd {
  margin: 0;
}

.kv-key,
.kv-list dt {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
  word-break: break-word;
}

.kv-val,
.kv-list dd {
  font-size: 12px;
  color: #0f172a;
  line-height: 1.45;
  word-break: break-word;
}

.kv-list-compact {
  gap: 4px 8px;
}

.json-details {
  margin-top: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  overflow: visible;
}

.json-details-summary {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  user-select: none;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  &::before {
    content: '▸ ';
    display: inline-block;
    margin-right: 4px;
    transition: transform 0.15s ease;
  }
}

.json-details[open] .json-details-summary::before {
  transform: rotate(90deg);
}

.info-json {
  margin: 0;
  padding: 10px 12px;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.5;
  color: #334155;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
}

.action-btn.primary {
  background: #1d4ed8;
  color: #fff;
  border-color: #1e40af;
}

.toolbar-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  color: #fff;
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.12);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;

  .toolbar-add-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 1;
    background: rgba(255, 255, 255, 0.2);
  }

  &.station {
    background: linear-gradient(145deg, #14b8a6 0%, #0d9488 45%, #0f766e 100%);
  }

  &.channel {
    background: linear-gradient(145deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.16);
    filter: brightness(1.03);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    filter: none;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
  }
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;

  .field {
    margin: 0;
  }

  :deep(.el-input),
  :deep(.el-select) {
    width: 100%;
  }
}

.readonly-block {
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}

.readonly-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.readonly-subtitle {
  margin: 10px 0 6px;
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
}

.readonly-pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  background: #ffffff;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  overflow: auto;
  max-height: 160px;
  word-break: break-word;
  color: #334155;
}

.edit-section .edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);

  :deep(.el-input),
  :deep(.el-select) {
    width: 100%;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    box-sizing: border-box;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  line-height: 1.3;
}

.field-check {
  padding-top: 2px;

  :deep(.el-checkbox__label) {
    font-size: 12px;
    color: #334155;
  }
}

.hint-line {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.dialog-hint {
  margin-top: -4px;
}

.station-nav-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 8px;
}

.station-nav-option {
  display: block;
  width: 100%;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fafc;
  color: #1e293b;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
  }

  &.primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;

    &:hover {
      background: #1d4ed8;
      border-color: #1d4ed8;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.24);
    }
  }
}

:deep(.station-nav-dialog .el-dialog__header) {
  margin-right: 0;
  padding-bottom: 8px;
  text-align: center;
}

:deep(.station-nav-dialog .el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

:deep(.station-nav-dialog .el-dialog__body) {
  padding-top: 8px;
  padding-bottom: 20px;
}

.bus-list-editor {
  margin-top: 4px;
}

.bus-list-title {
  margin-bottom: 4px;
}

.bus-list-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bus-list-row :deep(.el-input) {
  flex: 1;
  min-width: 0;
}

.bus-list-remove {
  flex: 0 0 auto;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 12px;
  line-height: 1;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.bus-list-remove:hover:not(:disabled) {
  background: #f8fafc;
  color: #334155;
}

.bus-list-remove:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.station-edit-bus {
  margin-top: 12px;
}

.trafo-list-editor {
  margin-top: 12px;
}

.trafo-list-title {
  margin-bottom: 4px;
}

.trafo-list-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.trafo-list-index {
  flex: 0 0 auto;
  font-size: 12px;
  color: #64748b;
  min-width: 20px;
}

.trafo-list-row :deep(.el-input) {
  flex: 1 1 72px;
  min-width: 72px;
}

.trafo-list-row :deep(.el-input:first-of-type) {
  flex: 2 1 120px;
  min-width: 100px;
}

.line-metrics-block {
  margin: 4px 0 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.line-params-title {
  margin: 12px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.switch-manage-block {
  margin: 12px 0;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;

  .btn-secondary.btn-block {
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
    box-sizing: border-box;
  }
}

.switch-list {
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}

.switch-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 12px;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
}

.switch-list li:last-child {
  border-bottom: none;
}

.switch-end-tag {
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 500;
  color: #1e40af;
  background: #dbeafe;
  border-radius: 4px;
}

.switch-state-tag {
  margin-left: auto;
  font-size: 11px;
  color: #64748b;
}

.btn-secondary {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-secondary:hover:not(:disabled) {
  background: #dbeafe;
}

.btn-secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-secondary.btn-block {
  width: 100%;
}

.btn-danger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-danger,
.btn-secondary {
  box-sizing: border-box;
}

.btn-danger {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-danger:hover {
  background: #fee2e2;
}

.btn-danger.btn-block {
  width: 100%;
  margin-top: 2px;
}

.hint-card {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.55;
  color: #64748b;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
}

.geEditor {
  position: absolute;
  inset: 0;
}

.loading-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.25);
  font-size: 17px;
}

/* 仅 draw.io 画布使用 content-box，避免侧栏按钮 width:100% 撑出卡片 */
.svg-liaison-drawio-demo :deep(.geEditor),
.svg-liaison-drawio-demo :deep(.geEditor *),
.svg-liaison-drawio-demo :deep(.geEditor *::before),
.svg-liaison-drawio-demo :deep(.geEditor *::after) {
  box-sizing: content-box;
}
</style>
