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

  return Chart.Annotation.Element.extend({
    setDataLimits: function () {
      var model = this._model;
      var options = this.options;

      // Set the data range for this annotation
      model.ranges = {};
      model.ranges[options.scaleID] = {
        min: options.value,
        max: options.endValue || options.value
      };
    },
    configure: function () {
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
      var labelConfig = labelUtil.getLabelConfig({
        x1: model.x1,
        x2: model.x2,
        y1: model.y1,
        y2: model.y2
      }, line, options, chartHelpers, ctx);
      Object.assign(model, labelConfig.model);
      Object.keys(labelConfig.ctx).forEach(function (ctxKey) {
        ctx[ctxKey] = labelConfig.ctx[ctxKey];
      });
    },
    inRange: function (mouseX, mouseY) {
      var model = this._model;

      return (
        // On the line
        model.line &&
        model.line.intersects(mouseX, mouseY, this.getHeight())
      ) || labelUtil.isOnLabel(mouseX, mouseY, model);
    },
    getCenterPoint: function () {
      return labelUtil.getCenterPoint(this._model.x1, this._model.x2, this._model.y1, this._model.y2);
    },
    getWidth: function () {
      return Math.abs(this._model.right - this._model.left);
    },
    getHeight: function () {
      return this._model.borderWidth || 1;
    },
    getArea: function () {
      return Math.sqrt(Math.pow(this.getWidth(), 2) + Math.pow(this.getHeight(), 2));
    },
    draw: function () {
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
};
