export interface PresetAvatar {
  id: string;
  nameEn: string;
  nameRu: string;
  badge: string;
  color: string;
  bgGradient: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: "avatar_cyber_wing",
    nameEn: "Cyber Wing",
    nameRu: "Кибер Крыло",
    badge: "🛸",
    color: "#00f5d4",
    bgGradient: "from-[#00f5d4]/20 to-[#120a2e]",
  },
  {
    id: "avatar_cosmic_ace",
    nameEn: "Cosmic Ace",
    nameRu: "Космический Ас",
    badge: "⚡",
    color: "#ffb703",
    bgGradient: "from-[#ffb703]/20 to-[#120a2e]",
  },
  {
    id: "avatar_nebula_sentinel",
    nameEn: "Nebula Sentinel",
    nameRu: "Страж Небулы",
    badge: "🛡️",
    color: "#9d4edd",
    bgGradient: "from-[#9d4edd]/20 to-[#120a2e]",
  },
  {
    id: "avatar_starlight_scout",
    nameEn: "Starlight Scout",
    nameRu: "Звёздный Скаут",
    badge: "🌟",
    color: "#ff007f",
    bgGradient: "from-[#ff007f]/20 to-[#120a2e]",
  },
  {
    id: "avatar_quantum_commander",
    nameEn: "Quantum Admiral",
    nameRu: "Квантовый Адмирал",
    badge: "👑",
    color: "#3a86ff",
    bgGradient: "from-[#3a86ff]/20 to-[#120a2e]",
  },
];

/**
 * Resizes and compresses an uploaded image file to a 192x192 JPEG Base64 string (~15-25KB).
 */
export async function compressImageToDataUrl(file: File, maxSizePx = 192, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid or corrupted image format"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSizePx;
        canvas.height = maxSizePx;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Canvas context unavailable"));
        }

        // Center crop 1:1
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSizePx, maxSizePx);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
