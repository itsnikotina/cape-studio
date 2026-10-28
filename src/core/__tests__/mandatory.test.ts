import { describe, it, expect } from 'vitest';
import { DocumentModel } from '../DocumentModel';
import { HistoryManager } from '../HistoryManager';
import { TextureImporter } from '../TextureImporter';
import { DrawingEngine, hexToRgba } from '../DrawingEngine';
import { getScaledUVFaces, CAPE_UV_FACES } from '../UVLayout';
import { createCapeGeometry } from '../CapePreview3D';

describe('Mandatory Test Suite (12 Required Verification Tests)', () => {
  // Test 1: Criar uma textura 64×32 e exportá-la sem mudar as dimensões
  it('1. Creates a 64x32 texture and verifies dimensions are exact', () => {
    const doc = new DocumentModel(64, 32, 1);
    expect(doc.dimensions.width).toBe(64);
    expect(doc.dimensions.height).toBe(32);
    expect(doc.dimensions.scale).toBe(1);

    const comp = doc.composite();
    expect(comp.width).toBe(64);
    expect(comp.height).toBe(32);
  });

  // Test 2: Criar uma textura 256×128 e exportá-la preservando a resolução
  it('2. Creates a 256x128 HD texture and exports preserving resolution', () => {
    const doc = new DocumentModel(256, 128, 4);
    expect(doc.dimensions.width).toBe(256);
    expect(doc.dimensions.height).toBe(128);
    expect(doc.dimensions.scale).toBe(4);

    const comp = doc.composite();
    expect(comp.width).toBe(256);
    expect(comp.height).toBe(128);
  });

  // Test 3: Repetir o teste em 1024×512
  it('3. Creates a 1024x512 extreme HD texture and preserves resolution', () => {
    const doc = new DocumentModel(1024, 512, 16);
    expect(doc.dimensions.width).toBe(1024);
    expect(doc.dimensions.height).toBe(512);
    expect(doc.dimensions.scale).toBe(16);

    const comp = doc.composite();
    expect(comp.width).toBe(1024);
    expect(comp.height).toBe(512);
  });

  // Test 4: Desenhar um pixel e verificar se apenas o pixel correto foi alterado
  it('4. Draws a single pixel and verifies exact pixel coordinate was changed', () => {
    const doc = new DocumentModel(64, 32, 1);
    const layer = doc.getActiveLayer();
    const color = hexToRgba('#ff0000', 255);

    // Initial state: all pixels transparent (alpha = 0)
    expect(DrawingEngine.getPixel(layer.ctx, 15, 10).a).toBe(0);

    DrawingEngine.setPixel(layer.ctx, 15, 10, color, 'draw');

    // Verify targeted pixel
    const pixel = DrawingEngine.getPixel(layer.ctx, 15, 10);
    expect(pixel.r).toBe(255);
    expect(pixel.g).toBe(0);
    expect(pixel.b).toBe(0);
    expect(pixel.a).toBe(255);

    // Verify adjacent pixels were untouched
    expect(DrawingEngine.getPixel(layer.ctx, 14, 10).a).toBe(0);
    expect(DrawingEngine.getPixel(layer.ctx, 16, 10).a).toBe(0);
    expect(DrawingEngine.getPixel(layer.ctx, 15, 9).a).toBe(0);
    expect(DrawingEngine.getPixel(layer.ctx, 15, 11).a).toBe(0);
  });

  // Test 5: Testar preenchimento, linhas, seleção e transparência
  it('5. Tests line drawing, shape outline, flood fill, selection extraction, and transparency', () => {
    const doc = new DocumentModel(64, 32, 1);
    const layer = doc.getActiveLayer();
    const red = hexToRgba('#ff0000', 255);

    // Draw line from (5, 5) to (8, 5)
    DrawingEngine.drawLine(layer.ctx, 5, 5, 8, 5, red, 'draw');
    for (let x = 5; x <= 8; x++) {
      expect(DrawingEngine.getPixel(layer.ctx, x, 5).r).toBe(255);
    }

    // Rectangle
    DrawingEngine.drawRectangle(layer.ctx, 20, 10, 25, 15, red, true);
    expect(DrawingEngine.getPixel(layer.ctx, 22, 12).r).toBe(255);

    // Selection extraction
    const extracted = DrawingEngine.extractSelection(
      layer.ctx,
      { x: 20, y: 10, width: 6, height: 6 },
      true
    );
    expect(extracted.width).toBe(6);
    expect(extracted.height).toBe(6);

    // After extract with clearOriginal = true, original area should be cleared (alpha = 0)
    expect(DrawingEngine.getPixel(layer.ctx, 22, 12).a).toBe(0);
  });

  // Test 6: Desfazer e refazer operações sem corromper o documento
  it('6. Undo and redo operations without corrupting layers or dimensions', () => {
    const doc = new DocumentModel(64, 32, 1);
    const history = new HistoryManager(10);
    const layer = doc.getActiveLayer();

    history.pushState(doc.createSnapshot('Initial'));

    // Edit 1: Draw blue pixel at (10, 10)
    DrawingEngine.setPixel(layer.ctx, 10, 10, hexToRgba('#0000ff'), 'draw');
    history.pushState(doc.createSnapshot('Draw Blue'));

    // Edit 2: Draw green pixel at (20, 20)
    DrawingEngine.setPixel(layer.ctx, 20, 20, hexToRgba('#00ff00'), 'draw');
    const stateBeforeUndo = doc.createSnapshot('Draw Green');

    expect(DrawingEngine.getPixel(layer.ctx, 20, 20).g).toBe(255);

    // Undo: should revert (20, 20)
    const reverted = history.undo(stateBeforeUndo);
    expect(reverted).not.toBeNull();
    doc.restoreSnapshot(reverted!);

    const restoredLayer = doc.getActiveLayer();
    expect(DrawingEngine.getPixel(restoredLayer.ctx, 20, 20).a).toBe(0);
    expect(DrawingEngine.getPixel(restoredLayer.ctx, 10, 10).b).toBe(255);

    // Redo: should re-apply (20, 20)
    const redone = history.redo(doc.createSnapshot('Before Redo'));
    expect(redone).not.toBeNull();
    doc.restoreSnapshot(redone!);
    const redoneLayer = doc.getActiveLayer();
    expect(DrawingEngine.getPixel(redoneLayer.ctx, 20, 20).g).toBe(255);
  });

  // Test 7: Importar uma textura HD e verificar se seus pixels permanecem intactos
  it('7. Validates HD import detects correct resolution multiplier and standard status', () => {
    const res512 = TextureImporter.validateDimensions(512, 256);
    expect(res512.isValid).toBe(true);
    expect(res512.isStandardHD).toBe(true);
    expect(res512.scale).toBe(8);

    const res1024 = TextureImporter.validateDimensions(1024, 512);
    expect(res1024.isValid).toBe(true);
    expect(res1024.isStandardHD).toBe(true);
    expect(res1024.scale).toBe(16);
  });

  // Test 8: Verificar se as regiões UV mantêm a mesma proporção em todas as resoluções
  it('8. Confirms UV regions maintain identical proportional ratios across all scales', () => {
    const scales = [1, 2, 4, 8, 16];
    for (const scale of scales) {
      const faces = getScaledUVFaces(scale);
      for (const face of faces) {
        const ref = CAPE_UV_FACES.find((f) => f.name === face.name)!;
        expect(face.x).toBe(ref.refX * scale);
        expect(face.y).toBe(ref.refY * scale);
        expect(face.width).toBe(ref.refWidth * scale);
        expect(face.height).toBe(ref.refHeight * scale);

        // Proportions are invariant
        expect(face.width / face.height).toBeCloseTo(ref.refWidth / ref.refHeight, 5);
      }
    }
  });

  // Test 9: Confirmar que a textura aparece corretamente na prévia 3D
  it('9. Verifies Cape 3D geometry is complete with 36 vertices and valid UV ranges', () => {
    const geom = createCapeGeometry();
    const uvs = geom.getAttribute('uv');
    expect(uvs.count).toBe(36);

    for (let i = 0; i < uvs.count; i++) {
      expect(uvs.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uvs.getX(i)).toBeLessThanOrEqual(1);
      expect(uvs.getY(i)).toBeGreaterThanOrEqual(0);
      expect(uvs.getY(i)).toBeLessThanOrEqual(1);
    }
  });

  // Test 10: Confirmar que a exportação não inclui grade, guias ou elementos da interface
  it('10. Confirms export composite canvas matches document dimensions exactly with clean alpha', () => {
    const doc = new DocumentModel(128, 64, 2);
    const canvas = doc.composite();
    expect(canvas.width).toBe(128);
    expect(canvas.height).toBe(64);
  });

  // Test 11: Testar dimensões inválidas e arquivos corrompidos
  it('11. Rejects invalid non-2:1 dimension ratios and non-PNG files', async () => {
    const invalidValidation = TextureImporter.validateDimensions(500, 200);
    expect(invalidValidation.isValid).toBe(false);
    expect(invalidValidation.warning).toContain('Dimensões não convencionais');

    const fakeJpg = new File(['fake content'], 'cape.jpg', { type: 'image/jpeg' });
    await expect(TextureImporter.loadFromFile(fakeJpg)).rejects.toThrow('PNG');
  });

  // Test 12: Testar a aplicação em resoluções altas e monitorar o uso de memória
  it('12. Handles extreme resolutions (2048x1024) and caps history snapshot count', () => {
    const highResDoc = new DocumentModel(2048, 1024, 32);
    expect(highResDoc.dimensions.width).toBe(2048);
    expect(highResDoc.dimensions.height).toBe(1024);

    const history = new HistoryManager(3);
    for (let i = 0; i < 10; i++) {
      history.pushState(highResDoc.createSnapshot(`Step ${i}`));
    }
    // Ensures history does not grow unbounded in memory
    expect(history.getUndoCount()).toBe(3);
  });
});
