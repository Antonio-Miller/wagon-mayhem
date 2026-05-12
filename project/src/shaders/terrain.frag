#version 300 es
precision highp float;

in vec4 vFinalColor;
in vec2 vTextureCoord;
in float vHeight;

out vec4 fragColor;

uniform bool uUseTexture;
uniform sampler2D uTerrainTexture;
uniform float uTileScale;
uniform float uMaxHeight;

void main() {
    vec3 terrainColor = texture(uTerrainTexture, vTextureCoord * uTileScale).rgb;
    float normalizedHeight = clamp(vHeight / max(uMaxHeight, 0.0001), 0.0, 1.0);

    vec3 lowColor = vec3(0.58, 0.45, 0.28);
    vec3 midColor = vec3(0.30, 0.62, 0.20);
    vec3 highColor = vec3(0.82, 0.80, 0.76);

    vec3 heightTint = mix(lowColor, midColor, smoothstep(0.06, 0.45, normalizedHeight));
    heightTint = mix(heightTint, highColor, smoothstep(0.60, 0.95, normalizedHeight));

    vec3 finalColor = terrainColor * heightTint * vFinalColor.rgb;
    fragColor = vec4(finalColor, 1.0);
}