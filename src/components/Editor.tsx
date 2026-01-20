interface EditorProps {
  content: string;
  onChange: (content: string) => void;
}

function Editor({ content, onChange }: EditorProps) {
  return (
    <main className="editor-container">
      <textarea
        className="editor"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start writing..."
        autoFocus
      />
    </main>
  );
}

export default Editor;
