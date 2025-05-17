const vsSource = `
attribute vec2 aPosition;
varying float vY;
void main() {
    vY = aPosition.y;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fsSource = `
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
`;

const waterfallVsSource = `
attribute vec2 aPosition;
varying vec2 vTexCoord;
void main() {
    vTexCoord = (aPosition + 1.0) / 2.0;
    gl_Position = vec4(aPosition, 0, 1);
}
`;

const waterfallFsSource = `
precision mediump float;
uniform sampler2D uTexture;
uniform int uColorMap;
varying vec2 vTexCoord;

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

vec3 colormap(float t) {
    return (uColorMap == 0) ? viridis(t) : jet(t);
}

void main() {
    float value = texture2D(uTexture, vec2(vTexCoord.x, 1.0 - vTexCoord.y)).r;
    gl_FragColor = vec4(colormap(value), 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Error compiling shader:\n${gl.getShaderInfoLog(shader)}\nSource:\n${source}`);
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
};

// Spectrum
const vertexShader = createShader(glSpectrum, glSpectrum.VERTEX_SHADER, vsSource);
const fragmentShader = createShader(glSpectrum, glSpectrum.FRAGMENT_SHADER, fsSource);
const spectrumProgram = createProgram(glSpectrum, vertexShader, fragmentShader);

const aPosition = glSpectrum.getAttribLocation(spectrumProgram, 'aPosition');
const uColorMap = glSpectrum.getUniformLocation(spectrumProgram, 'uColorMap');
glSpectrum.useProgram(spectrumProgram);

// Waterfall 
const waterfallVertexShader = createShader(glWaterfall, glWaterfall.VERTEX_SHADER, waterfallVsSource);
const waterfallFragmentShader = createShader(glWaterfall, glWaterfall.FRAGMENT_SHADER, waterfallFsSource);
const waterfallProgram = createProgram(glWaterfall, waterfallVertexShader, waterfallFragmentShader);

const waterfallPositionAttrib = glWaterfall.getAttribLocation(waterfallProgram, 'aPosition');
const waterfallTextureUniform = glWaterfall.getUniformLocation(waterfallProgram, 'uTexture');
const waterfallColorMapUniform = glWaterfall.getUniformLocation(waterfallProgram, 'uColorMap');
glWaterfall.useProgram(waterfallProgram);

// Fullscreen quad
const quadBuffer = glWaterfall.createBuffer();
glWaterfall.bindBuffer(glWaterfall.ARRAY_BUFFER, quadBuffer);
glWaterfall.bufferData(glWaterfall.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1
]), glWaterfall.STATIC_DRAW);
