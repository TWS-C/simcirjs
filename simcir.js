//
// SimcirJS
//
// Copyright (c) 2014 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//

// includes following device types:
//  In
//  Out
//  Joint

'use strict';

let simcir = {};

simcir.$ = initSimcirUtilityFunctions();

!function ($s)
{
    let $ = $s.$;

    let createSVGElement = function (tagName)
    {
        return $(document.createElementNS('http://www.w3.org/2000/svg', tagName));
    };

    let createSVG = function (w, h)
    {
        return createSVGElement('svg').attr({
            version: '1.1',
            width:   w,
            height:  h,
            viewBox: '0 0 ' + w + ' ' + h,
        });
    };

    let graphics = function ($target)
    {
        let attr       = {};
        let buf        = '';
        let moveTo     = function (x, y)
        {
            buf += ' M ' + x + ' ' + y;
        };
        let lineTo     = function (x, y)
        {
            buf += ' L ' + x + ' ' + y;
        };
        let curveTo    = function (x1, y1, x, y)
        {
            buf += ' Q ' + x1 + ' ' + y1 + ' ' + x + ' ' + y;
        };
        let closePath  = function (close)
        {
            if (close)
            {
                // really close path.
                buf += ' Z';
            }
            $target.append(createSVGElement('path').attr('d', buf).attr(attr));
            buf = '';
        };
        let drawRect   = function (x, y, width, height)
        {
            $target.append(
                createSVGElement('rect')
                .attr(
                    {
                        x:      x,
                        y:      y,
                        width:  width,
                        height: height,
                    })
                .attr(attr)
            );
        };
        let drawCircle = function (x, y, r)
        {
            $target.append(
                createSVGElement('circle')
                .attr({
                    cx: x,
                    cy: y,
                    r:  r,
                })
                .attr(attr),
            );
        };
        return {
            attr:       attr,
            moveTo:     moveTo,
            lineTo:     lineTo,
            curveTo:    curveTo,
            closePath:  closePath,
            drawRect:   drawRect,
            drawCircle: drawCircle,
        };
    };

    let transform = function ()
    {
        let attrX      = 'simcir-transform-x';
        let attrY      = 'simcir-transform-y';
        let attrRotate = 'simcir-transform-rotate';
        let num        = function ($o, k)
        {
            let v = $o.attr(k);
            return v ? +v : 0;
        };
        return function ($o, x, y, rotate)
        {
            if (arguments.length >= 3)
            {
                let transform = 'translate(' + x + ' ' + y + ')';
                if (rotate)
                {
                    transform += ' rotate(' + rotate + ')';
                }
                $o.attr('transform', transform);
                $o.attr(attrX, x);
                $o.attr(attrY, y);
                $o.attr(attrRotate, rotate);
            }
            else if (arguments.length == 1)
            {
                return {
                    x:      num($o, attrX),
                    y:      num($o, attrY),
                    rotate: num($o, attrRotate),
                };
            }
        };
    }();

    let offset = function ($o)
    {
        let x = 0;
        let y = 0;
        while ($o[0].nodeName != 'svg')
        {
            let pos = transform($o);
            x += pos.x;
            y += pos.y;
            $o      = $o.parent();
        }
        return {
            x: x,
            y: y,
        };
    };

    let enableEvents = function ($o, enable)
    {
        $o.css('pointer-events', enable ? 'visiblePainted' : 'none');
    };

    let disableSelection = function ($o)
    {
        $o.each(function ()
        {
            this.onselectstart = function ()
            {
                return false;
            };
        }).css('-webkit-user-select', 'none');
    };

    let controller = function ()
    {
        let id = 'controller';
        return function ($ui, controller)
        {
            if (arguments.length == 1)
            {
                return $.data($ui[0], id);
            }
            else if (arguments.length == 2)
            {
                $.data($ui[0], id, controller);
            }
        };
    }();

    let eventQueue = function ()
    {
        let delay         = 50; // ms
        let limit         = 40; // ms
        let _queue        = null;
        let postEvent     = function (event)
        {
            if (_queue == null)
            {
                _queue = [];
            }
            _queue.push(event);
        };
        let dispatchEvent = function ()
        {
            let queue = _queue;
            _queue    = null;
            while (queue.length > 0)
            {
                let e = queue.shift();
                e.target.trigger(e.type);
            }
        };
        let getTime       = function ()
        {
            return new Date().getTime();
        };
        let timerHandler  = function ()
        {
            let start = getTime();
            while (_queue != null && getTime() - start < limit)
            {
                dispatchEvent();
            }
            window.setTimeout(
                timerHandler,
                Math.max(delay - limit, delay - (getTime() - start)),
            );
        };
        timerHandler();
        return {
            postEvent: postEvent,
        };
    }();

    let unit     = 16;
    let fontSize = 12;

    let createLabel = function (text)
    {
        return createSVGElement('text').text(text).css('font-size', fontSize + 'px');
    };

    let createNode = function (type, label, description, headless)
    {
        let $node = createSVGElement('g').attr('simcir-node-type', type);
        if (!headless)
        {
            $node.attr('class', 'simcir-node');
        }
        let node = createNodeController({
            $ui:         $node,
            type:        type,
            label:       label,
            description: description,
            headless:    headless,
        });
        if (type == 'in')
        {
            controller($node, createInputNodeController(node));
        }
        else if (type == 'out')
        {
            controller($node, createOutputNodeController(node));
        }
        else
        {
            throw 'unknown type:' + type;
        }
        return $node;
    };

    let isActiveNode = function ($o)
    {
        return $o.closest('.simcir-node').length == 1 &&
            $o.closest('.simcir-toolbox').length == 0;
    };

    let createNodeController = function (node)
    {
        let _value   = null;
        let setValue = function (value, force)
        {
            if (_value === value && !force)
            {
                return;
            }
            _value = value;
            eventQueue.postEvent({
                target: node.$ui,
                type:   'nodeValueChange',
            });
        };
        let getValue = function ()
        {
            return _value;
        };

        if (!node.headless)
        {

            node.$ui.attr('class', 'simcir-node simcir-node-type-' + node.type);

            let $circle = createSVGElement('circle')
                .attr({
                    cx: 0,
                    cy: 0,
                    r:  4,
                });
            node.$ui.on('mouseover', function (event)
            {
                if (isActiveNode(node.$ui))
                {
                    node.$ui.addClass('simcir-node-hover');
                }
            });
            node.$ui.on('mouseout', function (event)
            {
                if (isActiveNode(node.$ui))
                {
                    node.$ui.removeClass('simcir-node-hover');
                }
            });
            node.$ui.append($circle);
            let appendLabel = function (text, align)
            {
                let $label = createLabel(text).attr('class', 'simcir-node-label');
                enableEvents($label, false);
                if (align == 'right')
                {
                    $label.attr('text-anchor', 'start').attr('x', 6).attr('y', fontSize / 2);
                }
                else if (align == 'left')
                {
                    $label.attr('text-anchor', 'end').attr('x', -6).attr('y', fontSize / 2);
                }
                node.$ui.append($label);
            };
            if (node.label)
            {
                if (node.type == 'in')
                {
                    appendLabel(node.label, 'right');
                }
                else if (node.type == 'out')
                {
                    appendLabel(node.label, 'left');
                }
            }
            if (node.description)
            {
                if (node.type == 'in')
                {
                    appendLabel(node.description, 'left');
                }
                else if (node.type == 'out')
                {
                    appendLabel(node.description, 'right');
                }
            }
            node.$ui.on('nodeValueChange', function (event)
            {
                if (_value != null)
                {
                    node.$ui.addClass('simcir-node-hot');
                }
                else
                {
                    node.$ui.removeClass('simcir-node-hot');
                }
            });
        }

        return $.extend(node, {
            setValue: setValue,
            getValue: getValue,
        });
    };

    let createInputNodeController = function (node)
    {
        let output    = null;
        let setOutput = function (outNode)
        {
            output = outNode;
        };
        let getOutput = function ()
        {
            return output;
        };
        return $.extend(node, {
            setOutput: setOutput,
            getOutput: getOutput,
        });
    };

    let createOutputNodeController = function (node)
    {
        let inputs         = [];
        let super_setValue = node.setValue;
        let setValue       = function (value)
        {
            super_setValue(value);
            for (let i = 0; i < inputs.length; i += 1)
            {
                inputs[i].setValue(value);
            }
        };
        let connectTo      = function (inNode)
        {
            if (inNode.getOutput() != null)
            {
                inNode.getOutput().disconnectFrom(inNode);
            }
            inNode.setOutput(node);
            inputs.push(inNode);
            inNode.setValue(node.getValue(), true);
        };
        let disconnectFrom = function (inNode)
        {
            if (inNode.getOutput() != node)
            {
                throw 'not connected.';
            }
            inNode.setOutput(null);
            inNode.setValue(null, true);
            inputs = $.grep(inputs, function (v)
            {
                return v != inNode;
            });
        };
        let getInputs      = function ()
        {
            return inputs;
        };
        return $.extend(node, {
            setValue:       setValue,
            getInputs:      getInputs,
            connectTo:      connectTo,
            disconnectFrom: disconnectFrom,
        });
    };

    let createDevice = function (deviceDef, headless, scope)
    {
        headless = headless || false;
        scope    = scope || null;
        let $dev = createSVGElement('g');
        if (!headless)
        {
            $dev.attr('class', 'simcir-device');
        }
        controller(
            $dev,
            createDeviceController(
            {
                $ui:       $dev,
                deviceDef: deviceDef,
                headless:  headless,
                scope:     scope,
                doc:       null,
            })
        );
        let factory = factories[deviceDef.type];
        if (factory)
        {
            factory(controller($dev));
        }
        if (!headless)
        {
            controller($dev).createUI();
        }
        return $dev;
    };

    let createDeviceController = function (device)
    {
        let inputs        = [];
        let outputs       = [];
        let addInput      = function (label, description)
        {
            let $node = createNode('in', label, description, device.headless);
            $node.on('nodeValueChange', function (event)
            {
                device.$ui.trigger('inputValueChange');
            });
            if (!device.headless)
            {
                device.$ui.append($node);
            }
            let node = controller($node);
            inputs.push(node);
            return node;
        };
        let addOutput     = function (label, description)
        {
            let $node = createNode('out', label, description, device.headless);
            if (!device.headless)
            {
                device.$ui.append($node);
            }
            let node = controller($node);
            outputs.push(node);
            return node;
        };
        let getInputs     = function ()
        {
            return inputs;
        };
        let getOutputs    = function ()
        {
            return outputs;
        };
        let disconnectAll = function ()
        {
            $.each(getInputs(), function (i, inNode)
            {
                let outNode = inNode.getOutput();
                if (outNode != null)
                {
                    outNode.disconnectFrom(inNode);
                }
            });
            $.each(getOutputs(), function (i, outNode)
            {
                $.each(outNode.getInputs(), function (i, inNode)
                {
                    outNode.disconnectFrom(inNode);
                });
            });
        };
        device.$ui.on('dispose', function ()
        {
            $.each(getInputs(), function (i, inNode)
            {
                inNode.$ui.remove();
            });
            $.each(getOutputs(), function (i, outNode)
            {
                outNode.$ui.remove();
            });
            device.$ui.remove();
        });

        let selected    = false;
        let setSelected = function (value)
        {
            selected = value;
            device.$ui.trigger('deviceSelect');
        };
        let isSelected  = function ()
        {
            return selected;
        };

        let label        = device.deviceDef.label;
        let defaultLabel = device.deviceDef.type;
        if (typeof label == 'undefined')
        {
            label = defaultLabel;
        }
        let setLabel = function (value)
        {
            value = value.replace(/^\s+|\s+$/g, '');
            label = value || defaultLabel;
            device.$ui.trigger('deviceLabelChange');
        };
        let getLabel = function ()
        {
            return label;
        };

        let getSize = function ()
        {
            let nodes = Math.max(
                device.getInputs().length,
                device.getOutputs().length,
            );
            return {
                width:  unit * 2,
                height: unit * Math.max(2, device.halfPitch ?
                    (nodes + 1) / 2 : nodes),
            };
        };

        let layoutUI = function ()
        {

            let size = device.getSize();
            let w    = size.width;
            let h    = size.height;

            device.$ui.children('.simcir-device-body')
                .attr({
                    x:      0,
                    y:      0,
                    width:  w,
                    height: h,
                });

            let pitch       = device.halfPitch ? unit / 2 : unit;
            let layoutNodes = function (nodes, x)
            {
                let offset = (h - pitch * (nodes.length - 1)) / 2;
                $.each(nodes, function (i, node)
                {
                    transform(node.$ui, x, pitch * i + offset);
                });
            };
            layoutNodes(getInputs(), 0);
            layoutNodes(getOutputs(), w);

            device.$ui.children('.simcir-device-label')
                .attr({
                    x: w / 2,
                    y: h + fontSize,
                });
        };

        let createUI = function ()
        {

            device.$ui.attr('class', 'simcir-device');
            device.$ui.on('deviceSelect', function ()
            {
                if (selected)
                {
                    $(this).addClass('simcir-device-selected');
                }
                else
                {
                    $(this).removeClass('simcir-device-selected');
                }
            });

            let $body = createSVGElement('rect').attr('class', 'simcir-device-body').attr('rx', 2).attr('ry', 2);
            device.$ui.prepend($body);

            let $label = createLabel(label).attr('class', 'simcir-device-label').attr('text-anchor', 'middle');
            device.$ui.on('deviceLabelChange', function ()
            {
                $label.text(getLabel());
            });

            let label_dblClickHandler = function (event)
            {
                event.preventDefault();
                event.stopPropagation();
                let $workspace = $(event.target).closest('.simcir-workspace');
                if (!controller($workspace).data().editable)
                {
                    return;
                }
                let title        = 'Enter device name ';
                let $labelEditor = $('<input type="text"/>')
                    .addClass('simcir-label-editor')
                    .val($label.text())
                    .on('keydown', function (event)
                    {
                        if (event.keyCode == 13)
                        {
                            // ENTER
                            setLabel($(this).val());
                            $dlg.remove();
                        }
                        else if (event.keyCode == 27)
                        {
                            // ESC
                            $dlg.remove();
                        }
                    });
                let $placeHolder = $('<div></div>').append($labelEditor);
                let $dlg         = showDialog(title, $placeHolder);
                $labelEditor.focus();
            };
            device.$ui.on('deviceAdd', function ()
            {
                $label.on('dblclick', label_dblClickHandler);
            });
            device.$ui.on('deviceRemove', function ()
            {
                $label.off('dblclick', label_dblClickHandler);
            });
            device.$ui.append($label);

            layoutUI();

        };

        let getState = function ()
        {
            return null;
        };

        return $.extend(device, {
            addInput:      addInput,
            addOutput:     addOutput,
            getInputs:     getInputs,
            getOutputs:    getOutputs,
            disconnectAll: disconnectAll,
            setSelected:   setSelected,
            isSelected:    isSelected,
            getLabel:      getLabel,
            halfPitch:     false,
            getSize:       getSize,
            createUI:      createUI,
            layoutUI:      layoutUI,
            getState:      getState,
        });
    };

    let createConnector = function (x1, y1, x2, y2)
    {
        return createSVGElement('path')
            .attr('d', 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2)
            .attr('class', 'simcir-connector');
    };

    let connect = function ($node1, $node2)
    {
        let type1 = $node1.attr('simcir-node-type');
        let type2 = $node2.attr('simcir-node-type');
        if (type1 == 'in' && type2 == 'out')
        {
            controller($node2).connectTo(controller($node1));
        }
        else if (type1 == 'out' && type2 == 'in')
        {
            controller($node1).connectTo(controller($node2));
        }
    };

    let buildCircuit = function (data, headless, scope)
    {
        let $devices = [];
        let $devMap  = {};
        let getNode  = function (path)
        {
            if (!path.match(/^(\w+)\.(in|out)([0-9]+)$/g))
            {
                throw 'unknown path:' + path;
            }
            let devId = RegExp.$1;
            let type  = RegExp.$2;
            let index = +RegExp.$3;
            return (type == 'in') ?
                controller($devMap[devId]).getInputs()[index] :
                controller($devMap[devId]).getOutputs()[index];
        };
        $.each(data.devices, function (i, deviceDef)
        {
            let $dev = createDevice(deviceDef, headless, scope);
            transform($dev, deviceDef.x, deviceDef.y);
            $devices.push($dev);
            $devMap[deviceDef.id] = $dev;
        });
        $.each(data.connectors, function (i, conn)
        {
            let nodeFrom = getNode(conn.from);
            let nodeTo   = getNode(conn.to);
            if (nodeFrom && nodeTo)
            {
                connect(nodeFrom.$ui, nodeTo.$ui);
            }
        });
        return $devices;
    };

    let dialogManager = function ()
    {
        let dialogs       = [];
        let updateDialogs = function ($dlg, remove)
        {
            let newDialogs = [];
            $.each(dialogs, function (i)
            {
                if (dialogs[i] != $dlg)
                {
                    newDialogs.push(dialogs[i]);
                }
            });
            if (!remove)
            {
                newDialogs.push($dlg);
            }
            // renumber z-index
            $.each(newDialogs, function (i)
            {
                newDialogs[i].css('z-index', '' + (i + 1));
            });
            dialogs = newDialogs;
        };
        return {
            add:     function ($dlg)
                     {
                         updateDialogs($dlg);
                     },
            remove:  function ($dlg)
                     {
                         updateDialogs($dlg, true);
                     },
            toFront: function ($dlg)
                     {
                         updateDialogs($dlg);
                     },
        };
    }();

    let showDialog = function (title, $content)
    {
        let $closeButton = function ()
        {
            let r    = 16;
            let pad  = 4;
            let $btn = createSVG(r, r).attr('class', 'simcir-dialog-close-button');
            let g    = graphics($btn);
            g.drawRect(0, 0, r, r);
            g.attr['class'] = 'simcir-dialog-close-button-symbol';
            g.moveTo(pad, pad);
            g.lineTo(r - pad, r - pad);
            g.closePath();
            g.moveTo(r - pad, pad);
            g.lineTo(pad, r - pad);
            g.closePath();
            return $btn;
        }();
        let $title       = $('<div></div>')
            .addClass('simcir-dialog-title')
            .text(title)
            .css('cursor', 'default')
            .on('mousedown', function (event)
            {
                event.preventDefault();
            });
        let $dlg         = $('<div></div>')
            .addClass('simcir-dialog')
            .css({position: 'absolute'})
            .append($title.css('float', 'left'))
            .append($closeButton.css('float', 'right'))
            .append($('<br/>').css('clear', 'both'))
            .append($content);
        $('BODY').append($dlg);
        dialogManager.add($dlg);
        let dragPoint            = null;
        let dlg_mouseDownHandler = function (event)
        {
            if (!$(event.target).hasClass('simcir-dialog') &&
                !$(event.target).hasClass('simcir-dialog-title'))
            {
                return;
            }
            event.preventDefault();
            dialogManager.toFront($dlg);
            let off   = $dlg.offset();
            dragPoint = {
                x: event.pageX - off.left,
                y: event.pageY - off.top,
            };
            $(document).on('mousemove', dlg_mouseMoveHandler);
            $(document).on('mouseup', dlg_mouseUpHandler);
        };
        let dlg_mouseMoveHandler = function (event)
        {
            moveTo(
                event.pageX - dragPoint.x,
                event.pageY - dragPoint.y,
            );
        };
        let dlg_mouseUpHandler   = function (event)
        {
            $(document).off('mousemove', dlg_mouseMoveHandler);
            $(document).off('mouseup', dlg_mouseUpHandler);
        };
        $dlg.on('mousedown', dlg_mouseDownHandler);
        $closeButton.on('mousedown', function ()
        {
            $dlg.trigger('close');
            $dlg.remove();
            dialogManager.remove($dlg);
        });
        let w       = $dlg.width();
        let h       = $dlg.height();
        let cw      = $(window).width();
        let ch      = $(window).height();
        let getProp = function (id)
        {
            return $('HTML')[id]() || $('BODY')[id]();
        };
        let x       = (cw - w) / 2 + getProp('scrollLeft');
        let y       = (ch - h) / 2 + getProp('scrollTop');
        let moveTo  = function (x, y)
        {
            $dlg.css({
                left: x + 'px',
                top:  y + 'px',
            });
        };
        moveTo(x, y);
        return $dlg;
    };

    let createDeviceRefFactory = function (data)
    {
        return function (device)
        {
            let $devs  = buildCircuit(data, true, {});
            let $ports = [];
            $.each($devs, function (i, $dev)
            {
                let deviceDef = controller($dev).deviceDef;
                if (deviceDef.type == 'In' || deviceDef.type == 'Out')
                {
                    $ports.push($dev);
                }
            });
            $ports.sort(function ($p1, $p2)
            {
                let x1 = controller($p1).deviceDef.x;
                let y1 = controller($p1).deviceDef.y;
                let x2 = controller($p2).deviceDef.x;
                let y2 = controller($p2).deviceDef.y;
                if (x1 == x2)
                {
                    return (y1 < y2) ? -1 : 1;
                }
                return (x1 < x2) ? -1 : 1;
            });
            let getDesc = function (port)
            {
                return port ? port.description : '';
            };
            $.each($ports, function (i, $port)
            {
                let port    = controller($port);
                let portDef = port.deviceDef;
                let inPort;
                let outPort;
                if (portDef.type == 'In')
                {
                    outPort    = port.getOutputs()[0];
                    inPort     = device.addInput(
                        portDef.label,
                        getDesc(outPort.getInputs()[0]),
                    );
                    // force disconnect test devices that connected to In-port
                    let inNode = port.getInputs()[0];
                    if (inNode.getOutput() != null)
                    {
                        inNode.getOutput().disconnectFrom(inNode);
                    }
                }
                else if (portDef.type == 'Out')
                {
                    inPort      = port.getInputs()[0];
                    outPort     = device.addOutput(
                        portDef.label,
                        getDesc(inPort.getOutput()),
                    );
                    // force disconnect test devices that connected to Out-port
                    let outNode = port.getOutputs()[0];
                    $.each(outNode.getInputs(), function (i, inNode)
                    {
                        if (inNode.getOutput() != null)
                        {
                            inNode.getOutput().disconnectFrom(inNode);
                        }
                    });
                }
                inPort.$ui.on('nodeValueChange', function ()
                {
                    outPort.setValue(inPort.getValue());
                });
            });
            let super_getSize = device.getSize;
            device.getSize    = function ()
            {
                let size = super_getSize();
                return {
                    width:  unit * 4,
                    height: size.height,
                };
            };
            device.$ui.on('dispose', function ()
            {
                $.each($devs, function (i, $dev)
                {
                    $dev.trigger('dispose');
                });
            });
            device.$ui.on('dblclick', function (event)
            {
                // open library,
                event.preventDefault();
                event.stopPropagation();
                showDialog(
                    device.deviceDef.label || device.deviceDef.type,
                    setupSimcir($('<div></div>'), data),
                ).on('close', function ()
                {
                    $(this).find('.simcir-workspace').trigger('dispose');
                });
            });
        };
    };

    let createCustomLayoutDeviceRefFactory = function (data)
    {
        return function (device)
        {
            let $devs  = buildCircuit(data, true, {});
            let $ports = [];
            let intfs  = [];
            $.each($devs, function (i, $dev)
            {
                let deviceDef = controller($dev).deviceDef;
                if (deviceDef.type == 'In' || deviceDef.type == 'Out')
                {
                    $ports.push($dev);
                }
            });
            let getDesc = function (port)
            {
                return port ? port.description : '';
            };
            $.each($ports, function (i, $port)
            {
                let port    = controller($port);
                let portDef = port.deviceDef;
                let inPort;
                let outPort;
                if (portDef.type == 'In')
                {
                    outPort = port.getOutputs()[0];
                    inPort  = device.addInput();
                    intfs.push({
                        node:  inPort,
                        label: portDef.label,
                        desc:  getDesc(outPort.getInputs()[0]),
                    });
                    // force disconnect test devices that connected to In-port
                    let inNode = port.getInputs()[0];
                    if (inNode.getOutput() != null)
                    {
                        inNode.getOutput().disconnectFrom(inNode);
                    }
                }
                else if (portDef.type == 'Out')
                {
                    inPort  = port.getInputs()[0];
                    outPort = device.addOutput();
                    intfs.push({
                        node:  outPort,
                        label: portDef.label,
                        desc:  getDesc(inPort.getOutput()),
                    });
                    // force disconnect test devices that connected to Out-port
                    let outNode = port.getOutputs()[0];
                    $.each(outNode.getInputs(), function (i, inNode)
                    {
                        if (inNode.getOutput() != null)
                        {
                            inNode.getOutput().disconnectFrom(inNode);
                        }
                    });
                }
                inPort.$ui.on('nodeValueChange', function ()
                {
                    outPort.setValue(inPort.getValue());
                });
            });
            let layout     = data.layout;
            let cols       = layout.cols;
            let rows       = layout.rows;
            rows           = ~~((Math.max(1, rows) + 1) / 2) * 2;
            cols           = ~~((Math.max(1, cols) + 1) / 2) * 2;
            let updateIntf = function (intf, x, y, align)
            {
                transform(intf.node.$ui, x, y);
                if (!intf.$label)
                {
                    intf.$label = createLabel(intf.label).attr('class', 'simcir-node-label');
                    enableEvents(intf.$label, false);
                    intf.node.$ui.append(intf.$label);
                }
                if (align == 'right')
                {
                    intf.$label.attr('text-anchor', 'start').attr('x', 6).attr('y', fontSize / 2);
                }
                else if (align == 'left')
                {
                    intf.$label.attr('text-anchor', 'end').attr('x', -6).attr('y', fontSize / 2);
                }
                else if (align == 'top')
                {
                    intf.$label.attr('text-anchor', 'middle').attr('x', 0).attr('y', -6);
                }
                else if (align == 'bottom')
                {
                    intf.$label.attr('text-anchor', 'middle').attr('x', 0).attr('y', fontSize + 6);
                }
            };
            let doLayout   = function ()
            {
                let x = 0;
                let y = 0;
                let w = unit * cols / 2;
                let h = unit * rows / 2;
                device.$ui.children('.simcir-device-label').attr({y: y + h + fontSize});
                device.$ui.children('.simcir-device-body')
                    .attr({
                        x:      x,
                        y:      y,
                        width:  w,
                        height: h,
                    });
                $.each(intfs, function (i, intf)
                {
                    if (layout.nodes[intf.label] &&
                        layout.nodes[intf.label].match(/^([TBLR])([0-9]+)$/))
                    {
                        let off = +RegExp.$2 * unit / 2;
                        switch (RegExp.$1)
                        {
                            case 'T' :
                                updateIntf(intf, x + off, y, 'bottom');
                                break;
                            case 'B' :
                                updateIntf(intf, x + off, y + h, 'top');
                                break;
                            case 'L' :
                                updateIntf(intf, x, y + off, 'right');
                                break;
                            case 'R' :
                                updateIntf(intf, x + w, y + off, 'left');
                                break;
                        }
                    }
                    else
                    {
                        transform(intf.node.$ui, 0, 0);
                    }
                });
            };
            device.getSize = function ()
            {
                return {
                    width:  unit * cols / 2,
                    height: unit * rows / 2,
                };
            };
            device.$ui.on('dispose', function ()
            {
                $.each($devs, function (i, $dev)
                {
                    $dev.trigger('dispose');
                });
            });
            if (data.layout.hideLabelOnWorkspace)
            {
                device.$ui.on('deviceAdd', function ()
                {
                    device.$ui.children('.simcir-device-label').css('display', 'none');
                }).on('deviceRemove', function ()
                {
                    device.$ui.children('.simcir-device-label').css('display', '');
                });
            }
            device.$ui.on('dblclick', function (event)
            {
                // open library,
                event.preventDefault();
                event.stopPropagation();
                showDialog(
                    device.deviceDef.label || device.deviceDef.type,
                    setupSimcir($('<div></div>'), data),
                ).on('close', function ()
                {
                    $(this).find('.simcir-workspace').trigger('dispose');
                });
            });
            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();
                doLayout();
            };
        };
    };

    let factories      = {};
    let defaultToolbox = [];
    let registerDevice = function (type, factory, deprecated)
    {
        if (typeof factory == 'object')
        {
            if (typeof factory.layout == 'object')
            {
                factory = createCustomLayoutDeviceRefFactory(factory);
            }
            else
            {
                factory = createDeviceRefFactory(factory);
            }
        }
        factories[type] = factory;
        if (!deprecated)
        {
            defaultToolbox.push({type: type});
        }
    };

    let createScrollbar = function ()
    {

        // vertical only.
        let _value   = 0;
        let _min     = 0;
        let _max     = 0;
        let _barSize = 0;
        let _width   = 0;
        let _height  = 0;

        let $body      = createSVGElement('rect');
        let $bar       = createSVGElement('g').append(createSVGElement('rect')).attr('class', 'simcir-scrollbar-bar');
        let $scrollbar = createSVGElement('g')
            .attr('class', 'simcir-scrollbar')
            .append($body)
            .append($bar)
            .on('unitup', function (event)
            {
                setValue(_value - unit * 2);
            })
            .on('unitdown', function (event)
            {
                setValue(_value + unit * 2);
            })
            .on('rollup', function (event)
            {
                setValue(_value - _barSize);
            })
            .on('rolldown', function (event)
            {
                setValue(_value + _barSize);
            });

        let dragPoint            = null;
        let bar_mouseDownHandler = function (event)
        {
            event.preventDefault();
            event.stopPropagation();
            let pos   = transform($bar);
            dragPoint = {
                x: event.pageX - pos.x,
                y: event.pageY - pos.y,
            };
            $(document).on('mousemove', bar_mouseMoveHandler);
            $(document).on('mouseup', bar_mouseUpHandler);
        };
        let bar_mouseMoveHandler = function (event)
        {
            calc(function (unitSize)
            {
                setValue((event.pageY - dragPoint.y) / unitSize);
            });
        };
        let bar_mouseUpHandler   = function (event)
        {
            $(document).off('mousemove', bar_mouseMoveHandler);
            $(document).off('mouseup', bar_mouseUpHandler);
        };
        $bar.on('mousedown', bar_mouseDownHandler);
        let body_mouseDownHandler = function (event)
        {
            event.preventDefault();
            event.stopPropagation();
            let off    = $scrollbar.parent('svg').offset();
            let pos    = transform($scrollbar);
            let y      = event.pageY - off.top - pos.y;
            let barPos = transform($bar);
            if (y < barPos.y)
            {
                $scrollbar.trigger('rollup');
            }
            else
            {
                $scrollbar.trigger('rolldown');
            }
        };
        $body.on('mousedown', body_mouseDownHandler);

        let setSize   = function (width, height)
        {
            _width  = width;
            _height = height;
            layout();
        };
        let layout    = function ()
        {

            $body.attr({
                x:      0,
                y:      0,
                width:  _width,
                height: _height,
            });

            let visible = _max - _min > _barSize;
            $bar.css('display', visible ? 'inline' : 'none');
            if (!visible)
            {
                return;
            }
            calc(function (unitSize)
            {
                $bar.children('rect')
                    .attr({
                        x:      0,
                        y:      0,
                        width:  _width,
                        height: _barSize * unitSize,
                    });
                transform($bar, 0, _value * unitSize);
            });
        };
        let calc      = function (f)
        {
            f(_height / (_max - _min));
        };
        let setValue  = function (value)
        {
            setValues(value, _min, _max, _barSize);
        };
        let setValues = function (value, min, max, barSize)
        {
            value       = Math.max(min, Math.min(value, max - barSize));
            let changed = (value != _value);
            _value      = value;
            _min        = min;
            _max        = max;
            _barSize    = barSize;
            layout();
            if (changed)
            {
                $scrollbar.trigger('scrollValueChange');
            }
        };
        let getValue  = function ()
        {
            return _value;
        };
        controller($scrollbar, {
            setSize:   setSize,
            setValues: setValues,
            getValue:  getValue,
        });
        return $scrollbar;
    };

    let getUniqueId = function ()
    {
        let uniqueIdCount = 0;
        return function ()
        {
            return 'simcir-id' + uniqueIdCount++;
        };
    }();

    let createWorkspace = function (data)
    {
        data = $.extend({
            width:       400,
            height:      200,
            showToolbox: true,
            editable:    true,
            toolbox:     defaultToolbox,
            devices:     [],
            connectors:  [],
        }, data);

        let scope = {};

        let workspaceWidth  = data.width;
        let workspaceHeight = data.height;
        let barWidth        = unit;
        let toolboxWidth    = data.showToolbox ? unit * 6 + barWidth : 0;

        let connectorsValid     = true;
        let connectorsValidator = function ()
        {
            if (!connectorsValid)
            {
                updateConnectors();
                connectorsValid = true;
            }
        };

        let $workspace = createSVG(workspaceWidth, workspaceHeight)
            .attr('class', 'simcir-workspace')
            .on('nodeValueChange', function (event)
            {
                connectorsValid = false;
                window.setTimeout(connectorsValidator, 0);
            })
            .on('dispose', function ()
            {
                $(this).find('.simcir-device').trigger('dispose');
                $toolboxPane.remove();
                $workspace.remove();
            });

        disableSelection($workspace);

        let $defs = createSVGElement('defs');
        $workspace.append($defs);

        !function ()
        {
            // fill with pin hole pattern.
            let patId = getUniqueId();
            let pitch = unit / 2;
            let w     = workspaceWidth - toolboxWidth;
            let h     = workspaceHeight;

            $defs.append(
                createSVGElement('pattern')
                .attr({
                    id:     patId,
                    x:      0,
                    y:      0,
                    width:  pitch / w,
                    height: pitch / h,
                })
                .append(
                    createSVGElement('rect')
                    .attr('class', 'simcir-pin-hole')
                    .attr({
                        x:      0,
                        y:      0,
                        width:  1,
                        height: 1,
                    })
                )
            );

            $workspace.append(
                createSVGElement('rect')
                .attr({
                    x:      toolboxWidth,
                    y:      0,
                    width:  w,
                    height: h,
                })
                .css({fill: 'url(#' + patId + ')'})
            );
        }();

        let $toolboxDevicePane = createSVGElement('g');
        let $scrollbar         = createScrollbar();
        $scrollbar.on('scrollValueChange', function (event)
        {
            transform($toolboxDevicePane, 0, -controller($scrollbar).getValue(),);
        });
        controller($scrollbar).setSize(barWidth, workspaceHeight);
        transform($scrollbar, toolboxWidth - barWidth, 0);
        let $toolboxPane = createSVGElement('g')
            .attr('class', 'simcir-toolbox')
            .append(createSVGElement('rect').attr({
                x:      0,
                y:      0,
                width:  toolboxWidth,
                height: workspaceHeight,
            }))
            .append($toolboxDevicePane)
            .append($scrollbar)
            .on('wheel', function (event)
            {
                event.preventDefault();
                let oe = event.originalEvent || event;
                if (oe.deltaY < 0)
                {
                    $scrollbar.trigger('unitup');
                }
                else if (oe.deltaY > 0)
                {
                    $scrollbar.trigger('unitdown');
                }
            });

        let $devicePane = createSVGElement('g');
        transform($devicePane, toolboxWidth, 0);
        let $connectorPane = createSVGElement('g');
        let $temporaryPane = createSVGElement('g');

        enableEvents($connectorPane, false);
        enableEvents($temporaryPane, false);

        if (data.showToolbox)
        {
            $workspace.append($toolboxPane);
        }
        $workspace.append($devicePane);
        $workspace.append($connectorPane);
        $workspace.append($temporaryPane);

        let addDevice = function ($dev)
        {
            $devicePane.append($dev);
            $dev.trigger('deviceAdd');
        };

        let removeDevice = function ($dev)
        {
            $dev.trigger('deviceRemove');
            // before remove, disconnect all
            controller($dev).disconnectAll();
            $dev.trigger('dispose');
            updateConnectors();
        };

        let disconnect = function ($inNode)
        {
            let inNode = controller($inNode);
            if (inNode.getOutput() != null)
            {
                inNode.getOutput().disconnectFrom(inNode);
            }
            updateConnectors();
        };

        let updateConnectors = function ()
        {
            $connectorPane.children().remove();
            $devicePane.children('.simcir-device').each(function ()
            {
                let device = controller($(this));
                $.each(device.getInputs(), function (i, inNode)
                {
                    if (inNode.getOutput() != null)
                    {
                        let p1    = offset(inNode.$ui);
                        let p2    = offset(inNode.getOutput().$ui);
                        let $conn = createConnector(p1.x, p1.y, p2.x, p2.y);
                        if (inNode.getOutput().getValue() != null)
                        {
                            $conn.addClass('simcir-connector-hot');
                        }
                        $connectorPane.append($conn);
                    }
                });
            });
        };

        let loadToolbox = function (data)
        {
            let vgap = 8;
            let y    = vgap;
            $.each(data.toolbox, function (i, deviceDef)
            {
                let $dev = createDevice(deviceDef);
                $toolboxDevicePane.append($dev);
                let size = controller($dev).getSize();
                transform($dev, (toolboxWidth - barWidth - size.width) / 2, y);
                y += (size.height + fontSize + vgap);
            });
            controller($scrollbar).setValues(0, 0, y, workspaceHeight);
        };

        let getData = function ()
        {

            // renumber all id
            let devIdCount = 0;
            $devicePane.children('.simcir-device').each(function ()
            {
                let $dev   = $(this);
                let device = controller($dev);
                let devId  = 'dev' + devIdCount++;
                device.id  = devId;
                $.each(device.getInputs(), function (i, node)
                {
                    node.id = devId + '.in' + i;
                });
                $.each(device.getOutputs(), function (i, node)
                {
                    node.id = devId + '.out' + i;
                });
            });

            let toolbox    = [];
            let devices    = [];
            let connectors = [];
            let clone      = function (obj)
            {
                return JSON.parse(JSON.stringify(obj));
            };
            $toolboxDevicePane.children('.simcir-device').each(function ()
            {
                let $dev   = $(this);
                let device = controller($dev);
                toolbox.push(device.deviceDef);
            });
            $devicePane.children('.simcir-device').each(function ()
            {
                let $dev   = $(this);
                let device = controller($dev);
                $.each(device.getInputs(), function (i, inNode)
                {
                    if (inNode.getOutput() != null)
                    {
                        connectors.push({
                            from: inNode.id,
                            to:   inNode.getOutput().id,
                        });
                    }
                });
                let pos         = transform($dev);
                let deviceDef   = clone(device.deviceDef);
                deviceDef.id    = device.id;
                deviceDef.x     = pos.x;
                deviceDef.y     = pos.y;
                deviceDef.label = device.getLabel();
                let state       = device.getState();
                if (state != null)
                {
                    deviceDef.state = state;
                }
                devices.push(deviceDef);
            });
            return {
                width:       data.width,
                height:      data.height,
                showToolbox: data.showToolbox,
                editable:    data.editable,
                toolbox:     toolbox,
                devices:     devices,
                connectors:  connectors,
            };
        };
        let getText = function ()
        {

            let data = getData();

            let buf        = '';
            let print      = function (s)
            {
                buf += s;
            };
            let println    = function (s)
            {
                print(s);
                buf += '\r\n';
            };
            let printArray = function (array)
            {
                $.each(array, function (i, item)
                {
                    println('    ' + JSON.stringify(item).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') +
                        (i + 1 < array.length ? ',' : ''));
                });
            };
            println('{');
            println('  "width":' + data.width + ',');
            println('  "height":' + data.height + ',');
            println('  "showToolbox":' + data.showToolbox + ',');
            println('  "toolbox":[');
            printArray(data.toolbox);
            println('  ],');
            println('  "devices":[');
            printArray(data.devices);
            println('  ],');
            println('  "connectors":[');
            printArray(data.connectors);
            println('  ]');
            print('}');
            return buf;
        };

        //-------------------------------------------
        // mouse operations

        let dragMoveHandler     = null;
        let dragCompleteHandler = null;

        let adjustDevice = function ($dev)
        {
            let pitch  = unit / 2;
            let adjust = function (v)
            {
                return Math.round(v / pitch) * pitch;
            };
            let pos    = transform($dev);
            let size   = controller($dev).getSize();
            let x      = Math.max(0, Math.min(
                pos.x,
                workspaceWidth - toolboxWidth - size.width,
            ));
            let y      = Math.max(0, Math.min(
                pos.y,
                workspaceHeight - size.height,
            ));
            transform($dev, adjust(x), adjust(y));
        };

        let beginConnect = function (event, $target)
        {
            let $srcNode = $target.closest('.simcir-node');
            let off      = $workspace.offset();
            let pos      = offset($srcNode);
            if ($srcNode.attr('simcir-node-type') == 'in')
            {
                disconnect($srcNode);
            }
            dragMoveHandler     = function (event)
            {
                let x = event.pageX - off.left;
                let y = event.pageY - off.top;
                $temporaryPane.children().remove();
                $temporaryPane.append(createConnector(pos.x, pos.y, x, y));
            };
            dragCompleteHandler = function (event)
            {
                $temporaryPane.children().remove();
                let $dst = $(event.target);
                if (isActiveNode($dst))
                {
                    let $dstNode = $dst.closest('.simcir-node');
                    connect($srcNode, $dstNode);
                    updateConnectors();
                }
            };
        };

        let beginNewDevice = function (event, $target)
        {
            let $dev = $target.closest('.simcir-device');
            let pos  = offset($dev);
            $dev     = createDevice(controller($dev).deviceDef, false, scope);
            transform($dev, pos.x, pos.y);
            $temporaryPane.append($dev);
            let dragPoint       = {
                x: event.pageX - pos.x,
                y: event.pageY - pos.y,
            };
            dragMoveHandler     = function (event)
            {
                transform(
                    $dev,
                    event.pageX - dragPoint.x,
                    event.pageY - dragPoint.y,
                );
            };
            dragCompleteHandler = function (event)
            {
                let $target = $(event.target);
                if ($target.closest('.simcir-toolbox').length == 0)
                {
                    $dev.detach();
                    let pos = transform($dev);
                    transform($dev, pos.x - toolboxWidth, pos.y);
                    adjustDevice($dev);
                    addDevice($dev);
                }
                else
                {
                    $dev.trigger('dispose');
                }
            };
        };

        let $selectedDevices = [];
        let addSelected      = function ($dev)
        {
            controller($dev).setSelected(true);
            $selectedDevices.push($dev);
        };
        let deselectAll      = function ()
        {
            $devicePane.children('.simcir-device').each(function ()
            {
                controller($(this)).setSelected(false);
            });
            $selectedDevices = [];
        };

        let beginMoveDevice = function (event, $target)
        {
            let $dev = $target.closest('.simcir-device');
            let pos  = transform($dev);
            if (!controller($dev).isSelected())
            {
                deselectAll();
                addSelected($dev);
                // to front.
                $dev.parent().append($dev.detach());
            }

            let dragPoint       = {
                x: event.pageX - pos.x,
                y: event.pageY - pos.y,
            };
            dragMoveHandler     = function (event)
            {
                // disable events while dragging.
                enableEvents($dev, false);
                let curPos   = transform($dev);
                let deltaPos = {
                    x: event.pageX - dragPoint.x - curPos.x,
                    y: event.pageY - dragPoint.y - curPos.y,
                };
                $.each($selectedDevices, function (i, $dev)
                {
                    let curPos = transform($dev);
                    transform(
                        $dev,
                        curPos.x + deltaPos.x,
                        curPos.y + deltaPos.y,
                    );
                });
                updateConnectors();
            };
            dragCompleteHandler = function (event)
            {
                let $target = $(event.target);
                enableEvents($dev, true);
                $.each($selectedDevices, function (i, $dev)
                {
                    if ($target.closest('.simcir-toolbox').length == 0)
                    {
                        adjustDevice($dev);
                        updateConnectors();
                    }
                    else
                    {
                        removeDevice($dev);
                    }
                });
            };
        };

        let beginSelectDevice = function (event, $target)
        {
            let intersect   = function (rect1, rect2)
            {
                return !(
                    rect1.x > rect2.x + rect2.width ||
                    rect1.y > rect2.y + rect2.height ||
                    rect1.x + rect1.width < rect2.x ||
                    rect1.y + rect1.height < rect2.y);
            };
            let pointToRect = function (p1, p2)
            {
                return {
                    x:      Math.min(p1.x, p2.x),
                    y:      Math.min(p1.y, p2.y),
                    width:  Math.abs(p1.x - p2.x),
                    height: Math.abs(p1.y - p2.y),
                };
            };
            deselectAll();
            let off         = $workspace.offset();
            let pos         = offset($devicePane);
            let p1          = {
                x: event.pageX - off.left,
                y: event.pageY - off.top,
            };
            dragMoveHandler = function (event)
            {
                deselectAll();
                let p2      = {
                    x: event.pageX - off.left,
                    y: event.pageY - off.top,
                };
                let selRect = pointToRect(p1, p2);
                $devicePane.children('.simcir-device').each(function ()
                {
                    let $dev    = $(this);
                    let devPos  = transform($dev);
                    let devSize = controller($dev).getSize();
                    let devRect = {
                        x:      devPos.x + pos.x,
                        y:      devPos.y + pos.y,
                        width:  devSize.width,
                        height: devSize.height,
                    };
                    if (intersect(selRect, devRect))
                    {
                        addSelected($dev);
                    }
                });
                $temporaryPane.children().remove();
                $temporaryPane.append(createSVGElement('rect').attr(selRect).attr('class', 'simcir-selection-rect'));
            };
        };

        let mouseDownHandler = function (event)
        {
            event.preventDefault();
            event.stopPropagation();
            let $target = $(event.target);
            if (!data.editable)
            {
                return;
            }
            if (isActiveNode($target))
            {
                beginConnect(event, $target);
            }
            else if ($target.closest('.simcir-device').length == 1)
            {
                if ($target.closest('.simcir-toolbox').length == 1)
                {
                    beginNewDevice(event, $target);
                }
                else
                {
                    beginMoveDevice(event, $target);
                }
            }
            else
            {
                beginSelectDevice(event, $target);
            }
            $(document).on('mousemove', mouseMoveHandler);
            $(document).on('mouseup', mouseUpHandler);
        };
        let mouseMoveHandler = function (event)
        {
            if (dragMoveHandler != null)
            {
                dragMoveHandler(event);
            }
        };
        let mouseUpHandler   = function (event)
        {
            if (dragCompleteHandler != null)
            {
                dragCompleteHandler(event);
            }
            dragMoveHandler     = null;
            dragCompleteHandler = null;
            $devicePane.children('.simcir-device').each(function ()
            {
                enableEvents($(this), true);
            });
            $temporaryPane.children().remove();
            $(document).off('mousemove', mouseMoveHandler);
            $(document).off('mouseup', mouseUpHandler);
        };
        $workspace.on('mousedown', mouseDownHandler);

        //-------------------------------------------
        //

        loadToolbox(data);
        $.each(buildCircuit(data, false, scope), function (i, $dev)
        {
            addDevice($dev);
        });
        updateConnectors();

        controller($workspace, {
            data: getData,
            text: getText,
        });

        return $workspace;
    };

    let clearSimcir = function ($placeHolder)
    {
        $placeHolder = $($placeHolder[0]);
        $placeHolder.find('.simcir-workspace').trigger('dispose');
        $placeHolder.children().remove();
        return $placeHolder;
    };

    let setupSimcir = function ($placeHolder, data)
    {
        //clear the div (e.g. remove previous simcir instance)
        $placeHolder = clearSimcir($placeHolder);

        //create the workspace from the provided data
        let $workspace = simcir.createWorkspace(data);

        //create the textarea that will show the json export
        let $dataArea  = $('<textarea></textarea>')
            .addClass('simcir-json-data-area')
            .attr('readonly', 'readonly')
            .css('width', $workspace.attr('width') + 'px')
            .css('height', $workspace.attr('height') + 'px');

        //logic whether to show the workspace or the textarea
        let showData   = false;
        let toggle     = function ()
        {
            $workspace.css('display', !showData ? 'inline' : 'none');
            $dataArea.css('display', showData ? 'inline' : 'none');
            if (showData)
            {
                $dataArea.val(controller($workspace).text()).focus();
            }
            showData = !showData;
        };

        //assemble the simcir element with a click event for workspace/textarea toggle
        $placeHolder.text('');
        $placeHolder.append(
            $('<div></div>')
            .addClass('simcir-body')
            .append($workspace)
            .append($dataArea)
            .on('click', function (event)
            {
                if (event.ctrlKey || event.metaKey)
                {
                    toggle();
                }
            })
        );
        toggle();

        //return the jQuery object
        return $placeHolder;
    };

    let setupSimcirDoc = function ($placeHolder)
    {
        let $table = $('<table><tbody></tbody></table>').addClass('simcir-doc-table');
        $.each(defaultToolbox, function (i, deviceDef)
        {
            let $dev1  = createDevice(deviceDef);
            let device = controller($dev1);
            if (!device.doc)
            {
                return;
            }
            let doc  = $.extend({
                description: '',
                params:      [],
            }, device.doc);
            let size = device.getSize();

            let $tr   = $('<tr></tr>');
            let hgap  = 32;
            let vgap  = 8;
            let $view = createSVG(
                size.width + hgap * 2,
                size.height + vgap * 2 + fontSize,
            );
            let $dev2 = createDevice(deviceDef);
            transform($dev2, hgap, vgap);

            $view.append($dev2);
            $tr.append($('<td></td>').css('text-align', 'center').append($view));
            let $desc = $('<td></td>');
            $tr.append($desc);

            if (doc.description)
            {
                $desc.append($('<span></span>').text(doc.description));
            }

            $desc.append($('<div>Params</div>').addClass('simcir-doc-title'));
            let $paramsTable = $('<table><tbody></tbody></table>').addClass('simcir-doc-params-table');
            $paramsTable.children('tbody')
                .append($('<tr></tr>')
                    .append($('<th>Name</th>'))
                    .append($('<th>Type</th>'))
                    .append($('<th>Default</th>'))
                    .append($('<th>Description</th>')));
            $paramsTable.children('tbody')
                .append($('<tr></tr>')
                    .append($('<td>type</td>'))
                    .append($('<td>string</td>'))
                    .append($('<td>-</td>').css('text-align', 'center'))
                    .append($('<td>"' + deviceDef.type + '"</td>')));
            if (!doc.labelless)
            {
                $paramsTable.children('tbody')
                    .append($('<tr></tr>')
                        .append($('<td>label</td>'))
                        .append($('<td>string</td>'))
                        .append($('<td>same with type</td>').css('text-align', 'center'))
                        .append($('<td>label for a device.</td>')));
            }
            if (doc.params)
            {
                $.each(doc.params, function (i, param)
                {
                    $paramsTable.children('tbody')
                        .append($('<tr></tr>')
                            .append($('<td></td>').text(param.name))
                            .append($('<td></td>').text(param.type))
                            .append($('<td></td>').css('text-align', 'center').text(param.defaultValue))
                            .append($('<td></td>').text(param.description)));
                });
            }
            $desc.append($paramsTable);

            if (doc.code)
            {
                $desc.append($('<div>Code</div>').addClass('simcir-doc-title'));
                $desc.append($('<div></div>').addClass('simcir-doc-code').text(doc.code));
            }

            $table.children('tbody').append($tr);
        });

        $placeHolder.append($table);
    };

    $(function ()
    {
        $('.simcir-doc').each(function ()
        {
            setupSimcirDoc($(this));
        });
    });

    $.extend(
        $s,
        {
            registerDevice:   registerDevice,
            clearSimcir:      clearSimcir,
            setupSimcir:      setupSimcir,
            createWorkspace:  createWorkspace,
            createSVGElement: createSVGElement,
            offset:           offset,
            transform:        transform,
            enableEvents:     enableEvents,
            graphics:         graphics,
            controller:       controller,
            unit:             unit,
        }
    );
}(simcir);

