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

	return Chart.Annotation.Element.extend({
		setDataLimits: function () {
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
		configure: function () {
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
			var labelConfig = labelUtil.getLabelConfig({
				x1: left,
				x2: right,
				y1: top,
				y2: bottom
			}, new BoxFunction(model), options, chartHelpers, ctx);
			Object.assign(model, labelConfig.model);
			Object.keys(labelConfig.ctx).forEach(function (ctxKey) {
				ctx[ctxKey] = labelConfig.ctx[ctxKey];
			});

			// Stylistic options
			model.borderColor = options.borderColor;
			model.borderWidth = options.borderWidth;
			model.backgroundColor = options.backgroundColor;
		},
		inRange: function (mouseX, mouseY) {
			var model = this._model;
			return (model &&
				mouseX >= model.left &&
				mouseX <= model.right &&
				mouseY >= model.top &&
				mouseY <= model.bottom) || labelUtil.isOnLabel(mouseX, mouseY, model);
		},
		getCenterPoint: function () {
			var model = this._model;
			return labelUtil.getCenterPoint(model.left, model.right, model.bottom, model.top);
		},
		getWidth: function () {
			var model = this._model;
			return Math.abs(model.right - model.left);
		},
		getHeight: function () {
			var model = this._model;
			return Math.abs(model.bottom - model.top);
		},
		getArea: function () {
			return this.getWidth() * this.getHeight();
		},
		draw: function () {
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
};
