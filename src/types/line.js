// Line Annotation implementation
module.exports = function(Chart) {
	/* eslint-disable global-require */
	var chartHelpers = Chart.helpers;
	var helpers = require('../helpers.js')(Chart);
	/* eslint-enable global-require */

	var horizontalKeyword = 'horizontal';
	var verticalKeyword = 'vertical';

	function LineFunction(view) {
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

	function calculateLabelPosition(view, width, height, padWidth, padHeight, x1, x2, y1, y2) {
		var line = view.line;
		var ret = {};
		var xa = 0;
		var ya = 0;

		switch (true) {
		// top align
		case view.mode === verticalKeyword && view.labelPosition === 'top':
			ya = padHeight + view.labelYAdjust;
			xa = (width / 2) + view.labelXAdjust;
			ret.y = y1 + ya;
			ret.x = (isFinite(line.m) ? line.getX(ret.y) : x1) - xa;
			break;

		// bottom align
		case view.mode === verticalKeyword && view.labelPosition === 'bottom':
			ya = height + padHeight + view.labelYAdjust;
			xa = (width / 2) + view.labelXAdjust;
			ret.y = y2 - ya;
			ret.x = (isFinite(line.m) ? line.getX(ret.y) : x1) - xa;
			break;

		// left align
		case view.mode === horizontalKeyword && view.labelPosition === 'left':
			xa = padWidth + view.labelXAdjust;
			ya = -(height / 2) + view.labelYAdjust;
			ret.x = x1 + xa;
			ret.y = line.getY(ret.x) + ya;
			break;

		// right align
		case view.mode === horizontalKeyword && view.labelPosition === 'right':
			xa = width + padWidth + view.labelXAdjust;
			ya = -(height / 2) + view.labelYAdjust;
			ret.x = x2 - xa;
			ret.y = line.getY(ret.x) + ya;
			break;

		// center align
		default:
			ret.x = ((x1 + x2 - width) / 2) + view.labelXAdjust;
			ret.y = ((y1 + y2 - height) / 2) + view.labelYAdjust;
		}

		return ret;
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

			if (this.options.mode === horizontalKeyword) {
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

			model.line = new LineFunction(model);
			model.mode = options.mode;
			model.onlyForDataIndex = helpers.isValid(options.onlyForDataIndex) ? options.onlyForDataIndex : NaN;
			model.datasetIndex = helpers.isValid(options.datasetIndex) ? options.datasetIndex : 0;
			model.linePadding = helpers.isValid(options.linePadding) ? options.linePadding : 0;

			// Figure out the label:
			model.labelBackgroundColor = options.label.backgroundColor;
			model.labelFontFamily = options.label.fontFamily;
			model.labelFontSize = options.label.fontSize;
			model.labelFontStyle = options.label.fontStyle;
			model.labelFontColor = options.label.fontColor;
			model.labelXPadding = options.label.xPadding;
			model.labelYPadding = options.label.yPadding;
			model.labelCornerRadius = options.label.cornerRadius;
			model.labelPosition = options.label.position;
			model.labelXAdjust = options.label.xAdjust;
			model.labelYAdjust = options.label.yAdjust;
			model.labelEnabled = options.label.enabled;
			model.labelContent = options.label.content;
			model.labelRotation = options.label.rotation;

			var lineBounds = this.getLineBoundaries(model);
			ctx.font = chartHelpers.fontString(model.labelFontSize, model.labelFontStyle, model.labelFontFamily);
			var textWidth = ctx.measureText(model.labelContent).width;
			var textHeight = model.labelFontSize;
			model.labelHeight = textHeight + (2 * model.labelYPadding);

			if (model.labelContent && chartHelpers.isArray(model.labelContent)) {
				var labelContentArray = model.labelContent.slice(0);
				var longestLabel = labelContentArray.sort(function(a, b) {
					return b.length - a.length;
				})[0];
				textWidth = ctx.measureText(longestLabel).width;

				model.labelHeight = (textHeight * model.labelContent.length) + (2 * model.labelYPadding);
				// Add padding in between each label item
				model.labelHeight += model.labelYPadding * (model.labelContent.length - 1);
			}

			var labelPosition = calculateLabelPosition(
				model, textWidth, textHeight,
				model.labelXPadding, model.labelYPadding,
				lineBounds.x1, lineBounds.x2,
				lineBounds.y1, lineBounds.y2
			);

			model.labelX = labelPosition.x - model.labelXPadding;
			model.labelY = labelPosition.y - model.labelYPadding;
			model.labelWidth = textWidth + (2 * model.labelXPadding);

			model.borderColor = options.borderColor;
			model.borderWidth = options.borderWidth;
			model.borderDash = options.borderDash || [];
			model.borderDashOffset = options.borderDashOffset || 0;

			// Hide if display is disabled
			if (!options.display || !chartInstance.annotation.options.display) {
				model.labelEnabled = false;
				model.borderColor = 'rgba(0,0,0,0)';
				model.borderWidth = 0;
			}
		},
		inRange: function(mouseX, mouseY) {
			var model = this._model;

			return (
				// On the line
				model.line &&
				model.line.intersects(mouseX, mouseY, this.getHeight())
			) || (
				// On the label
				model.labelEnabled &&
				model.labelContent &&
				mouseX >= model.labelX &&
				mouseX <= model.labelX + model.labelWidth &&
				mouseY >= model.labelY &&
				mouseY <= model.labelY + model.labelHeight
			);
		},
		getCenterPoint: function() {
			return {
				x: (this._model.x2 + this._model.x1) / 2,
				y: (this._model.y2 + this._model.y1) / 2
			};
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
		_getLineBoundariesForHorizontalLine: function(chartModel, barPercentage, linePadding) {
			var halfWidth = chartModel.width / 2;
			return {
				x1: (chartModel.x - halfWidth) + linePadding,
				x2: (chartModel.x + halfWidth) - linePadding
			};
		},
		_getLineBoundariesForVerticalLine: function(chartModel, barPercentage, linePadding) {
			var height = chartModel.height / barPercentage;
			var halfBarHeight = height / 2.0;
			return {
				y1: chartModel.y - halfBarHeight - linePadding,
				y2: chartModel.y + halfBarHeight + linePadding
			};
		},
		getLineBoundaries: function(view) {
			var defaultX = {x1: view.x1, x2: view.x2};
			var defaultY = {y1: view.y1, y2: view.y2};

			if (isNaN(view.onlyForDataIndex)) {
				return Object.assign(defaultX, defaultY);
			}

			var datasetMeta = this.chartInstance.getDatasetMeta(view.datasetIndex);
			var data = datasetMeta.data[view.onlyForDataIndex];
			if (!('_model' in data)) {
				datasetMeta.controller.update();
			}

			var barPercentage = datasetMeta.controller.getRuler().scale.options.barPercentage;
			if (this.options.mode === horizontalKeyword) {
				var boundsX = this._getLineBoundariesForHorizontalLine(data._model, barPercentage, view.linePadding);
				return Object.assign(boundsX, defaultY);
			}
			var boundsY = this._getLineBoundariesForVerticalLine(data._model, barPercentage, view.linePadding);
			return Object.assign(boundsY, defaultX);

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

			var bounds = this.getLineBoundaries(view);
			var x1 = bounds.x1;
			var x2 = bounds.x2;
			var y1 = bounds.y1;
			var y2 = bounds.y2;

			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();

			ctx.restore();
		},
		drawLabel: function() {
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

			if (view.labelEnabled && view.labelContent) {
				ctx.beginPath();
				ctx.rect(view.clip.x1, view.clip.y1, view.clip.x2 - view.clip.x1, view.clip.y2 - view.clip.y1);
				ctx.clip();

				ctx.translate(view.labelX + (view.labelWidth / 2), view.labelY + (view.labelHeight / 2));
				ctx.rotate(view.labelRotation * Math.PI / 180);

				ctx.fillStyle = view.labelBackgroundColor;
				// Draw the tooltip
				chartHelpers.drawRoundedRectangle(
					ctx,
					-(view.labelWidth / 2), // x
					-(view.labelHeight / 2), // y
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
					var textYPosition = -(view.labelHeight / 2) + view.labelYPadding;
					for (var i = 0; i < view.labelContent.length; i++) {
						ctx.textBaseline = 'top';
						ctx.fillText(
							view.labelContent[i],
							-(view.labelWidth / 2) + (view.labelWidth / 2),
							textYPosition
						);

						textYPosition += view.labelFontSize + view.labelYPadding;
					}
				} else {
					ctx.textBaseline = 'middle';
					ctx.fillText(view.labelContent, 0, 0);
				}
			}

			ctx.restore();
		}
	});

	return LineAnnotation;
};
