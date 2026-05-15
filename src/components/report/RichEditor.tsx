"use client";
/**
 * src/components/report/RichEditor.tsx
 *
 * Google-Docs-style rich text editor for report sections.
 * Built on Tiptap (ProseMirror wrapper, MIT license).
 */

import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdown-convert";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  Image as ImageIcon,
  Minus,
  Undo,
  Redo,
  AlignLeft,
  Code,
  Quote,
  Columns,
  AlertTriangle,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Custom Placeholder Node ────────────────────────────────────────────
// Renders ⬡ PLACEHOLDER blocks that the consultant fills in manually.
const PlaceholderNode = Node.create({
  name: "placeholder",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      label: { default: "Content" },
      hint: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="placeholder"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "placeholder",
        class: "placeholder-block",
      }),
      `⬡ PLACEHOLDER: ${HTMLAttributes.label}`,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("div");
      dom.setAttribute("data-type", "placeholder");
      dom.className = [
        "my-4 px-4 py-3 rounded-xl border-2 border-dashed border-amber-300",
        "bg-amber-50 text-amber-800 text-sm font-medium",
        "flex items-center gap-2 cursor-pointer select-none",
        "hover:border-amber-400 hover:bg-amber-100 transition-colors",
      ].join(" ");

      const icon = document.createElement("span");
      icon.textContent = "⬡";
      icon.className = "text-amber-500 text-base";

      const label = document.createElement("span");
      label.textContent = `PLACEHOLDER: ${node.attrs.label}`;

      const hint = document.createElement("span");
      hint.textContent = node.attrs.hint
        ? ` — ${node.attrs.hint}`
        : " — Click to edit or upload content here";
      hint.className = "text-amber-600 font-normal text-xs ml-1";

      dom.appendChild(icon);
      dom.appendChild(label);
      dom.appendChild(hint);

      return { dom };
    };
  },
});