//
// built-in devices
//
!function ($s)
{

    'use strict';

    let $ = $s.$;

    // unit size
    let unit = $s.unit;

    let connectNode = function (in1, out1)
    {
        // set input value to output without inputValueChange event.
        let in1_super_setValue = in1.setValue;
        in1.setValue           = function (value, force)
        {
            let changed = in1.getValue() !== value;
            in1_super_setValue(value, force);
            if (changed || force)
            {
                out1.setValue(in1.getValue());
            }
        };
    };

    let createPortFactory = function (type)
    {
        return function (device)
        {
            let in1  = device.addInput();
            let out1 = device.addOutput();
            connectNode(in1, out1);
            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();
                let size = device.getSize();
                let cx   = size.width / 2;
                let cy   = size.height / 2;
                device.$ui.append($s.createSVGElement('circle')
                                  .attr({
                                            cx: cx,
                                            cy: cy,
                                            r:  unit / 2,
                                        })
                                  .attr('class', 'simcir-port simcir-node-type-' + type));
                device.$ui.append($s.createSVGElement('circle')
                                  .attr({
                                            cx: cx,
                                            cy: cy,
                                            r:  unit / 4,
                                        })
                                  .attr('class', 'simcir-port-hole'));
            };
        };
    };

    let createJointFactory = function ()
    {

        let maxFadeCount = 16;
        let fadeTimeout  = 100;

        let Direction = {
            WE: 0,
            NS: 1,
            EW: 2,
            SN: 3,
        };

        return function (device)
        {

            let in1  = device.addInput();
            let out1 = device.addOutput();
            connectNode(in1, out1);

            let state       = device.deviceDef.state || {direction: Direction.WE};
            device.getState = function ()
            {
                return state;
            };

            device.getSize = function ()
            {
                return {
                    width:  unit,
                    height: unit,
                };
            };

            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();

                let $label = device.$ui.children('.simcir-device-label');
                $label.attr('y', $label.attr('y') - unit / 4);

                let $point = $s.createSVGElement('circle')
                .css('pointer-events', 'none')
                .css('opacity', 0)
                .attr('r', 2)
                .addClass('simcir-connector')
                .addClass('simcir-joint-point');
                device.$ui.append($point);

                let $path = $s.createSVGElement('path')
                .css('pointer-events', 'none')
                .css('opacity', 0)
                .addClass('simcir-connector');
                device.$ui.append($path);

                let $title = $s.createSVGElement('title').text('Double-Click to change a direction.');

                let updatePoint = function ()
                {
                    $point.css('display', out1.getInputs().length > 1 ? '' : 'none');
                };

                updatePoint();

                let super_connectTo      = out1.connectTo;
                out1.connectTo           = function (inNode)
                {
                    super_connectTo(inNode);
                    updatePoint();
                };
                let super_disconnectFrom = out1.disconnectFrom;
                out1.disconnectFrom      = function (inNode)
                {
                    super_disconnectFrom(inNode);
                    updatePoint();
                };

                let updateUI = function ()
                {
                    let x0,
                        y0,
                        x1,
                        y1;
                    x0            = y0 = x1 = y1 = unit / 2;
                    let d         = unit / 2;
                    let direction = state.direction;
                    if (direction == Direction.WE)
                    {
                        x0 -= d;
                        x1 += d;
                    }
                    else if (direction == Direction.NS)
                    {
                        y0 -= d;
                        y1 += d;
                    }
                    else if (direction == Direction.EW)
                    {
                        x0 += d;
                        x1 -= d;
                    }
                    else if (direction == Direction.SN)
                    {
                        y0 += d;
                        y1 -= d;
                    }
                    $path.attr('d', 'M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1);
                    $s.transform(in1.$ui, x0, y0);
                    $s.transform(out1.$ui, x1, y1);
                    $point.attr({
                                    cx: x1,
                                    cy: y1,
                                });
                    if (direction == Direction.EW || direction == Direction.WE)
                    {
                        device.$ui.children('.simcir-device-body')
                        .attr({
                                  x:      0,
                                  y:      unit / 4,
                                  width:  unit,
                                  height: unit / 2,
                              });
                    }
                    else
                    {
                        device.$ui.children('.simcir-device-body')
                        .attr({
                                  x:      unit / 4,
                                  y:      0,
                                  width:  unit / 2,
                                  height: unit,
                              });
                    }
                };

                updateUI();

                // fadeout a body.
                let fadeCount  = 0;
                let setOpacity = function (opacity)
                {
                    device.$ui.children('.simcir-device-body,.simcir-node').css('opacity', opacity);
                    $path.css('opacity', 1 - opacity);
                    $point.css('opacity', 1 - opacity);
                };
                let fadeout    = function ()
                {
                    window.setTimeout(function ()
                                      {
                                          if (fadeCount > 0)
                                          {
                                              fadeCount -= 1;
                                              setOpacity(fadeCount / maxFadeCount);
                                              fadeout();
                                          }
                                      }, fadeTimeout);
                };

                let isEditable             = function ($dev)
                {
                    let $workspace = $dev.closest('.simcir-workspace');
                    return !!$s.controller($workspace).data().editable;
                };
                let device_mouseoutHandler = function (event)
                {
                    if (!isEditable($(event.target)))
                    {
                        return;
                    }
                    if (!device.isSelected())
                    {
                        fadeCount = maxFadeCount;
                        fadeout();
                    }
                };
                let device_dblclickHandler = function (event)
                {
                    if (!isEditable($(event.target)))
                    {
                        return;
                    }
                    state.direction = (state.direction + 1) % 4;
                    updateUI();
                    // update connectors.
                    $(this).trigger('mousedown').trigger('mouseup');
                };

                device.$ui.on('mouseover', function (event)
                {
                    if (!isEditable($(event.target)))
                    {
                        $title.text('');
                        return;
                    }
                    setOpacity(1);
                    fadeCount = 0;
                }).on('deviceAdd', function ()
                {
                    if ($(this).closest('BODY').length == 0)
                    {
                        setOpacity(0);
                    }
                    $(this)
                    .append($title)
                    .on('mouseout', device_mouseoutHandler)
                    .on('dblclick', device_dblclickHandler);
                    // hide a label
                    $label.css('display', 'none');
                }).on('deviceRemove', function ()
                {
                    $(this).off('mouseout', device_mouseoutHandler).off('dblclick', device_dblclickHandler);
                    $title.remove();
                    // show a label
                    $label.css('display', '');
                }).on('deviceSelect', function ()
                {
                    if (device.isSelected())
                    {
                        setOpacity(1);
                        fadeCount = 0;
                    }
                    else
                    {
                        if (fadeCount == 0)
                        {
                            setOpacity(0);
                        }
                    }
                });
            };
        };
    };

    // register built-in devices
    $s.registerDevice('In', createPortFactory('in'));
    $s.registerDevice('Out', createPortFactory('out'));
    $s.registerDevice('Joint', createJointFactory());

}(simcir);
