// Elaborazione foto nel browser: ridimensiona, comprime in WebP, rimuove lo sfondo (opzionale)

const loadBitmap = async (blob) => {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* fallback */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
};

const toBlob = (canvas, type = 'image/webp', q = 0.85) =>
  new Promise((res) => canvas.toBlob((b) => {
    if (b) return res(b);
    canvas.toBlob(res, 'image/jpeg', q); // Safari vecchi senza WebP
  }, type, q));

export async function resize(blob, max, q = 0.85, transparent = false) {
  const bmp = await loadBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext('2d');
  if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return toBlob(c, 'image/webp', q);
}

// ritaglia i bordi trasparenti dopo la rimozione sfondo, lasciando un margine
async function trimTransparent(blob, pad = 0.06) {
  const bmp = await loadBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    if (data[(y * width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) return blob;
  const bw = x1 - x0, bh = y1 - y0, p = Math.round(Math.max(bw, bh) * pad);
  const o = document.createElement('canvas');
  o.width = bw + p * 2; o.height = bh + p * 2;
  o.getContext('2d').drawImage(c, x0, y0, bw, bh, p, p, bw, bh);
  return toBlob(o, 'image/png', 1);
}

export async function removeBackground(blob, onProgress) {
  const { removeBackground: rb } = await import('@imgly/background-removal');
  const out = await rb(blob, {
    output: { format: 'image/png' },
    progress: (key, cur, total) => onProgress?.(key.includes('fetch') ? `Scarico il modello… ${Math.round((cur / total) * 100)}%` : 'Rimuovo lo sfondo…'),
  });
  return trimTransparent(out);
}

// produce { full, thumb } pronti per l'upload
export async function prepare(blob, transparent = false) {
  const [full, thumb] = await Promise.all([resize(blob, 1400, 0.85, transparent), resize(blob, 520, 0.8, transparent)]);
  return { full, thumb };
}
