import {Element, defaults} from 'chart.js';
import {isArray, toFontString, toRadians} from 'chart.js/helpers';
import {scaleValue, roundedRect, rotated} from '../helpers';

const PI = Math.PI;
const pointInLine = (p1, p2, t) => ({x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y)});
const interpolateX = (y, p1, p2) => pointInLine(p1, p2, Math.abs((y - p1.y) / (p2.y - p1.y))).x;
const interpolateY = (x, p1, p2) => pointInLine(p1, p2, Math.abs((x - p1.x) / (p2.x - p1.x))).y;

export default class LineAnnotation extends Element {
  intersects(x, y, epsilon) {
    epsilon = epsilon || 0.001;
    const me = this;
    const p1 = {x: me.x, y: me.y};
    const p2 = {x: me.x2, y: me.y2};
    const dy = interpolateY(x, p1, p2);
    const dx = interpolateX(y, p1, p2);
    return (
      (!isFinite(dy) || Math.abs(y - dy) < epsilon) &&
			(!isFinite(dx) || Math.abs(x - dx) < epsilon)
    );
  }

  labelIsVisible() {
    const label = this.options.label;
    return label && label.enabled && label.content;
  }

  isOnLabel(mouseX, mouseY) {
    const {labelRect} = this;

    if (!labelRect) {
      return false;
    }

    const {x, y} = rotated({x: mouseX, y: mouseY}, labelRect, -labelRect.rotation);
    const w2 = labelRect.width / 2;
    const h2 = labelRect.height / 2;
    return x >= labelRect.x - w2 && x <= labelRect.x + w2 &&
      y >= labelRect.y - h2 && y <= labelRect.y + h2;
  }

  inRange(x, y) {
    const epsilon = this.options.borderWidth || 1;
    return this.intersects(x, y, epsilon) || this.isOnLabel(x, y);
  }

  getCenterPoint() {
    return {
      x: (this.x2 + this.x) / 2,
      y: (this.y2 + this.y) / 2
    };
  }

  draw(ctx) {
    const {x, y, x2, y2, options} = this;
    ctx.save();

    ctx.lineWidth = options.borderWidth;
    ctx.strokeStyle = options.borderColor;

    if (ctx.setLineDash) {
      ctx.setLineDash(options.borderDash);
    }
    ctx.lineDashOffset = options.borderDashOffset;

    // Draw
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  }

  drawLabel(ctx, chartArea) {
    if (this.labelIsVisible()) {
      ctx.save();
      drawLabel(ctx, this, chartArea);
      ctx.restore();
    }
  }

  resolveElementProperties(chart, options) {
    const scale = chart.scales[options.scaleID];
    let {top: y, left: x, bottom: y2, right: x2} = chart.chartArea;
    let min, max;

    if (scale) {
      min = scaleValue(scale, options.value, NaN);
      max = scaleValue(scale, options.endValue, min);
      if (scale.isHorizontal()) {
        x = min;
        x2 = max;
      } else {
        y = min;
        y2 = max;
      }
    } else {
      const xScale = chart.scales[options.xScaleID];
      const yScale = chart.scales[options.yScaleID];

      if (xScale) {
        x = scaleValue(xScale, options.xMin, x);
        x2 = scaleValue(xScale, options.xMax, x2);
      }

      if (yScale) {
        y = scaleValue(yScale, options.yMin, y);
        y2 = scaleValue(yScale, options.yMax, y2);
      }
    }
    return {
      x,
      y,
      x2,
      y2,
      width: x2 - x,
      height: y2 - y
    };
  }
}

LineAnnotation.id = 'lineAnnotation';
LineAnnotation.defaults = {
  display: true,
  borderWidth: 2,
  borderDash: [],
  borderDashOffset: 0,
  label: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    font: {
      family: defaults.font.family,
      size: defaults.font.size,
      style: 'bold',
    },
    color: '#fff',
    xPadding: 6,
    yPadding: 6,
    rotation: 0,
    cornerRadius: 6,
    position: 'center',
    xAdjust: 0,
    yAdjust: 0,
    enabled: false,
    content: null
  }
};

LineAnnotation.defaultRoutes = {
  borderColor: 'color'
};

function calculateAutoRotation(line) {
  const {x, y, x2, y2} = line;
  const rotation = Math.atan2(y2 - y, x2 - x);
  // Flip the rotation if it goes > PI/2 or < -PI/2, so label stays upright
  return rotation > PI / 2 ? rotation - PI : rotation < PI / -2 ? rotation + PI : rotation;
}

