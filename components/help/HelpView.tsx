"use client";

import { useState } from "react";
import {
  BookOpen, Type, Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Minus, Table, ImagePlus, Link2, Tag, Folder,
  Search, Download, Share2, History, Trash2, Pin,
  Star, Keyboard, Command,
  GripVertical, Copy, FileText, Zap,
  ListTodo, CalendarDays, KanbanSquare, Columns, Clock,
  ArrowUpDown, Filter, FolderOpen, Repeat, AlertTriangle,
  Bell, Timer, Palette, StickyNote, FolderTree,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isModuleEnabled } from "@/config/modules";

/* ── Types ───────────────────────────────────────────────── */

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  shortcut?: string;
  tip?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  features: Feature[];
}

interface Module {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  sections: Section[];
}

/* ── Data ────────────────────────────────────────────────── */

const allModules: Module[] = [
  {
    id: "notes",
    title: "Note",
    icon: <FileText className="h-4 w-4" />,
    color: "text-indigo-400",
    sections: [
      {
        id: "formatting",
        title: "Formattazione testo",
        icon: <Type className="h-4 w-4" />,
        features: [
          { icon: <Bold className="h-4 w-4" />, title: "Grassetto", description: "Rende il testo in grassetto.", shortcut: "Cmd + B" },
          { icon: <Italic className="h-4 w-4" />, title: "Corsivo", description: "Rende il testo in corsivo.", shortcut: "Cmd + I" },
          { icon: <Strikethrough className="h-4 w-4" />, title: "Barrato", description: "Testo barrato per indicare qualcosa di completato o rimosso.", shortcut: "Cmd + Shift + S" },
          { icon: <Code className="h-4 w-4" />, title: "Codice inline", description: "Formatta il testo come codice monospaced.", shortcut: "Cmd + E" },
          { icon: <Heading1 className="h-4 w-4" />, title: "Titolo 1", description: "Intestazione principale, la più grande." },
          { icon: <Heading2 className="h-4 w-4" />, title: "Titolo 2", description: "Sotto-intestazione per organizzare le sezioni." },
          { icon: <Heading3 className="h-4 w-4" />, title: "Titolo 3", description: "Intestazione più piccola per sotto-sezioni." },
        ],
      },
      {
        id: "blocks",
        title: "Blocchi e struttura",
        icon: <List className="h-4 w-4" />,
        features: [
          { icon: <List className="h-4 w-4" />, title: "Elenco puntato", description: "Crea un elenco con punti. Scrivi '- ' o '* ' all'inizio di una riga.", tip: "Markdown: - testo" },
          { icon: <ListOrdered className="h-4 w-4" />, title: "Elenco numerato", description: "Crea un elenco numerato. Scrivi '1. ' all'inizio di una riga.", tip: "Markdown: 1. testo" },
          { icon: <CheckSquare className="h-4 w-4" />, title: "Checklist", description: "Lista di task con checkbox cliccabili. Perfetta per to-do list.", tip: "Markdown: [ ] testo" },
          { icon: <Quote className="h-4 w-4" />, title: "Citazione", description: "Blocco citazione con barra laterale colorata. Scrivi '> ' all'inizio.", tip: "Markdown: > testo" },
          { icon: <Minus className="h-4 w-4" />, title: "Separatore", description: "Linea orizzontale per dividere sezioni. Scrivi '---' per inserirla.", tip: "Markdown: ---" },
          { icon: <Code className="h-4 w-4" />, title: "Blocco codice", description: "Blocco di codice multi-riga con sfondo scuro. Scrivi ``` per aprirlo.", tip: "Markdown: ```codice```" },
          { icon: <Table className="h-4 w-4" />, title: "Tabella", description: "Inserisci una tabella 3x3 con intestazione. Ridimensiona le colonne trascinando i bordi." },
        ],
      },
      {
        id: "media",
        title: "Media e immagini",
        icon: <ImagePlus className="h-4 w-4" />,
        features: [
          { icon: <ImagePlus className="h-4 w-4" />, title: "Inserisci immagine", description: "Clicca il pulsante nella toolbar o trascina un'immagine direttamente nell'editor." },
          { icon: <Trash2 className="h-4 w-4" />, title: "Elimina immagine", description: "Passa il mouse sull'immagine: appare una X in alto a destra per rimuoverla." },
          { icon: <Zap className="h-4 w-4" />, title: "Fullscreen immagine", description: "Clicca su un'immagine per aprirla in fullscreen. Premi Esc o clicca fuori per chiudere." },
          { icon: <Copy className="h-4 w-4" />, title: "Incolla immagine", description: "Copia un'immagine e incollala direttamente nell'editor con Cmd + V." },
        ],
      },
      {
        id: "links",
        title: "Link tra note",
        icon: <Link2 className="h-4 w-4" />,
        features: [
          { icon: <Link2 className="h-4 w-4" />, title: "Link a nota", description: "Scrivi [[nome nota]] per creare un collegamento ad un'altra nota. Cliccandolo si apre in un nuovo tab.", tip: "Sintassi: [[Nome della nota]]" },
          { icon: <FileText className="h-4 w-4" />, title: "Backlinks", description: "In fondo alla nota vedi la sezione 'Citata in N note' con tutte le note che contengono un link verso quella corrente." },
        ],
      },
      {
        id: "organization",
        title: "Organizzazione",
        icon: <Folder className="h-4 w-4" />,
        features: [
          { icon: <Folder className="h-4 w-4" />, title: "Notebook", description: "Assegna le note a notebook per organizzarle per argomento. Puoi cambiare notebook dal picker sopra l'editor." },
          { icon: <FolderTree className="h-4 w-4" />, title: "Notebook annidati", description: "Crea sotto-notebook dentro altri notebook per una struttura gerarchica. Usa il pulsante '+' accanto a ogni notebook nella lista." },
          { icon: <Tag className="h-4 w-4" />, title: "Tag", description: "Aggiungi tag alla nota digitando nel campo tag e premendo Invio. Utili per categorizzare trasversalmente." },
          { icon: <Pin className="h-4 w-4" />, title: "Fissa nota", description: "Fissa una nota in cima alla lista per trovarla subito. Clicca l'icona pin nella lista note." },
          { icon: <Star className="h-4 w-4" />, title: "Accesso rapido", description: "Le note fissate appaiono nella sezione Accesso Rapido della Home per trovarle al volo." },
          { icon: <GripVertical className="h-4 w-4" />, title: "Drag & drop", description: "Trascina una nota sui chip dei notebook nella lista per spostarla velocemente." },
          { icon: <Copy className="h-4 w-4" />, title: "Duplica nota", description: "Crea una copia della nota con il suffisso '(copia)' dal menu nella lista note." },
          { icon: <ArrowUpDown className="h-4 w-4" />, title: "Ordinamento", description: "Ordina le note per data di modifica, data di creazione, titolo o dimensione tramite il pulsante di ordinamento." },
        ],
      },
      {
        id: "appearance",
        title: "Aspetto e personalizzazione",
        icon: <Palette className="h-4 w-4" />,
        features: [
          { icon: <Palette className="h-4 w-4" />, title: "Colore nota", description: "Assegna un colore alla nota per distinguerla visivamente nella lista. Il colore appare come bordo laterale." },
          { icon: <StickyNote className="h-4 w-4" />, title: "Emoji nota", description: "Scegli un'emoji come icona della nota, visibile nella lista e nell'editor." },
          { icon: <FolderOpen className="h-4 w-4" />, title: "Progetto", description: "Assegna la nota a un progetto condiviso con il Task Manager per collegare note e task sotto lo stesso contesto." },
        ],
      },
      {
        id: "tools",
        title: "Strumenti",
        icon: <Zap className="h-4 w-4" />,
        features: [
          { icon: <Timer className="h-4 w-4" />, title: "Pomodoro timer", description: "Timer integrato con sessioni da 25 minuti di focus e 5 di pausa. Notifica push e audio al cambio di fase. Contatore sessioni completate." },
          { icon: <Bell className="h-4 w-4" />, title: "Promemoria", description: "Imposta un promemoria su una nota con preset rapidi (30min, 1h, 3h, domani, 3 giorni, 1 settimana) o con data e ora personalizzate. Ricevi una notifica push." },
          { icon: <Share2 className="h-4 w-4" />, title: "Condividi nota", description: "Genera un link pubblico in sola lettura che scade dopo 7 giorni. Puoi revocarlo in qualsiasi momento." },
          { icon: <History className="h-4 w-4" />, title: "Cronologia versioni", description: "Viene salvata una versione automaticamente ogni 5 minuti. Apri il pannello Cronologia per vedere e ripristinare versioni precedenti." },
          { icon: <Download className="h-4 w-4" />, title: "Esporta nota", description: "Esporta la nota corrente come file Markdown (.md) o come PDF tramite la stampa del browser." },
          { icon: <StickyNote className="h-4 w-4" />, title: "Template", description: "Salva una nota come template per riutilizzare la struttura. Crea nuove note a partire da template esistenti." },
          { icon: <Trash2 className="h-4 w-4" />, title: "Cestino", description: "Le note eliminate vanno nel cestino e possono essere ripristinate entro 30 giorni. Dopo vengono eliminate definitivamente." },
        ],
      },
      {
        id: "search",
        title: "Ricerca",
        icon: <Search className="h-4 w-4" />,
        features: [
          { icon: <Search className="h-4 w-4" />, title: "Cerca note", description: "Usa la barra di ricerca nella lista note per filtrare per titolo e contenuto. I risultati mostrano il match evidenziato.", shortcut: "Cmd + K (Command Palette)" },
          { icon: <Command className="h-4 w-4" />, title: "Command Palette", description: "Apri la palette comandi da qualsiasi pagina per cercare note, navigare, creare note o cambiare notebook.", shortcut: "Cmd + K" },
        ],
      },
      {
        id: "shortcuts",
        title: "Scorciatoie da tastiera",
        icon: <Keyboard className="h-4 w-4" />,
        features: [
          { icon: <Keyboard className="h-4 w-4" />, title: "Cmd + S", description: "Salva la nota immediatamente (il salvataggio automatico avviene comunque dopo 1.5s di inattività)." },
          { icon: <Keyboard className="h-4 w-4" />, title: "Cmd + B / I / E", description: "Grassetto, Corsivo, Codice inline." },
          { icon: <Keyboard className="h-4 w-4" />, title: "Cmd + Shift + S", description: "Testo barrato." },
          { icon: <Keyboard className="h-4 w-4" />, title: "Cmd + Z / Shift + Z", description: "Annulla / Ripristina l'ultima azione nell'editor." },
          { icon: <Keyboard className="h-4 w-4" />, title: "Cmd + K", description: "Apre la Command Palette per ricerca rapida e navigazione." },
          { icon: <Keyboard className="h-4 w-4" />, title: "Esc", description: "Chiude la lightbox delle immagini e la Command Palette." },
        ],
      },
      {
        id: "markdown",
        title: "Scorciatoie Markdown",
        icon: <FileText className="h-4 w-4" />,
        features: [
          { icon: <Heading1 className="h-4 w-4" />, title: "# Titolo", description: "Digita # + spazio per creare un Titolo 1. ## per Titolo 2, ### per Titolo 3." },
          { icon: <List className="h-4 w-4" />, title: "- oppure * Lista", description: "Digita - o * + spazio per creare un elenco puntato." },
          { icon: <ListOrdered className="h-4 w-4" />, title: "1. Lista numerata", description: "Digita 1. + spazio per creare un elenco numerato." },
          { icon: <Quote className="h-4 w-4" />, title: "> Citazione", description: "Digita > + spazio per creare un blocco citazione." },
          { icon: <Minus className="h-4 w-4" />, title: "--- Separatore", description: "Digita tre trattini per inserire una linea orizzontale." },
          { icon: <Code className="h-4 w-4" />, title: "``` Blocco codice", description: "Digita tre backtick per aprire un blocco di codice." },
          { icon: <Link2 className="h-4 w-4" />, title: "[[Link nota]]", description: "Digita [[ + nome nota + ]] per creare un link interno ad un'altra nota." },
        ],
      },
    ],
  },
  {
    id: "tasks",
    title: "Task Manager",
    icon: <ListTodo className="h-4 w-4" />,
    color: "text-amber-400",
    sections: [
      {
        id: "task-basics",
        title: "Gestione task",
        icon: <CheckSquare className="h-4 w-4" />,
        features: [
          { icon: <CheckSquare className="h-4 w-4" />, title: "Crea task", description: "Usa la barra rapida in alto per creare un task al volo. Scrivi il titolo e premi Invio. Puoi anche selezionare la priorità." },
          { icon: <CheckSquare className="h-4 w-4" />, title: "Stato task", description: "Ogni task ha tre stati: Da fare, In corso, Completato. Clicca l'icona cerchio per ciclare tra gli stati." },
          { icon: <AlertTriangle className="h-4 w-4" />, title: "Priorità", description: "Quattro livelli: Urgente (rosso), Alta (arancione), Media (ambra), Bassa (blu). Il pallino colorato indica la priorità a colpo d'occhio." },
          { icon: <CalendarDays className="h-4 w-4" />, title: "Data di scadenza", description: "Assegna una data di scadenza. I task scaduti vengono evidenziati in rosso e mostrati nella sezione 'In ritardo' della Home." },
          { icon: <Trash2 className="h-4 w-4" />, title: "Elimina task", description: "I task eliminati vanno nel cestino (soft delete). Puoi eliminarli dal pannello dettaglio." },
        ],
      },
      {
        id: "task-views",
        title: "Viste",
        icon: <Columns className="h-4 w-4" />,
        features: [
          { icon: <List className="h-4 w-4" />, title: "Vista Lista", description: "Visualizzazione classica con tutti i task in un elenco verticale. Mostra priorità, progetto, data di scadenza e subtask." },
          { icon: <KanbanSquare className="h-4 w-4" />, title: "Vista Kanban", description: "Tre colonne: Da fare, In corso, Completato. Trascina i task tra le colonne per cambiarne lo stato con drag & drop." },
          { icon: <CalendarDays className="h-4 w-4" />, title: "Vista Calendario", description: "Calendario mensile che mostra i task posizionati nel giorno della scadenza. Naviga tra i mesi con le frecce." },
          { icon: <Clock className="h-4 w-4" />, title: "Vista Oggi", description: "Focus sulla giornata: mostra task in ritardo, task di oggi e task senza scadenza. Ideale per la pianificazione quotidiana." },
        ],
      },
      {
        id: "task-detail",
        title: "Dettaglio task",
        icon: <FileText className="h-4 w-4" />,
        features: [
          { icon: <FileText className="h-4 w-4" />, title: "Pannello dettaglio", description: "Clicca su un task per aprire il pannello laterale con tutte le informazioni e le opzioni di modifica." },
          { icon: <CheckSquare className="h-4 w-4" />, title: "Subtask", description: "Aggiungi sotto-attività a un task. Ogni subtask ha una checkbox per segnarlo come completato. Contatore visibile nella lista." },
          { icon: <FileText className="h-4 w-4" />, title: "Descrizione", description: "Aggiungi una descrizione testuale al task per dettagli aggiuntivi e note." },
          { icon: <Tag className="h-4 w-4" />, title: "Tag", description: "Categorizza i task con tag. Utili per filtrare e raggruppare task trasversalmente ai progetti." },
          { icon: <Link2 className="h-4 w-4" />, title: "Collega nota", description: "Associa una nota esistente al task. Usa il campo di ricerca per trovare la nota giusta. Cliccando il link si apre la nota." },
          { icon: <Repeat className="h-4 w-4" />, title: "Task ricorrenti", description: "Imposta un task come ricorrente: giornaliero, settimanale o mensile. Completandolo, viene creata automaticamente la prossima occorrenza." },
        ],
      },
      {
        id: "task-projects",
        title: "Progetti",
        icon: <FolderOpen className="h-4 w-4" />,
        features: [
          { icon: <FolderOpen className="h-4 w-4" />, title: "Crea progetto", description: "Crea progetti per raggruppare task correlati. Ogni progetto ha un nome, un colore e un'emoji opzionale." },
          { icon: <Folder className="h-4 w-4" />, title: "Progetti condivisi", description: "I progetti sono condivisi tra Note e Task Manager. Assegna lo stesso progetto a note e task per collegare tutto sotto un unico contesto." },
          { icon: <Filter className="h-4 w-4" />, title: "Filtra per progetto", description: "Clicca su un progetto nella barra progetti per filtrare e vedere solo i task di quel progetto." },
          { icon: <Trash2 className="h-4 w-4" />, title: "Elimina progetto", description: "Elimina un progetto cliccando la X accanto al nome. I task e le note associati non vengono eliminati, perdono solo l'associazione." },
        ],
      },
      {
        id: "task-filters",
        title: "Filtri e ordinamento",
        icon: <Filter className="h-4 w-4" />,
        features: [
          { icon: <Filter className="h-4 w-4" />, title: "Filtra per priorità", description: "Filtra i task per livello di priorità: urgente, alta, media, bassa." },
          { icon: <Tag className="h-4 w-4" />, title: "Filtra per tag", description: "Seleziona un tag per vedere solo i task con quel tag. I filtri sono combinabili tra loro." },
          { icon: <FolderOpen className="h-4 w-4" />, title: "Filtra per progetto", description: "Seleziona un progetto dalla barra superiore per filtrare i task." },
          { icon: <ArrowUpDown className="h-4 w-4" />, title: "Ordinamento", description: "Ordina i task per priorità, data di scadenza, data di creazione o titolo." },
          { icon: <CheckSquare className="h-4 w-4" />, title: "Mostra/nascondi completati", description: "Attiva o disattiva la visualizzazione dei task completati con l'apposito toggle." },
        ],
      },
      {
        id: "task-stats",
        title: "Statistiche",
        icon: <Zap className="h-4 w-4" />,
        features: [
          { icon: <ListTodo className="h-4 w-4" />, title: "Task attivi", description: "Numero totale di task non completati. Visibile sia nel Task Manager che nella Home." },
          { icon: <AlertTriangle className="h-4 w-4" />, title: "In ritardo", description: "Conteggio dei task con scadenza passata e non ancora completati. Alert visibile nella Home." },
          { icon: <CheckSquare className="h-4 w-4" />, title: "Completati questa settimana", description: "Contatore dei task completati negli ultimi 7 giorni con barra di progresso e messaggio motivazionale nella Home." },
        ],
      },
    ],
  },
];

