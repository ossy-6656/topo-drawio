import SymbolParse from "./SymbolParse2.js";
export default class StationParse {
	symbolMap = {
		Disconnector: true,
		GroundDisconnector: true,
		circlearc: true,
		ellipsear: true,
		poke: true,
	}
	constructor(url) {
		this.url = url;
	}
	getSpecialSymbol(list) {
		let map = {};
		list.each((index, dom) => {
			let nodeName = dom.nodeName;
			let ahref = dom.getAttribute('ahref');
			let devref = dom.getAttribute('devref');
			if (!map[nodeName]) {
				map[nodeName] = {};
			}
			if (devref) {
				// let stopIndex = devref.indexOf(':');
				map[nodeName][devref.substring(1)] = true;
			}
		});
		return map;
	}
	// 符号解析
	parseSymbol(spcMap) {
		let sb = [];
		sb.push('<defs>');
		for(let key in spcMap) {
			let symbolMap = spcMap[key];
			for(let symbolName in symbolMap) {
				let index = symbolName.indexOf(':');
				let name = symbolName.substring(0, index);

				let path = key.toLowerCase();
				let url = './鹤壁220kV浚县变主接线图/CIM-G/display/fac/' + path + '/' + name;
				$.ajax({
					type: 'post',
					url: url,
					dataType: 'xml',
					async: false,
					success: function (xmlDoc) {
						let g = $(xmlDoc).children()[0];
						let symbol = $(g).children()[0]
						let html = SymbolParse.parse(symbol, symbolName);
						sb.push(html);
					},
					error: function () {
						console.log('获取symbol失败...');
					}
				});
			}

		}
		sb.push('</defs>');
		return sb.join('');
	}

	/**
	 * g文件解析
	 * @param list       节点集合
	 * @param width      svg宽度 string
	 * @param height     svg高度 string
	 * @returns {string}
	 */
	parseDevList(list, width, height) {
		let sb = [];
		sb.push('<svg id="graph" width="' + width + '" height="' + height + '">');
		// 先生成所有状态符号
		let spcMap = this.getSpecialSymbol(list);

		let symbolTxt = this.parseSymbol(spcMap);
		sb.push(symbolTxt);
		list.each((index, dom) => {
			let nodeName = dom.nodeName;
			switch (nodeName) {
				case 'rect':
					sb.push(SymbolParse.parseRect(dom, true));
					break;
				case 'polygon':
					sb.push(SymbolParse.parsePolygon(dom, true));
					break;
				case 'polyline':
					sb.push(SymbolParse.parsePolyline(dom, true));
					break;
				case 'ellipse':
					sb.push(SymbolParse.parseEllipse(dom, true));
					break;
				case 'BusbarSection':
				case 'ACLineSegment':
				case 'line':
					sb.push(SymbolParse.parseLine(dom, true));
					break;
				case 'Text':
					sb.push(SymbolParse.parseText(dom, true));
					break;
				case 'DText':
					sb.push(SymbolParse.parseDText(dom, true));
					break;
				case 'circlearc':
					sb.push(SymbolParse.parseCirclearc(dom, true));
					break;
				case 'ellipsear':
					sb.push(SymbolParse.parseEllipsear(dom, true));
					break;
				case 'Status':
				case 'PT':
				case 'GroundDisconnector':
				case 'Disconnector':
				case 'CBreaker':
					sb.push(SymbolParse.parseDev(dom));
					break;
				default:
					console.log('未处理的数据：', nodeName);
			}
		});
		sb.push('</svg>');
		return sb.join('');
	}

	parseStation(callback) {
		let url = this.url;
		let that = this;

		$.ajax({
			type: 'post',
			url: url,
			dataType: 'xml',
			async: true,
			success: function (xmlDoc) {
				let g = $(xmlDoc).children()[0];
				let w = g.getAttribute('w');
				let h = g.getAttribute('h');
				let layer = $(g).children()[0];
				let list = $(layer).children();
				let html = that.parseDevList(list, w, h);
				callback(html);
			},
			error: function () {
				alert('获取symbol失败...');
			}
		});
	}
}
