import * as THREE from 'three';

export function createCapeGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  // Cape box dimensions: Width = 10 (X: -5 to 5), Height = 16 (Y: -16 to 0), Depth = 1 (Z: 0 to 1)
  // Standard Minecraft 64x32 UV mapping normalized
  const u = (px: number) => px / 64;
  const v = (py: number) => 1.0 - py / 32;

  // Face definitions: 2 triangles per face (6 vertices each)
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const addQuad = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    norm: [number, number, number],
    uv0: [number, number],
    uv1: [number, number],
    uv2: [number, number],
    uv3: [number, number]
  ) => {
    // Triangle 1: p0, p1, p2
    positions.push(...p0, ...p1, ...p2);
    normals.push(...norm, ...norm, ...norm);
    uvs.push(...uv0, ...uv1, ...uv2);

    // Triangle 2: p0, p2, p3
    positions.push(...p0, ...p2, ...p3);
    normals.push(...norm, ...norm, ...norm);
    uvs.push(...uv0, ...uv2, ...uv3);
  };

  // 1. BACK Face (facing +Z, outer face seen from behind the player)
  // Texture: x=12, y=1, w=10, h=16
  {
    const u0 = u(12);
    const u1 = u(22);
    const v0 = v(17); // bottom
    const v1 = v(1);  // top
    addQuad(
      [-5, 0, 1],
      [-5, -16, 1],
      [5, -16, 1],
      [5, 0, 1],
      [0, 0, 1],
      [u0, v1],
      [u0, v0],
      [u1, v0],
      [u1, v1]
    );
  }

  // 2. FRONT Face (facing -Z, inner face facing player body back)
  // Texture: x=1, y=1, w=10, h=16
  {
    const u0 = u(1);
    const u1 = u(11);
    const v0 = v(17);
    const v1 = v(1);
    addQuad(
      [5, 0, 0],
      [5, -16, 0],
      [-5, -16, 0],
      [-5, 0, 0],
      [0, 0, -1],
      [u0, v1],
      [u0, v0],
      [u1, v0],
      [u1, v1]
    );
  }

  // 3. RIGHT Side Face (+X side, player's left / cape's right edge)
  // Connects Back (+X, u=22) and Front (+X, u=1) -> wraps across seam (u: 0..1)
  // Texture: x=0, y=1, w=1, h=16
  {
    const u0 = u(0);
    const u1 = u(1);
    const v0 = v(17);
    const v1 = v(1);
    addQuad(
      [5, 0, 1],
      [5, -16, 1],
      [5, -16, 0],
      [5, 0, 0],
      [1, 0, 0],
      [u0, v1],
      [u0, v0],
      [u1, v0],
      [u1, v1]
    );
  }

  // 4. LEFT Side Face (-X side, player's right / cape's left edge)
  // Connects Front (-X, u=11) and Back (-X, u=12) -> seam at (u: 11..12)
  // Texture: x=11, y=1, w=1, h=16
  {
    const u0 = u(11);
    const u1 = u(12);
    const v0 = v(17);
    const v1 = v(1);
    addQuad(
      [-5, 0, 0],
      [-5, -16, 0],
      [-5, -16, 1],
      [-5, 0, 1],
      [-1, 0, 0],
      [u0, v1],
      [u0, v0],
      [u1, v0],
      [u1, v1]
    );
  }

  // 5. TOP Face (facing +Y)
  // Texture: x=1, y=0, w=10, h=1
  {
    const u0 = u(1);
    const u1 = u(11);
    const v0 = v(1);
    const v1 = v(0);
    addQuad(
      [-5, 0, 0],
      [-5, 0, 1],
      [5, 0, 1],
      [5, 0, 0],
      [0, 1, 0],
      [u0, v0],
      [u0, v1],
      [u1, v1],
      [u1, v0]
    );
  }

  // 6. BOTTOM Face (facing -Y)
  // Texture: x=11, y=0, w=10, h=1
  {
    const u0 = u(11);
    const u1 = u(21);
    const v0 = v(1);
    const v1 = v(0);
    addQuad(
      [-5, -16, 1],
      [-5, -16, 0],
      [5, -16, 0],
      [5, -16, 1],
      [0, -1, 0],
      [u0, v1],
      [u0, v0],
      [u1, v0],
      [u1, v1]
    );
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // Rotate cape orientation 180° around Y-axis to match Minecraft model specification:
  // Swaps front and back faces so the front and back correspond correctly to Minecraft cape rendering.
  // Translating by (0, 0, 1) preserves bounding box depth in [0, 1], perfectly positioned behind the torso.
  geom.rotateY(Math.PI);
  geom.translate(0, 0, 1);

  return geom;
}

export function createPlayerBodyGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'player-body';

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
    metalness: 0.1,
  });

  const secondaryMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
    metalness: 0.1,
  });

  // Torso: 8 wide, 12 high, 4 deep (centered at X=0, Y=-6, Z=0)
  const torsoGeom = new THREE.BoxGeometry(8, 12, 4);
  const torso = new THREE.Mesh(torsoGeom, bodyMaterial);
  torso.position.set(0, -6, 0);
  torso.castShadow = true;
  group.add(torso);

  // Head: 8x8x8 (centered at X=0, Y=4, Z=0)
  const headGeom = new THREE.BoxGeometry(8, 8, 8);
  const head = new THREE.Mesh(headGeom, secondaryMaterial);
  head.position.set(0, 4, 0);
  head.castShadow = true;
  group.add(head);

  // Right Arm: 4x12x4 (X: -6, Y: -6, Z: 0)
  const armGeom = new THREE.BoxGeometry(4, 12, 4);
  const rightArm = new THREE.Mesh(armGeom, bodyMaterial);
  rightArm.position.set(-6, -6, 0);
  group.add(rightArm);

  // Left Arm: 4x12x4 (X: +6, Y: -6, Z: 0)
  const leftArm = new THREE.Mesh(armGeom, bodyMaterial);
  leftArm.position.set(6, -6, 0);
  group.add(leftArm);

  // Right Leg: 4x12x4 (X: -2, Y: -18, Z: 0)
  const legGeom = new THREE.BoxGeometry(4, 12, 4);
  const rightLeg = new THREE.Mesh(legGeom, secondaryMaterial);
  rightLeg.position.set(-2, -18, 0);
  group.add(rightLeg);

  // Left Leg: 4x12x4 (X: +2, Y: -18, Z: 0)
  const leftLeg = new THREE.Mesh(legGeom, secondaryMaterial);
  leftLeg.position.set(2, -18, 0);
  group.add(leftLeg);

  return group;
}
