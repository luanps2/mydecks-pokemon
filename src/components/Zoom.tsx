import { Modal } from "./Modal";

/* Carta ampliada, centralizada na tela; clique em qualquer lugar fecha */
export function Zoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <Modal open={!!src} onClose={onClose} label="Carta ampliada" className="zoom">
      <img src={src} alt={alt} onClick={onClose} />
    </Modal>
  );
}
