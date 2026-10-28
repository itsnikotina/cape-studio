import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createCapeGeometry, createPlayerBodyGroup } from '../core/CapePreview3D';
import type { DocumentModel } from '../core/DocumentModel';
import { Eye, EyeOff, Play, Pause, Camera, Upload } from 'lucide-react';

interface Preview3DPanelProps {
  document: DocumentModel;
  version: number;
}

export const Preview3DPanel: React.FC<Preview3DPanelProps> = ({ document: doc, version }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const skinInputRef = useRef<HTMLInputElement>(null);

  // States
  const [showBody, setShowBody] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const isAnimatingRef = useRef(isAnimating);
  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);
  const [hasCustomSkin, setHasCustomSkin] = useState(false);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const capeMeshRef = useRef<THREE.Mesh | null>(null);
  const capeTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const playerBodyRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Orbit controls state
  const isDraggingRef = useRef(false);
  const previousPointerRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({
    radius: 36,
    theta: 0, // 0 = viewing from +Z (Cape back / outside)
    phi: Math.PI / 2, // horizontal level
  });
  const targetRef = useRef(new THREE.Vector3(0, -6, 0));

  // Update camera position from spherical coordinates
  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(
      targetRef.current.x + x,
      targetRef.current.y + y,
      targetRef.current.z + z
    );
    cameraRef.current.lookAt(targetRef.current);
  }, []);

  const lastDimensionsRef = useRef({ width: doc.dimensions.width, height: doc.dimensions.height });

  // Update Cape Texture from Document
  const updateCapeTexture = useCallback(() => {
    if (!capeTextureRef.current || !capeMeshRef.current) return;
    const compCanvas = doc.getCompositeCanvas();

    if (
      lastDimensionsRef.current.width !== doc.dimensions.width ||
      lastDimensionsRef.current.height !== doc.dimensions.height
    ) {
      lastDimensionsRef.current = { width: doc.dimensions.width, height: doc.dimensions.height };

      capeTextureRef.current.dispose();
      const newTex = new THREE.CanvasTexture(compCanvas);
      newTex.magFilter = THREE.NearestFilter;
      newTex.minFilter = THREE.NearestFilter;
      newTex.generateMipmaps = false;
      newTex.colorSpace = THREE.SRGBColorSpace;
      capeTextureRef.current = newTex;

      const mat = capeMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.map = newTex;
      mat.needsUpdate = true;
    } else {
      capeTextureRef.current.needsUpdate = true;
    }
  }, [doc]);

  // Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCamera();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(20, 40, 30);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.6);
    dirLight2.position.set(-20, -20, -30);
    scene.add(dirLight2);

    // Cape Mesh
    const capeGeom = createCapeGeometry();
    const compCanvas = doc.getCompositeCanvas();
    const capeTexture = new THREE.CanvasTexture(compCanvas);
    capeTexture.magFilter = THREE.NearestFilter;
    capeTexture.minFilter = THREE.NearestFilter;
    capeTexture.generateMipmaps = false;
    capeTexture.colorSpace = THREE.SRGBColorSpace;
    capeTextureRef.current = capeTexture;

    const capeMaterial = new THREE.MeshStandardMaterial({
      map: capeTexture,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const capeMesh = new THREE.Mesh(capeGeom, capeMaterial);
    // Attach cape to back of torso (Torso back is Z = 2.0). Standoff at Z = 2.15.
    // Backward tilt (-0.188 rads) hangs it away from the torso and legs.
    capeMesh.position.set(0, 0, 2.15);
    capeMesh.rotation.x = -0.188; // -10.8 degrees backward away from body
    capeMesh.castShadow = true;
    capeMeshRef.current = capeMesh;
    scene.add(capeMesh);

    // Player Body
    const playerBody = createPlayerBodyGroup();
    playerBodyRef.current = playerBody;
    scene.add(playerBody);

    // Render loop with subtle idle swing animation
    let time = 0;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      time += 0.03;

      if (capeMeshRef.current) {
        if (isAnimatingRef.current) {
          // Gentle Minecraft idle cape wind sway backwards
          const sway = Math.sin(time) * 0.04;
          capeMeshRef.current.rotation.x = -0.188 - Math.abs(sway);
        } else {
          capeMeshRef.current.rotation.x = -0.188;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    const mount = mountRef.current;

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement && mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      capeGeom.dispose();
      capeMaterial.dispose();
      capeTexture.dispose();
    };
  }, [doc, updateCamera]);

  // Sync texture when document updates or version changes
  useEffect(() => {
    updateCapeTexture();
    const unsubscribe = doc.subscribe(() => {
      updateCapeTexture();
    });
    return unsubscribe;
  }, [doc, version, updateCapeTexture]);

  // Toggle player body visibility
  useEffect(() => {
    if (playerBodyRef.current) {
      playerBodyRef.current.visible = showBody;
    }
  }, [showBody]);

  // Pointer Orbit Controls
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    previousPointerRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - previousPointerRef.current.x;
    const deltaY = e.clientY - previousPointerRef.current.y;
    previousPointerRef.current = { x: e.clientX, y: e.clientY };

    const speed = 0.008;
    sphericalRef.current.theta -= deltaX * speed;
    sphericalRef.current.phi = Math.max(
      0.05,
      Math.min(Math.PI - 0.05, sphericalRef.current.phi - deltaY * speed)
    );

    updateCamera();
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.03;
    sphericalRef.current.radius = Math.max(12, Math.min(80, sphericalRef.current.radius + zoomDelta));
    updateCamera();
  };

  // Preset Views
  const setCameraPreset = (preset: 'back' | 'front' | 'left' | 'right' | 'iso') => {
    switch (preset) {
      case 'back':
        sphericalRef.current.theta = 0; // Behind player, looking straight at cape
        sphericalRef.current.phi = Math.PI / 2;
        break;
      case 'front':
        sphericalRef.current.theta = Math.PI; // Looking at front of player
        sphericalRef.current.phi = Math.PI / 2;
        break;
      case 'left':
        sphericalRef.current.theta = Math.PI / 2;
        sphericalRef.current.phi = Math.PI / 2;
        break;
      case 'right':
        sphericalRef.current.theta = -Math.PI / 2;
        sphericalRef.current.phi = Math.PI / 2;
        break;
      case 'iso':
        sphericalRef.current.theta = -Math.PI / 4;
        sphericalRef.current.phi = Math.PI / 2.6;
        break;
    }
    updateCamera();
  };

  // Custom Skin Loader
  const handleLoadCustomSkin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !playerBodyRef.current) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const skinTexture = new THREE.Texture(img);
        skinTexture.magFilter = THREE.NearestFilter;
        skinTexture.minFilter = THREE.NearestFilter;
        skinTexture.generateMipmaps = false;
        skinTexture.needsUpdate = true;

        const skinMaterial = new THREE.MeshStandardMaterial({
          map: skinTexture,
          roughness: 0.9,
          metalness: 0.1,
        });

        // Apply skin material to body meshes
        playerBodyRef.current?.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = skinMaterial;
          }
        });
        setHasCustomSkin(true);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="right-panel">
      {/* Hidden skin file input */}
      <input
        ref={skinInputRef}
        type="file"
        accept="image/png"
        style={{ display: 'none' }}
        onChange={handleLoadCustomSkin}
      />

      <div className="preview-3d-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Camera size={15} color="var(--accent-color)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
            Prévia 3D em Tempo Real
          </span>
        </div>
        <button
          className="btn btn-icon"
          style={{ width: 26, height: 26 }}
          onClick={() => setIsAnimating(!isAnimating)}
          title={isAnimating ? 'Pausar animação de vento' : 'Ativar animação de vento'}
        >
          {isAnimating ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>

      {/* Interactive 3D Canvas Area */}
      <div
        ref={mountRef}
        className="preview-3d-canvas-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{ cursor: 'grab' }}
      />

      {/* Controls Bar */}
      <div className="preview-controls-bar">
        {/* Camera Presets */}
        <div className="camera-presets">
          <button
            className="btn camera-preset-btn"
            onClick={() => setCameraPreset('back')}
            title="Vista Traseira (Capa)"
          >
            Traseira
          </button>
          <button
            className="btn camera-preset-btn"
            onClick={() => setCameraPreset('front')}
            title="Vista Frontal (Frente)"
          >
            Frente
          </button>
          <button
            className="btn camera-preset-btn"
            onClick={() => setCameraPreset('right')}
            title="Lateral Direita"
          >
            Dir.
          </button>
          <button
            className="btn camera-preset-btn"
            onClick={() => setCameraPreset('left')}
            title="Lateral Esquerda"
          >
            Esq.
          </button>
          <button
            className="btn camera-preset-btn"
            onClick={() => setCameraPreset('iso')}
            title="Perspectiva Isométrica"
          >
            Iso
          </button>
        </div>

        {/* Visibility and Skin Toggles */}
        <div className="preview-toggles">
          <button
            className={`btn ${showBody ? '' : 'active'}`}
            style={{ flex: 1, fontSize: '0.75rem' }}
            onClick={() => setShowBody(!showBody)}
          >
            {showBody ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showBody ? 'Ocultar Corpo' : 'Exibir Corpo'}</span>
          </button>

          <button
            className="btn"
            style={{ flex: 1, fontSize: '0.75rem' }}
            onClick={() => skinInputRef.current?.click()}
            title="Carregar skin personalizada (.png) para o manequim"
          >
            <Upload size={13} />
            <span>{hasCustomSkin ? 'Trocar Skin' : 'Skin Própria'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
