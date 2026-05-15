"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
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
import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ── Custom Placeholder Node ────────────────────────────────────────────
// Renders ⬡ PLACEHOLDER blocks that the consultant fills in manually.
const PlaceholderNode = Node.create({
  name: "reportPlaceholder",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      label: {
        default: "Content",
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => ({ "data-label": attributes.label }),
      },
      hint: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-hint"),
        renderHTML: (attributes) => ({ "data-hint": attributes.hint }),
      },
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
      `⬡ PLACEHOLDER: ${HTMLAttributes["data-label"] || "Content"}`,
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
  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);
  
  const onChangeFn = useRef(onChange);
  useEffect(() => {
    onChangeFn.current = onChange;
  }, [onChange]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !readOnly,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({ allowBase64: false, inline: true }),
        Placeholder.configure({ placeholder }),
        CharacterCount,
        PlaceholderNode,
      ],
      content: markdownToHtml(content),
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        onChangeFn.current(htmlToMarkdown(html));
      },
      onSelectionUpdate: () => {
        // This forces the React component to re-render when the selection changes
        // so that isActive("table") checks in the toolbar/footer are accurate.
        forceUpdate();
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
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [content, editor]);

  const insertPlaceholder = useCallback(
    (label: string, hint = "") => {
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: "reportPlaceholder",
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
          <div className="relative group">
            <ToolBtn
              title="Table actions"
              active={editor.isActive("table")}
              onClick={() => {}}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </ToolBtn>
            
            {/* Hover bridge to prevent dropdown from disappearing */}
            <div className="absolute top-full left-0 w-full h-2 z-50 hidden group-hover:block" />

            {editor.isActive("table") ? (
              <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-48 hidden group-hover:block animate-in fade-in zoom-in duration-100">
                {[
                  {
                    label: "Add Row Above",
                    fn: () => editor.chain().focus().addRowBefore().run(),
                  },
                  {
                    label: "Add Row Below",
                    fn: () => editor.chain().focus().addRowAfter().run(),
                  },
                  {
                    label: "Add Column Left",
                    fn: () => editor.chain().focus().addColumnBefore().run(),
                  },
                  {
                    label: "Add Column Right",
                    fn: () => editor.chain().focus().addColumnAfter().run(),
                  },
                  { type: "divider" },
                  {
                    label: "Delete Row",
                    fn: () => editor.chain().focus().deleteRow().run(),
                  },
                  {
                    label: "Delete Column",
                    fn: () => editor.chain().focus().deleteColumn().run(),
                  },
                  {
                    label: "Delete Table",
                    fn: () => editor.chain().focus().deleteTable().run(),
                  },
                ].map((item, idx) =>
                  item.type === "divider" ? (
                    <div key={idx} className="h-px bg-slate-100 my-1" />
                  ) : (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        (item as any).fn();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {(item as any).label}
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-48 hidden group-hover:block animate-in fade-in zoom-in duration-100">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Insert Table (3x3)
                </button>
              </div>
            )}
          </div>

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
                {
                  label: "Financial Chart / Graph",
                  hint: "Upload ROI or cash flow chart",
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
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertPlaceholder(label, hint);
                  }}
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
      {!readOnly && (editor.isActive("table") || editor.isActive("tableCell") || editor.isActive("tableHeader") || editor.can().deleteTable()) && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-amber-100 bg-amber-50/50 text-[11px] flex-wrap">
          <span className="text-amber-700 font-bold uppercase tracking-wider text-[9px] mr-2 flex items-center gap-1">
            <TableIcon className="w-3 h-3" /> Table Active:
          </span>
          {[
            {
              label: "+ Row",
              fn: () => editor.chain().focus().addRowAfter().run(),
            },
            {
              label: "+ Col",
              fn: () => editor.chain().focus().addColumnAfter().run(),
            },
            {
              label: "- Row",
              fn: () => editor.chain().focus().deleteRow().run(),
            },
            {
              label: "- Col",
              fn: () => editor.chain().focus().deleteColumn().run(),
            },
            {
              label: "Delete",
              fn: () => editor.chain().focus().deleteTable().run(),
              danger: true,
            },
          ].map(({ label, fn, danger }) => (
            <button
              key={label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                fn();
              }}
              className={cn(
                "px-2.5 py-1 rounded-md border shadow-sm transition-all font-medium",
                danger
                  ? "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300"
                  : "border-amber-200 bg-white text-amber-700 hover:bg-amber-100 hover:border-amber-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
