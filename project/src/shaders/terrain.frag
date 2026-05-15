#version 300 es
precision highp float;

in vec4 vFinalColor;
in vec2 vTextureCoord;
in float vHeight;
in vec2 vWorldXZ;

out vec4 fragColor;

uniform bool uUseTexture;
uniform sampler2D uTerrainTexture;
uniform float uTileScale;
uniform float uMaxHeight;
uniform vec2 uPathCorners[4];
uniform float uPathHalfWidth;
uniform vec3 uPathColor;
uniform float uPathBlend;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
    );
}

float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    vec2 ap = p - a;
    float denom = max(dot(ab, ab), 0.00001);
    float t = clamp(dot(ap, ab) / denom, 0.0, 1.0);
    return length(ap - t * ab);
}

void main() {
    vec3 terrainColor = texture(uTerrainTexture, vTextureCoord * uTileScale).rgb;
    float normalizedHeight = clamp(vHeight / max(uMaxHeight, 0.0001), 0.0, 1.0);

    vec3 lowColor = vec3(0.58, 0.45, 0.28);
    vec3 midColor = vec3(0.30, 0.62, 0.20);
    vec3 highColor = vec3(0.82, 0.80, 0.76);

    vec3 heightTint = mix(lowColor, midColor, smoothstep(0.06, 0.45, normalizedHeight));
    heightTint = mix(heightTint, highColor, smoothstep(0.60, 0.95, normalizedHeight));

    vec3 baseColor = terrainColor * heightTint * vFinalColor.rgb;

    float d = min(
        min(distToSegment(vWorldXZ, uPathCorners[0], uPathCorners[1]), distToSegment(vWorldXZ, uPathCorners[1], uPathCorners[2])),
        min(distToSegment(vWorldXZ, uPathCorners[2], uPathCorners[3]), distToSegment(vWorldXZ, uPathCorners[3], uPathCorners[0]))
    );

    float edgeNoise = (smoothNoise(vWorldXZ * 0.08) - 0.5) * 1.8;
    float pathMask = 1.0 - smoothstep(
        uPathHalfWidth - 1.5 + edgeNoise,
        uPathHalfWidth + edgeNoise,
        d
    );

    vec3 finalColor = mix(baseColor, uPathColor, pathMask * uPathBlend);
    fragColor = vec4(finalColor, 1.0);
}