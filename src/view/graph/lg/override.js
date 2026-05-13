
// 处理拖动线顶点时偏移太大问题 （不再重写，按下alt键可实现这功能）
// mxEdgeHandler.prototype.getSnapToTerminalTolerance = function()
// {
//     return 2 * this.graph.view.scale / 2;
// };

import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import StationHandler from '@/plugins/tmzx/graph/StationHandler.js'
import { sbzlx2nameMap } from '@/plugins/tmzx/graph/graph.js'
import { lgSidebarPaletteTitleForShape } from '@/view/graph/lg/Constants.js'

let preAddPopupMenuItems = Menus.prototype.addPopupMenuItems;
Menus.prototype.addPopupMenuItems = function(menu, cell, evt)
{
    if (cell) {
        let graph = this.editorUi.editor.graph;
        let model = graph.getModel();

        let parent = model.getParent(cell);
        let cellState = graph.view.getState(cell);
        let styleObj = cellState.style;
        this.addMenuItems(menu, ['cellSearch','cellMark', '-'], null, evt);


        if (cell.symbol == 'busbar') {
            this.addMenuItems(menu, ['selectBusGroup','-'], null, evt);
        }
        else if (DeviceCategoryUtil.isStationCell(cell) || cell.style?.includes('group;'))
        {
            this.addMenuItems(menu, ['scaleMulti','prettifyStation', 'pjffjg', 'compactStation', 'prettifyOutterLine', 'selectAllTxt', 'selectAllName', 'selectAllPoint', '-'], null, evt);
        }
        else if (StationHandler.isStationInnerCell(graph, cell) && !DeviceCategoryUtil.isTextCell(cell)) {
            this.addMenuItems(menu, ['selectSimilarDevice', 'selectSimilarDeviceTxt', 'selectSimilarDevicePoint', '-'], null, evt);
        }
        else if (parent && parent.style && parent.style.includes('group;')) {
            this.addMenuItems(menu, ['prettifyStation', 'pjffjg', '-'], null, evt);
        }
        else if (cell.style.indexOf('text;') != -1) {
            this.addMenuItems(menu, ['verticalText','verticalCText','verticalAllText', 'horizontalText', '-'], null, evt);
        }
        else
        {
            this.addMenuItems(menu, ['fsSettingSameType', 'straightDev', 'scaleMulti'], null, evt);
            if (DeviceCategoryUtil.isPoleCell(cell) || DeviceCategoryUtil.isCableTerminalCell(cell)) {
                this.addMenuItems(menu, ['beautifyPole', '-'], null, evt);
            }
        }
    }
    preAddPopupMenuItems.apply(this, arguments);
}