/* ── Component ───────────────────────────────────────────── */

export default function HelpView() {
  const modules = allModules.filter((module) => module.id === "notes" ? isModuleEnabled("notes") : module.id === "tasks" ? isModuleEnabled("tasks") : true);
  const [activeModule, setActiveModule] = useState(modules[0]?.id ?? "notes");
  const [activeSection, setActiveSection] = useState("formatting");

  const currentModule = modules.find((m) => m.id === activeModule) ?? modules[0];
  const currentSection = currentModule?.sections.find((s) => s.id === activeSection) || currentModule?.sections[0];

  function switchModule(moduleId: string) {
    setActiveModule(moduleId);
    const mod = modules.find((m) => m.id === moduleId)!;
    setActiveSection(mod.sections[0].id);
  }

  if (!currentModule || !currentSection) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <BookOpen className="mx-auto mb-3 h-6 w-6 text-[var(--sb-muted)]" />
          <h1 className="text-sm font-semibold text-[var(--sb-text)]">Guida moduli</h1>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--sb-muted)]">
            I moduli documentati sono disattivati in questa installazione. Riattivali tramite `NEXT_PUBLIC_SELFOS_MODULES` o `NEXT_PUBLIC_SELFOS_DISABLED_MODULES`.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left nav — desktop only */}
      <div className="hidden lg:flex flex-col w-60 shrink-0 border-r border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-y-auto">
        <div className="px-4 py-5 border-b border-[var(--sb-border)]">
          <h1 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--sb-accent)]" />
            Guida
          </h1>
        </div>

        {/* Module tabs */}
        <div className="flex border-b border-[var(--sb-border)]">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => switchModule(mod.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all cursor-pointer border-b-2",
                activeModule === mod.id
                  ? `${mod.color} border-current bg-[var(--sb-hover)]`
                  : "text-[var(--sb-muted)] border-transparent hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]",
              )}
            >
              {mod.icon}
              {mod.title}
            </button>
          ))}
        </div>

        {/* Section nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {currentModule.sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-xs transition-all cursor-pointer text-left",
                activeSection === section.id
                  ? "bg-[var(--sb-hover)] text-[var(--sb-text)] font-medium"
                  : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
              )}
            >
              {section.icon}
              {section.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-10 border-b border-[var(--sb-border)] bg-[var(--sb-surface)] backdrop-blur-sm">
          <div className="px-4 py-3">
            <h1 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[var(--sb-accent)]" />
              Guida
            </h1>
          </div>

          {/* Mobile module tabs */}
          <div className="flex border-b border-[var(--sb-border)]">
            {modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => switchModule(mod.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all cursor-pointer border-b-2",
                  activeModule === mod.id
                    ? `${mod.color} border-current bg-[var(--sb-hover)]`
                    : "text-[var(--sb-muted)] border-transparent",
                )}
              >
                {mod.icon}
                {mod.title}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile section tabs */}
        <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b border-[var(--sb-border)] bg-[var(--sb-surface)]">
          {currentModule.sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer whitespace-nowrap",
                activeSection === section.id
                  ? "bg-[var(--sb-accent)] text-white font-medium"
                  : "bg-[var(--sb-card)] text-[var(--sb-muted)] border border-[var(--sb-border)]",
              )}
            >
              {section.icon}
              {section.title}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className={cn("p-2 rounded-lg", activeModule === "notes" ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-400")}>
                {currentSection.icon}
              </div>
              <div>
                <p className={cn("text-[10px] uppercase font-medium", currentModule.color)}>
                  {currentModule.title}
                </p>
                <h2 className="text-lg font-semibold text-[var(--sb-text)]">
                  {currentSection.title}
                </h2>
              </div>
            </div>

            <div className="grid gap-3">
              {currentSection.features.map((feature, i) => (
                <div
                  key={i}
                  className={cn(
                    "group flex items-start gap-4 p-4 rounded-xl bg-[var(--sb-card)] border border-[var(--sb-border)] transition-all",
                    activeModule === "notes" ? "hover:border-indigo-500/30" : "hover:border-amber-500/30",
                  )}
                >
                  <div className={cn(
                    "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--sb-hover)] text-[var(--sb-muted)] transition-colors",
                    activeModule === "notes" ? "group-hover:text-indigo-400" : "group-hover:text-amber-400",
                  )}>
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-[var(--sb-text)]">
                        {feature.title}
                      </h3>
                      {feature.shortcut && (
                        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--sb-hover)] text-[var(--sb-muted)] border border-[var(--sb-border)]">
                          {feature.shortcut}
                        </kbd>
                      )}
                    </div>
                    <p className="text-xs text-[var(--sb-muted)] mt-1 leading-relaxed">
                      {feature.description}
                    </p>
                    {feature.tip && (
                      <p className={cn("text-[10px] mt-1.5 font-mono", activeModule === "notes" ? "text-indigo-400" : "text-amber-400")}>
                        {feature.tip}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
