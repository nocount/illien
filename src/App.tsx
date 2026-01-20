import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Editor from "./components/Editor";

function App() {
  const [content, setContent] = useState("");
  const [journalDirectory, setJournalDirectory] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [entries, setEntries] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const today = new Date().toISOString().split("T")[0];

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
    }
    loadSettings();
  }, []);

  // Load entries list when directory is set
  const loadEntries = useCallback(async () => {
    if (!journalDirectory) return;
    try {
      const entryList = await invoke<string[]>("list_journal_entries", {
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

  // Load selected date's journal entry
  useEffect(() => {
    async function loadEntry() {
      if (!journalDirectory) return;
      try {
        const entry = await invoke<string | null>("load_journal", {
          date: selectedDate,
          directory: journalDirectory,
        });
        setContent(entry || "");
        setSaveStatus("saved");
      } catch (e) {
        console.error("Failed to load journal entry:", e);
      }
    }
    loadEntry();
  }, [journalDirectory, selectedDate]);

  // Auto-save with debounce
  const saveEntry = useCallback(async () => {
    if (!journalDirectory) return;
    setSaveStatus("saving");
    try {
      await invoke("save_journal", {
        date: selectedDate,
        content: content,
        directory: journalDirectory,
      });
      setSaveStatus("saved");
      // Refresh entries list if this is a new entry
      if (!entries.includes(selectedDate) && content.trim() !== "") {
        loadEntries();
      }
    } catch (e) {
      console.error("Failed to save journal entry:", e);
      setSaveStatus("unsaved");
    }
  }, [journalDirectory, selectedDate, content, entries, loadEntries]);

  // Debounced auto-save
  useEffect(() => {
    if (!journalDirectory) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      saveEntry();
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, journalDirectory, saveEntry]);

  // Save dark mode preference
  useEffect(() => {
    invoke("set_dark_mode", { darkMode });
  }, [darkMode]);

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

  const handleSelectEntry = (date: string) => {
    setSelectedDate(date);
    setShowSidebar(false);
  };

  const handleGoToToday = () => {
    setSelectedDate(today);
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

  const isToday = selectedDate === today;

  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>
      <header className="header">
        <div className="header-left">
          {journalDirectory && (
            <button
              className="icon-button"
              onClick={() => setShowSidebar(!showSidebar)}
              title="Past entries"
            >
              📅
            </button>
          )}
          <h1 className="date">{formatDate(selectedDate)}</h1>
          {!isToday && (
            <button className="today-btn" onClick={handleGoToToday}>
              Today
            </button>
          )}
        </div>
        <div className="header-actions">
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
              <h2>Past Entries</h2>
              <span className="entry-count">{entries.length} entries</span>
            </div>
            <ul className="entries-list">
              {entries.length === 0 ? (
                <li className="no-entries">No entries yet</li>
              ) : (
                entries.map((date) => (
                  <li key={date}>
                    <button
                      className={`entry-item ${date === selectedDate ? "active" : ""}`}
                      onClick={() => handleSelectEntry(date)}
                    >
                      <span className="entry-date">{formatShortDate(date)}</span>
                      {date === today && <span className="today-badge">Today</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
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
    </div>
  );
}

export default App;
