import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

interface CsvDropzoneProps {
  selectedFile: File | null;
  disabled?: boolean;
  maxFileSizeMb: number;
  onFileSelected: (file: File | null) => void;
}

export function CsvDropzone({
  selectedFile,
  disabled = false,
  maxFileSizeMb,
  onFileSelected,
}: CsvDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileDetails = useMemo(() => {
    if (!selectedFile) return null;
    return {
      name: selectedFile.name,
      formattedSize: formatBytes(selectedFile.size),
      lastModified: new Date(selectedFile.lastModified).toLocaleString(),
    };
  }, [selectedFile]);

  const openFilePicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0] ?? null;
    onFileSelected(file);
  };

  return (
    <div className="csv-dropzone-wrap">
      <div
        className={`csv-dropzone${dragActive ? " is-drag-active" : ""}${disabled ? " is-disabled" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="CSV upload drop zone"
        aria-describedby="csv-upload-hint"
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="csv-dropzone-title">Drag and drop a CSV here</p>
        <p className="csv-dropzone-subtitle">or click to browse from your device</p>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openFilePicker();
          }}
          disabled={disabled}
        >
          Browse CSV
        </button>
        <input
          ref={inputRef}
          className="csv-input-hidden"
          id="project-csv-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
          disabled={disabled}
        />
      </div>

      <p id="csv-upload-hint" className="import-hint">
        Max {maxFileSizeMb}MB. Use the template for exact column headers.
      </p>

      {fileDetails ? (
        <div className="csv-file-card" aria-live="polite">
          <p>
            <strong>File name:</strong> {fileDetails.name}
          </p>
          <p>
            <strong>Size:</strong> {fileDetails.formattedSize}
          </p>
          <p>
            <strong>Last modified:</strong> {fileDetails.lastModified}
          </p>
          <button className="btn btn-link" type="button" onClick={() => onFileSelected(null)} disabled={disabled}>
            Remove file
          </button>
        </div>
      ) : (
        <p className="csv-file-empty">No file selected yet.</p>
      )}
    </div>
  );
}
