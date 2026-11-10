import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Heart, Shuffle } from 'lucide-react';
import { usePersonal } from '../lib/personal.js';
import { isoDate, cx } from '../lib/utils.js';

/* ---------- foto ritagliata a cuore ---------- */
export function HeartPhoto({ src, size = 220, className }) {
  return (
    <div className={cx('heart-wrap', className)} style={{ width: size, height: size }}>
      <div className="heart">{src ? <img src={src} alt="" /> : <Heart size={size / 3} strokeWidth={1.2} />}</div>
    </div>
  );
}

/* ---------- frase pop chiudibile (si chiude per oggi) ---------- */
const KEY = 'armadio-frase-chiusa';
export function PhraseBanner() {
  const { phrases, showPhrases, isViewer } = usePersonal();
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem(KEY) === isoDate(); } catch { return false; } });
  const [i, setI] = useState(() => Math.floor(Math.random() * 1000));
  if (!showPhrases || closed || !phrases.length) return null;
  const text = phrases[i % phrases.length];
  const close = () => { setClosed(true); try { localStorage.setItem(KEY, isoDate()); } catch { /* */ } };
  return (
    <div className="phrase">
      <button className="phrase__text" onClick={() => setI(i + 1)} aria-label="Un'altra frase">
        <span>{text}</span>
        {phrases.length > 1 && <Shuffle size={13} className="phrase__shuffle" />}
      </button>
      {isViewer && <Link to="/ispirazioni" className="phrase__cta"><Heart size={13} fill="currentColor" />Scegli tu</Link>}
      <button className="phrase__x" onClick={close} aria-label="Chiudi per oggi"><X size={16} /></button>
    </div>
  );
}

/* ---------- editor ritaglio a cuore ---------- */
export function HeartCropper({ file, onCancel, onSave, busy }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const canvasRef = useRef();
  const drag = useRef(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    const im = new Image(); im.onload = () => setImg(im); im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const draw = (c, S) => {
    const ctx = c.getContext('2d');
    c.width = S; c.height = S;
    const side = Math.min(img.width, img.height) / zoom;
    const sx = (img.width - side) * pos.x, sy = (img.height - side) * pos.y;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
  };
  useEffect(() => { if (img && canvasRef.current) draw(canvasRef.current, 560); }); // eslint-disable-line

  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, p: pos }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!drag.current || !img) return;
    const side = Math.min(img.width, img.height) / zoom;
    const rangeX = img.width - side, rangeY = img.height - side;
    const k = side / e.currentTarget.clientWidth;
    const nx = rangeX > 0 ? drag.current.p.x - ((e.clientX - drag.current.x) * k) / rangeX : 0.5;
    const ny = rangeY > 0 ? drag.current.p.y - ((e.clientY - drag.current.y) * k) / rangeY : 0.5;
    setPos({ x: Math.min(1, Math.max(0, nx)), y: Math.min(1, Math.max(0, ny)) });
  };
  const save = async () => {
    const c = document.createElement('canvas'); draw(c, 900);
    const blob = await new Promise((r) => c.toBlob((b) => r(b || null), 'image/webp', 0.88));
    onSave(blob || await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)));
  };
  return (
    <div className="cropper">
      <div className="heart-wrap heart-wrap--edit" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }}>
        <div className="heart"><canvas ref={canvasRef} /></div>
      </div>
      <p className="muted small center">Trascina la foto per spostarla dentro il cuore</p>
      <label className="field"><span className="field__label">Zoom</span>
        <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      </label>
      <div className="row gap">
        <button className="btn" onClick={onCancel} disabled={busy}>Annulla</button>
        <button className="btn btn--primary grow" onClick={save} disabled={!img || busy}>{busy ? 'Salvo…' : 'Usa questa foto'}</button>
      </div>
    </div>
  );
}
