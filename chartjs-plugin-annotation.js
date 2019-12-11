/*@preserve!
 * chartjs-plugin-annotation.js
 * http://chartjs.org/
 * Version: 0.5.7
 *
 * Copyright 2016 Evert Timberg
 * Released under the MIT license
 * https://github.com/chartjs/Chart.Annotation.js/blob/master/LICENSE.md
 */
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
module.exports = function(Chart) {
	/* eslint-disable global-require */
	var chartHelpers = Chart.helpers;

	var helpers = require('./helpers.js')(Chart);
	var events = require('./events.js')(Chart);
	/* eslint-enable global-require */

	var annotationTypes = Chart.Annotation.types;

	function setAfterDataLimitsHook(axisOptions) {
		helpers.decorate(axisOptions, 'afterDataLimits', function(previous, scale) {
			if (previous) {
				previous(scale);
			}
			helpers.adjustScaleRange(scale);
		});
	}

	function draw(drawTime) {
		return function(chartInstance, easingDecimal) {
			var defaultDrawTime = chartInstance.annotation.options.drawTime;

			helpers.elements(chartInstance)
				.filter(function(element) {
					return drawTime === (element.options.drawTime || defaultDrawTime);
				})
				.forEach(function(element) {
					element.configure();
					element.transition(easingDecimal).draw();
				});
		};
	}

	function getAnnotationConfig(chartOptions) {
		var plugins = chartOptions.plugins;
		var pluginAnnotation = plugins && plugins.annotation ? plugins.annotation : null;
		return pluginAnnotation || chartOptions.annotation || {};
	}

	return {
		id: 'annotation',
		beforeInit: function(chartInstance) {
			var chartOptions = chartInstance.options;

			// Initialize chart instance plugin namespace
			var ns = chartInstance.annotation = {
				elements: {},
				options: helpers.initConfig(getAnnotationConfig(chartOptions)),
				onDestroy: [],
				firstRun: true,
				supported: false
			};

			// Add the annotation scale adjuster to each scale's afterDataLimits hook
			chartInstance.ensureScalesHaveIDs();
			if (chartOptions.scales) {
				ns.supported = true;
				chartHelpers.each(chartOptions.scales.xAxes, setAfterDataLimitsHook);
				chartHelpers.each(chartOptions.scales.yAxes, setAfterDataLimitsHook);
			}
		},
		beforeUpdate: function(chartInstance) {
			var ns = chartInstance.annotation;

			if (!ns.supported) {
				return;
			}

			if (!ns.firstRun) {
				ns.options = helpers.initConfig(getAnnotationConfig(chartInstance.options));
			} else {
				ns.firstRun = false;
			}

			var elementIds = [];

			// Add new elements, or update existing ones
			ns.options.annotations.forEach(function(annotation) {
				var id = annotation.id || helpers.objectId();

				// No element with that ID exists, and it's a valid annotation type
				if (!ns.elements[id] && annotationTypes[annotation.type]) {
					var cls = annotationTypes[annotation.type];
					var element = new cls({
						id: id,
						options: annotation,
						chartInstance: chartInstance,
					});
					element.initialize();
					ns.elements[id] = element;
					annotation.id = id;
					elementIds.push(id);
				} else if (ns.elements[id]) {
					// Nothing to do for update, since the element config references
					// the same object that exists in the chart annotation config
					elementIds.push(id);
				}
			});

			// Delete removed elements
			Object.keys(ns.elements).forEach(function(id) {
				if (elementIds.indexOf(id) === -1) {
					ns.elements[id].destroy();
					delete ns.elements[id];
				}
			});
		},
		beforeDatasetsDraw: draw('beforeDatasetsDraw'),
		afterDatasetsDraw: draw('afterDatasetsDraw'),
		afterDraw: draw('afterDraw'),
		afterInit: function(chartInstance) {
			// Detect and intercept events that happen on an annotation element
			var watchFor = chartInstance.annotation.options.events;
			if (chartHelpers.isArray(watchFor) && watchFor.length > 0) {
				var canvas = chartInstance.chart.canvas;
				var eventHandler = events.dispatcher.bind(chartInstance);
				events.collapseHoverEvents(watchFor).forEach(function(eventName) {
					chartHelpers.addEvent(canvas, eventName, eventHandler);
					chartInstance.annotation.onDestroy.push(function() {
						chartHelpers.removeEvent(canvas, eventName, eventHandler);
					});
				});
			}
		},
		destroy: function(chartInstance) {
			if (!chartInstance || !chartInstance.annotation) {
				return;
			}
			var deregisterers = chartInstance.annotation.onDestroy;
			while (deregisterers.length > 0) {
				deregisterers.pop()();
			}
		}
	};
};

},{"./events.js":4,"./helpers.js":5}],3:[function(require,module,exports){
module.exports = function(Chart) {
	var chartHelpers = Chart.helpers;

	var AnnotationElement = Chart.Element.extend({
		initialize: function() {
			this.hidden = false;
			this.hovering = false;
			this._model = chartHelpers.clone(this._model) || {};
			this.setDataLimits();
		},
		destroy: function() {},
		setDataLimits: function() {},
		configure: function() {},
		inRange: function() {},
		getCenterPoint: function() {},
		getWidth: function() {},
		getHeight: function() {},
		getArea: function() {},
		draw: function() {}
	});

	return AnnotationElement;
};

},{}],4:[function(require,module,exports){
module.exports = function(Chart) {
	/* eslint-disable global-require */
	var chartHelpers = Chart.helpers;
	var helpers = require('./helpers.js')(Chart);
	/* eslint-enable global-require */

	function collapseHoverEvents(events) {
		var hover = false;
		var filteredEvents = events.filter(function(eventName) {
			switch (eventName) {
			case 'mouseenter':
			case 'mouseover':
			case 'mouseout':
			case 'mouseleave':
				hover = true;
				return false;

			default:
				return true;
			}
		});
		if (hover && filteredEvents.indexOf('mousemove') === -1) {
			filteredEvents.push('mousemove');
		}
		return filteredEvents;
	}

	function dispatcher(e) {
		var ns = this.annotation;
		var elements = helpers.elements(this);
		var position = chartHelpers.getRelativePosition(e, this.chart);
		var element = helpers.getNearestItems(elements, position);
		var events = collapseHoverEvents(ns.options.events);
		var dblClickSpeed = ns.options.dblClickSpeed;
		var eventHandlers = [];
		var eventHandlerName = helpers.getEventHandlerName(e.type);
		var options = (element || {}).options;

		// Detect hover events
		if (e.type === 'mousemove') {
			if (element && !element.hovering) {
				// hover started
				['mouseenter', 'mouseover'].forEach(function(eventName) {
					var handlerName = helpers.getEventHandlerName(eventName);
					var hoverEvent = helpers.createMouseEvent(eventName, e); // recreate the event to match the handler
					element.hovering = true;
					if (typeof options[handlerName] === 'function') {
						eventHandlers.push([options[handlerName], hoverEvent, element]);
					}
				});
			} else if (!element) {
				// hover ended
				elements.forEach(function(el) {
					if (el.hovering) {
						el.hovering = false;
						var opt = el.options;
						['mouseout', 'mouseleave'].forEach(function(eventName) {
							var handlerName = helpers.getEventHandlerName(eventName);
							var hoverEvent = helpers.createMouseEvent(eventName, e); // recreate the event to match the handler
							if (typeof opt[handlerName] === 'function') {
								eventHandlers.push([opt[handlerName], hoverEvent, el]);
							}
						});
					}
				});
			}
		}

		// Suppress duplicate click events during a double click
		// 1. click -> 2. click -> 3. dblclick
		//
		// 1: wait dblClickSpeed ms, then fire click
		// 2: cancel (1) if it is waiting then wait dblClickSpeed ms then fire click, else fire click immediately
		// 3: cancel (1) or (2) if waiting, then fire dblclick
		if (element && events.indexOf('dblclick') > -1 && typeof options.onDblclick === 'function') {
			if (e.type === 'click' && typeof options.onClick === 'function') {
				clearTimeout(element.clickTimeout);
				element.clickTimeout = setTimeout(function() {
					delete element.clickTimeout;
					options.onClick.call(element, e);
				}, dblClickSpeed);
				e.stopImmediatePropagation();
				e.preventDefault();
				return;
			} else if (e.type === 'dblclick' && element.clickTimeout) {
				clearTimeout(element.clickTimeout);
				delete element.clickTimeout;
			}
		}

		// Dispatch the event to the usual handler, but only if we haven't substituted it
		if (element && typeof options[eventHandlerName] === 'function' && eventHandlers.length === 0) {
			eventHandlers.push([options[eventHandlerName], e, element]);
		}

		if (eventHandlers.length > 0) {
			e.stopImmediatePropagation();
			e.preventDefault();
			eventHandlers.forEach(function(eventHandler) {
				// [handler, event, element]
				eventHandler[0].call(eventHandler[2], eventHandler[1]);
			});
		}
	}

	return {
		dispatcher: dispatcher,
		collapseHoverEvents: collapseHoverEvents
	};
};

},{"./helpers.js":5}],5:[function(require,module,exports){
function noop() {}

function elements(chartInstance) {
	// Turn the elements object into an array of elements
	var els = chartInstance.annotation.elements;
	return Object.keys(els).map(function(id) {
		return els[id];
	});
}

function objectId() {
	return Math.random().toString(36).substr(2, 6);
}

function isValid(rawValue) {
	if (rawValue === null || typeof rawValue === 'undefined') {
		return false;
	} else if (typeof rawValue === 'number') {
		return isFinite(rawValue);
	}
	return !!rawValue;
}

function decorate(obj, prop, func) {
	var prefix = '$';
	if (!obj[prefix + prop]) {
		if (obj[prop]) {
			obj[prefix + prop] = obj[prop].bind(obj);
			obj[prop] = function() {
				var args = [obj[prefix + prop]].concat(Array.prototype.slice.call(arguments));
				return func.apply(obj, args);
			};
		} else {
			obj[prop] = function() {
				var args = [undefined].concat(Array.prototype.slice.call(arguments));
				return func.apply(obj, args);
			};
		}
	}
}

function callEach(fns, method) {
	fns.forEach(function(fn) {
		(method ? fn[method] : fn)();
	});
}

function getEventHandlerName(eventName) {
	return 'on' + eventName[0].toUpperCase() + eventName.substring(1);
}

function createMouseEvent(type, previousEvent) {
	try {
		return new MouseEvent(type, previousEvent);
	} catch (exception) {
		try {
			var m = document.createEvent('MouseEvent');
			m.initMouseEvent(
				type,
				previousEvent.canBubble,
				previousEvent.cancelable,
				previousEvent.view,
				previousEvent.detail,
				previousEvent.screenX,
				previousEvent.screenY,
				previousEvent.clientX,
				previousEvent.clientY,
				previousEvent.ctrlKey,
				previousEvent.altKey,
				previousEvent.shiftKey,
				previousEvent.metaKey,
				previousEvent.button,
				previousEvent.relatedTarget
			);
			return m;
		} catch (exception2) {
			var e = document.createEvent('Event');
			e.initEvent(
				type,
				previousEvent.canBubble,
				previousEvent.cancelable
			);
			return e;
		}
	}
}

module.exports = function(Chart) {
	var chartHelpers = Chart.helpers;

	function initConfig(config) {
		config = chartHelpers.configMerge(Chart.Annotation.defaults, config);
		if (chartHelpers.isArray(config.annotations)) {
			config.annotations.forEach(function(annotation) {
				annotation.label = chartHelpers.configMerge(Chart.Annotation.labelDefaults, annotation.label);
			});
		}
		return config;
	}

	function getScaleLimits(scaleId, annotations, scaleMin, scaleMax) {
		var ranges = annotations.filter(function(annotation) {
			return !!annotation._model.ranges[scaleId];
		}).map(function(annotation) {
			return annotation._model.ranges[scaleId];
		});

		var min = ranges.map(function(range) {
			return Number(range.min);
		}).reduce(function(a, b) {
			return isFinite(b) && !isNaN(b) && b < a ? b : a;
		}, scaleMin);

		var max = ranges.map(function(range) {
			return Number(range.max);
		}).reduce(function(a, b) {
			return isFinite(b) && !isNaN(b) && b > a ? b : a;
		}, scaleMax);

		return {
			min: min,
			max: max
		};
	}

	function adjustScaleRange(scale) {
		// Adjust the scale range to include annotation values
		var range = getScaleLimits(scale.id, elements(scale.chart), scale.min, scale.max);
		if (typeof scale.options.ticks.min === 'undefined' && typeof scale.options.ticks.suggestedMin === 'undefined') {
			scale.min = range.min;
		}
		if (typeof scale.options.ticks.max === 'undefined' && typeof scale.options.ticks.suggestedMax === 'undefined') {
			scale.max = range.max;
		}
		if (scale.handleTickRangeOptions) {
			scale.handleTickRangeOptions();
		}
	}

	function getNearestItems(annotations, position) {
		var minDistance = Number.POSITIVE_INFINITY;

		return annotations
			.filter(function(element) {
				return element.inRange(position.x, position.y);
			})
			.reduce(function(nearestItems, element) {
				var center = element.getCenterPoint();
				var distance = chartHelpers.distanceBetweenPoints(position, center);

				if (distance < minDistance) {
					nearestItems = [element];
					minDistance = distance;
				} else if (distance === minDistance) {
					// Can have multiple items at the same distance in which case we sort by size
					nearestItems.push(element);
				}

				return nearestItems;
			}, [])
			.sort(function(a, b) {
				// If there are multiple elements equally close,
				// sort them by size, then by index
				var sizeA = a.getArea();
				var sizeB = b.getArea();
				return (sizeA > sizeB || sizeA < sizeB) ? sizeA - sizeB : a._index - b._index;
			})
			.slice(0, 1)[0]; // return only the top item
	}

	return {
		initConfig: initConfig,
		elements: elements,
		callEach: callEach,
		noop: noop,
		objectId: objectId,
		isValid: isValid,
		decorate: decorate,
		adjustScaleRange: adjustScaleRange,
		getNearestItems: getNearestItems,
		getEventHandlerName: getEventHandlerName,
		createMouseEvent: createMouseEvent
	};
};


},{}],6:[function(require,module,exports){
// Get the chart variable
var Chart = require('chart.js');
Chart = typeof Chart === 'function' ? Chart : window.Chart;

// Configure plugin namespace
Chart.Annotation = Chart.Annotation || {};

Chart.Annotation.drawTimeOptions = {
	afterDraw: 'afterDraw',
	afterDatasetsDraw: 'afterDatasetsDraw',
	beforeDatasetsDraw: 'beforeDatasetsDraw'
};

Chart.Annotation.defaults = {
	drawTime: 'afterDatasetsDraw',
	dblClickSpeed: 350, // ms
	events: [],
	annotations: []
};

Chart.Annotation.labelDefaults = {
	backgroundColor: 'rgba(0,0,0,0.8)',
	fontFamily: Chart.defaults.global.defaultFontFamily,
	fontSize: Chart.defaults.global.defaultFontSize,
	fontStyle: 'bold',
	fontColor: '#fff',
	xPadding: 6,
	yPadding: 6,
	cornerRadius: 6,
	position: 'center',
	xAdjust: 0,
	yAdjust: 0,
	enabled: false,
	content: null
};

Chart.Annotation.Element = require('./element.js')(Chart);

/* eslint-disable global-require */
Chart.Annotation.types = {
	line: require('./types/line.js')(Chart),
	box: require('./types/box.js')(Chart)
};
/* eslint-enable global-require */

var annotationPlugin = require('./annotation.js')(Chart);

module.exports = annotationPlugin;
Chart.pluginService.register(annotationPlugin);

},{"./annotation.js":2,"./element.js":3,"./types/box.js":8,"./types/line.js":9,"chart.js":1}],7:[function(require,module,exports){
var util = require('./util.js');

function calculateLabelPositionForLine(labelModel, range, annotation, mode, textWidth, textHeight) {
  var position = {};
  var deltaX = 0;
  var deltaY = 0;

  switch (true) {
    // top align
    case mode === util.verticalKeyword && labelModel.labelPosition === 'top':
      deltaX = (textWidth / 2) + labelModel.labelXAdjust;
      deltaY = labelModel.labelYPadding + labelModel.labelYAdjust;
      position.y = range.y1 + deltaY;
      position.x = (isFinite(annotation.m) ? annotation.getX(position.y) : range.x1) - deltaX;
      break;

    // bottom align
    case mode === util.verticalKeyword && labelModel.labelPosition === 'bottom':
      deltaX = (textWidth / 2) + labelModel.labelXAdjust;
      deltaY = textHeight + labelModel.labelYPadding + labelModel.labelYAdjust;
      position.y = range.y2 - deltaY;
      position.x = (isFinite(annotation.m) ? annotation.getX(position.y) : range.x1) - deltaX;
      break;

    // left align
    case mode === util.horizontalKeyword && labelModel.labelPosition === 'left':
      deltaX = labelModel.labelXPadding + labelModel.labelXAdjust;
      deltaY = -(textHeight / 2) + labelModel.labelYAdjust;
      position.x = range.x1 + deltaX;
      position.y = annotation.getY(position.x) + deltaY;
      break;

    // right align
    case mode === util.horizontalKeyword && labelModel.labelPosition === 'right':
      deltaX = textWidth + labelModel.labelXPadding + labelModel.labelXAdjust;
      deltaY = -(textHeight / 2) + labelModel.labelYAdjust;
      position.x = range.x2 - deltaX;
      position.y = annotation.getY(position.x) + deltaY;
      break;

    // center align
    default:
      var centerPoint = getCenterPoint(range.x1, range.x2, range.y1, range.y2, textWidth, textHeight);
      centerPoint.x += labelModel.labelXAdjust;
      centerPoint.y += labelModel.labelYAdjust;
      Object.assign(position, centerPoint);
  }

  return position;
}

function calculateLabelPositionForBox(labelModel, range, annotation, textWidth, textHeight) {
  var position = {};
  var deltaX = 0;
  var deltaY = 0;

  switch (labelModel.labelPosition) {
    // top align
    case 'top':
      deltaX = -(textWidth / 2);
      deltaY = labelModel.labelYPadding - (textHeight * 2);
      position.y = range.y1 + deltaY + labelModel.labelYAdjust;
      position.x = annotation.getX() + deltaX + labelModel.labelXAdjust;
      break;

    // bottom align
    case 'bottom':
      deltaX = -(textWidth / 2);
      deltaY = textHeight - labelModel.labelYPadding;
      position.y = range.y2 + deltaY + labelModel.labelYAdjust;
      position.x = annotation.getX() + deltaX + labelModel.labelXAdjust;
      break;

    // left align
    case 'left':
      deltaX = -textWidth - labelModel.labelXPadding;
      deltaY = -(textHeight / 2);
      position.x = range.x1 + deltaX + labelModel.labelXAdjust;
      position.y = annotation.getY() + deltaY + labelModel.labelYAdjust;
      break;

    // right align
    case 'right':
      deltaX = labelModel.labelXPadding;
      deltaY = -(textHeight / 2);
      position.x = range.x2 + deltaX + labelModel.labelXAdjust;
      position.y = annotation.getY() + deltaY + labelModel.labelYAdjust;
      break;

    // center align
    default:
      var centerPoint = getCenterPoint(range.x1, range.x2, range.y1, range.y2, textWidth, textHeight);
      centerPoint.x += labelModel.labelXAdjust;
      centerPoint.y += labelModel.labelYAdjust;
      Object.assign(position, centerPoint);
  }

  return position;
}

function calculateLabelPosition(labelModel, range, annotation, mode, textWidth, textHeight) {
  if (annotation.type === 'line') {
    return calculateLabelPositionForLine(labelModel, range, annotation, mode, textWidth, textHeight);
  } else if (annotation.type === 'box') {
    return calculateLabelPositionForBox(labelModel, range, annotation, textWidth, textHeight);
  } else {
    return {
      x: 0,
      y: 0,
    }
  }
}

function getCenterPoint(left, right, bottom, top, width, height) {
  return {
    x: (right + left - (width || 0)) / 2,
    y: (bottom + top - (height || 0)) / 2
  };
}

function getLabelConfig(range, annotation, options, chartHelpers, ctx) {
  var labelOptions = options.label || {};

  var labelModel = {
    labelBackgroundColor: labelOptions.backgroundColor,
    labelFontFamily: labelOptions.fontFamily,
    labelFontSize: labelOptions.fontSize,
    labelFontStyle: labelOptions.fontStyle,
    labelFontColor: labelOptions.fontColor,
    labelXPadding: labelOptions.xPadding,
    labelYPadding: labelOptions.yPadding,
    labelCornerRadius: labelOptions.cornerRadius,
    labelPosition: labelOptions.position,
    labelXAdjust: labelOptions.xAdjust,
    labelYAdjust: labelOptions.yAdjust,
    labelEnabled: labelOptions.enabled,
    labelContent: labelOptions.content,
  };

  var font = chartHelpers.fontString(labelModel.labelFontSize, labelModel.labelFontStyle, labelModel.labelFontFamily);
  var textWidth = ctx.measureText(labelModel.labelContent).width;
  var textHeight = labelModel.labelFontSize;
  labelModel.labelHeight = textHeight + (2 * labelModel.labelYPadding);

  if (labelModel.labelContent && chartHelpers.isArray(labelModel.labelContent)) {
    var labelContentArray = labelModel.labelContent.slice(0);
    var longestLabel = labelContentArray.sort(function (a, b) {
      return b.length - a.length;
    })[0];
    textWidth = ctx.measureText(longestLabel).width;

    labelModel.labelHeight = (textHeight * labelModel.labelContent.length) + (2 * labelModel.labelYPadding);
    // Add padding in between each label item
    labelModel.labelHeight += labelModel.labelYPadding * (labelModel.labelContent.length - 1);
  }

  var labelPosition = calculateLabelPosition(labelModel, range, annotation, options.mode, textWidth, textHeight);
  labelModel.labelX = labelPosition.x - labelModel.labelXPadding;
  labelModel.labelY = labelPosition.y - labelModel.labelYPadding;
  labelModel.labelWidth = textWidth + (2 * labelModel.labelXPadding);

  labelModel.borderColor = options.borderColor;
  labelModel.borderWidth = options.borderWidth;
  labelModel.borderDash = options.borderDash || [];
  labelModel.borderDashOffset = options.borderDashOffset || 0;

  return {
    model: labelModel,
    ctx: {
      font: font,
    }
  }
}

function drawLabel(view, ctx, chartHelpers) {
  if (view.labelEnabled && view.labelContent) {
    ctx.beginPath();
    ctx.rect(view.clip.x1, view.clip.y1, view.clip.x2 - view.clip.x1, view.clip.y2 - view.clip.y1);
    ctx.clip();

    ctx.fillStyle = view.labelBackgroundColor;
    // Draw the tooltip
    chartHelpers.drawRoundedRectangle(
      ctx,
      view.labelX, // x
      view.labelY, // y
      view.labelWidth, // width
      view.labelHeight, // height
      view.labelCornerRadius // radius
    );
    ctx.fill();

    // Draw the text
    ctx.font = chartHelpers.fontString(
      view.labelFontSize,
      view.labelFontStyle,
      view.labelFontFamily
    );
    ctx.fillStyle = view.labelFontColor;
    ctx.textAlign = 'center';

    if (view.labelContent && chartHelpers.isArray(view.labelContent)) {
      var textYPosition = view.labelY + view.labelYPadding;
      for (var i = 0; i < view.labelContent.length; i++) {
        ctx.textBaseline = 'top';
        ctx.fillText(
          view.labelContent[i],
          view.labelX + (view.labelWidth / 2),
          textYPosition
        );

        textYPosition += view.labelFontSize + view.labelYPadding;
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillText(
        view.labelContent,
        view.labelX + (view.labelWidth / 2),
        view.labelY + (view.labelHeight / 2)
      );
    }
  }
}

function isOnLabel(mouseX, mouseY, model) {
  return model.labelEnabled &&
    model.labelContent &&
    mouseX >= model.labelX &&
    mouseX <= model.labelX + model.labelWidth &&
    mouseY >= model.labelY &&
    mouseY <= model.labelY + model.labelHeight;
}

module.exports = {
  getLabelConfig: getLabelConfig,
  getCenterPoint: getCenterPoint,
  drawLabel: drawLabel,
  isOnLabel: isOnLabel,
};

},{"./util.js":10}],8:[function(require,module,exports){
// Box Annotation implementation
module.exports = function(Chart) {
	/* eslint-disable global-require */
	var helpers = require('../helpers.js')(Chart);
	var labelUtil = require('../labelUtil.js');
	var chartHelpers = Chart.helpers;
	/* eslint-enable global-require */

	function BoxFunction(view) {
		this.type = 'box';

		// Describe the box as left, right, bottom and top values

		this.getX = function() {
			// get centered x coordinate of the box
			return (view.left + view.right) / 2;
		};

		this.getY = function() {
			// get centered y coordinate of the box
			return (view.bottom + view.top) / 2;
		};
	}

	var BoxAnnotation = Chart.Annotation.Element.extend({
		setDataLimits: function() {
			var model = this._model;
			var options = this.options;
			var chartInstance = this.chartInstance;

			var xScale = chartInstance.scales[options.xScaleID];
			var yScale = chartInstance.scales[options.yScaleID];
			var chartArea = chartInstance.chartArea;

			// Set the data range for this annotation
			model.ranges = {};

			if (!chartArea) {
				return;
			}

			var min = 0;
			var max = 0;

			if (xScale) {
				min = helpers.isValid(options.xMin) ? options.xMin : xScale.getValueForPixel(chartArea.left);
				max = helpers.isValid(options.xMax) ? options.xMax : xScale.getValueForPixel(chartArea.right);

				model.ranges[options.xScaleID] = {
					min: Math.min(min, max),
					max: Math.max(min, max)
				};
			}

			if (yScale) {
				min = helpers.isValid(options.yMin) ? options.yMin : yScale.getValueForPixel(chartArea.bottom);
				max = helpers.isValid(options.yMax) ? options.yMax : yScale.getValueForPixel(chartArea.top);

				model.ranges[options.yScaleID] = {
					min: Math.min(min, max),
					max: Math.max(min, max)
				};
			}
		},
		configure: function() {
			var model = this._model;
			var options = this.options;
			var chartInstance = this.chartInstance;

			var xScale = chartInstance.scales[options.xScaleID];
			var yScale = chartInstance.scales[options.yScaleID];
			var chartArea = chartInstance.chartArea;
			var ctx = chartInstance.chart.ctx;

			// clip annotations to the chart area
			model.clip = {
				x1: chartArea.left,
				x2: chartArea.right,
				y1: chartArea.top,
				y2: chartArea.bottom
			};

			var left = chartArea.left;
			var top = chartArea.top;
			var right = chartArea.right;
			var bottom = chartArea.bottom;

			var min, max;

			if (xScale) {
				min = helpers.isValid(options.xMin) ? xScale.getPixelForValue(options.xMin) : chartArea.left;
				max = helpers.isValid(options.xMax) ? xScale.getPixelForValue(options.xMax) : chartArea.right;
				left = Math.min(min, max);
				right = Math.max(min, max);
			}

			if (yScale) {
				min = helpers.isValid(options.yMin) ? yScale.getPixelForValue(options.yMin) : chartArea.bottom;
				max = helpers.isValid(options.yMax) ? yScale.getPixelForValue(options.yMax) : chartArea.top;
				top = Math.min(min, max);
				bottom = Math.max(min, max);
			}

			// Ensure model has rect coordinates
			model.left = left;
			model.top = top;
			model.right = right;
			model.bottom = bottom;

			// Figure out the label:
			var labelConfig = labelUtil.getLabelConfig({x1: left, x2: right, y1: top, y2: bottom}, new BoxFunction(model), options, chartHelpers, ctx);
			Object.assign(model, labelConfig.model);
			Object.keys(labelConfig.ctx).forEach(function(ctxKey) {
				ctx[ctxKey] = labelConfig.ctx[ctxKey];
			});

			// Stylistic options
			model.borderColor = options.borderColor;
			model.borderWidth = options.borderWidth;
			model.backgroundColor = options.backgroundColor;
		},
		inRange: function(mouseX, mouseY) {
			var model = this._model;
			return (model &&
				mouseX >= model.left &&
				mouseX <= model.right &&
				mouseY >= model.top &&
				mouseY <= model.bottom) || labelUtil.isOnLabel(mouseX, mouseY, model);
		},
		getCenterPoint: function() {
			var model = this._model;
			return labelUtil.getCenterPoint(model.left, model.right, model.bottom, model.top);
		},
		getWidth: function() {
			var model = this._model;
			return Math.abs(model.right - model.left);
		},
		getHeight: function() {
			var model = this._model;
			return Math.abs(model.bottom - model.top);
		},
		getArea: function() {
			return this.getWidth() * this.getHeight();
		},
		draw: function() {
			var view = this._view;
			var ctx = this.chartInstance.chart.ctx;

			ctx.save();

			// Canvas setup
			ctx.beginPath();
			ctx.rect(view.clip.x1, view.clip.y1, view.clip.x2 - view.clip.x1, view.clip.y2 - view.clip.y1);
			ctx.clip();

			ctx.lineWidth = view.borderWidth;
			ctx.strokeStyle = view.borderColor;
			ctx.fillStyle = view.backgroundColor;

			// Draw
			var width = view.right - view.left;
			var height = view.bottom - view.top;
			ctx.fillRect(view.left, view.top, width, height);
			ctx.strokeRect(view.left, view.top, width, height);

			labelUtil.drawLabel(view, ctx, chartHelpers);

			ctx.restore();
		}
	});

	return BoxAnnotation;
};

},{"../helpers.js":5,"../labelUtil.js":7}],9:[function(require,module,exports){
// Line Annotation implementation
module.exports = function(Chart) {
	/* eslint-disable global-require */
	var labelUtil = require('../labelUtil.js');
	var util = require('../util.js');
	var chartHelpers = Chart.helpers;
	var helpers = require('../helpers.js')(Chart);
	/* eslint-enable global-require */

	function LineFunction(view) {
		this.type = 'line';

		// Describe the line in slope-intercept form (y = mx + b).
		// Note that the axes are rotated 90° CCW, which causes the
		// x- and y-axes to be swapped.
		var m = (view.x2 - view.x1) / (view.y2 - view.y1);
		var b = view.x1 || 0;

		this.m = m;
		this.b = b;

		this.getX = function(y) {
			// Coordinates are relative to the origin of the canvas
			return m * (y - view.y1) + b;
		};

		this.getY = function(x) {
			return ((x - b) / m) + view.y1;
		};

		this.intersects = function(x, y, epsilon) {
			epsilon = epsilon || 0.001;
			var dy = this.getY(x);
			var dx = this.getX(y);
			return (
				(!isFinite(dy) || Math.abs(y - dy) < epsilon) &&
				(!isFinite(dx) || Math.abs(x - dx) < epsilon)
			);
		};
	}

	var LineAnnotation = Chart.Annotation.Element.extend({
		setDataLimits: function() {
			var model = this._model;
			var options = this.options;

			// Set the data range for this annotation
			model.ranges = {};
			model.ranges[options.scaleID] = {
				min: options.value,
				max: options.endValue || options.value
			};
		},
		configure: function() {
			var model = this._model;
			var options = this.options;
			var chartInstance = this.chartInstance;
			var ctx = chartInstance.chart.ctx;

			var scale = chartInstance.scales[options.scaleID];
			var pixel, endPixel;
			if (scale) {
				pixel = helpers.isValid(options.value) ? scale.getPixelForValue(options.value, options.value.index) : NaN;
				endPixel = helpers.isValid(options.endValue) ? scale.getPixelForValue(options.endValue, options.value.index) : pixel;
			}

			if (isNaN(pixel)) {
				return;
			}

			var chartArea = chartInstance.chartArea;

			// clip annotations to the chart area
			model.clip = {
				x1: chartArea.left,
				x2: chartArea.right,
				y1: chartArea.top,
				y2: chartArea.bottom
			};

			if (this.options.mode === util.horizontalKeyword) {
				model.x1 = chartArea.left;
				model.x2 = chartArea.right;
				model.y1 = pixel;
				model.y2 = endPixel;
			} else {
				model.y1 = chartArea.top;
				model.y2 = chartArea.bottom;
				model.x1 = pixel;
				model.x2 = endPixel;
			}

			var line = new LineFunction(model);
			model.line = line;
			model.mode = options.mode;

			// Figure out the label:
			var labelConfig = labelUtil.getLabelConfig({x1: model.x1, x2: model.x2, y1: model.y1, y2: model.y2}, line, options, chartHelpers, ctx);
			Object.assign(model, labelConfig.model);
			Object.keys(labelConfig.ctx).forEach(function(ctxKey) {
				ctx[ctxKey] = labelConfig.ctx[ctxKey];
			});
		},
		inRange: function(mouseX, mouseY) {
			var model = this._model;

			return (
				// On the line
				model.line &&
				model.line.intersects(mouseX, mouseY, this.getHeight())
			) || labelUtil.isOnLabel(mouseX, mouseY, model);
		},
		getCenterPoint: function() {
			return labelUtil.getCenterPoint(this._model.x1, this._model.x2, this._model.y1, this._model.y2);
		},
		getWidth: function() {
			return Math.abs(this._model.right - this._model.left);
		},
		getHeight: function() {
			return this._model.borderWidth || 1;
		},
		getArea: function() {
			return Math.sqrt(Math.pow(this.getWidth(), 2) + Math.pow(this.getHeight(), 2));
		},
		draw: function() {
			var view = this._view;
			var ctx = this.chartInstance.chart.ctx;

			if (!view.clip) {
				return;
			}

			ctx.save();

			// Canvas setup
			ctx.beginPath();
			ctx.rect(view.clip.x1, view.clip.y1, view.clip.x2 - view.clip.x1, view.clip.y2 - view.clip.y1);
			ctx.clip();

			ctx.lineWidth = view.borderWidth;
			ctx.strokeStyle = view.borderColor;

			if (ctx.setLineDash) {
				ctx.setLineDash(view.borderDash);
			}
			ctx.lineDashOffset = view.borderDashOffset;

			// Draw
			ctx.beginPath();
			ctx.moveTo(view.x1, view.y1);
			ctx.lineTo(view.x2, view.y2);
			ctx.stroke();

			labelUtil.drawLabel(view, ctx, chartHelpers);

			ctx.restore();
		}
	});

	return LineAnnotation;
};

},{"../helpers.js":5,"../labelUtil.js":7,"../util.js":10}],10:[function(require,module,exports){
var horizontalKeyword = 'horizontal';
var verticalKeyword = 'vertical';

module.exports = {
  horizontalKeyword: horizontalKeyword,
  verticalKeyword: verticalKeyword,
};

},{}]},{},[6]);
