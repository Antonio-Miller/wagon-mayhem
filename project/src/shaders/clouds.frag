#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uSampler;
uniform bool uUseTexture;

void main() {
    vec4 tex = texture(uSampler, vTextureCoord);
    float luminance = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float alpha = 1.0 - smoothstep(0.94, 0.995, luminance);

    if (alpha <= 0.01) {
        discard;
    }

    fragColor = vec4(vec3(1.0), alpha * tex.a);
}
