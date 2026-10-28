import type { DocumentModel } from './DocumentModel';

export class TextureExporter {
  /**
   * Generates a PNG Blob directly from the composited document
   */
  static async exportToBlob(document: DocumentModel): Promise<Blob> {
    const compCanvas = document.composite();
    return new Promise((resolve, reject) => {
      compCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Falha ao gerar PNG da textura.'));
        }
      }, 'image/png');
    });
  }

  /**
   * Generates a base64 Data URL for the texture
   */
  static exportToDataURL(document: DocumentModel): string {
    const compCanvas = document.composite();
    return compCanvas.toDataURL('image/png');
  }

  /**
   * Triggers download of the texture file
   */
  static async downloadTexture(document: DocumentModel, filename = 'cape.png'): Promise<{
    width: number;
    height: number;
    filename: string;
  }> {
    const blob = await this.exportToBlob(document);
    const cleanFilename = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;

    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      width: document.dimensions.width,
      height: document.dimensions.height,
      filename: cleanFilename,
    };
  }
}
