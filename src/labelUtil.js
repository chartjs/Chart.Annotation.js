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
