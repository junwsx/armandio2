// Personalizzazione: nomi, titolo, frasi. Salvata in settings.personal (modificabile da Altro → Personalizza)
import { useStore } from './store.jsx';

export const DEFAULT_PERSONAL = {
  title: "L'armadio di Ciro",
  adminName: 'Ciro',
  viewerName: 'Enza',
  showPhrases: true,
  phrasesAdmin: [
    'Ciao Ciro, oggi che look si fa? 😎',
    'Prima di uscire: outfit check con Enza? 💛',
    'Meno shopping, più abbinamenti 💡',
    'Stile: on. Ritardo: off. ⏱️',
    'Quel maglione non lo metti da un po’… 👀',
  ],
  phrasesViewer: [
    'Per favore, amore mio, aiutami a scegliere cosa mettere 🥺',
    'Enza, stylist ufficiale di questo armadio ✨',
    'Approvato o bocciato? Decidi tu 👀',
    'Senza di te mi vesto a caso. Aiutami tu 💛',
    'Dress code della serata? Scegli tu, amore 💃',
  ],
};

export function usePersonal() {
  const { settingsBy, role } = useStore();
  const p = { ...DEFAULT_PERSONAL, ...(settingsBy?.personal || {}) };
  const isViewer = role === 'viewer';
  return {
    ...p,
    me: isViewer ? p.viewerName : p.adminName,
    phrases: (isViewer ? p.phrasesViewer : p.phrasesAdmin).filter((s) => s && s.trim()),
    isViewer,
  };
}

// testi pubblici della pagina di login (file login.json nello spazio pubblico)
export const DEFAULT_LOGIN = { title: 'Ciro & Enza', subtitle: 'Il nostro armadio, sempre con noi.', photo: null };
