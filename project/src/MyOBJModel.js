import { CGFappearance, CGFobject } from "../../lib/CGF.js";

export class MyOBJModel extends CGFobject {
  constructor(scene, url, scale = 1.0) {
    super(scene);
    this.url = url;
    this.scale = scale;
    this.inited = false;
    this.materials = new Map();
    this.submeshes = [];
    try {
      const baseUrl = url.slice(0, url.lastIndexOf('/') + 1);
      const text = this._getSyncText(url);
      this._parseOBJ(text, baseUrl);
      this.initGLBuffers();
      this.inited = true;
    } catch (e) {
      console.warn("MyOBJModel: failed to load", url, e);
    }
  }

  _getSyncText(url) {
    const req = new XMLHttpRequest();
    req.open('GET', url, false);
    req.send(null);
    if (req.status === 200 || req.status === 0) return req.responseText;
    throw new Error('Failed to load ' + url + ' (' + req.status + ')');
  }

  _parseMTL(text) {
    const materials = new Map();
    let current = null;

    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);
      if (parts[0] === 'newmtl' && parts[1]) {
        current = {
          name: parts[1],
          Ka: [0.2, 0.2, 0.2],
          Kd: [0.8, 0.8, 0.8],
          Ks: [0.1, 0.1, 0.1],
          Ns: 20,
        };
        materials.set(current.name, current);
      } else if (current && parts[0] === 'Ka' && parts.length >= 4) {
        current.Ka = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      } else if (current && parts[0] === 'Kd' && parts.length >= 4) {
        current.Kd = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      } else if (current && parts[0] === 'Ks' && parts.length >= 4) {
        current.Ks = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      } else if (current && parts[0] === 'Ns' && parts.length >= 2) {
        current.Ns = parseFloat(parts[1]);
      }
    }

    return materials;
  }

  _buildAppearance(materialInfo) {
    const appearance = new CGFappearance(this.scene);
    const ka = materialInfo?.Ka || [0.2, 0.2, 0.2];
    const kd = materialInfo?.Kd || [0.8, 0.8, 0.8];
    const ks = materialInfo?.Ks || [0.1, 0.1, 0.1];
    const ns = materialInfo?.Ns ?? 20;

    appearance.setAmbient(ka[0], ka[1], ka[2], 1);
    appearance.setDiffuse(kd[0], kd[1], kd[2], 1);
    appearance.setSpecular(ks[0], ks[1], ks[2], 1);
    appearance.setShininess(ns);
    return appearance;
  }

  _parseOBJ(text, baseUrl) {
    const ps = [];
    const ns = [];
    const ts = [];
    let currentMaterial = 'default';
    let mtlMap = new Map();

    const ensureSubmesh = (name) => {
      let submesh = this.submeshes.find((entry) => entry.materialName === name);
      if (!submesh) {
        submesh = {
          materialName: name,
          vertices: [],
          normals: [],
          texCoords: [],
          indices: [],
          vertexMap: new Map(),
          appearance: null,
          verticesBuffer: null,
          normsBuffer: null,
          texCoordsBuffer: null,
          indicesBuffer: null,
        };
        this.submeshes.push(submesh);
      }
      return submesh;
    };

    ensureSubmesh(currentMaterial);

    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);

      if (parts[0] === 'mtllib' && parts[1]) {
        try {
          const mtlText = this._getSyncText(baseUrl + parts[1]);
          mtlMap = this._parseMTL(mtlText);
        } catch (e) {
          console.warn('MyOBJModel: failed to load material library', parts[1], e);
        }
      } else if (parts[0] === 'usemtl' && parts[1]) {
        currentMaterial = parts[1];
        ensureSubmesh(currentMaterial);
      } else if (parts[0] === 'v' && parts.length >= 4) {
        ps.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (parts[0] === 'vn' && parts.length >= 4) {
        ns.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (parts[0] === 'vt' && parts.length >= 3) {
        ts.push(parseFloat(parts[1]), parseFloat(parts[2]));
      } else if (parts[0] === 'f' && parts.length >= 4) {
        const submesh = ensureSubmesh(currentMaterial);
        const face = parts.slice(1);
        for (let i = 1; i < face.length - 1; ++i) {
          const tri = [face[0], face[i], face[i + 1]];
          for (const tok of tri) {
            const comps = tok.split('/');
            const vi = parseInt(comps[0], 10) - 1;
            const vti = comps[1] ? (comps[1].length ? parseInt(comps[1], 10) - 1 : undefined) : undefined;
            const vni = comps[2] ? parseInt(comps[2], 10) - 1 : undefined;
            const key = vi + '/' + (vti === undefined ? '' : vti) + '/' + (vni === undefined ? '' : vni);

            if (!submesh.vertexMap.has(key)) {
              const baseIndex = submesh.vertices.length / 3;
              submesh.vertices.push(ps[vi * 3], ps[vi * 3 + 1], ps[vi * 3 + 2]);
              if (vti !== undefined && ts.length > vti * 2 + 1) {
                submesh.texCoords.push(ts[vti * 2], ts[vti * 2 + 1]);
              } else {
                submesh.texCoords.push(0, 0);
              }
              if (vni !== undefined && ns.length > vni * 3 + 2) {
                submesh.normals.push(ns[vni * 3], ns[vni * 3 + 1], ns[vni * 3 + 2]);
              } else {
                submesh.normals.push(0, 0, 0);
              }
              submesh.vertexMap.set(key, baseIndex);
            }
            submesh.indices.push(submesh.vertexMap.get(key));
          }
        }
      }
    }

    for (const submesh of this.submeshes) {
      if (submesh.normals.length === 0 || submesh.normals.every((value) => value === 0)) {
        this._computeNormalsForSubmesh(submesh);
      }
      submesh.appearance = this._buildAppearance(mtlMap.get(submesh.materialName));
    }
  }

  _computeNormalsForSubmesh(submesh) {
    const accum = new Array(submesh.vertices.length).fill(0);
    for (let i = 0; i < submesh.indices.length; i += 3) {
      const ia = submesh.indices[i] * 3;
      const ib = submesh.indices[i + 1] * 3;
      const ic = submesh.indices[i + 2] * 3;
      const ax = submesh.vertices[ia];
      const ay = submesh.vertices[ia + 1];
      const az = submesh.vertices[ia + 2];
      const bx = submesh.vertices[ib];
      const by = submesh.vertices[ib + 1];
      const bz = submesh.vertices[ib + 2];
      const cx = submesh.vertices[ic];
      const cy = submesh.vertices[ic + 1];
      const cz = submesh.vertices[ic + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      accum[ia] += nx; accum[ia + 1] += ny; accum[ia + 2] += nz;
      accum[ib] += nx; accum[ib + 1] += ny; accum[ib + 2] += nz;
      accum[ic] += nx; accum[ic + 1] += ny; accum[ic + 2] += nz;
    }

    submesh.normals = new Array(submesh.vertices.length);
    for (let i = 0; i < accum.length; i += 3) {
      const nx = accum[i];
      const ny = accum[i + 1];
      const nz = accum[i + 2];
      const len = Math.hypot(nx, ny, nz) || 1;
      submesh.normals[i] = nx / len;
      submesh.normals[i + 1] = ny / len;
      submesh.normals[i + 2] = nz / len;
    }
  }

  initGLBuffers() {
    for (const submesh of this.submeshes) {
      submesh.verticesBuffer = this.scene.gl.createBuffer();
      this.scene.gl.bindBuffer(this.scene.gl.ARRAY_BUFFER, submesh.verticesBuffer);
      this.scene.gl.bufferData(this.scene.gl.ARRAY_BUFFER, new Float32Array(submesh.vertices), this.scene.gl.STATIC_DRAW);

      submesh.normsBuffer = this.scene.gl.createBuffer();
      this.scene.gl.bindBuffer(this.scene.gl.ARRAY_BUFFER, submesh.normsBuffer);
      this.scene.gl.bufferData(this.scene.gl.ARRAY_BUFFER, new Float32Array(submesh.normals), this.scene.gl.STATIC_DRAW);

      submesh.texCoordsBuffer = this.scene.gl.createBuffer();
      this.scene.gl.bindBuffer(this.scene.gl.ARRAY_BUFFER, submesh.texCoordsBuffer);
      this.scene.gl.bufferData(this.scene.gl.ARRAY_BUFFER, new Float32Array(submesh.texCoords), this.scene.gl.STATIC_DRAW);

      submesh.indicesBuffer = this.scene.gl.createBuffer();
      this.scene.gl.bindBuffer(this.scene.gl.ELEMENT_ARRAY_BUFFER, submesh.indicesBuffer);
      this.scene.gl.bufferData(this.scene.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(submesh.indices), this.scene.gl.STATIC_DRAW);
      submesh.indicesBuffer.numValues = submesh.indices.length;
    }
    this.inited = true;
  }

  display() {
    if (!this.inited) return;
    const shader = this.scene.activeShader;
    const gl = this.scene.gl;

    this.scene.pushMatrix();
    this.scene.scale(this.scale, this.scale, this.scale);

    for (const submesh of this.submeshes) {
      if (!submesh.indicesBuffer || submesh.indicesBuffer.numValues === 0) continue;
      if (submesh.appearance) submesh.appearance.apply();

      gl.uniformMatrix4fv(shader.uniforms.uMVMatrix, false, this.scene.activeMatrix);
      if (shader.attributes.aVertexPosition !== undefined && shader.attributes.aVertexPosition !== null) {
        gl.enableVertexAttribArray(shader.attributes.aVertexPosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, submesh.verticesBuffer);
        gl.vertexAttribPointer(shader.attributes.aVertexPosition, 3, gl.FLOAT, false, 0, 0);
      }
      if (shader.attributes.aVertexNormal !== undefined && shader.attributes.aVertexNormal !== null) {
        gl.enableVertexAttribArray(shader.attributes.aVertexNormal);
        gl.bindBuffer(gl.ARRAY_BUFFER, submesh.normsBuffer);
        gl.vertexAttribPointer(shader.attributes.aVertexNormal, 3, gl.FLOAT, false, 0, 0);
      }
      if (shader.attributes.aTextureCoord !== undefined && shader.attributes.aTextureCoord !== null) {
        gl.enableVertexAttribArray(shader.attributes.aTextureCoord);
        gl.bindBuffer(gl.ARRAY_BUFFER, submesh.texCoordsBuffer);
        gl.vertexAttribPointer(shader.attributes.aTextureCoord, 2, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, submesh.indicesBuffer);
      gl.drawElements(gl.TRIANGLES, submesh.indicesBuffer.numValues, gl.UNSIGNED_SHORT, 0);
    }

    this.scene.popMatrix();
  }
}
