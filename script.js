const spectrumCanvas = document.getElementById('spectrumCanvas');
const waterfallCanvas = document.getElementById('waterfallCanvas');

const glSpectrum = spectrumCanvas.getContext('webgl');
const glWaterfall = waterfallCanvas.getContext('webgl');

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
    initWaterfallTexture(glWaterfall);
    drawAxes();
});

colorSelect.addEventListener('change', () => {
    colorMap = parseInt(colorSelect.value, 10);
    glSpectrum.uniform1i(uColorMap, colorMap);
    glWaterfall.uniform1i(waterfallColorMapUniform, colorMap);
});
minYInput.addEventListener('input', () => {
    min_y = parseFloat(minYInput.value);
    drawAxes();
});
maxYInput.addEventListener('input', () => {
    max_y = parseFloat(maxYInput.value);
    drawAxes();
});

minYInput.addEventListener('wheel', (event) => {
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * 0.5;
    min_y = parseFloat(minYInput.value) + delta;
    minYInput.value = min_y.toFixed(1);
    drawAxes();
});
maxYInput.addEventListener('wheel', (event) => {
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * 0.5;
    max_y = parseFloat(maxYInput.value) + delta;
    maxYInput.value = max_y.toFixed(1);
    drawAxes();
});

window.addEventListener('resize', () => {
    drawAxes();
});

const positionBuffer = glSpectrum.createBuffer();

let lastTime = performance.now();
let frameCount = 0;

function updateFPS() {
    const now = performance.now();
    const delta = now - lastTime;
    frameCount++;
    if (delta >= 1000) {
        fpsDisplay.textContent = ((frameCount * 1000) / delta).toFixed(1);
        frameCount = 0;
        lastTime = now;
    }
}

function set_canvas_size(width, height) {
    canvases = [spectrumCanvas, waterfallCanvas, axisCanvas];
    canvases.forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
    });
}

function drawAxes() {
    const container = document.getElementById('container').getBoundingClientRect();
    set_canvas_size(container.width, container.height);
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
    document.getElementById("sampleRateValue").textContent = audioContext.sampleRate;
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

function getFFTDataFromMic() {
    analyser.fftSize = binCount;
    const bufferLength = analyser.frequencyBinCount;

    if (!fftDataArray || fftDataArray.length !== bufferLength) {
        fftDataArray = new Float32Array(bufferLength);
    }
    analyser.getFloatFrequencyData(fftDataArray);
    return fftDataArray;
}

function map(x, min, max, newMin, newMax) {
    return ((x - min) * (newMax - newMin)) / (max - min) + newMin;
}

function clamp_value(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function resizeCanvasToDisplaySize(canvas) {
  // Lookup the size the browser is displaying the canvas in CSS pixels.
  const displayWidth  = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  // Check if the canvas is not the same size.
  const needResize = canvas.width  !== displayWidth ||
                     canvas.height !== displayHeight;

  if (needResize) {
    // Make the canvas the same size
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}

function drawSpectrum(gl, fft) {
    gl.useProgram(spectrumProgram);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const vertices = new Float32Array(binCount * 2);
    for (let i = 0; i < binCount; i++) {
        const x = -1 + (2 * i) / (binCount/2 - 1);
        const y = map(fft[i], min_y, max_y, -1, 1);
        vertices[i * 2] = x;
        vertices[i * 2 + 1] = y;
    }
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
    gl.uniform1i(uColorMap, colorMap);
    gl.drawArrays(gl.LINE_STRIP, 0, binCount);
}

const waterfallHeight = 512;
let waterfallBuffer = null;
let waterfallTexture = null;

// Setup waterfall texture
function initWaterfallTexture(gl) {
    waterfallTexture = gl.createTexture();
    waterfallBuffer = new Uint8Array(binCount/2 * waterfallHeight);
    gl.bindTexture(gl.TEXTURE_2D, waterfallTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, binCount/2, waterfallHeight, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

// Update the waterfall buffer and texture
function updateWaterfall(gl, fft) {
    waterfallBuffer.set(waterfallBuffer.subarray(binCount/2), 0);
    for (let i = 0; i < binCount/2; i++) {
        const value = Math.floor(map(fft[i], min_y, max_y, 0, 255));
        waterfallBuffer[(waterfallHeight - 1) * binCount/2 + i] = clamp_value(value, 0, 255);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, waterfallTexture);
    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0, 0, 0,
        binCount/2, waterfallHeight,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        waterfallBuffer
    );
}

// Draw waterfall plot
function drawWaterfall(gl) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.vertexAttribPointer(waterfallPositionAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(waterfallPositionAttrib);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, waterfallTexture);
    gl.uniform1i(waterfallTextureUniform, 0);
    gl.uniform1f(uTextureWidthLoc, binCount/2);
    gl.uniform1i(waterfallColorMapUniform, colorMap); // Optional for switching color maps

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Modify render()
function render() {
    updateFPS();
    if(resizeCanvasToDisplaySize(spectrumCanvas)) {
        drawAxes();
    }
    resizeCanvasToDisplaySize(axisCanvas);
    resizeCanvasToDisplaySize(waterfallCanvas);
    const fft = getFFTDataFromMic();
    drawSpectrum(glSpectrum, fft);         // Optional: remove if only waterfall is needed
    updateWaterfall(glWaterfall, fft);
    drawWaterfall(glWaterfall);

    requestAnimationFrame(render);
}

// At init time
initWaterfallTexture(glWaterfall);
document.getElementById('startButton').addEventListener('click', () => {
    initAudio();
    drawAxes();
    render();
});
