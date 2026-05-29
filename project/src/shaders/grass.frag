precision mediump float;

uniform vec4 uGrassColor;

varying vec2 vTexCoord;
varying float vHeightFactor;

void main() {
    float tipLight = 0.85 + vHeightFactor * 0.25;
    gl_FragColor = vec4(uGrassColor.rgb * tipLight, uGrassColor.a);
}