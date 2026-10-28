# CAPE STUDIO — Editor de Texturas de Capas de Minecraft

Editor web de texturas de capas de Minecraft de alta precisão, com suporte a resoluções HD, desenho pixel a pixel, sistema de camadas, importação/exportação de PNG sem perda e prévia 3D em tempo real construída com Three.js.

---

## 🚀 Funcionalidades

### 1. Resoluções e Compatibilidade HD
- **Padrão:** 64×32 (1x).
- **HD Nativo:** 128×64 (2x), 256×128 (4x), 512×256 (8x), 1024×512 (16x).
- **Personalizado:** Escolha qualquer multiplicador inteiro proporcional ao padrão Minecraft.
- **Mapeamento UV Proporcional:** As 6 faces da capa (`Cima`, `Baixo`, `Direita`, `Frente/Interna`, `Esquerda`, `Traseira/Externa`) mantêm proporções físicas exatas em qualquer escala.
- **Validação Inteligente:** Alerta para arquivos que não respeitem a proporção 2:1 ou múltiplos de 64×32 sem distorcer nem reduzir os pixels.

### 2. Editor 2D Pixel-a-Pixel
- **Ferramentas:**
  - Lápis (`P`)
  - Borracha (`E`)
  - Conta-gotas (`I`)
  - Balde de Tinta / Preenchimento (`G`)
  - Linha com algoritmo de Bresenham (`L`)
  - Retângulo com contorno (`U`) e preenchido (`Shift+U`)
  - Elipse de ponto médio (`C`) e preenchida (`Shift+C`)
  - Seleção retangular (`M`)
  - Mover seleção flutuante (`V`)
  - Copiar (`Ctrl+C`), Recortar (`Ctrl+X`), Colar (`Ctrl+V`) e Espelhar Horizontalmente
- **Recursos Visuais:**
  - Grade de pixels nítida com zoom automático.
  - Guias UV coloridas com nomes de cada face.
  - Espelhamento horizontal em tempo real para desenhos simétricos.
  - Exibição contínua das coordenadas do cursor (`X`, `Y`) e da face UV sob o ponteiro.
  - Zoom de 100% até 3200% centrado no cursor e panorâmica com botão do meio ou `Espaço + Arraste`.

### 3. Sistema de Camadas
- Camadas independentes com resolução nativa do documento.
- Criação, duplicação, renomeação, reordenação e exclusão.
- Controle individual de visibilidade e opacidade (0% a 100%).
- Composição preservando canal alfa (transparência).

### 4. Prévia 3D em Tempo Real (Three.js)
- Geometria tridimensional precisa da capa (10×16×1 unidades) com as 6 faces mapeadas fielmente ao layout do Minecraft.
- Textura atualizada em tempo real conforme você desenha no Canvas 2D.
- Controles orbitais de câmera (rotação livre, zoom com scroll e pan).
- Presets rápidos de visualização: **Traseira (Capa)**, **Frente**, **Lateral Direita**, **Lateral Esquerda** e **Isométrica**.
- Animação de vento suave (*idle sway*) ativável/desativável.
- Manequim do jogador com opção de ocultar para inspecionar a capa isolada.
- Suporte a carregamento de skin personalizada (`.png`) para o manequim.

### 5. Importação e Exportação
- **Importação:** Leitura direta de arquivos PNG via botão ou arrastar e soltar, detectando resolução e preservando os pixels originais sem blur.
- **Exportação:** Geração de PNG limpo na resolução exata do documento, preservando transparência e sem inclusão de grades ou elementos da interface.

---

## 🛠️ Como Executar o Projeto

### Pré-requisitos
- Node.js 18+ (recomendado Node.js 20+)
- npm

### Instalação
```bash
npm install
```

### Desenvolvimento
Inicie o servidor de desenvolvimento local:
```bash
npm run dev
```
O editor estará disponível em `http://localhost:5173/`.

### Testes Automatizados
Execução de toda a suíte de testes unitários e de integração (incluindo os 12 testes obrigatórios do plano de requisitos):
```bash
npm test
```

### Build de Produção
```bash
npm run build
```

---

## 📐 Layout UV de Capas Minecraft (64×32)

| Face | Posição Padrão (X, Y) | Tamanho Padrão (W × H) |
|---|---|---|
| **Cima (Top)** | (1, 0) | 10 × 1 |
| **Baixo (Bottom)** | (11, 0) | 10 × 1 |
| **Direita (Right)** | (0, 1) | 1 × 16 |
| **Frente (Front / Interna)** | (1, 1) | 10 × 16 |
| **Esquerda (Left)** | (11, 1) | 1 × 16 |
| **Traseira (Back / Externa)** | (12, 1) | 10 × 16 |

Em resoluções HD (ex: 512×256 com fator 8x), todas as coordenadas acima são multiplicadas pelo mesmo fator `S`, garantindo mapeamento UV sem distorções.
