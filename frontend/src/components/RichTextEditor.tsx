import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { api } from "@/lib/api";

type RichTextEditorProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
};

export function RichTextEditor({ label, value, onChange, onError }: RichTextEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content: value ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const next = value ?? "";
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  const insertLink = () => {
    if (!editor) {
      return;
    }
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", current ?? "https://");
    if (href === null) {
      return;
    }
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const insertImage = async (file?: File) => {
    if (!editor || !file) {
      return;
    }
    try {
      setUploading(true);
      const result = await api.uploadImage(file);
      editor.chain().focus().setImage({ src: result.url }).run();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const toolButtonClass = (active = false) => `editor-tool${active ? " is-active" : ""}`;

  return (
    <>
      {expanded ? <button type="button" className="rich-text-overlay" aria-label={`Close expanded ${label} editor`} onClick={() => setExpanded(false)} /> : null}
      <div className={`page-card rich-text-card${expanded ? " is-expanded" : ""}`}>
        <div className="rich-text-header">
          <label htmlFor={inputId}>{label}</label>
          <div className="rich-text-actions">
            <button
              type="button"
              className={toolButtonClass(expanded)}
              onClick={() => setExpanded((current) => !current)}
              title={expanded ? "Collapse Editor" : "Expand Editor"}
              aria-label={expanded ? "Collapse editor" : "Expand editor"}
            >
              {expanded ? (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 6H2.5V2.5M2.5 2.5 6.5 6.5" />
                  <path d="M10 6h3.5V2.5M13.5 2.5 9.5 6.5" />
                  <path d="M6 10H2.5v3.5M2.5 13.5 6.5 9.5" />
                  <path d="M10 10h3.5v3.5M13.5 13.5 9.5 9.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 2.5H2.5V6M2.5 2.5 6.5 6.5" />
                  <path d="M10 2.5h3.5V6M13.5 2.5 9.5 6.5" />
                  <path d="M6 13.5H2.5V10M2.5 13.5 6.5 9.5" />
                  <path d="M10 13.5h3.5V10M13.5 13.5 9.5 9.5" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className={`editor-mode-toggle${sourceMode ? "" : " is-active"}`}
              onClick={() => setSourceMode(false)}
            >
              Visual
            </button>
            <button
              type="button"
              className={`editor-mode-toggle${sourceMode ? " is-active" : ""}`}
              onClick={() => setSourceMode(true)}
            >
              HTML
            </button>
          </div>
        </div>
        {sourceMode ? (
          <textarea
            id={inputId}
            className={`rich-text-source${expanded ? " is-expanded" : ""}`}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <>
            <div className="rich-text-toolbar">
              <button
                type="button"
                className={toolButtonClass(Boolean(editor?.isActive("bold")))}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                title="Bold"
                aria-label="Bold"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className={toolButtonClass(Boolean(editor?.isActive("italic")))}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                title="Italic"
                aria-label="Italic"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className={toolButtonClass(Boolean(editor?.isActive("underline")))}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                title="Underline"
                aria-label="Underline"
              >
                <span className="editor-underline-icon">U</span>
              </button>
              <button
                type="button"
                className={toolButtonClass(Boolean(editor?.isActive("bulletList")))}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                title="Bulleted List"
                aria-label="Bulleted List"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="3" cy="4" r="1.25" />
                  <circle cx="3" cy="8" r="1.25" />
                  <circle cx="3" cy="12" r="1.25" />
                  <path d="M6 4h7M6 8h7M6 12h7" />
                </svg>
              </button>
              <button
                type="button"
                className={toolButtonClass(Boolean(editor?.isActive("orderedList")))}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                title="Numbered List"
                aria-label="Numbered List"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2.5 3.5h1v3h-1zM2 6.5h2" />
                  <path d="M2.25 9.25C2.6 8.75 3 8.5 3.5 8.5c.8 0 1.5.52 1.5 1.25 0 .52-.24.92-.9 1.42l-1.1.83H5" />
                  <path d="M7 4h7M7 8h7M7 12h7" />
                </svg>
              </button>
              <button
                type="button"
                className={toolButtonClass(Boolean(editor?.isActive("blockquote")))}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                title="Block Quote"
                aria-label="Block Quote"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6.5 4.5H4.75A1.75 1.75 0 0 0 3 6.25V8.5h3.5V12H2.5V8.25A3.75 3.75 0 0 1 6.25 4.5h.25zM13.5 4.5h-1.75A1.75 1.75 0 0 0 10 6.25V8.5h3.5V12H9.5V8.25A3.75 3.75 0 0 1 13.25 4.5h.25z" />
                </svg>
              </button>
              <button
                type="button"
                className={toolButtonClass(Boolean(editor?.isActive("link")))}
                onClick={insertLink}
                title="Insert Link"
                aria-label="Insert Link"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6.25 10.75 4.5 12.5a2.12 2.12 0 1 1-3-3L3.25 7.75" />
                  <path d="M9.75 5.25 11.5 3.5a2.12 2.12 0 1 1 3 3l-1.75 1.75" />
                  <path d="m5.5 10.5 5-5" />
                </svg>
              </button>
              <button
                type="button"
                className={toolButtonClass(false)}
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                title={uploading ? "Uploading Image" : "Insert Image"}
                aria-label={uploading ? "Uploading Image" : "Insert Image"}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
                  <circle cx="6" cy="6.25" r="1.1" />
                  <path d="m4 11 2.75-2.75L9 10.5l1.5-1.5L12 11" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => void insertImage(event.target.files?.[0])}
              />
            </div>
            <div id={inputId} className={`rich-text-editor${expanded ? " is-expanded" : ""}`}>
              <EditorContent editor={editor} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
