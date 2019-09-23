//
// SimcirJS - basicset
//
// Copyright (c) 2014 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//

// includes following device types:
//  DC
//  LED
//  PushOff
//  PushOn
//  Toggle
//  BUF
//  NOT
//  AND
//  NAND
//  OR
//  NOR
//  EOR
//  ENOR
//  OSC
//  7seg
//  16seg
//  4bit7seg
//  RotaryEncoder
//  BusIn
//  BusOut

!function ($s)
{

    'use strict';

    let $ = $s.$;

    // unit size
    let unit = $s.unit;

    // red/black
    let defaultLEDColor   = '#ff0000';
    let defaultLEDBgColor = '#000000';

    let multiplyColor = function ()
    {
        let HEX           = '0123456789abcdef';
        let toIColor      = function (sColor)
        {
            if (!sColor)
            {
                return 0;
            }
            sColor = sColor.toLowerCase();
            if (sColor.match(/^#[0-9a-f]{3}$/i))
            {
                let iColor = 0;
                for (let i = 0; i < 6; i += 1)
                {
                    iColor = (iColor << 4) | HEX.indexOf(sColor.charAt((i >> 1) + 1));
                }
                return iColor;
            }
            else if (sColor.match(/^#[0-9a-f]{6}$/i))
            {
                let iColor = 0;
                for (let i = 0; i < 6; i += 1)
                {
                    iColor = (iColor << 4) | HEX.indexOf(sColor.charAt(i + 1));
                }
                return iColor;
            }
            return 0;
        };
        let toSColor      = function (iColor)
        {
            let sColor = '#';
            for (let i = 0; i < 6; i += 1)
            {
                sColor += HEX.charAt((iColor >>> (5 - i) * 4) & 0x0f);
            }
            return sColor;
        };
        let toRGB         = function (iColor)
        {
            return {
                r: (iColor >>> 16) & 0xff,
                g: (iColor >>> 8) & 0xff,
                b: iColor & 0xff,
            };
        };
        let multiplyColor = function (iColor1, iColor2, ratio)
        {
            let c1 = toRGB(iColor1);
            let c2 = toRGB(iColor2);
            let mc = function (v1, v2, ratio)
            {
                return ~~Math.max(0, Math.min((v1 - v2) * ratio + v2, 255));
            };
            return (mc(c1.r, c2.r, ratio) << 16) |
                (mc(c1.g, c2.g, ratio) << 8) | mc(c1.b, c2.b, ratio);
        };
        return function (color1, color2, ratio)
        {
            return toSColor(multiplyColor(
                toIColor(color1), toIColor(color2), ratio));
        };
    }();

    // symbol draw functions
    let drawBUF  = function (g, x, y, width, height)
    {
        g.moveTo(x, y);
        g.lineTo(x + width, y + height / 2);
        g.lineTo(x, y + height);
        g.lineTo(x, y);
        g.closePath(true);
    };
    let drawAND  = function (g, x, y, width, height)
    {
        g.moveTo(x, y);
        g.curveTo(x + width, y, x + width, y + height / 2);
        g.curveTo(x + width, y + height, x, y + height);
        g.lineTo(x, y);
        g.closePath(true);
    };
    let drawOR   = function (g, x, y, width, height)
    {
        let depth = width * 0.2;
        g.moveTo(x, y);
        g.curveTo(x + width - depth, y, x + width, y + height / 2);
        g.curveTo(x + width - depth, y + height, x, y + height);
        g.curveTo(x + depth, y + height, x + depth, y + height / 2);
        g.curveTo(x + depth, y, x, y);
        g.closePath(true);
    };
    let drawEOR  = function (g, x, y, width, height)
    {
        drawOR(g, x + 3, y, width - 3, height);
        let depth = (width - 3) * 0.2;
        g.moveTo(x, y + height);
        g.curveTo(x + depth, y + height, x + depth, y + height / 2);
        g.curveTo(x + depth, y, x, y);
        g.closePath();
    };
    let drawNOT  = function (g, x, y, width, height)
    {
        drawBUF(g, x - 1, y, width - 2, height);
        g.drawCircle(x + width - 1, y + height / 2, 2);
    };
    let drawNAND = function (g, x, y, width, height)
    {
        drawAND(g, x - 1, y, width - 2, height);
        g.drawCircle(x + width - 1, y + height / 2, 2);
    };
    let drawNOR  = function (g, x, y, width, height)
    {
        drawOR(g, x - 1, y, width - 2, height);
        g.drawCircle(x + width - 1, y + height / 2, 2);
    };
    let drawENOR = function (g, x, y, width, height)
    {
        drawEOR(g, x - 1, y, width - 2, height);
        g.drawCircle(x + width - 1, y + height / 2, 2);
    };
    // logical functions
    let AND      = function (a, b)
    {
        return a & b;
    };
    let OR       = function (a, b)
    {
        return a | b;
    };
    let EOR      = function (a, b)
    {
        return a ^ b;
    };
    let BUF      = function (a)
    {
        return (a == 1) ? 1 : 0;
    };
    let NOT      = function (a)
    {
        return (a == 1) ? 0 : 1;
    };

    let onValue  = 1;
    let offValue = null;
    let isHot    = function (v)
    {
        return v != null;
    };
    let intValue = function (v)
    {
        return isHot(v) ? 1 : 0;
    };

    let createSwitchFactory = function (type)
    {
        return function (device)
        {
            let in1  = device.addInput();
            let out1 = device.addOutput();
            let on   = (type == 'PushOff');

            if (type == 'Toggle' && device.deviceDef.state)
            {
                on = device.deviceDef.state.on;
            }
            device.getState = function ()
            {
                return type == 'Toggle' ? {on: on} : null;
            };

            device.$ui.on('inputValueChange', function ()
            {
                if (on)
                {
                    out1.setValue(in1.getValue());
                }
            });
            let updateOutput = function ()
            {
                out1.setValue(on ? in1.getValue() : null);
            };
            updateOutput();

            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();
                let size    = device.getSize();
                let $button = $s.createSVGElement('rect').attr({
                                                                   x:      size.width / 4,
                                                                   y:      size.height / 4,
                                                                   width:  size.width / 2,
                                                                   height: size.height / 2,
                                                                   rx:     2,
                                                                   ry:     2,
                                                               });
                $button.addClass('simcir-basicset-switch-button');
                if (type == 'Toggle' && on)
                {
                    $button.addClass('simcir-basicset-switch-button-pressed');
                }
                device.$ui.append($button);
                let button_mouseDownHandler = function (event)
                {
                    event.preventDefault();
                    event.stopPropagation();
                    if (type == 'PushOn')
                    {
                        on = true;
                        $button.addClass('simcir-basicset-switch-button-pressed');
                    }
                    else if (type == 'PushOff')
                    {
                        on = false;
                        $button.addClass('simcir-basicset-switch-button-pressed');
                    }
                    else if (type == 'Toggle')
                    {
                        on = !on;
                        $button.addClass('simcir-basicset-switch-button-pressed');
                    }
                    updateOutput();
                    $(document).on('mouseup', button_mouseUpHandler);
                    $(document).on('touchend', button_mouseUpHandler);
                };
                let button_mouseUpHandler   = function (event)
                {
                    if (type == 'PushOn')
                    {
                        on = false;
                        $button.removeClass('simcir-basicset-switch-button-pressed');
                    }
                    else if (type == 'PushOff')
                    {
                        on = true;
                        $button.removeClass('simcir-basicset-switch-button-pressed');
                    }
                    else if (type == 'Toggle')
                    {
                        // keep state
                        if (!on)
                        {
                            $button.removeClass('simcir-basicset-switch-button-pressed');
                        }
                    }
                    updateOutput();
                    $(document).off('mouseup', button_mouseUpHandler);
                    $(document).off('touchend', button_mouseUpHandler);
                };
                device.$ui.on('deviceAdd', function ()
                {
                    $s.enableEvents($button, true);
                    $button.on('mousedown', button_mouseDownHandler);
                    $button.on('touchstart', button_mouseDownHandler);
                });
                device.$ui.on('deviceRemove', function ()
                {
                    $s.enableEvents($button, false);
                    $button.off('mousedown', button_mouseDownHandler);
                    $button.off('touchstart', button_mouseDownHandler);
                });
                device.$ui.addClass('simcir-basicset-switch');
            };
        };
    };

    let createLogicGateFactory = function (op, out, draw)
    {
        return function (device)
        {
            let numInputs    = (op == null) ? 1 :
                Math.max(2, device.deviceDef.numInputs || 2);
            device.halfPitch = numInputs > 2;
            for (let i = 0; i < numInputs; i += 1)
            {
                device.addInput();
            }
            device.addOutput();
            let inputs  = device.getInputs();
            let outputs = device.getOutputs();
            device.$ui.on('inputValueChange', function ()
            {
                let b = intValue(inputs[0].getValue());
                if (op != null)
                {
                    for (let i = 1; i < inputs.length; i += 1)
                    {
                        b = op(b, intValue(inputs[i].getValue()));
                    }
                }
                b = out(b);
                outputs[0].setValue((b == 1) ? 1 : null);
            });
            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();
                let size        = device.getSize();
                let g           = $s.graphics(device.$ui);
                g.attr['class'] = 'simcir-basicset-symbol';
                draw(g,
                     (size.width - unit) / 2,
                     (size.height - unit) / 2,
                     unit, unit,
                );
                if (op != null)
                {
                    device.doc = {
                        params: [
                            {
                                name:         'numInputs',
                                type:         'number',
                                defaultValue: 2,
                                description:  'number of inputs.',
                            },
                        ],
                        code:   '{"type":"' + device.deviceDef.type + '","numInputs":2}',
                    };
                }
            };
        };
    };

    /*
     let segBase = function() {
     return {
     width: 0,
     height: 0,
     allSegments: '',
     drawSegment: function(g, segment, color) {},
     drawPoint: function(g, color) {}
     };
     };
     */

    let _7Seg = function ()
    {
        let _SEGMENT_DATA = {
            a: [575, 138, 494, 211, 249, 211, 194, 137, 213, 120, 559, 120],
            b: [595, 160, 544, 452, 493, 500, 459, 456, 500, 220, 582, 146],
            c: [525, 560, 476, 842, 465, 852, 401, 792, 441, 562, 491, 516],
            d: [457, 860, 421, 892, 94, 892, 69, 864, 144, 801, 394, 801],
            e: [181, 560, 141, 789, 61, 856, 48, 841, 96, 566, 148, 516],
            f: [241, 218, 200, 453, 150, 500, 115, 454, 166, 162, 185, 145],
            g: [485, 507, 433, 555, 190, 555, 156, 509, 204, 464, 451, 464],
        };
        return {
            width:       636,
            height:      1000,
            allSegments: 'abcdefg',
            drawSegment: function (g, segment, color)
                         {
                             if (!color)
                             {
                                 return;
                             }
                             let data       = _SEGMENT_DATA[segment];
                             let numPoints  = data.length / 2;
                             g.attr['fill'] = color;
                             for (let i = 0; i < numPoints; i += 1)
                             {
                                 let x = data[i * 2];
                                 let y = data[i * 2 + 1];
                                 if (i == 0)
                                 {
                                     g.moveTo(x, y);
                                 }
                                 else
                                 {
                                     g.lineTo(x, y);
                                 }
                             }
                             g.closePath(true);
                         },
            drawPoint:   function (g, color)
                         {
                             if (!color)
                             {
                                 return;
                             }
                             g.attr['fill'] = color;
                             g.drawCircle(542, 840, 46);
                         },
        };
    }();

    let _16Seg = function ()
    {
        let _SEGMENT_DATA = {
            a: [255, 184, 356, 184, 407, 142, 373, 102, 187, 102],
            b: [418, 144, 451, 184, 552, 184, 651, 102, 468, 102],
            c: [557, 190, 507, 455, 540, 495, 590, 454, 656, 108],
            d: [487, 550, 438, 816, 506, 898, 573, 547, 539, 507],
            e: [281, 863, 315, 903, 500, 903, 432, 821, 331, 821],
            f: [35, 903, 220, 903, 270, 861, 236, 821, 135, 821],
            g: [97, 548, 30, 897, 129, 815, 180, 547, 147, 507],
            h: [114, 455, 148, 495, 198, 454, 248, 189, 181, 107],
            i: [233, 315, 280, 452, 341, 493, 326, 331, 255, 200],
            j: [361, 190, 334, 331, 349, 485, 422, 312, 445, 189, 412, 149],
            k: [430, 316, 354, 492, 432, 452, 522, 334, 547, 200],
            l: [354, 502, 408, 542, 484, 542, 534, 500, 501, 460, 434, 460],
            m: [361, 674, 432, 805, 454, 691, 405, 550, 351, 509],
            n: [265, 693, 242, 816, 276, 856, 326, 815, 353, 676, 343, 518],
            o: [255, 546, 165, 671, 139, 805, 258, 689, 338, 510],
            p: [153, 502, 187, 542, 254, 542, 338, 500, 278, 460, 203, 460],
        };
        return {
            width:       690,
            height:      1000,
            allSegments: 'abcdefghijklmnop',
            drawSegment: function (g, segment, color)
                         {
                             if (!color)
                             {
                                 return;
                             }
                             let data       = _SEGMENT_DATA[segment];
                             let numPoints  = data.length / 2;
                             g.attr['fill'] = color;
                             for (let i = 0; i < numPoints; i += 1)
                             {
                                 let x = data[i * 2];
                                 let y = data[i * 2 + 1];
                                 if (i == 0)
                                 {
                                     g.moveTo(x, y);
                                 }
                                 else
                                 {
                                     g.lineTo(x, y);
                                 }
                             }
                             g.closePath(true);
                         },
            drawPoint:   function (g, color)
                         {
                             if (!color)
                             {
                                 return;
                             }
                             g.attr['fill'] = color;
                             g.drawCircle(610, 900, 30);
                         },
        };
    }();

    let drawSeg = function (seg, g, pattern, hiColor, loColor, bgColor)
    {
        g.attr['stroke'] = 'none';
        if (bgColor)
        {
            g.attr['fill'] = bgColor;
            g.drawRect(0, 0, seg.width, seg.height);
        }
        let on;
        for (let i = 0; i < seg.allSegments.length; i += 1)
        {
            let c = seg.allSegments.charAt(i);
            on    = (pattern != null && pattern.indexOf(c) != -1);
            seg.drawSegment(g, c, on ? hiColor : loColor);
        }
        on = (pattern != null && pattern.indexOf('.') != -1);
        seg.drawPoint(g, on ? hiColor : loColor);
    };

    let createSegUI = function (device, seg)
    {
        let size  = device.getSize();
        let sw    = seg.width;
        let sh    = seg.height;
        let dw    = size.width - unit;
        let dh    = size.height - unit;
        let scale = (sw / sh > dw / dh) ? dw / sw : dh / sh;
        let tx    = (size.width - seg.width * scale) / 2;
        let ty    = (size.height - seg.height * scale) / 2;
        return $s.createSVGElement('g').attr('transform', 'translate(' + tx + ' ' + ty + ')' +
            ' scale(' + scale + ') ');
    };

    let createLEDSegFactory = function (seg)
    {
        return function (device)
        {
            let hiColor      = device.deviceDef.color || defaultLEDColor;
            let bgColor      = device.deviceDef.bgColor || defaultLEDBgColor;
            let loColor      = multiplyColor(hiColor, bgColor, 0.25);
            let allSegs      = seg.allSegments + '.';
            device.halfPitch = true;
            for (let i = 0; i < allSegs.length; i += 1)
            {
                device.addInput();
            }

            let super_getSize = device.getSize;
            device.getSize    = function ()
            {
                let size = super_getSize();
                return {
                    width:  unit * 4,
                    height: size.height,
                };
            };

            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();

                let $seg = createSegUI(device, seg);
                device.$ui.append($seg);

                let update = function ()
                {
                    let segs = '';
                    for (let i = 0; i < allSegs.length; i += 1)
                    {
                        if (isHot(device.getInputs()[i].getValue()))
                        {
                            segs += allSegs.charAt(i);
                        }
                    }
                    $seg.children().remove();
                    drawSeg(seg, $s.graphics($seg), segs,
                            hiColor, loColor, bgColor,
                    );
                };
                device.$ui.on('inputValueChange', update);
                update();
                device.doc = {
                    params: [
                        {
                            name:         'color',
                            type:         'string',
                            defaultValue: defaultLEDColor,
                            description:  'color in hexadecimal.',
                        },
                        {
                            name:         'bgColor',
                            type:         'string',
                            defaultValue: defaultLEDBgColor,
                            description:  'background color in hexadecimal.',
                        },
                    ],
                    code:   '{"type":"' + device.deviceDef.type +
                                '","color":"' + defaultLEDColor + '"}',
                };
            };
        };
    };

    let createLED4bitFactory = function ()
    {

        let _PATTERNS = {
            0: 'abcdef',
            1: 'bc',
            2: 'abdeg',
            3: 'abcdg',
            4: 'bcfg',
            5: 'acdfg',
            6: 'acdefg',
            7: 'abc',
            8: 'abcdefg',
            9: 'abcdfg',
            a: 'abcefg',
            b: 'cdefg',
            c: 'adef',
            d: 'bcdeg',
            e: 'adefg',
            f: 'aefg',
        };

        let getPattern = function (value)
        {
            return _PATTERNS['0123456789abcdef'.charAt(value)];
        };

        let seg = _7Seg;

        return function (device)
        {
            let hiColor = device.deviceDef.color || defaultLEDColor;
            let bgColor = device.deviceDef.bgColor || defaultLEDBgColor;
            let loColor = multiplyColor(hiColor, bgColor, 0.25);
            for (let i = 0; i < 4; i += 1)
            {
                device.addInput();
            }

            let super_getSize = device.getSize;
            device.getSize    = function ()
            {
                let size = super_getSize();
                return {
                    width:  unit * 4,
                    height: size.height,
                };
            };

            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();

                let $seg = createSegUI(device, seg);
                device.$ui.append($seg);

                let update = function ()
                {
                    let value = 0;
                    for (let i = 0; i < 4; i += 1)
                    {
                        if (isHot(device.getInputs()[i].getValue()))
                        {
                            value += (1 << i);
                        }
                    }
                    $seg.children().remove();
                    drawSeg(seg, $s.graphics($seg), getPattern(value),
                            hiColor, loColor, bgColor,
                    );
                };
                device.$ui.on('inputValueChange', update);
                update();
                device.doc = {
                    params: [
                        {
                            name:         'color',
                            type:         'string',
                            defaultValue: defaultLEDColor,
                            description:  'color in hexadecimal.',
                        },
                        {
                            name:         'bgColor',
                            type:         'string',
                            defaultValue: defaultLEDBgColor,
                            description:  'background color in hexadecimal.',
                        },
                    ],
                    code:   '{"type":"' + device.deviceDef.type +
                                '","color":"' + defaultLEDColor + '"}',
                };
            };
        };
    };

    let createRotaryEncoderFactory = function ()
    {
        let _MIN_ANGLE   = 45;
        let _MAX_ANGLE   = 315;
        let thetaToAngle = function (theta)
        {
            let angle = (theta - Math.PI / 2) / Math.PI * 180;
            while (angle < 0)
            {
                angle += 360;
            }
            while (angle > 360)
            {
                angle -= 360;
            }
            return angle;
        };
        return function (device)
        {
            let numOutputs   = Math.max(2, device.deviceDef.numOutputs || 4);
            device.halfPitch = numOutputs > 4;
            device.addInput();
            for (let i = 0; i < numOutputs; i += 1)
            {
                device.addOutput();
            }

            let super_getSize = device.getSize;
            device.getSize    = function ()
            {
                let size = super_getSize();
                return {
                    width:  unit * 4,
                    height: size.height,
                };
            };

            let super_createUI = device.createUI;
            device.createUI    = function ()
            {
                super_createUI();
                let size = device.getSize();

                let $knob = $s.createSVGElement('g')
                .attr('class', 'simcir-basicset-knob')
                .append($s.createSVGElement('rect')
                        .attr({
                                  x:      -10,
                                  y:      -10,
                                  width:  20,
                                  height: 20,
                              }));
                let r     = Math.min(size.width, size.height) / 4 * 1.5;
                let g     = $s.graphics($knob);
                g.drawCircle(0, 0, r);
                g.attr['class'] = 'simcir-basicset-knob-mark';
                g.moveTo(0, 0);
                g.lineTo(r, 0);
                g.closePath();
                device.$ui.append($knob);

                let _angle   = _MIN_ANGLE;
                let setAngle = function (angle)
                {
                    _angle = Math.max(_MIN_ANGLE, Math.min(angle, _MAX_ANGLE));
                    update();
                };

                let dragPoint             = null;
                let knob_mouseDownHandler = function (event)
                {
                    event.preventDefault();
                    event.stopPropagation();
                    dragPoint = {
                        x: event.pageX,
                        y: event.pageY,
                    };
                    $(document).on('mousemove', knob_mouseMoveHandler);
                    $(document).on('mouseup', knob_mouseUpHandler);
                };
                let knob_mouseMoveHandler = function (event)
                {
                    let off = $knob.parent('svg').offset();
                    let pos = $s.offset($knob);
                    let cx  = off.left + pos.x;
                    let cy  = off.top + pos.y;
                    let dx  = event.pageX - cx;
                    let dy  = event.pageY - cy;
                    if (dx == 0 && dy == 0)
                    {
                        return;
                    }
                    setAngle(thetaToAngle(Math.atan2(dy, dx)));
                };
                let knob_mouseUpHandler   = function (event)
                {
                    $(document).off('mousemove', knob_mouseMoveHandler);
                    $(document).off('mouseup', knob_mouseUpHandler);
                };
                device.$ui.on('deviceAdd', function ()
                {
                    $s.enableEvents($knob, true);
                    $knob.on('mousedown', knob_mouseDownHandler);
                });
                device.$ui.on('deviceRemove', function ()
                {
                    $s.enableEvents($knob, false);
                    $knob.off('mousedown', knob_mouseDownHandler);
                });

                let update = function ()
                {
                    $s.transform($knob, size.width / 2,
                                 size.height / 2, _angle + 90,
                    );
                    let max   = 1 << numOutputs;
                    let value = Math.min(((_angle - _MIN_ANGLE) /
                        (_MAX_ANGLE - _MIN_ANGLE) * max), max - 1);
                    for (let i = 0; i < numOutputs; i += 1)
                    {
                        device.getOutputs()[i].setValue((value & (1 << i)) ?
                                                            device.getInputs()[0].getValue() : null);
                    }
                };
                device.$ui.on('inputValueChange', update);
                update();
                device.doc = {
                    params: [
                        {
                            name:         'numOutputs',
                            type:         'number',
                            defaultValue: 4,
                            description:  'number of outputs.',
                        },
                    ],
                    code:   '{"type":"' + device.deviceDef.type + '","numOutputs":4}',
                };
            };
        };
    };

    // register direct current source
    $s.registerDevice('DC', function (device)
    {
        device.addOutput();
        let super_createUI = device.createUI;
        device.createUI    = function ()
        {
            super_createUI();
            device.$ui.addClass('simcir-basicset-dc');
        };
        device.$ui.on('deviceAdd', function ()
        {
            device.getOutputs()[0].setValue(onValue);
        });
        device.$ui.on('deviceRemove', function ()
        {
            device.getOutputs()[0].setValue(null);
        });
    });

    // register simple LED
    $s.registerDevice('LED', function (device)
    {
        let in1            = device.addInput();
        let super_createUI = device.createUI;
        device.createUI    = function ()
        {
            super_createUI();
            let hiColor  = device.deviceDef.color || defaultLEDColor;
            let bgColor  = device.deviceDef.bgColor || defaultLEDBgColor;
            let loColor  = multiplyColor(hiColor, bgColor, 0.25);
            let bLoColor = multiplyColor(hiColor, bgColor, 0.2);
            let bHiColor = multiplyColor(hiColor, bgColor, 0.8);
            let size     = device.getSize();
            let $ledbase = $s.createSVGElement('circle')
            .attr({
                      cx: size.width / 2,
                      cy: size.height / 2,
                      r:  size.width / 4,
                  })
            .attr('stroke', 'none')
            .attr('fill', bLoColor);
            device.$ui.append($ledbase);
            let $led = $s.createSVGElement('circle')
            .attr({
                      cx: size.width / 2,
                      cy: size.height / 2,
                      r:  size.width / 4 * 0.8,
                  })
            .attr('stroke', 'none')
            .attr('fill', loColor);
            device.$ui.append($led);
            device.$ui.on('inputValueChange', function ()
            {
                $ledbase.attr('fill', isHot(in1.getValue()) ? bHiColor : bLoColor);
                $led.attr('fill', isHot(in1.getValue()) ? hiColor : loColor);
            });
            device.doc = {
                params: [
                    {
                        name:         'color',
                        type:         'string',
                        defaultValue: defaultLEDColor,
                        description:  'color in hexadecimal.',
                    },
                    {
                        name:         'bgColor',
                        type:         'string',
                        defaultValue: defaultLEDBgColor,
                        description:  'background color in hexadecimal.',
                    },
                ],
                code:   '{"type":"' + device.deviceDef.type +
                            '","color":"' + defaultLEDColor + '"}',
            };
        };
    });

    // register switches
    $s.registerDevice('PushOff', createSwitchFactory('PushOff'));
    $s.registerDevice('PushOn', createSwitchFactory('PushOn'));
    $s.registerDevice('Toggle', createSwitchFactory('Toggle'));

    // register logic gates
    $s.registerDevice('BUF', createLogicGateFactory(null, BUF, drawBUF));
    $s.registerDevice('NOT', createLogicGateFactory(null, NOT, drawNOT));
    $s.registerDevice('AND', createLogicGateFactory(AND, BUF, drawAND));
    $s.registerDevice('NAND', createLogicGateFactory(AND, NOT, drawNAND));
    $s.registerDevice('OR', createLogicGateFactory(OR, BUF, drawOR));
    $s.registerDevice('NOR', createLogicGateFactory(OR, NOT, drawNOR));
    $s.registerDevice('XOR', createLogicGateFactory(EOR, BUF, drawEOR));
    $s.registerDevice('XNOR', createLogicGateFactory(EOR, NOT, drawENOR));
    // deprecated. not displayed in the default toolbox.
    $s.registerDevice('EOR', createLogicGateFactory(EOR, BUF, drawEOR), true);
    $s.registerDevice('ENOR', createLogicGateFactory(EOR, NOT, drawENOR), true);

    // register Oscillator
    $s.registerDevice('OSC', function (device)
    {
        let freq    = device.deviceDef.freq || 10;
        let delay   = ~~(500 / freq);
        let out1    = device.addOutput();
        let timerId = null;
        let on      = false;
        device.$ui.on('deviceAdd', function ()
        {
            timerId = window.setInterval(function ()
                                         {
                                             out1.setValue(on ? onValue : offValue);
                                             on = !on;
                                         }, delay);
        });
        device.$ui.on('deviceRemove', function ()
        {
            if (timerId != null)
            {
                window.clearInterval(timerId);
                timerId = null;
            }
        });
        let super_createUI = device.createUI;
        device.createUI    = function ()
        {
            super_createUI();
            device.$ui.addClass('simcir-basicset-osc');
            device.doc = {
                params: [
                    {
                        name:         'freq',
                        type:         'number',
                        defaultValue: '10',
                        description:  'frequency of an oscillator.',
                    },
                ],
                code:   '{"type":"' + device.deviceDef.type + '","freq":10}',
            };
        };
    });

    // register LED seg
    $s.registerDevice('7seg', createLEDSegFactory(_7Seg));
    $s.registerDevice('16seg', createLEDSegFactory(_16Seg));
    $s.registerDevice('4bit7seg', createLED4bitFactory());

    // register Rotary Encoder
    $s.registerDevice('RotaryEncoder', createRotaryEncoderFactory());

    $s.registerDevice('BusIn', function (device)
    {
        let numOutputs   = Math.max(2, device.deviceDef.numOutputs || 8);
        device.halfPitch = true;
        device.addInput('', 'x' + numOutputs);
        for (let i = 0; i < numOutputs; i += 1)
        {
            device.addOutput();
        }
        let extractValue = function (busValue, i)
        {
            return (busValue != null && typeof busValue == 'object' &&
                typeof busValue[i] != 'undefined') ? busValue[i] : null;
        };
        device.$ui.on('inputValueChange', function ()
        {
            let busValue = device.getInputs()[0].getValue();
            for (let i = 0; i < numOutputs; i += 1)
            {
                device.getOutputs()[i].setValue(extractValue(busValue, i));
            }
        });
        let super_createUI = device.createUI;
        device.createUI    = function ()
        {
            super_createUI();
            device.doc = {
                params: [
                    {
                        name:         'numOutputs',
                        type:         'number',
                        defaultValue: 8,
                        description:  'number of outputs.',
                    },
                ],
                code:   '{"type":"' + device.deviceDef.type + '","numOutputs":8}',
            };
        };
    });

    $s.registerDevice('BusOut', function (device)
    {
        let numInputs    = Math.max(2, device.deviceDef.numInputs || 8);
        device.halfPitch = true;
        for (let i = 0; i < numInputs; i += 1)
        {
            device.addInput();
        }
        device.addOutput('', 'x' + numInputs);
        device.$ui.on('inputValueChange', function ()
        {
            let busValue = [];
            let hotCount = 0;
            for (let i = 0; i < numInputs; i += 1)
            {
                let value = device.getInputs()[i].getValue();
                if (isHot(value))
                {
                    hotCount += 1;
                }
                busValue.push(value);
            }
            device.getOutputs()[0].setValue(
                (hotCount > 0) ? busValue : null);
        });
        let super_createUI = device.createUI;
        device.createUI    = function ()
        {
            super_createUI();
            device.doc = {
                params: [
                    {
                        name:         'numInputs',
                        type:         'number',
                        defaultValue: 8,
                        description:  'number of inputs.',
                    },
                ],
                code:   '{"type":"' + device.deviceDef.type + '","numInputs":8}'
            };
        };
    });

}(simcir);
