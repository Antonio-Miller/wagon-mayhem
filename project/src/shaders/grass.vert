attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform float uTime;

varying vec2 vTexCoord;
varying float vHeightFactor;

void main() {
    vec4 pos = vec4(aPosition, 1.0);
    float sway = sin(uTime * 2.0 + aPosition.x * 3.0 + aPosition.z * 2.0) * 0.16;
    pos.x += sway * aPosition.y;
    pos.z += cos(uTime * 1.4 + aPosition.x * 2.0) * 0.04 * aPosition.y;

    vTexCoord = aTexCoord;
    vHeightFactor = clamp(aPosition.y, 0.0, 1.0);
    gl_Position = uPMatrix * uMVMatrix * pos;
}