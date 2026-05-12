#version 300 es
precision highp float;

in vec3 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aTextureCoord;

uniform bool uUseTexture;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

struct lightProperties {
    vec4 position;
    vec4 ambient;
    vec4 diffuse;
    vec4 specular;
    vec4 half_vector;
    vec3 spot_direction;
    float spot_exponent;
    float spot_cutoff;
    float constant_attenuation;
    float linear_attenuation;
    float quadratic_attenuation;
    bool enabled;
};

struct materialProperties {
    vec4 ambient;
    vec4 diffuse;
    vec4 specular;
    vec4 emission;
    float shininess;
};

uniform vec4 uGlobalAmbient;
uniform lightProperties uLight[8];
uniform materialProperties uFrontMaterial;
uniform materialProperties uBackMaterial;

uniform sampler2D uHeightmap;
uniform sampler2D uTerrainTexture;
uniform float uMaxHeight;
uniform float uTerrainStep;
uniform float uTexelStep;

out vec4 vFinalColor;
out vec2 vTextureCoord;
out float vHeight;

vec4 lighting(vec4 vertex, vec3 E, vec3 N) {
    vec4 result = vec4(0.0);

    for (int i = 0; i < 8; i++) {
        if (uLight[i].enabled) {
            float att = 1.0;
            float spotEffect = 1.0;
            vec3 L = vec3(0.0);

            if (uLight[i].position.w == 1.0) {
                L = (uLight[i].position - vertex).xyz;
                float dist = length(L);
                L = normalize(L);

                if (uLight[i].spot_cutoff != 180.0) {
                    vec3 sd = normalize(vec3(uLight[i].spot_direction));
                    float cosCurAngle = dot(sd, -L);
                    float cosInnerConeAngle = cos(radians(clamp(uLight[i].spot_cutoff, 0.0, 89.0)));
                    spotEffect = pow(clamp(cosCurAngle / cosInnerConeAngle, 0.0, 1.0), clamp(uLight[i].spot_exponent, 0.0, 128.0));
                }

                att = 1.0 / (uLight[i].constant_attenuation + uLight[i].linear_attenuation * dist + uLight[i].quadratic_attenuation * dist * dist);
            } else {
                L = normalize(uLight[i].position.xyz);
            }

            float lambertTerm = max(dot(N, L), 0.0);
            vec4 Ia = uLight[i].ambient * uFrontMaterial.ambient;
            vec4 Id = uLight[i].diffuse * uFrontMaterial.diffuse * lambertTerm;
            vec4 Is = vec4(0.0);

            if (lambertTerm > 0.0) {
                vec3 R = reflect(-L, N);
                float specular = pow(max(dot(R, E), 0.0), uFrontMaterial.shininess);
                Is = uLight[i].specular * uFrontMaterial.specular * specular;
            }

            if (uLight[i].position.w == 1.0)
                result += att * max(spotEffect * (Id + Is), Ia);
            else
                result += att * spotEffect * (Ia + Id + Is);
        }
    }

    result += uGlobalAmbient * uFrontMaterial.ambient + uFrontMaterial.emission;
    return clamp(result, vec4(0.0), vec4(1.0));
}

float sampleHeight(vec2 uv) {
    return texture(uHeightmap, clamp(uv, vec2(0.0), vec2(1.0))).r * uMaxHeight;
}

void main() {
    vec2 uv = aTextureCoord;
    float height = sampleHeight(uv);

    float heightLeft = sampleHeight(uv - vec2(uTexelStep, 0.0));
    float heightRight = sampleHeight(uv + vec2(uTexelStep, 0.0));
    float heightDown = sampleHeight(uv - vec2(0.0, uTexelStep));
    float heightUp = sampleHeight(uv + vec2(0.0, uTexelStep));

    vec3 displacedPosition = vec3(aVertexPosition.x, height, aVertexPosition.z);
    vec3 tangentX = vec3(uTerrainStep * 2.0, heightRight - heightLeft, 0.0);
    vec3 tangentZ = vec3(0.0, heightUp - heightDown, uTerrainStep * 2.0);
    vec3 normal = normalize(cross(tangentZ, tangentX));

    vec4 vertex = uMVMatrix * vec4(displacedPosition, 1.0);
    vec3 eyeVec = -vec3(vertex.xyz);
    vec3 E = normalize(eyeVec);

    vFinalColor = lighting(vertex, E, normal);
    gl_Position = uPMatrix * vertex;
    vHeight = height;

    vTextureCoord = uv;
}