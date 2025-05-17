b
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');
const axisCanvas = document.getElementById('axisCanvas');
const axisCtx = axisCanvas.getContext('2d');

const binSelect = document.getElementById('binSelect');
const colorSelect = document.getElementById('colorSelect');
const minYInput = document.getElementById('minY');
const maxYInput = document.getElementById('maxY');
const fpsDisplay = document.getElementById('fps');
const binDisplay = document.getElementById('binCount');

let binCount = parseInt(binSelect.value, 10);
let colorMap = parseInt(colorSelect.value, 10);
let min_y = parseFloat(minYInput.value);
let max_y = parseFloat(maxYInput.value);

let audioContext;
let analyser;
let fftDataArray;
let sourceNode;

binSelect.addEventListener('change', () => {
    binCount = parseInt(binSelect.value, 10);
    binDisplay.textContent = binCount;
});

colorSelect.addEventListener('change', () => {
    colorMap = parseInt(colorSelect.value, 10);
    gl.uniform1i(uColorMap, colorMap);
});
minYInput.addEventListener('input', () => {
    min_y = parseFloat(minYInput.value);
});
maxYInput.addEventListener('input', () => {
    max_y = parseFloat(maxYInput.value);
});

minYInput.addEventListener('wheel', (event) => {
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * 0.5;
    min_y = parseFloat(minYInput.value) + delta;
    minYInput.value = min_y.toFixed(1);
});
maxYInput.addEventListener('wheel', (event) => {
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * 0.5;
    max_y = parseFloat(maxYInput.value) + delta;
    maxYInput.value = max_y.toFixed(1);
});

const vsSource = 
      attribute vec2 aPosition;
      varying float vY;
      void main() {
        vY = aPosition.y;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    ;

const fsSource = 
      precision mediump float;
      varying float vY;
      uniform int uColorMap;

      vec3 viridis(float x) {
          x = clamp(x, 0.0, 1.0);
          vec4 x1 = vec4(1.0, x, x * x, x * x * x);
          vec4 x2 = x1 * x1.w * x;

          return vec3(
              dot(x1, vec4(+0.280268003, -0.143510503, +2.225793877, -14.815088879)) +
              dot(x2.xy, vec2(+25.212752309, -11.772589584)),

              dot(x1, vec4(-0.002117546, +1.617109353, -1.909305070, +2.701152864)) +
              dot(x2.xy, vec2(-1.685288385, +0.178738871)),

              dot(x1, vec4(+0.300805501, +2.614650302, -12.019139090, +28.933559110)) +
              dot(x2.xy, vec2(-33.491294770, +13.762053843))
          );
      }

      vec3 jet(float t) {
        float r = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
        float g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
        float b = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
        return vec3(r, g, b);
      }

      void main() {
        float t = clamp((vY + 1.0) / 2.0, 0.0, 1.0);
        vec3 color = (uColorMap == 0) ? viridis(t) : jet(t);
        gl_FragColor = vec4(color, 1.0);
      }
    ;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

const aPosition = gl.getAttribLocation(program, 'aPosition');
const uColorMap = gl.getUniformLocation(program, 'uColorMap');
gl.uniform1i(uColorMap, colorMap);

const positionBuffer = gl.createBuffer();

function generateFFTData(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push(Math.random() * 0.1);
    }
    const s = 100;
    for (let i = -s; i < s; i++) {
        arr[i + Math.round(n/4)] += 0.1 * Math.abs(Math.sin(i / s * Math.PI * 2) / (i / s));
    }
    return arr;
}

let lastTime = performance.now();
let frameCount = 0;

function updateFPS() {
    const now = performance.now();
    const delta = now - lastTime;
    frameCount++;
    if (delta >= 1000) {
        fpsDisplay.textContent = Math.round((frameCount * 1000) / delta);
        frameCount = 0;
        lastTime = now;
    }
}

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

function drawAxes() {
    const container = document.getElementById('container');
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    axisCanvas.width = containerRect.width;
    axisCanvas.height = containerRect.height;
    const w = axisCanvas.width;
    const h = axisCanvas.height;

    axisCtx.clearRect(0, 0, w, h);

    drawXAxis(axisCtx, {
        width: w,
        height: h,
        yOffset: h - 0,
        range: [0, binCount/2],
        units: "",
        numTicks: 8,
        margin: -12,
        align: 'center'
    });

    drawYAxis(axisCtx, {
        width: w,
        height: h,
        xOffset: 0,
        range: [min_y, max_y],
        numTicks: 8,
        align: 'left'
    });
}

async function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = binCount;
    const bufferLength = analyser.frequencyBinCount;
    fftDataArray = new Float32Array(bufferLength);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);
        console.log("Microphone initialized");
    } catch (err) {
        alert("Microphone access denied or failed.");
        console.error(err);
    }
}
initAudio();

function getFFTDataFromMic() {
    analyser.fftSize = binCount;
    const bufferLength = analyser.frequencyBinCount;

    if (!fftDataArray || fftDataArray.length !== bufferLength) {
        fftDataArray = new Float32Array(bufferLength);
    }
    analyser.getFloatFrequencyData(fftDataArray);
    // const normalized = Array.from(fftDataArray, v => v / 1);
    return fftDataArray;
}


function map(x, min, max, newMin, newMax) {
    return ((x - min) * (newMax - newMin)) / (max - min) + newMin;
}

function render() {
    updateFPS();
    drawAxes();

    // const fft = generateFFTData(binCount);
    const fft = getFFTDataFromMic();
    const range = max_y - min_y;
    const vertices = new Float32Array(binCount * 2);
    for (let i = 0; i < binCount; i++) {
        const x = -1 + (2 * i) / (binCount/2 - 1);
        const y = map(fft[i], min_y, max_y, -1, 1);
        vertices[i * 2] = x;
        vertices[i * 2 + 1] = y;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);

    gl.drawArrays(gl.LINE_STRIP, 0, binCount);

    requestAnimationFrame(render);
}

document.getElementById('startButton').addEventListener('click', () => {
    initAudio();
    render();
});
