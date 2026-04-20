
// 处理拖动线顶点时偏移太大问题 （不再重写，按下alt键可实现这功能）
// mxEdgeHandler.prototype.getSnapToTerminalTolerance = function()
// {
//     return 2 * this.graph.view.scale / 2;
// };

import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import StationHandler from '@/plugins/tmzx/graph/StationHandler.js'

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

    var attrs = value.attributes;
    var names = [];
    var texts = [];
    var count = 0;

    var id = (EditDataDialog.getDisplayIdForCell != null) ?
        EditDataDialog.getDisplayIdForCell(ui, cell) : null;

    var addRemoveButton = function(text, name)
    {
        var wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.paddingRight = '20px';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.width = '100%';

        var removeAttr = document.createElement('a');
        var img = mxUtils.createImage(Dialog.prototype.closeImage);
        img.style.height = '9px';
        img.style.fontSize = '9px';
        img.style.marginBottom = (mxClient.IS_IE11) ? '-1px' : '5px';

        removeAttr.className = 'geButton';
        removeAttr.setAttribute('title', mxResources.get('delete'));
        removeAttr.style.position = 'absolute';
        removeAttr.style.top = '4px';
        removeAttr.style.right = '0px';
        removeAttr.style.margin = '0px';
        removeAttr.style.width = '9px';
        removeAttr.style.height = '9px';
        removeAttr.style.cursor = 'pointer';
        removeAttr.appendChild(img);

        var removeAttrFn = (function(name)
        {
            return function()
            {
                var count = 0;

                for (var j = 0; j < names.length; j++)
                {
                    if (names[j] == name)
                    {
                        texts[j] = null;
                        form.table.deleteRow(count + ((id != null) ? 1 : 0));

                        break;
                    }

                    if (texts[j] != null)
                    {
                        count++;
                    }
                }
            };
        })(name);

        mxEvent.addListener(removeAttr, 'click', removeAttrFn);

        var parent = text.parentNode;
        wrapper.appendChild(text);
        wrapper.appendChild(removeAttr);
        parent.appendChild(wrapper);
    };

    var addTextArea = function(index, name, value)
    {
        names[index] = name;
        texts[index] = form.addTextarea(names[count] + ':', value, 2);
        texts[index].style.width = '100%';

        if (value.indexOf('\n') > 0)
        {
            texts[index].setAttribute('rows', '2');
        }

        addRemoveButton(texts[index], name);

        if (meta[name] != null && meta[name].editable == false)
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

    // Sorts by name
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

    if (id != null)
    {
        var text = document.createElement('div');
        text.style.width = '100%';
        text.style.fontSize = '11px';
        text.style.textAlign = 'center';
        mxUtils.write(text, id);

        var idInput = form.addField(mxResources.get('id') + ':', text);

        mxEvent.addListener(text, 'dblclick', function(evt)
        {
            var dlg = new FilenameDialog(ui, id, mxResources.get('apply'),
                mxUtils.bind(this, function(value)
                {
                    if (value != null && value.length > 0 && value != id)
                    {
                        if (graph.model.isRoot(cell))
                        {
                            var page = ui.getPageById(id);

                            if (page != null)
                            {
                                if (ui.getPageById(value) == null)
                                {
                                    var index = ui.getPageIndex(page);

                                    if (index >= 0)
                                    {
                                        ui.removePage(page);
                                        page.node.setAttribute('id', value);
                                        id = value;
                                        idInput.innerHTML = mxUtils.htmlEntities(value);
                                        ui.insertPage(page, index);
                                    }
                                }
                                else
                                {
                                    ui.handleError({message: mxResources.get('alreadyExst',
                                            [mxResources.get('page')])});
                                }
                            }
                        }
                        else
                        {
                            if (graph.getModel().getCell(value) == null)
                            {
                                graph.getModel().cellRemoved(cell);
                                cell.setId(value);
                                id = value;
                                idInput.innerHTML = mxUtils.htmlEntities(value);
                                graph.getModel().cellAdded(cell);
                            }
                            else
                            {
                                ui.handleError({message: mxResources.get('alreadyExst', [value])});
                            }
                        }
                    }
                }), mxResources.get('id'));
            ui.showDialog(dlg.container, 300, 80, true, true);
            dlg.init();
        });
    }

    for (var i = 0; i < temp.length; i++)
    {
        addTextArea(count, temp[i].name, temp[i].value);
        count++;
    }

    var top = document.createElement('div');
    top.style.position = 'absolute';
    top.style.top = '30px';
    top.style.left = '30px';
    top.style.right = '30px';
    top.style.bottom = '80px';
    top.style.overflowY = 'auto';

    top.appendChild(form.table);

    var newProp = document.createElement('div');
    newProp.style.display = 'flex';
    newProp.style.alignItems = 'center';
    newProp.style.boxSizing = 'border-box';
    newProp.style.paddingRight = '160px';
    newProp.style.whiteSpace = 'nowrap';
    newProp.style.marginTop = '6px';
    newProp.style.width = '100%';

    var nameInput = document.createElement('input');
    nameInput.setAttribute('placeholder', mxResources.get('enterPropertyName'));
    nameInput.setAttribute('type', 'text');
    nameInput.setAttribute('size', (mxClient.IS_IE || mxClient.IS_IE11) ? '36' : '40');
    nameInput.style.boxSizing = 'border-box';
    nameInput.style.borderWidth = '1px';
    nameInput.style.borderStyle = 'solid';
    nameInput.style.marginLeft = '2px';
    nameInput.style.padding = '4px';
    nameInput.style.width = '100%';

    newProp.appendChild(nameInput);
    top.appendChild(newProp);
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
                    texts.push(text);
                    addRemoveButton(text, name);

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
    addBtn.style.position = 'absolute';
    addBtn.style.overflow = 'hidden';
    addBtn.style.width = '144px';
    addBtn.style.right = '0px';
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

            for (var i = 0; i < names.length; i++)
            {
                if (texts[i] == null)
                {
                    value.removeAttribute(names[i]);
                }
                else
                {
                    value.setAttribute(names[i], texts[i].value);
                    removeLabel = removeLabel || (names[i] == 'placeholder' &&
                        value.getAttribute('placeholders') == '1');
                }
            }

            // Removes label if placeholder is assigned
            if (removeLabel)
            {
                value.removeAttribute('label');
            }

            // Updates the value of the cell (undoable)
            graph.getModel().setValue(cell, value);
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
    buttons.style.cssText = 'position:absolute;left:30px;right:30px;text-align:right;bottom:30px;height:40px;'

    if (ui.editor.graph.getModel().isVertex(cell) || ui.editor.graph.getModel().isEdge(cell))
    {
        var replace = document.createElement('span');
        replace.style.marginRight = '10px';
        var input = document.createElement('input');
        input.setAttribute('type', 'checkbox');
        input.style.marginRight = '6px';

        if (value.getAttribute('placeholders') == '1')
        {
            input.setAttribute('checked', 'checked');
            input.defaultChecked = true;
        }

        mxEvent.addListener(input, 'click', function()
        {
            if (value.getAttribute('placeholders') == '1')
            {
                value.removeAttribute('placeholders');
            }
            else
            {
                value.setAttribute('placeholders', '1');
            }
        });

        replace.appendChild(input);
        mxUtils.write(replace, mxResources.get('placeholders'));

        if (EditDataDialog.placeholderHelpLink != null)
        {
            replace.appendChild(ui.createHelpIcon(
                EditDataDialog.placeholderHelpLink));
        }

        buttons.appendChild(replace);
    }

    if (ui.editor.cancelFirst)
    {
        buttons.appendChild(cancelBtn);
    }

    // buttons.appendChild(exportBtn);
    // buttons.appendChild(applyBtn);

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