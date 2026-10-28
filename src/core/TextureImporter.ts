export interface ImportValidationResult {
  width: number;
  height: number;
  scale: number;
  isStandardHD: boolean;
  isValid: boolean;
  warning?: string;
  recommendation?: string;
}

export class TextureImporter {
  /**
   * Validate image dimensions against Minecraft cape standards
   */
  static validateDimensions(width: number, height: number): ImportValidationResult {
    // Standard Minecraft cape is 64x32 or an integer multiple of both
    const scaleX = width / 64;
    const scaleY = height / 32;

    const isIntegerScaleX = Number.isInteger(scaleX) && scaleX >= 1;
    const isIntegerScaleY = Number.isInteger(scaleY) && scaleY >= 1;

    if (isIntegerScaleX && isIntegerScaleY && scaleX === scaleY) {
      return {
        width,
        height,
        scale: scaleX,
        isStandardHD: true,
        isValid: true,
      };
    }

    // Ratio 2:1 but not multiple of 64x32
    if (Math.abs(width / height - 2.0) < 0.001) {
      return {
        width,
        height,
        scale: scaleX,
        isStandardHD: false,
        isValid: true,
        warning: `A proporção é 2:1 (${width}×${height}), mas as dimensões não são múltiplos exatos de 64×32. Alguns mods de capa podem rejeitar esta textura.`,
        recommendation: `Resoluções recomendadas: 64×32 (1x), 128×64 (2x), 256×128 (4x), 512×256 (8x), 1024×512 (16x).`,
      };
    }

    // Completely non-standard aspect ratio (e.g. 64x64 skin or square)
    return {
      width,
      height,
      scale: 1,
      isStandardHD: false,
      isValid: false,
      warning: `Dimensões não convencionais para capa de Minecraft (${width}×${height}). O formato padrão exige proporção 2:1 (ex: 64×32 ou 512×256).`,
      recommendation: `O arquivo será carregado preservando os pixels originais em modo personalizado, mas pode não encaixar no modelo 3D padrão.`,
    };
  }

  /**
   * Load image from File or Blob
   */
  static async loadFromFile(file: File): Promise<{
    image: HTMLImageElement;
    validation: ImportValidationResult;
  }> {
    if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      throw new Error('Formato inválido. Por favor, selecione um arquivo de imagem PNG.');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const validation = this.validateDimensions(img.naturalWidth, img.naturalHeight);
          resolve({ image: img, validation });
        };
        img.onerror = () => reject(new Error('Falha ao decodificar arquivo PNG. O arquivo pode estar corrompido.'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo do disco.'));
      reader.readAsDataURL(file);
    });
  }
}
