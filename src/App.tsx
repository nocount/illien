import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Editor from "./components/Editor";

function App() {
  const [content, setContent] = useState("");
  const [journalDirectory, setJournalDirectory] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const today = new Date().toISOString().split("T")[0];

  // Load saved settings and journal entry on mount
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

  // Load today's journal entry when directory is set
  useEffect(() => {
    async function loadEntry() {
      if (!journalDirectory) return;
      try {
        const entry = await invoke<string | null>("load_journal", {
          date: today,
          directory: journalDirectory,
        });
        if (entry) {
          setContent(entry);
        }
      } catch (e) {
        console.error("Failed to load journal entry:", e);
      }
    }
    loadEntry();
  }, [journalDirectory, today]);

  // Auto-save with debounce
  const saveEntry = useCallback(async () => {
    if (!journalDirectory) return;
    setSaveStatus("saving");
    try {
      await invoke("save_journal", {
        date: today,
        content: content,
        directory: journalDirectory,
      });
      setSaveStatus("saved");
    } catch (e) {
      console.error("Failed to save journal entry:", e);
      setSaveStatus("unsaved");
    }
  }, [journalDirectory, today, content]);

  // Debounced auto-save
  useEffect(() => {
    if (!journalDirectory || content === "") return;
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>
      <header className="header">
        <h1 className="date">{formatDate(today)}</h1>
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
  );
}

export default App;
