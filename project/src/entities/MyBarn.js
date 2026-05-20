import { CGFobject, CGFappearance, CGFtexture } from "../../../lib/CGF.js";
import { MyTrapezoidalPrism } from "../primitives/MyTrapezoidalPrism.js";
import { MyIsosceleTriangularPrism } from "../primitives/MyIsosceleTriangularPrism.js";

export class MyBarn extends CGFobject {
  constructor(scene, terrain, positionX = 0, positionZ = 0, width = 20, bodyHeight = 15, roofHeight = 10, depth = 30) {
    super(scene);

    this.terrain = terrain;
    this.positionX = positionX;
    this.positionZ = positionZ;
    this.width = width;
    this.bodyHeight = bodyHeight;
    this.roofHeight = roofHeight;
    this.depth = depth;
    this.groundSink = 3;

    this.lowerBodyHeight = bodyHeight * 0.36;
    this.middleBodyHeight = bodyHeight * 0.34;
    this.upperBodyHeight = Math.max(1, bodyHeight - this.lowerBodyHeight - this.middleBodyHeight);

    this.lowerBottomWidth = width * 0.78;
    this.lowerTopWidth = width * 0.97;
    this.middleBottomWidth = this.lowerTopWidth;
    this.middleTopWidth = width * 0.84;
    this.roofBaseWidth = width * 0.9;

    this.bodyTotalHeight = this.lowerBodyHeight + this.middleBodyHeight + this.upperBodyHeight;

    // Create barn body solids from bottom to top
    this.bodyLower = new MyTrapezoidalPrism(scene, this.lowerBottomWidth, this.lowerTopWidth, this.lowerBodyHeight, depth);
    this.bodyMiddle = new MyTrapezoidalPrism(scene, this.middleBottomWidth, this.middleTopWidth, this.middleBodyHeight, depth);
    this.bodyTop = new MyIsosceleTriangularPrism(scene, this.roofBaseWidth, this.upperBodyHeight, depth);

    // Apply the same wood texture with different tints per barn section.
    this.woodTexture = new CGFtexture(this.scene, "/project/src/shaders/Poliigon_WoodFloorAsh_4186_BaseColor.jpg");

    this.redWoodAppearance = new CGFappearance(this.scene);
    this.redWoodAppearance.setAmbient(0.55, 0.12, 0.12, 1.0);
    this.redWoodAppearance.setDiffuse(0.92, 0.22, 0.22, 1.0);
    this.redWoodAppearance.setSpecular(0.08, 0.08, 0.08, 1.0);
    this.redWoodAppearance.setShininess(12.0);
    this.redWoodAppearance.setTexture(this.woodTexture);
    this.redWoodAppearance.setTextureWrap("REPEAT", "REPEAT");

    this.whiteWoodAppearance = new CGFappearance(this.scene);
    this.whiteWoodAppearance.setAmbient(0.95, 0.95, 0.95, 1.0);
    this.whiteWoodAppearance.setDiffuse(1.0, 1.0, 1.0, 1.0);
    this.whiteWoodAppearance.setSpecular(0.08, 0.08, 0.08, 1.0);
    this.whiteWoodAppearance.setShininess(12.0);
    this.whiteWoodAppearance.setTexture(this.woodTexture);
    this.whiteWoodAppearance.setTextureWrap("REPEAT", "REPEAT");
  }

  display() {
    const positionY = this.terrain ? this.terrain.getHeightAt(this.positionX, this.positionZ) : 0;
    const baseY = positionY - this.groundSink - 10;
    const lowerCenterY = this.lowerBodyHeight / 2;
    const middleCenterY = this.lowerBodyHeight + this.middleBodyHeight / 2;
    const upperCenterY = this.lowerBodyHeight + this.middleBodyHeight + this.upperBodyHeight / 2;
    const previousTexturesEnabled = this.scene.texturesEnabled;

    this.scene.enableTextures(true);

    this.scene.pushMatrix();
    this.scene.translate(this.positionX, baseY, this.positionZ);

    // Display barn body from bottom to top
    this.redWoodAppearance.apply();
    this.scene.pushMatrix();
    this.scene.translate(0, lowerCenterY, 0);
    this.bodyLower.display();
    this.scene.popMatrix();

    this.scene.pushMatrix();
    this.scene.translate(0, middleCenterY, 0);
    this.bodyMiddle.display();
    this.scene.popMatrix();

    this.scene.pushMatrix();
    this.scene.translate(0, upperCenterY, 0);
    this.whiteWoodAppearance.apply();
    this.bodyTop.display();
    this.scene.popMatrix();

    this.scene.popMatrix();
    this.scene.enableTextures(previousTexturesEnabled);
  }
}