// ── Toolbar button ─────────────────────────────────────────────────────
function ToolBtn({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={[
        "p-1.5 rounded text-sm transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        disabled ? "opacity-30 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return <div className="w-px h-5 bg-slate-200 mx-1" />;
}

// ── Image upload handler ───────────────────────────────────────────────
async function uploadImage(
  file: File,
  projectId: string,
): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${projectId}/report-images/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("uploads")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[RichEditor] Image upload failed:", error);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("uploads").getPublicUrl(path);
  return publicUrl;
}

// ── Main component ─────────────────────────────────────────────────────
interface Props {
  content: string; // stored as Markdown
  onChange: (markdown: string) => void;
  projectId?: string; // needed for image uploads
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export function RichEditor({
  content,
  onChange,
  projectId,
  placeholder = "Start writing…",
  readOnly = false,
  className = "",
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const onChangeFn = useRef(onChange);
  useEffect(() => {
    onChangeFn.current = onChange;
  }, [onChange]);

  const editor = useEditor(
    {
      editable: !readOnly,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({ allowBase64: false, inline: false }),
        Placeholder.configure({ placeholder }),
        CharacterCount,
        PlaceholderNode,
      ],
      content: markdownToHtml(content),
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        onChangeFn.current(htmlToMarkdown(html));
      },
      editorProps: {
        attributes: {
          class: [
            "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-5",
            "text-slate-800 leading-relaxed",
            // Table styles inside editor
            "[&_table]:w-full [&_table]:border-collapse [&_table]:my-3",
            "[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
            "[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2",
            // Placeholder node styles injected via addNodeView above
            "[&_.placeholder-block]:my-3",
            // Image
            "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3",
            // Blockquote
            "[&_blockquote]:border-l-4 [&_blockquote]:border-green-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600",
          ].join(" "),
        },
      },
    },
    [],
  ); // empty dep array — editor is stable, content updates handled below

  // Sync content when prop changes externally (e.g. section switches)
  const prevContent = useRef(content);
  useEffect(() => {
    if (!editor || content === prevContent.current) return;
    prevContent.current = content;
    const html = markdownToHtml(content);
    // Only update if editor doesn't already have this content
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html, false);
    }
  }, [content, editor]);

  const insertPlaceholder = useCallback(
    (label: string, hint = "") => {
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: "placeholder",
          attrs: { label, hint },
        })
        .run();
    },
    [editor],
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!projectId) {
        alert("Save the project first before uploading images.");
        return;
      }
      const url = await uploadImage(file, projectId);
      if (url) editor?.chain().focus().setImage({ src: url }).run();
    },
    [editor, projectId],
  );

  if (!editor)
    return (
      <div className="border border-slate-200 rounded-xl min-h-[400px] flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin" />
      </div>
    );

  const charCount = editor.storage.characterCount?.characters() ?? 0;
  const wordCount = editor.storage.characterCount?.words() ?? 0;

  return (
    <div
      className={`border border-slate-200 rounded-xl overflow-hidden bg-white ${className}`}
    >
      {/* ── Toolbar ── */}
      {!readOnly && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50 flex-wrap">
          {/* History */}
          <ToolBtn
            title="Undo (⌘Z)"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Redo (⌘⇧Z)"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="w-3.5 h-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Headings */}
          <ToolBtn
            title="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="w-3.5 h-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Inline formatting */}
          <ToolBtn
            title="Bold (⌘B)"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Italic (⌘I)"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Inline code"
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Blockquote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="w-3.5 h-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Lists */}
          <ToolBtn
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Table */}
          <ToolBtn
            title="Insert table"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            <TableIcon className="w-3.5 h-3.5" />
          </ToolBtn>

          {/* Image */}
          <ToolBtn
            title="Insert image"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </ToolBtn>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await handleImageUpload(file);
              e.target.value = "";
            }}
          />

          {/* Horizontal rule */}
          <ToolBtn
            title="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="w-3.5 h-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Placeholder insert */}
          <div className="relative group">
            <ToolBtn title="Insert placeholder block" onClick={() => {}}>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </ToolBtn>
            {/* Dropdown on hover */}
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-64 hidden group-hover:block">
              <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Insert placeholder
              </p>
              {[
                {
                  label: "Site Photo / Rendering",
                  hint: "Upload a site photo or farm rendering",
                },
                {
                  label: "Greenhouse Layout Plan",
                  hint: "Upload site plan or CAD drawing",
                },
                { label: "Gantt Chart", hint: "Upload project timeline" },
                {
                  label: "Equipment Supplier Quotes",
                  hint: "Attach supplier quotations",
                },
                {
                  label: "Water Quality Report",
                  hint: "Upload lab EC/TDS/pH report",
                },
                {
                  label: "Staffing Plan",
                  hint: "Add detailed role and salary breakdown",
                },
                {
                  label: "Marketing Budget",
                  hint: "Add quarterly marketing spend plan",
                },
                { label: "Custom", hint: "" },
              ].map(({ label, hint }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => insertPlaceholder(label, hint)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                >
                  ⬡ {label}
                </button>
              ))}
            </div>
          </div>

          {/* Word/char count */}
          <div className="ml-auto text-[10px] text-slate-400 pr-1 hidden sm:block">
            {wordCount} words · {charCount} chars
          </div>
        </div>
      )}

      {/* ── Editor content area ── */}
      <EditorContent editor={editor} />

      {/* ── Table controls (shown when cursor is in a table) ── */}
      {!readOnly && editor.isActive("table") && (
        <div className="flex items-center gap-1 px-3 py-2 border-t border-slate-100 bg-slate-50 text-xs flex-wrap">
          <span className="text-slate-500 font-medium mr-1">Table:</span>
          {[
            {
              label: "Add col →",
              fn: () => editor.chain().focus().addColumnAfter().run(),
            },
            {
              label: "← Add col",
              fn: () => editor.chain().focus().addColumnBefore().run(),
            },
            {
              label: "Del col",
              fn: () => editor.chain().focus().deleteColumn().run(),
            },
            {
              label: "Add row ↓",
              fn: () => editor.chain().focus().addRowAfter().run(),
            },
            {
              label: "↑ Add row",
              fn: () => editor.chain().focus().addRowBefore().run(),
            },
            {
              label: "Del row",
              fn: () => editor.chain().focus().deleteRow().run(),
            },
            {
              label: "Del table",
              fn: () => editor.chain().focus().deleteTable().run(),
            },
          ].map(({ label, fn }) => (
            <button
              key={label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                fn();
              }}
              className="px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