window.EditDataDialog = function(ui, cell)
{
    var div = document.createElement('div');
    div.style.boxSizing = 'border-box';
    // 子节点均为 absolute，不设高度且 overflow:hidden 会导致父级高度为 0、内容被裁成空白
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.minHeight = '0';
    div.style.position = 'relative';
    var graph = ui.editor.graph;

    var value = graph.getModel().getValue(cell);

    // Converts the value to an XML node
    if (!mxUtils.isNode(value))
    {
        var doc = mxUtils.createXmlDocument();
        var obj = doc.createElement('object');
        obj.setAttribute('label', value || '');
        value = obj;
    }

    var meta = {};

    try
    {
        var temp = mxUtils.getValue(ui.editor.graph.getCurrentCellStyle(cell), 'metaData', null);

        if (temp != null)
        {
            meta = JSON.parse(temp);
        }
    }
    catch (e)
    {
        // ignore
    }

    // Creates the dialog contents
    var form = new mxForm('properties');
    form.table.style.width = '100%';
    form.table.style.maxWidth = '100%';
    form.table.style.boxSizing = 'border-box';
    form.table.style.tableLayout = 'fixed';

    var attrs = value.attributes;
    var names = [];
    var texts = [];
    var count = 0;

    // 与 graph.js getTooltipForCell 母线（0311 / busbar）判定一致
    var cellStyle = graph.getCurrentCellStyle(cell) || {};
    var psrtype = cell['psrtype'] || cellStyle['psrtype'] || '';
    var isBusbar = cell.symbol == 'busbar' || psrtype == '0311' || cellStyle['flag'] == 'busbar';

    var shapeLower = (cellStyle.shape || cell.symbol || '').toString().toLowerCase()
    var isLgLoadDevice = shapeLower === 'substation' || shapeLower === 'xb'
    var isLgGeneratingUnit = shapeLower === 'generatingunit'
    var isLgTransformer =
        shapeLower === 'potentialtransformer2w' ||
        shapeLower === 'potentialtransformer3w' ||
        shapeLower.indexOf('potentialtransformer2w_') === 0 ||
        shapeLower.indexOf('potentialtransformer3w_') === 0

    var id = (EditDataDialog.getDisplayIdForCell != null) ?
        EditDataDialog.getDisplayIdForCell(ui, cell) : null;

    // 判断是否为母线连接线（连接两条母线的线）
    var isBusbarConnector = false;
    if (graph.getModel().isEdge(cell)) {
        var sourceCell = graph.getModel().getTerminal(cell, true);
        var targetCell = graph.getModel().getTerminal(cell, false);
        
        // 检查源终端是否为母线
        var isSourceBusbar = false;
        if (sourceCell) {
            var sourceCellStyle = graph.getCurrentCellStyle(sourceCell) || {};
            var sourcePsrtype = sourceCell['psrtype'] || sourceCellStyle['psrtype'] || '';
            isSourceBusbar = sourceCell.symbol == 'busbar' || sourcePsrtype == '0311' || sourceCellStyle['flag'] == 'busbar';
        }
        
        // 检查目标终端是否为母线
        var isTargetBusbar = false;
        if (targetCell) {
            var targetCellStyle = graph.getCurrentCellStyle(targetCell) || {};
            var targetPsrtype = targetCell['psrtype'] || targetCellStyle['psrtype'] || '';
            isTargetBusbar = targetCell.symbol == 'busbar' || targetPsrtype == '0311' || targetCellStyle['flag'] == 'busbar';
        }
        
        isBusbarConnector = isSourceBusbar && isTargetBusbar;
    }
    
    // 属性名称中英文映射
    var attrNameMap = {
        'name': '设备名称',
        'switchrolename': '开关作用',
        'pubprivflag': '营配标识',
        'psrtype': 'PSR类型',
        'sblx': '设备类型',
        'dydj': '电压等级',
        'id': 'ID',
        'shape': '图形',
        'label': '标签',
        'style': '样式',
        'metadata': '元数据',
        // 母线连接线属性
        'model': '线路型号',
        'model_paras': '线路型号参数',
        'Ih': '额定载流量(kA)',
        'length': '线路长度(km)',
        'P': '有功功率',
        'Q': '无功功率',
        'type': '机组类型',
        'V_Rate': '机组额定电压',
        'P_Rate': '机组额定有功功率',
        'P_max': '机组最大有功功率',
        'P_min': '机组最小有功功率',
        'Q_max': '机组最大无功功率',
        'Q_min': '机组最小无功功率',
        'P_meas': '机组目标出力',
        'I_Vol': '高压侧额定电压',
        'K_Vol': '中压侧额定电压',
        'J_Vol': '低压侧额定电压',
        'hv_paras': '高-中压侧参数',
        'mv_paras': '中-低压侧参数',
        'lv_paras': '高-低压侧参数',
        'I_S': '高压侧容量',
        'K_S': '中压侧容量',
        'J_S': '低压侧容量',
    };

    var addTextArea = function(index, name, value)
    {
        names[index] = name;
        // 使用中文属性名称显示（cell / 样式上可能为数字等非字符串）
        var strValue = (value == null || value === undefined) ? '' : String(value);
        var displayName = attrNameMap[name] || name;
        if (isBusbarConnector && name == 'name') {
            displayName = '线路名称';
        }
        if (isLgGeneratingUnit && name == 'name') {
            displayName = '机组名称';
        }
        if (isLgTransformer && name === 'model') {
            displayName = '变压器型号';
        }
        if (isLgGeneratingUnit && name === 'type') {
            var sel = form.addCombo(displayName + ':', false);
            sel.style.width = '100%';
            sel.style.maxWidth = '100%';
            sel.style.boxSizing = 'border-box';
            var typeOpts = [
                { label: '煤', value: 'coal' },
                { label: '燃气', value: 'gas' },
                { label: '生物质', value: 'biomass' },
                { label: '风', value: 'wind' },
                { label: '光', value: 'solar' },
                { label: '核', value: 'nuclear' },
                { label: '水', value: 'hydro' },
            ];
            var cur = strValue.trim();
            var known = false;
            for (var toi = 0; toi < typeOpts.length; toi++) {
                if (typeOpts[toi].value === cur) {
                    known = true;
                    break;
                }
            }
            form.addOption(sel, '（请选择）', '', cur === '' || !known);
            for (var toj = 0; toj < typeOpts.length; toj++) {
                form.addOption(sel, typeOpts[toj].label, typeOpts[toj].value, cur === typeOpts[toj].value);
            }
            texts[index] = sel;
        } else {
            texts[index] = form.addTextarea(displayName + ':', strValue, 2);
            texts[index].style.width = '100%';
            texts[index].style.maxWidth = '100%';
            texts[index].style.boxSizing = 'border-box';
            if (strValue.indexOf('\n') > 0)
            {
                texts[index].setAttribute('rows', '2');
            }
        }

        // 设备名称可编辑，id和shape不可编辑；母线设备类型只读（与 Graph.getTooltipForCell 一致）
        if (name == 'id' || name == 'shape' || (isBusbar && name == 'sblx') ||
            (meta[name] != null && meta[name].editable == false))
        {
            texts[index].setAttribute('disabled', 'disabled');
        }
    };

    var temp = [];
    var isLayer = graph.getModel().getParent(cell) == graph.getModel().getRoot();

    for (var i = 0; i < attrs.length; i++)
    {
        if ((attrs[i].nodeName != 'label' || Graph.translateDiagram ||
            isLayer) && attrs[i].nodeName != 'placeholders')
        {
            temp.push({name: attrs[i].nodeName, value: attrs[i].nodeValue});
        }
    }

    // 添加 tooltip 中显示的其他属性（母线仅同步：设备名称、设备类型）
    var tooltipAttrs = isBusbar ? ['name'] : ['name', 'attr', 'switchrolename', 'pubprivflag'];

    for (var i = 0; i < tooltipAttrs.length; i++)
    {
        var attrName = tooltipAttrs[i];
        var attrValue = cell[attrName] || cellStyle[attrName] || '';
        
        // 转换营配标识的显示值
        if (attrName == 'pubprivflag' && attrValue != '')
        {
            attrValue = attrValue == 0 ? '运检' : '营销';
        }
        
        // 检查是否已存在该属性
        var exists = temp.some(function(item) { return item.name == attrName; });
        if (!exists && (attrValue != '' || (isBusbar && attrName == 'name')))
        {
            temp.push({name: attrName, value: attrValue.toString()});
        }
    }

    // 处理设备类型（包含中文名称），与 graph.js 母线 tooltip 逻辑一致
    var sblxName = '';
    
    if (cell.id) {
        var arr = cell.id.split('_');
        if (cell.id.indexOf('virtual') == -1 && arr.length > 0) {
            var sbzlx = arr[1];
            sblxName = sbzlx2nameMap.get(sbzlx) || sbzlx2nameMap.get(cell.sbzlx) || '';
        }
    }
    
    var fullSblx = '';
    if (sblxName) {
        fullSblx = sblxName;
    }
    if (psrtype) {
        if (fullSblx) {
            fullSblx = fullSblx + '(' + psrtype + ')';
        } else {
            fullSblx = psrtype;
        }
    }
    if (isBusbar && !fullSblx) {
        fullSblx = '母线(0311)';
    }
    // 工具栏拖入的站内母线（graphLg 模板 busbarThin=1），设备类型与图例「站内-母线（0311）」一致
    if (isBusbar && (cellStyle['busbarThin'] == '1' || cellStyle['busbarThin'] === 1)) {
        fullSblx = '站内-母线(0311)';
    }

    if (isBusbar) {
        temp = temp.filter(function(item) { return item.name != 'sblx'; });
        temp.push({ name: 'sblx', value: fullSblx });
    } else {
        var sblxExists = temp.some(function(item) { return item.name == 'sblx'; });
        if (!sblxExists && fullSblx != '') {
            temp.push({name: 'sblx', value: fullSblx});
        }
    }

    if (isBusbar) {
        temp = temp.filter(function(item) { return item.name != 'dydj'; });
        var nameFound = false;
        for (var ni = 0; ni < temp.length; ni++) {
            if (temp[ni].name == 'name') {
                nameFound = true;
                if (!temp[ni].value) {
                    temp[ni].value = (cell['name'] || cellStyle['name'] || '').toString();
                }
                break;
            }
        }
        if (!nameFound) {
            temp.push({ name: 'name', value: (cell['name'] || cellStyle['name'] || '').toString() });
        }
    }

    // 力光侧栏「负荷」：配电站(zf06)、箱式变(zf08) — 仅编辑设备名称、有功功率、无功功率
    if (isLgLoadDevice) {
        var loadKeys = ['name', 'P', 'Q']
        var loadVals = {}
        for (var li = 0; li < loadKeys.length; li++) {
            var lk = loadKeys[li]
            var vRaw = cell[lk] != null && cell[lk] !== '' ? cell[lk] : cellStyle[lk]
            loadVals[lk] = vRaw != null && vRaw !== '' ? String(vRaw) : ''
        }
        temp = temp.filter(function (item) {
            var n = item.name
            return n === 'id' || n === 'shape' || loadKeys.indexOf(n) >= 0
        })
        for (var lj = 0; lj < loadKeys.length; lj++) {
            var kn = loadKeys[lj]
            var exists = temp.some(function (item) {
                return item.name === kn
            })
            if (!exists) {
                temp.push({ name: kn, value: loadVals[kn] })
            } else {
                for (var ti = 0; ti < temp.length; ti++) {
                    if (temp[ti].name === kn && (!temp[ti].value || temp[ti].value === '')) {
                        temp[ti].value = loadVals[kn]
                        break
                    }
                }
            }
        }
    }

    // 力光侧栏「机组」：仅编辑名称、类型、额定/限值/目标出力等约定字段
    if (isLgGeneratingUnit) {
        var unitKeys = [
            'name',
            'type',
            'V_Rate',
            'P_Rate',
            'P_max',
            'P_min',
            'Q_max',
            'Q_min',
            'P_meas',
        ]
        var unitVals = {}
        for (var gi = 0; gi < unitKeys.length; gi++) {
            var gk = unitKeys[gi]
            var gRaw = cell[gk] != null && cell[gk] !== '' ? cell[gk] : cellStyle[gk]
            unitVals[gk] = gRaw != null && gRaw !== '' ? String(gRaw) : ''
        }
        temp = temp.filter(function (item) {
            var n = item.name
            return n === 'id' || n === 'shape' || unitKeys.indexOf(n) >= 0
        })
        for (var gj = 0; gj < unitKeys.length; gj++) {
            var gkn = unitKeys[gj]
            var gExists = temp.some(function (item) {
                return item.name === gkn
            })
            if (!gExists) {
                temp.push({ name: gkn, value: unitVals[gkn] })
            } else {
                for (var gti = 0; gti < temp.length; gti++) {
                    if (temp[gti].name === gkn && (!temp[gti].value || temp[gti].value === '')) {
                        temp[gti].value = unitVals[gkn]
                        break
                    }
                }
            }
        }
    }

    // 力光侧栏「变压器」双绕组/三绕组：电压、型号、参数、容量等约定字段
    if (isLgTransformer) {
        var xfKeys = [
            'name',
            'I_Vol',
            'K_Vol',
            'J_Vol',
            'model',
            'hv_paras',
            'mv_paras',
            'lv_paras',
            'I_S',
            'K_S',
            'J_S',
        ]
        var xfVals = {}
        for (var xi = 0; xi < xfKeys.length; xi++) {
            var xk = xfKeys[xi]
            var xRaw = cell[xk] != null && cell[xk] !== '' ? cell[xk] : cellStyle[xk]
            xfVals[xk] = xRaw != null && xRaw !== '' ? String(xRaw) : ''
        }
        temp = temp.filter(function (item) {
            var n = item.name
            return n === 'id' || n === 'shape' || xfKeys.indexOf(n) >= 0
        })
        for (var xj = 0; xj < xfKeys.length; xj++) {
            var xkn = xfKeys[xj]
            var xExists = temp.some(function (item) {
                return item.name === xkn
            })
            if (!xExists) {
                temp.push({ name: xkn, value: xfVals[xkn] })
            } else {
                for (var xti = 0; xti < temp.length; xti++) {
                    if (temp[xti].name === xkn && (!temp[xti].value || temp[xti].value === '')) {
                        temp[xti].value = xfVals[xkn]
                        break
                    }
                }
            }
        }
    }

    // 母线连接线特殊处理：添加线路属性字段
    if (isBusbarConnector) {
        // 不展示 busid / 母线端点引用（模型与提交仍保留；含命名空间前缀如 cge:busid）
        var hideConnectorBusAttrs = [
            'busid',
            'bus_id',
            'from_bus_id',
            'to_bus_id',
            'from_bus',
            'to_bus',
            'frombusid',
            'tobusid'
        ]
        var connectorAttrLocalName = function (attrName) {
            var s = (attrName || '').toString().trim()
            var c = s.indexOf(':')
            if (c >= 0) {
                s = s.slice(c + 1)
            }
            return s.toLowerCase()
        }
        temp = temp.filter(function (item) {
            return hideConnectorBusAttrs.indexOf(connectorAttrLocalName(item.name)) < 0
        })
        // 确保 name 字段存在（线路名称）
        var lineNameFound = false;
        for (var ni = 0; ni < temp.length; ni++) {
            if (temp[ni].name == 'name') {
                lineNameFound = true;
                if (!temp[ni].value) {
                    temp[ni].value = (cell['name'] || cellStyle['name'] || '').toString();
                }
                break;
            }
        }
        if (!lineNameFound) {
            temp.push({ name: 'name', value: (cell['name'] || cellStyle['name'] || '').toString() });
        }
        
        // 添加线路型号字段
        var modelValue = cell['model'] || cellStyle['model'] || '';
        temp = temp.filter(function(item) { return item.name != 'model'; });
        temp.push({ name: 'model', value: modelValue.toString() });
        
        // 添加线路型号参数字段
        var modelParasValue = cell['model_paras'] || cellStyle['model_paras'] || '';
        temp = temp.filter(function(item) { return item.name != 'model_paras'; });
        temp.push({ name: 'model_paras', value: modelParasValue.toString() });
        
        // 添加额定载流量字段
        var IhValue = cell['Ih'] || cellStyle['Ih'] || '';
        temp = temp.filter(function(item) { return item.name != 'Ih'; });
        temp.push({ name: 'Ih', value: IhValue.toString() });
        
        // 添加线路长度字段
        var lengthValue = cell['length'] || cellStyle['length'] || '';
        temp = temp.filter(function(item) { return item.name != 'length'; });
        temp.push({ name: 'length', value: lengthValue.toString() });
    }

    // Sorts by name；母线优先顺序与 tooltip 一致：设备名称、设备类型
    if (isBusbar) {
        var orderPref = { name: 0, sblx: 1 };
        temp.sort(function(a, b) {
            var oa = Object.prototype.hasOwnProperty.call(orderPref, a.name) ? orderPref[a.name] : 100;
            var ob = Object.prototype.hasOwnProperty.call(orderPref, b.name) ? orderPref[b.name] : 100;
            if (oa !== ob) {
                return oa - ob;
            }
            if (a.name < b.name) {
                return -1;
            }
            if (a.name > b.name) {
                return 1;
            }
            return 0;
        });
    } else if (isBusbarConnector) {
        // 母线连接线字段顺序：线路名称、线路型号、线路型号参数、额定载流量、线路长度
        var connectorOrderPref = { name: 0, model: 1, model_paras: 2, Ih: 3, length: 4 };
        temp.sort(function(a, b) {
            var oa = Object.prototype.hasOwnProperty.call(connectorOrderPref, a.name) ? connectorOrderPref[a.name] : 100;
            var ob = Object.prototype.hasOwnProperty.call(connectorOrderPref, b.name) ? connectorOrderPref[b.name] : 100;
            if (oa !== ob) {
                return oa - ob;
            }
            if (a.name < b.name) {
                return -1;
            }
            if (a.name > b.name) {
                return 1;
            }
            return 0;
        });
    } else if (isLgTransformer) {
        var xfOrderPref = {
            name: 0,
            I_Vol: 1,
            K_Vol: 2,
            J_Vol: 3,
            model: 4,
            hv_paras: 5,
            mv_paras: 6,
            lv_paras: 7,
            I_S: 8,
            K_S: 9,
            J_S: 10,
            id: 98,
            shape: 99,
        }
        temp.sort(function (a, b) {
            var oa = Object.prototype.hasOwnProperty.call(xfOrderPref, a.name) ? xfOrderPref[a.name] : 50
            var ob = Object.prototype.hasOwnProperty.call(xfOrderPref, b.name) ? xfOrderPref[b.name] : 50
            if (oa !== ob) {
                return oa - ob
            }
            if (a.name < b.name) {
                return -1
            }
            if (a.name > b.name) {
                return 1
            }
            return 0
        })
    } else if (isLgGeneratingUnit) {
        var unitOrderPref = {
            name: 0,
            type: 1,
            V_Rate: 2,
            P_Rate: 3,
            P_max: 4,
            P_min: 5,
            Q_max: 6,
            Q_min: 7,
            P_meas: 8,
            id: 98,
            shape: 99,
        }
        temp.sort(function (a, b) {
            var oa = Object.prototype.hasOwnProperty.call(unitOrderPref, a.name) ? unitOrderPref[a.name] : 50
            var ob = Object.prototype.hasOwnProperty.call(unitOrderPref, b.name) ? unitOrderPref[b.name] : 50
            if (oa !== ob) {
                return oa - ob
            }
            if (a.name < b.name) {
                return -1
            }
            if (a.name > b.name) {
                return 1
            }
            return 0
        })
    } else if (isLgLoadDevice) {
        var loadOrderPref = { name: 0, P: 1, Q: 2, id: 98, shape: 99 };
        temp.sort(function (a, b) {
            var oa = Object.prototype.hasOwnProperty.call(loadOrderPref, a.name) ? loadOrderPref[a.name] : 50;
            var ob = Object.prototype.hasOwnProperty.call(loadOrderPref, b.name) ? loadOrderPref[b.name] : 50;
            if (oa !== ob) {
                return oa - ob;
            }
            if (a.name < b.name) {
                return -1;
            }
            if (a.name > b.name) {
                return 1;
            }
            return 0;
        });
    } else {
        temp.sort(function(a, b)
        {
            if (a.name < b.name)
            {
                return -1;
            }
            else if (a.name > b.name)
            {
                return 1;
            }
            else
            {
                return 0;
            }
        });
    }

    if (id != null)
    {
        var text = document.createElement('div');
        text.style.width = '100%';
        text.style.fontSize = '11px';
        text.style.textAlign = 'center';
        text.style.color = '#999';
        mxUtils.write(text, id);

        var idInput = form.addField(mxResources.get('id') + ':', text);
        
        // id 字段不可编辑，禁用双击编辑功能
        text.style.cursor = 'default';
    }

    for (var i = 0; i < temp.length; i++)
    {
        addTextArea(count, temp[i].name, temp[i].value);
        count++;
    }

    var dialogTitle = '编辑属性';
    if (isBusbar) {
        dialogTitle = '站内-母线（0311）';
    } else if (isBusbarConnector) {
        dialogTitle = '母线连接线';
    } else {
        var shapeForTitle = (cellStyle.shape || cell.symbol || '').toString();
        var paletteTitle = lgSidebarPaletteTitleForShape(shapeForTitle);
        if (paletteTitle) {
            dialogTitle = paletteTitle;
        } else if (graph.getModel().isEdge(cell)) {
            dialogTitle = '连接线';
        }
    }
    var headerEl = document.createElement('div');
    headerEl.setAttribute('role', 'heading');
    headerEl.setAttribute('aria-level', '2');
    headerEl.style.cssText =
        'position:absolute;top:10px;left:24px;right:24px;height:44px;box-sizing:border-box;' +
        'padding:10px 2px 8px 2px;margin:0;border-bottom:1px solid #e5e5e5;' +
        'font-size:15px;font-weight:600;color:#1a1a1a;line-height:1.35;text-align:center;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    mxUtils.write(headerEl, dialogTitle);
    div.appendChild(headerEl);

    var top = document.createElement('div');
    top.style.position = 'absolute';
    top.style.top = '60px';
    top.style.left = '24px';
    top.style.right = '24px';
    top.style.bottom = '80px';
    top.style.overflowY = 'auto';
    top.style.overflowX = 'hidden';
    top.style.boxSizing = 'border-box';

    top.appendChild(form.table);

    var newProp = document.createElement('div');
    newProp.style.display = 'flex';
    newProp.style.alignItems = 'center';
    newProp.style.flexWrap = 'wrap';
    newProp.style.gap = '6px 8px';
    newProp.style.boxSizing = 'border-box';
    newProp.style.whiteSpace = 'normal';
    newProp.style.marginTop = '10px';
    newProp.style.width = '100%';
    newProp.style.maxWidth = '100%';
    newProp.style.minWidth = '0';

    var nameInput = document.createElement('input');
    nameInput.setAttribute('placeholder', mxResources.get('enterPropertyName'));
    nameInput.setAttribute('type', 'text');
    nameInput.setAttribute('size', (mxClient.IS_IE || mxClient.IS_IE11) ? '36' : '40');
    nameInput.style.boxSizing = 'border-box';
    nameInput.style.borderWidth = '1px';
    nameInput.style.borderStyle = 'solid';
    nameInput.style.marginLeft = '0';
    nameInput.style.padding = '4px';
    nameInput.style.flex = '1 1 120px';
    nameInput.style.minWidth = '0';
    nameInput.style.maxWidth = '100%';
    newProp.appendChild(nameInput);
    top.appendChild(newProp);
    if (isLgGeneratingUnit || isLgTransformer) {
        newProp.style.display = 'none';
    }
    div.appendChild(top);

    var addBtn = mxUtils.button(mxResources.get('addProperty'), function()
    {
        var name = nameInput.value;

        // Avoid ':' in attribute names which seems to be valid in Chrome
        if (name.length > 0 && name != 'label' && name != 'id' &&
            name != 'placeholders' && name.indexOf(':') < 0)
        {
            try
            {
                var idx = mxUtils.indexOf(names, name);

                if (idx >= 0 && texts[idx] != null)
                {
                    texts[idx].focus();
                }
                else
                {
                    // Checks if the name is valid
                    var clone = value.cloneNode(false);
                    clone.setAttribute(name, '');

                    if (idx >= 0)
                    {
                        names.splice(idx, 1);
                        texts.splice(idx, 1);
                    }

                    names.push(name);
                    var text = form.addTextarea(name + ':', '', 2);
                    text.style.width = '100%';
                    text.style.maxWidth = '100%';
                    text.style.boxSizing = 'border-box';
                    texts.push(text);

                    text.focus();
                }

                addBtn.setAttribute('disabled', 'disabled');
                nameInput.value = '';
            }
            catch (e)
            {
                mxUtils.alert(e);
            }
        }
        else
        {
            mxUtils.alert(mxResources.get('invalidName'));
        }
    });

    mxEvent.addListener(nameInput, 'keypress', function(e)
    {
        if (e.keyCode == 13 )
        {
            addBtn.click();
        }
    });

    this.init = function()
    {
        if (texts.length > 0)
        {
            texts[0].focus();
        }
        else
        {
            nameInput.focus();
        }
    };

    addBtn.setAttribute('title', mxResources.get('addProperty'));
    addBtn.setAttribute('disabled', 'disabled');
    addBtn.style.textOverflow = 'ellipsis';
    addBtn.style.position = 'static';
    addBtn.style.overflow = 'hidden';
    addBtn.style.flex = '0 0 auto';
    addBtn.style.maxWidth = '100%';
    addBtn.className = 'geBtn';
    newProp.appendChild(addBtn);

    var cancelBtn = mxUtils.button(mxResources.get('cancel'), function()
    {
        ui.hideDialog.apply(ui, arguments);
    });

    cancelBtn.setAttribute('title', 'Escape');
    cancelBtn.className = 'geBtn';

    var exportBtn = mxUtils.button(mxResources.get('export'), mxUtils.bind(this, function(evt)
    {
        var result = graph.getDataForCells([cell], true);

        var dlg = new EmbedDialog(ui, JSON.stringify(result, null, 2), null, null, function()
        {
            console.log(result);
            ui.alert('Written to Console (Dev Tools)');
        }, mxResources.get('export'), null, 'Console', 'data.json');
        ui.showDialog(dlg.container, 450, 240, true, true);
        dlg.init();
    }));

    exportBtn.setAttribute('title', mxResources.get('export'));
    exportBtn.className = 'geBtn';

    var applyBtn = mxUtils.button(mxResources.get('apply'), function()
    {
        try
        {
            ui.hideDialog.apply(ui, arguments);

            // Clones and updates the value
            value = value.cloneNode(true);
            var removeLabel = false;
            var gmodel = graph.getModel();

            gmodel.beginUpdate();
            try
            {
                for (var i = 0; i < names.length; i++)
                {
                    if (texts[i] == null)
                    {
                        value.removeAttribute(names[i]);
                        // 删除属性时也从 cell 对象上移除
                        if (cell[names[i]] != null)
                        {
                            delete cell[names[i]];
                        }
                    }
                    else
                    {
                        // 设备类型行为只读展示，不落库（与 tooltip 推导一致）
                        if (isBusbar && names[i] == 'sblx') {
                            continue;
                        }

                        value.setAttribute(names[i], texts[i].value);
                        
                        // 同步更新 cell 对象上的所有属性（用于 tooltip 显示）
                        // 营配标识需要转换回数字
                        if (names[i] == 'pubprivflag')
                        {
                            cell[names[i]] = texts[i].value == '运检' ? 0 : 1;
                        }
                        else
                        {
                            cell[names[i]] = texts[i].value;
                        }
                        
                        removeLabel = removeLabel || (names[i] == 'placeholder' &&
                            value.getAttribute('placeholders') == '1');
                    }
                }

                if (isBusbar && value.removeAttribute) {
                    value.removeAttribute('sblx');
                }

                // Removes label if placeholder is assigned
                if (removeLabel)
                {
                    value.removeAttribute('label');
                }

                // Updates the value of the cell (undoable)
                gmodel.setValue(cell, value);

                // 母线连接线：样式与 XML 双写，便于导出与 collectBusConnectorSubmitPayload 读取
                if (isBusbarConnector) {
                    var connectorStyleKeys = ['name', 'model', 'model_paras', 'Ih', 'length'];
                    for (var si = 0; si < names.length; si++) {
                        if (connectorStyleKeys.indexOf(names[si]) < 0) {
                            continue;
                        }
                        var sv = texts[si] != null ? texts[si].value : '';
                        graph.setCellStyles(names[si], sv, [cell]);
                    }
                }
                if (isLgGeneratingUnit) {
                    var unitStyleKeys = [
                        'name',
                        'type',
                        'V_Rate',
                        'P_Rate',
                        'P_max',
                        'P_min',
                        'Q_max',
                        'Q_min',
                        'P_meas',
                    ]
                    for (var uix = 0; uix < names.length; uix++) {
                        if (unitStyleKeys.indexOf(names[uix]) < 0) {
                            continue
                        }
                        var usv = texts[uix] != null ? texts[uix].value : ''
                        graph.setCellStyles(names[uix], usv, [cell])
                    }
                }
                if (isLgTransformer) {
                    var xfStyleKeys = [
                        'name',
                        'I_Vol',
                        'K_Vol',
                        'J_Vol',
                        'model',
                        'hv_paras',
                        'mv_paras',
                        'lv_paras',
                        'I_S',
                        'K_S',
                        'J_S',
                    ]
                    for (var xix = 0; xix < names.length; xix++) {
                        if (xfStyleKeys.indexOf(names[xix]) < 0) {
                            continue
                        }
                        var xsv = texts[xix] != null ? texts[xix].value : ''
                        graph.setCellStyles(names[xix], xsv, [cell])
                    }
                }
            }
            finally
            {
                gmodel.endUpdate();
            }
        }
        catch (e)
        {
            mxUtils.alert(e);
        }
    });

    applyBtn.setAttribute('title', 'Ctrl+Enter');
    applyBtn.className = 'geBtn gePrimaryBtn';

    mxEvent.addListener(div, 'keypress', function(e)
    {
        if (e.keyCode == 13 && mxEvent.isControlDown(e))
        {
            applyBtn.click();
        }
    });

    function updateAddBtn()
    {
        if (nameInput.value.length > 0)
        {
            addBtn.removeAttribute('disabled');
        }
        else
        {
            addBtn.setAttribute('disabled', 'disabled');
        }
    };

    mxEvent.addListener(nameInput, 'keyup', updateAddBtn);

    // Catches all changes that don't fire a keyup (such as paste via mouse)
    mxEvent.addListener(nameInput, 'change', updateAddBtn);

    var buttons = document.createElement('div');
    buttons.style.cssText = 'position:absolute;left:24px;right:24px;text-align:right;bottom:24px;height:40px;'

    if (ui.editor.cancelFirst)
    {
        buttons.appendChild(cancelBtn);
    }

    // buttons.appendChild(exportBtn);
    buttons.appendChild(applyBtn);

    if (!ui.editor.cancelFirst)
    {
        buttons.appendChild(cancelBtn);
    }

    div.appendChild(buttons);
    this.container = div;
};

