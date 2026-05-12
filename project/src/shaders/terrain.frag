#version 300 es
precision highp float;

in vec4 vFinalColor;
in vec2 vTextureCoord;

out vec4 fragColor;

uniform bool uUseTexture;

void main() {
    fragColor = vFinalColor;
}