function drawLabel(ctx, line, chartArea) {
  const label = line.options.label;

  ctx.font = toFontString(label.font);
  ctx.textAlign = 'center';

  const {width, height} = measureLabel(ctx, label);

  const rect = line.labelRect = calculateLabelPosition(line, width, height, chartArea);

  ctx.translate(rect.x, rect.y);
  ctx.rotate(rect.rotation);

  ctx.fillStyle = label.backgroundColor;
  roundedRect(ctx, -(width / 2), -(height / 2), width, height, label.cornerRadius);
  ctx.fill();

  ctx.fillStyle = label.color;
  if (isArray(label.content)) {
    let textYPosition = -(height / 2) + label.yPadding;
    for (let i = 0; i < label.content.length; i++) {
      ctx.textBaseline = 'top';
      ctx.fillText(
        label.content[i],
        -(width / 2) + (width / 2),
        textYPosition
      );
      textYPosition += label.font.size + label.yPadding;
    }
  } else {
    ctx.textBaseline = 'middle';
    ctx.fillText(label.content, 0, 0);
  }
}

const widthCache = new Map();
function measureLabel(ctx, label) {
  const content = label.content;
  const lines = isArray(content) ? content : [content];
  const count = lines.length;
  let width = 0;
  for (let i = 0; i < count; i++) {
    const text = lines[i];
    if (!widthCache.has(text)) {
      widthCache.set(text, ctx.measureText(text).width);
    }
    width = Math.max(width, widthCache.get(text));
  }
  width += 2 * label.xPadding;

  return {
    width,
    height: count * label.font.size + ((count + 1) * label.yPadding)
  };
}

function calculateLabelPosition(line, width, height, chartArea) {
  const label = line.options.label;
  const {xAdjust, yAdjust, xPadding, yPadding, position} = label;
  const p1 = {x: line.x, y: line.y};
  const p2 = {x: line.x2, y: line.y2};
  const rotation = label.rotation === 'auto' ? calculateAutoRotation(line) : toRadians(label.rotation);
  const size = rotatedSize(width, height, rotation);
  const t = calculateT(line, position, size, chartArea);
  const pt = pointInLine(p1, p2, t);
  const xCoordinateSizes = {size: size.w, min: chartArea.left, max: chartArea.right, padding: xPadding};
  const yCoordinateSizes = {size: size.h, min: chartArea.top, max: chartArea.bottom, padding: yPadding};

  return {
    x: adjustLabelCoordinate(pt.x, xCoordinateSizes) + xAdjust,
    y: adjustLabelCoordinate(pt.y, yCoordinateSizes) + yAdjust,
    width,
    height,
    rotation
  };
}

function rotatedSize(width, height, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    w: Math.abs(width * cos) + Math.abs(height * sin),
    h: Math.abs(width * sin) + Math.abs(height * cos)
  };
}

function calculateT(line, position, rotSize, chartArea) {
  let t = 0.5;
  const space = spaceAround(line, chartArea);
  const label = line.options.label;
  if (position === 'start') {
    t = calculateTAdjust({w: line.x2 - line.x, h: line.y2 - line.y}, rotSize, label, space);
  } else if (position === 'end') {
    t = 1 - calculateTAdjust({w: line.x - line.x2, h: line.y - line.y2}, rotSize, label, space);
  }
  return t;
}

function calculateTAdjust(lineSize, labelSize, label, space) {
  const {xPadding, yPadding} = label;
  const lineW = lineSize.w * space.dx;
  const lineH = lineSize.h * space.dy;
  const x = (lineW > 0) && ((labelSize.w / 2 + xPadding - space.x) / lineW);
  const y = (lineH > 0) && ((labelSize.h / 2 + yPadding - space.y) / lineH);
  return Math.max(Math.min(Math.max(x, y), 0.25), 0);
}

function spaceAround(line, chartArea) {
  const {x, x2, y, y2} = line;
  const t = Math.min(y, y2) - chartArea.top;
  const l = Math.min(x, x2) - chartArea.left;
  const b = chartArea.bottom - Math.max(y, y2);
  const r = chartArea.right - Math.max(x, x2);
  return {
    x: Math.min(l, r),
    y: Math.min(t, b),
    dx: l < r ? 1 : -1,
    dy: t < b ? 1 : -1
  };
}

function adjustLabelCoordinate(coordinate, labelSizes) {
  const {size, min, max, padding} = labelSizes;
  const halfSize = size / 2;

  if (size > max - min) {
    // if it does not fit, display as much as possible
    return (max + min) / 2;
  }

  if (min >= (coordinate - padding - halfSize)) {
    coordinate = min + padding + halfSize;
  }

  if (max <= (coordinate + padding + halfSize)) {
    coordinate = max - padding - halfSize;
  }

  return coordinate;
}
