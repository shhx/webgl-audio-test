function clamp_label(pos, labelSize, w) {
    if (pos > w - labelSize) {
        pos = w - labelSize;
    } else if (pos < 0) {
        pos = labelSize;
    }
    return pos;
}

function drawXAxis(ctx, options) {
    const {
        width,
        height,
        yOffset = height,           // y-position of X axis (bottom)
        range = [0, 1],             // data range for tick labels
        numTicks = 5,
        tickLength = 5,
        units = '',
        font = '12px sans-serif',
        strokeStyle = '#888',
        fillStyle = '#ccc',
        margin = 0,
        align = 'center'           // label alignment: 'center', 'left', 'right'
    } = options;

    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = fillStyle;
    ctx.font = font;

    // X axis line
    ctx.beginPath();
    ctx.moveTo(0, yOffset);
    ctx.lineTo(width, yOffset);
    ctx.stroke();

    for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const x = t * width;
        const value = range[0] + t * (range[1] - range[0]);

        // Draw tick
        ctx.beginPath();
        ctx.moveTo(x, yOffset - tickLength);
        ctx.lineTo(x, yOffset + tickLength);
        ctx.stroke();

        // Label
        const label = value.toFixed(1) + ' ' + units;
        const labelWidth = ctx.measureText(label).width;
        let labelX = x;

        if (align === 'center') {
            labelX = x - labelWidth / 2;
        } else if (align === 'right') {
            labelX = x - labelWidth;
        } // left = x
        labelX = clamp_label(labelX, labelWidth, width);
        ctx.fillText(label, labelX, yOffset + tickLength + margin);
    }
}

function drawYAxis(ctx, options) {
    const {
        height,
        xOffset = 0,                // x-position of Y axis (left)
        range = [-1, 1],            // data range for tick labels
        numTicks = 5,
        tickLength = 5,
        font = '12px sans-serif',
        strokeStyle = '#888',
        fillStyle = '#ccc',
        margin = 4,
        align = 'right'            // label alignment: 'right', 'left', 'center'
    } = options;

    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = fillStyle;
    ctx.font = font;

    // Y axis line
    ctx.beginPath();
    ctx.moveTo(xOffset, 0);
    ctx.lineTo(xOffset, height);
    ctx.stroke();

    for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const y = height - t * height;
        const value = range[0] + t * (range[1] - range[0]);

        // Draw tick
        ctx.beginPath();
        ctx.moveTo(xOffset - tickLength, y);
        ctx.lineTo(xOffset + tickLength, y);
        ctx.stroke();

        // Label
        const label = value.toFixed(1);
        const labelWidth = ctx.measureText(label).width;
        let labelX = xOffset;

        if (align === 'right') {
            labelX = xOffset - labelWidth - margin;
        } else if (align === 'center') {
            labelX = xOffset - labelWidth / 2;
        } else {
            labelX = xOffset + tickLength + margin;
        }

        ctx.fillText(label, labelX, y + 3);
    }
}
