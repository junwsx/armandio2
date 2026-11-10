# 👕 Armadio Digitale

Il tuo guardaroba virtuale: capi con foto, categorie su più livelli, attributi personalizzati, filtri fissi, outfit con calendario, statistiche e ispirazioni per gli acquisti. È pensata per il telefono e si installa sulla schermata Home come un'app.

**Tecnologie:** React + Vite (frontend statico su **GitHub Pages**) · **Supabase** (database, login e foto) · nessun server da gestire, tutto gratuito.

---

## 🔐 Come funziona la sicurezza (da leggere)

Su GitHub Pages il codice dell'app è pubblico per forza. Per questo la sicurezza **non** si basa su segreti nascosti nel codice, ma sul database:

| Cosa | Dove sta | È un segreto? |
|---|---|---|
| URL di Supabase e chiave **anon / publishable** | GitHub Secrets → finiscono nell'app compilata | **No**: sono fatte per stare nel browser. Da sole non danno accesso a nulla. |
| Password degli utenti | Solo in Supabase (cifrate) + il tuo `credenziali.local.md` | **Sì**: non sono mai nel codice. |
| Chiave **service_role / secret** di Supabase | Da nessuna parte nell'app | **Sì**: non usarla mai qui. |

A proteggere i dati sono le regole **RLS** (Row Level Security) che `supabase/schema.sql` crea nel database:

- **admin** (tu): può leggere e scrivere tutto;
- **viewer**: può leggere tutto e creare i propri outfit;
- **pending** (qualsiasi nuovo utente): **non vede niente**. Anche se qualcuno riuscisse a registrarsi, resterebbe bloccato finché tu non gli assegni un ruolo;
- **le foto** stanno in uno spazio **privato**: si aprono solo con link temporanei, generati per chi ha fatto il login.

Le iscrizioni pubbliche vanno comunque disattivate (passo 1.3). Gli utenti li crei solo tu.

---

## 1. Supabase (circa 10 minuti)

1. **Crea l'account** su [supabase.com](https://supabase.com) → **New project**.
   Nome a piacere, region **Central EU (Frankfurt)**. Salva la password del database in `credenziali.local.md`.
   Nella sezione **Security**:
   - lascia attivo **Enable Data API**;
   - **togli** la spunta a **Automatically expose new tables** (i permessi li dà `schema.sql`);
   - **attiva** **Enable automatic RLS**.
2. **Crea il database**: menu a sinistra **SQL Editor** → **New query**. Incolla tutto il contenuto di `supabase/schema.sql` → **Run**.
   Così crei le tabelle, le regole di sicurezza, lo spazio per le foto, le categorie e gli attributi di partenza.
3. **Blocca le iscrizioni**: **Authentication** → **Sign In / Providers** (o *Settings*) → disattiva **Allow new users to sign up**.
4. **Crea i due utenti**: **Authentication** → **Users** → **Add user** → **Create new user**, con la spunta **Auto Confirm User**.
   - Tu: la tua email e una password robusta.
   - L'ospite: email `ospite@armadio.app` (non serve che esista davvero) e una password.
   
   Al login l'ospite può scrivere solo **`ospite`**: l'app aggiunge da sola `@armadio.app`.
5. **Assegna i ruoli**: torna in **SQL Editor**, sostituisci la tua email ed esegui:
   ```sql
   update public.profiles set role = 'admin'  where email = 'tua@email.it';
   update public.profiles set role = 'viewer' where email = 'ospite@armadio.app';
   ```
6. **Copia le chiavi**: **Project Settings** → **API** (o **Data API** / **API Keys**). Ti servono:
   - **Project URL**, del tipo `https://abcd.supabase.co`;
   - **anon public** oppure **publishable key**.
   
   Scrivile in `credenziali.local.md`.

## 2. GitHub Pages

1. Crea un **nuovo repository** su GitHub (es. `armadio`).
   GitHub Pages gratuito richiede un repository **pubblico**, e non è un problema: nel codice non ci sono dati né password.
