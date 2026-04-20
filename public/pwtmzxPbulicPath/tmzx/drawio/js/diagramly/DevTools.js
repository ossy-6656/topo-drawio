if (urlParams['dev'] == '1')
{
	(function()
	{
		var graphGetTooltipForCell = Graph.prototype.getTooltipForCell;

		/**
		 * Overrides tooltips to show custom tooltip or metadata.
		 */
		Graph.prototype.getTooltipForCell_bak = function(cell)
		{
			var tip = graphGetTooltipForCell.apply(this, arguments);
			var geo = this.getCellGeometry(cell);
			
			tip += ((tip.length > 0) ? '<br>' : '') + 'id=' + cell.id + '<br>';
			
			if (geo != null)
			{
				if (geo.sourcePoint != null)
				{
					tip += 'source=' + parseFloat(geo.sourcePoint.x) + ',' + parseFloat(geo.sourcePoint.y) + '<br>';
				}
				
				if (geo.targetPoint != null)
				{
					tip += 'target=' + parseFloat(geo.targetPoint.x) + ',' + parseFloat(geo.targetPoint.y) + '<br>';
				}
				
				var state = this.view.getState(cell);
				
				if (state != null && state.absolutePoints != null)
				{
					tip += 'abspoints(' + state.absolutePoints.length + ')=';
					
					for (var i = 0; i < state.absolutePoints.length; i++)
					{
						tip += parseFloat(state.absolutePoints[i].x) + ',' + parseFloat(state.absolutePoints[i].y) + ';';
					}
					
					tip += '<br>';
					
					if (geo.points != null)
					{
						tip += 'points(' + geo.points.length + ')=';
						
						for (var i = 0; i < geo.points.length; i++)
						{
							tip += parseFloat(geo.points[i].x) + ',' + parseFloat(geo.points[i].y) + ';';
						}
					}
				}
				else
				{
//					tip += 'pos=' + this.view.formatUnitText(parseFloat(geo.x)) + ',' + this.view.formatUnitText(parseFloat(geo.y)) + '<br>' +
//						'size=' + this.view.formatUnitText(parseFloat(geo.width)) + 'x' + this.view.formatUnitText(parseFloat(geo.height));
					tip += 'x/y=' + parseFloat(geo.x) + ',' + parseFloat(geo.y) + '<br>' +
						'w/h=' + parseFloat(geo.width) + 'x' + parseFloat(geo.height);
					
					if (state != null)
					{
						tip += '<br>pos=' + parseFloat(state.x) + ',' + parseFloat(state.y) + '<br>' +
							'size=' + parseFloat(state.width) + 'x' + parseFloat(state.height);
					}
				}

				if (cell.style != null)
				{
					if (state.style && state.style.name) {
						tip += '<div>设备名称=' + state.style.name + '</div>';
					}
					else
					{
						tip += '<br>';
					}

					tip += 'style=<div style="display:inline-block;vertical-align:bottom;white-space:nowrap;width:480px;' +
						'overflow:hidden;text-overflow:ellipsis;">' + mxUtils.htmlEntities(cell.style) + '</span>';
				}
			}
			
			return tip;
		};
		Graph.prototype.getTooltipForCell = function(cell)
		{
			let model = this.model;
			let view = this.view;
			var tip = graphGetTooltipForCell.apply(this, arguments);
			var geo = this.getCellGeometry(cell);

			let sb = [];
			// if (tip.length > 0){
			// 	sb.push(tip);
			// }
			sb.push('<table>');
			sb.push(`<tr><td>ID</td><td>${cell.id}</td></tr>`);
			if (geo != null)
			{
				var state = this.view.getState(cell);
				let cellStyle = state.style;

				if (cellStyle)
				{
					if (cellStyle.name)
					{
						sb.push(`<tr><td>设备名称</td><td>${cellStyle.name}</td></tr>`);
					}
					if (cellStyle.shape)
					{
						sb.push(`<tr><td>symbol</td><td>${cellStyle.shape}</td></tr>`);
					}
				}

				if (model.isEdge(cell))
				{
					let sourceVertex = model.getTerminal(cell, true);
					let sourceState = view.getState(sourceVertex);
					let sourceStyle = sourceState ? sourceState.style : null;
					let sourceId = sourceVertex ? sourceVertex.id : null;

					let targetVertex = model.getTerminal(cell, false);
					let targetState = view.getState(targetVertex);
					let targetStyle = targetState ? targetState.style : null;
					let targetId = targetVertex ? targetVertex.id : null;

					if (sourceVertex)
					{
						sb.push(`<tr><td>sourceID</td><td>${sourceStyle.id}</td></tr>`);
						if (sourceStyle.name)
						{
							sb.push(`<tr><td>source</td><td>${sourceStyle.name}</td></tr>`);
						}
					}
					if (targetStyle)
					{
						sb.push(`<tr><td>targetID</td><td>${targetStyle.id}</td></tr>`);
						if (targetStyle.name)
						{
							sb.push(`<tr><td>target</td><td>${targetStyle.name}</td></tr>`);
						}
					}
				}
			}
			sb.push('</table>');
			let str = sb.join('');
			return str;
		};
	})();
}