window.TextareaDialog = function(editorUi, title, url, fn, cancelFn, cancelTitle, w, h,
    addButtons, noHide, noWrap, applyTitle, helpLink, customButtons, header)
{
    w = (w != null) ? w : 300;
    h = (h != null) ? h : 120;
    noHide = (noHide != null) ? noHide : false;

    var div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.top = '20px';
    div.style.bottom = '20px';
    div.style.left = '20px';
    div.style.right = '20px';

    var top = document.createElement('div');

    top.style.position = 'absolute';
    top.style.left = '0px';
    top.style.right = '0px';

    var main = top.cloneNode(false);
    var buttons = top.cloneNode(false);

    top.style.top = '0px';
    top.style.height = '20px';
    main.style.top = '20px';
    main.style.bottom = '64px';
    buttons.style.bottom = '0px';
    buttons.style.height = '60px';
    buttons.style.textAlign = 'right';
    buttons.style.paddingTop = '14px';
    buttons.style.boxSizing = 'border-box';

    mxUtils.write(top, title);

    div.appendChild(top);
    div.appendChild(main);
    div.appendChild(buttons);

    if (header != null)
    {
        top.appendChild(header);
    }

    var nameInput = document.createElement('textarea');

    if (noWrap)
    {
        nameInput.setAttribute('wrap', 'off');
    }

    nameInput.setAttribute('spellcheck', 'false');
    nameInput.setAttribute('autocorrect', 'off');
    nameInput.setAttribute('autocomplete', 'off');
    nameInput.setAttribute('autocapitalize', 'off');

    mxUtils.write(nameInput, url || '');
    nameInput.style.resize = 'none';
    nameInput.style.outline = 'none';
    nameInput.style.position = 'absolute';
    nameInput.style.boxSizing = 'border-box';
    nameInput.style.top = '0px';
    nameInput.style.left = '0px';
    nameInput.style.height = '100%';
    nameInput.style.width = '100%';

    this.textarea = nameInput;

    this.init = function()
    {
        nameInput.focus();
        nameInput.scrollTop = 0;
    };

    main.appendChild(nameInput);

    if (helpLink != null && !editorUi.isOffline())
    {
        buttons.appendChild(editorUi.createHelpIcon(helpLink));
    }

    if (customButtons != null)
    {
        for (var i = 0; i < customButtons.length; i++)
        {
            (function(label, fn, title)
            {
                var customBtn = mxUtils.button(label, function(e)
                {
                    fn(e, nameInput);
                });

                if (title != null)
                {
                    customBtn.setAttribute('title', title);
                }

                customBtn.className = 'geBtn';

                buttons.appendChild(customBtn);
            })(customButtons[i][0], customButtons[i][1], customButtons[i][2]);
        }
    }

    var cancelBtn = mxUtils.button(cancelTitle || mxResources.get('cancel'), function()
    {
        editorUi.hideDialog();

        if (cancelFn != null)
        {
            cancelFn();
        }
    });

    cancelBtn.setAttribute('title', 'Escape');
    cancelBtn.className = 'geBtn';

    if (editorUi.editor.cancelFirst)
    {
        buttons.appendChild(cancelBtn);
    }

    if (addButtons != null)
    {
        addButtons(buttons, nameInput);
    }

    // if (fn != null)
    // {
    //     var genericBtn = mxUtils.button(applyTitle || mxResources.get('apply'), function()
    //     {
    //         if (!noHide)
    //         {
    //             editorUi.hideDialog();
    //         }
    //
    //         fn(nameInput.value);
    //     });
    //
    //     genericBtn.setAttribute('title', 'Ctrl+Enter');
    //     genericBtn.className = 'geBtn gePrimaryBtn';
    //     buttons.appendChild(genericBtn);
    //
    //     mxEvent.addListener(nameInput, 'keypress', function(e)
    //     {
    //         if (e.keyCode == 13 && mxEvent.isControlDown(e))
    //         {
    //             genericBtn.click();
    //         }
    //     });
    // }

    if (!editorUi.editor.cancelFirst)
    {
        buttons.appendChild(cancelBtn);
    }

    this.container = div;
};