2. **Carica i file** di questa cartella. Il modo più semplice è [GitHub Desktop](https://desktop.github.com): *Add existing repository* → scegli questa cartella → *Publish*.
   `node_modules`, `dist` e `credenziali.local.md` vengono esclusi in automatico.
3. **Aggiungi il workflow di pubblicazione**: su GitHub, nel repository, clicca **Add file** → **Create new file**.
   - Come nome scrivi esattamente `.github/workflows/deploy.yml`. Gli slash creano le cartelle da soli.
   - Come contenuto incolla tutto il file `deploy-github-pages.yml` che trovi in questa cartella.
   - Clicca **Commit changes**. Il file `deploy-github-pages.yml` puoi poi cancellarlo.

   In alternativa, sul PC crea la cartella `.github\workflows` e spostaci dentro il file rinominandolo `deploy.yml`.
4. Nel repository vai in **Settings** → **Secrets and variables** → **Actions** → **New repository secret** e crea:
   - `VITE_SUPABASE_URL` → il Project URL;
   - `VITE_SUPABASE_ANON_KEY` → la chiave anon/publishable.
5. **Settings** → **Pages** → **Source: GitHub Actions**.
6. Vai in **Actions** e avvia *Pubblica su GitHub Pages* (o fai un push). Dopo circa 1 minuto l'app è online su `https://TUO-UTENTE.github.io/armadio/`.

Ogni volta che modifichi il codice e fai push, l'app si aggiorna da sola.

## 3. Sul telefono

Apri l'indirizzo dell'app:
- **iPhone (Safari)**: Condividi → **Aggiungi alla schermata Home**;
- **Android (Chrome)**: menu ⋮ → **Installa app**.

Si apre a schermo intero, come un'app normale.

---

## 🔄 Aggiornamenti del database

Alcune funzioni nuove richiedono di eseguire **una volta** un piccolo script SQL in Supabase: **SQL Editor** → **New query** → incolla → **Run**. Lo script si può rieseguire senza problemi.

| File | A cosa serve |
|---|---|
| `supabase/aggiornamento-01-foto-login.sql` | Spazio pubblico per la foto a cuore e i testi della pagina di accesso |
| `supabase/aggiornamento-02-outfit-ospite.sql` | L'ospite può creare outfit (e modificare/cancellare solo i suoi) |

Chi installa da zero con `schema.sql` li ha già inclusi.

---

## 🧪 Provarla senza Supabase (modalità demo)

Senza le chiavi, l'app parte in **modalità demo** con capi di esempio salvati solo nel browser. È utile per provarla subito.

```bash
npm install
npm run dev          # apre http://localhost:5173
```

- Per collegarla a Supabase anche sul PC: copia `.env.example` in `.env.local` e inserisci le chiavi.
- Per vedere l'app come la vede l'ospite in demo: aggiungi `?ruolo=viewer` all'indirizzo.

---

## 📱 Cosa fa

- **Armadio**:
  - griglia 2 per riga (o 3), foto, nome e categoria;
  - attributi sotto la foto, scelti in *Altro → Visualizzazione griglia*. Puoi anche spegnere tutto e vedere solo le foto;
  - chip per le categorie e le sottocategorie, i preferiti e i **filtri fissi**;
  - ricerca testuale, filtri per qualsiasi attributo, 6 ordinamenti.
- **Nuovo capo**:
  - foto da fotocamera o galleria, compressa in automatico;
  - **rimozione dello sfondo** opzionale, fatta nel telefono (gratis, senza server);
  - nome, categoria e tutti gli attributi validi per quella categoria.
- **Categorie**: albero con livelli illimitati, icone, ordinamento. Il «ruolo» (sopra, sotto, scarpe…) serve agli abbinamenti automatici.
- **Attributi**: crei tu nome, tipo e opzioni colorate, e decidi:
  - se valgono solo per alcune categorie;
  - se compaiono nella griglia e tra i filtri.
  
  Tipi disponibili: scelta singola o multipla, testo, numero, data, stelle, sì/no. Quelli di base sono Stagione, Uso, Stato di usura, Colore, Taglia, Marca, Data di acquisto, Prezzo e Gradimento.
- **Outfit**: completi salvati con etichette e preferiti, più un **calendario** di cosa hai indossato ogni giorno. C'è anche il tasto rapido «L'ho indossato oggi».
- **Statistiche**:
  - capi più indossati;
  - **costo per utilizzo**;
  - capi mai indossati;
  - distribuzione per categoria, stagione, uso, usura e colore;
  - attività delle ultime 12 settimane.
- **Ispirazioni** (gratis, nessuna AI a pagamento):
  - *abbinamento del giorno* in base a stagione e uso, che preferisce i capi che non metti da tempo e limita i colori accesi;
  - *capi dimenticati* da riscoprire;
  - *colori mancanti* che si abbinano alla tua palette;
  - *capi da sostituire*;
  - checklist del **guardaroba capsula** (16 essenziali);
  - *buchi* per stagione e per uso;
  - link di ricerca pronti su Zalando, Vinted, Google Shopping e Pinterest, e una **lista desideri**.
- **Personalizza** (*Altro → Personalizza*):
  - titolo dell'armadio e nomi (Ciro come admin, Enza come ospite), con saluto in alto;
  - frasi «pop» diverse per ognuno: si cambiano toccandole e si chiudono fino al giorno dopo. Per l'ospite c'è anche il pulsante «Scegli tu»;
  - foto a cuore e testi della pagina di accesso. ⚠️ Questi sono visibili a chiunque apra il link.
- **Campi obbligatori** (*Altro → Campi obbligatori*): scegli se foto, categoria e ogni attributo sono obbligatori quando aggiungi un capo.
- **Backup**: *Altro → Esporta backup* scarica tutti i dati in JSON.
- **Importa da Whering**: *Altro → Importa da Whering*, scegli lo ZIP esportato (`whering-export/whering-export-con-foto.zip`). Crea capi, foto, categorie, colori, stagioni, uso, usura, marca, stile e outfit. Si può rilanciare senza creare doppioni.

## 📦 Limiti del piano gratuito Supabase

- 500 MB di database e 1 GB di foto. Ogni capo occupa circa 200 KB (foto + miniatura), quindi c'è spazio per migliaia di capi.
- Un progetto gratuito **va in pausa dopo circa 7 giorni senza utilizzo**: basta riattivarlo dalla dashboard con un clic. Se usi l'app regolarmente non succede.

## 🗂️ Struttura

```
supabase/schema.sql        database, sicurezza, dati iniziali
src/lib/backend.js         collegamento a Supabase + modalità demo
src/lib/store.jsx          stato dell'app, filtri, azioni
src/lib/inspo.js           motore delle ispirazioni
src/lib/images.js          compressione foto e rimozione sfondo
src/pages/                 Armadio, Capo, Outfit, Ispirazioni, Statistiche, Impostazioni
.github/workflows/deploy.yml  pubblicazione automatica (vedi passo 2.3)
credenziali.local.md       le tue password (privato, mai su GitHub)
```

> La rimozione dello sfondo usa la libreria `@imgly/background-removal` (licenza AGPL), che va bene per un uso personale. Al primo utilizzo scarica un modello di circa 40 MB, che poi resta nella cache del browser.
