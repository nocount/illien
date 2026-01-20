import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Editor from "./components/Editor";

interface JournalEntry {
  filename: string;
  entry_type: "daily" | "titled";
  title: string;
  date: string | null;
}

function App() {
  const [content, setContent] = useState("");
  const [journalDirectory, setJournalDirectory] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const todayFilename = `${today}.md`;

  // Load saved settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const dir = await invoke<string | null>("get_journal_directory");
        if (dir) {
          setJournalDirectory(dir);
        }
        const savedDarkMode = await invoke<boolean | null>("get_dark_mode");
        if (savedDarkMode !== null) {
          setDarkMode(savedDarkMode);
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
      setSettingsLoaded(true);
    }
    loadSettings();
  }, []);

  // Load entries list when directory is set
  const loadEntries = useCallback(async () => {
    if (!journalDirectory) return;
    try {
      const entryList = await invoke<JournalEntry[]>("list_journal_entries", {
        directory: journalDirectory,
      });
      setEntries(entryList);
    } catch (e) {
      console.error("Failed to load entries list:", e);
    }
  }, [journalDirectory]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Set default entry to today when directory is loaded
  useEffect(() => {
    if (journalDirectory && !currentEntry) {
      setCurrentEntry({
        filename: todayFilename,
        entry_type: "daily",
        title: today,
        date: today,
      });
    }
  }, [journalDirectory, currentEntry, today, todayFilename]);

  // Load current entry's content
  useEffect(() => {
    async function loadEntry() {
      if (!journalDirectory || !currentEntry) return;
      try {
        const entry = await invoke<string | null>("load_journal", {
          filename: currentEntry.filename,
          directory: journalDirectory,
        });
        setContent(entry || "");
        setSaveStatus("saved");
      } catch (e) {
        console.error("Failed to load journal entry:", e);
      }
    }
    loadEntry();
  }, [journalDirectory, currentEntry]);

  // Auto-save with debounce
  const saveEntry = useCallback(async () => {
    if (!journalDirectory || !currentEntry) return;
    setSaveStatus("saving");
    try {
      await invoke("save_journal", {
        filename: currentEntry.filename,
        content: content,
        directory: journalDirectory,
      });
      setSaveStatus("saved");
      // Refresh entries list if content changed
      if (content.trim() !== "") {
        loadEntries();
      }
    } catch (e) {
      console.error("Failed to save journal entry:", e);
      setSaveStatus("unsaved");
    }
  }, [journalDirectory, currentEntry, content, loadEntries]);

  // Debounced auto-save
  useEffect(() => {
    if (!journalDirectory || !currentEntry) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      saveEntry();
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, journalDirectory, currentEntry, saveEntry]);

  // Save dark mode preference (only after settings have loaded)
  useEffect(() => {
    if (settingsLoaded) {
      invoke("set_dark_mode", { darkMode });
    }
  }, [darkMode, settingsLoaded]);

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Journal Directory",
      });
      if (selected) {
        setJournalDirectory(selected as string);
        await invoke("set_journal_directory", { directory: selected });
      }
    } catch (e) {
      console.error("Failed to select directory:", e);
    }
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    setCurrentEntry(entry);
  };

  const handleGoToToday = () => {
    setCurrentEntry({
      filename: todayFilename,
      entry_type: "daily",
      title: today,
      date: today,
    });
  };

  const handleCreateNewEntry = () => {
    if (!newEntryTitle.trim()) return;

    // Sanitize filename
    const sanitizedTitle = newEntryTitle
      .trim()
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, " ");
    const filename = `${sanitizedTitle}.md`;

    const newEntry: JournalEntry = {
      filename,
      entry_type: "titled",
      title: sanitizedTitle,
      date: null,
    };

    setCurrentEntry(newEntry);
    setContent("");
    setNewEntryTitle("");
    setShowNewEntryModal(false);
  };

  const handleDeleteEntry = async () => {
    if (!journalDirectory || !currentEntry) return;
    if (currentEntry.entry_type === "daily") return; // Don't delete daily entries

    const confirmed = window.confirm(`Delete "${currentEntry.title}"?`);
    if (!confirmed) return;

    try {
      await invoke("delete_journal", {
        filename: currentEntry.filename,
        directory: journalDirectory,
      });
      await loadEntries();
      // Go back to today
      handleGoToToday();
    } catch (e) {
      console.error("Failed to delete entry:", e);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const isToday = currentEntry?.filename === todayFilename;
  const dailyEntries = entries.filter((e) => e.entry_type === "daily");
  const titledEntries = entries.filter((e) => e.entry_type === "titled");

  const getDisplayTitle = () => {
    if (!currentEntry) return "";
    if (currentEntry.entry_type === "daily" && currentEntry.date) {
      return formatDate(currentEntry.date);
    }
    return currentEntry.title;
  };

  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>
      <header className="header">
        <div className="header-left">
          {journalDirectory && (
            <button
              className="icon-button"
              onClick={() => setShowSidebar(!showSidebar)}
              title="Entries"
            >
              📅
            </button>
          )}
          <h1 className="date">{getDisplayTitle()}</h1>
          {!isToday && currentEntry && (
            <button className="today-btn" onClick={handleGoToToday}>
              Today
            </button>
          )}
        </div>
        <div className="header-actions">
          {currentEntry?.entry_type === "titled" && (
            <button
              className="icon-button delete-btn"
              onClick={handleDeleteEntry}
              title="Delete entry"
            >
              🗑️
            </button>
          )}
          <span className={`save-status ${saveStatus}`}>
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "unsaved" && "Unsaved"}
          </span>
          <button
            className="icon-button"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button
            className="icon-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="settings-panel">
          <div className="setting-row">
            <span>Journal Directory:</span>
            <button onClick={handleSelectDirectory} className="select-directory-btn">
              {journalDirectory || "Select directory..."}
            </button>
          </div>
        </div>
      )}

      <div className="main-content">
        {showSidebar && journalDirectory && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <h2>Entries</h2>
              <button
                className="new-entry-btn"
                onClick={() => setShowNewEntryModal(true)}
                title="New titled entry"
              >
                + New
              </button>
            </div>

            {titledEntries.length > 0 && (
              <div className="entries-section">
                <h3 className="section-title">Titled Entries</h3>
                <ul className="entries-list">
                  {titledEntries.map((entry) => (
                    <li key={entry.filename}>
                      <button
                        className={`entry-item ${entry.filename === currentEntry?.filename ? "active" : ""}`}
                        onClick={() => handleSelectEntry(entry)}
                      >
                        <span className="entry-title">{entry.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="entries-section">
              <h3 className="section-title">Daily Entries</h3>
              <ul className="entries-list">
                {dailyEntries.length === 0 ? (
                  <li className="no-entries">No entries yet</li>
                ) : (
                  dailyEntries.map((entry) => (
                    <li key={entry.filename}>
                      <button
                        className={`entry-item ${entry.filename === currentEntry?.filename ? "active" : ""}`}
                        onClick={() => handleSelectEntry(entry)}
                      >
                        <span className="entry-date">
                          {entry.date && formatShortDate(entry.date)}
                        </span>
                        {entry.date === today && <span className="today-badge">Today</span>}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        )}

        {!journalDirectory ? (
          <div className="no-directory">
            <p>Welcome to Illien</p>
            <p>Please select a directory to store your journal entries.</p>
            <button onClick={handleSelectDirectory} className="primary-btn">
              Select Directory
            </button>
          </div>
        ) : (
          <Editor content={content} onChange={setContent} />
        )}
      </div>

      {showNewEntryModal && (
        <div className="modal-overlay" onClick={() => setShowNewEntryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Entry</h2>
            <input
              type="text"
              className="modal-input"
              placeholder="Entry title..."
              value={newEntryTitle}
              onChange={(e) => setNewEntryTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNewEntry();
                if (e.key === "Escape") setShowNewEntryModal(false);
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowNewEntryModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn create"
                onClick={handleCreateNewEntry}
                disabled={!newEntryTitle.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
