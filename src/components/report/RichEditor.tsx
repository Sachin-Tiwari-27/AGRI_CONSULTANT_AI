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
  Code,
  Quote,
  AlertTriangle,
  BarChart2,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ChartNode, insertChart } from "./ChartNode";
import { ChartInsertPopover } from "./ChartInsertPopover";
import type { ChartType, ChartDataPoint } from "./ChartNode";

/* ── Custom Placeholder Node (unchanged) ─────────────────────────── */
const PlaceholderNode = Node.create({
  name: "reportPlaceholder",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      label: {
        default: "Content",
        parseHTML: (el) => el.getAttribute("data-label"),
        renderHTML: (a) => ({ "data-label": a.label }),
      },
      hint: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-hint"),
        renderHTML: (a) => ({ "data-hint": a.hint }),
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
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.setAttribute("data-type", "placeholder");
      dom.className =
        "my-3 flex items-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 cursor-pointer hover:border-amber-400 transition-colors";
      dom.innerHTML = `<span class="text-amber-500">⬡</span><span>PLACEHOLDER: ${node.attrs.label}</span><span class="text-amber-600 font-normal text-xs ml-1">${node.attrs.hint ? `— ${node.attrs.hint}` : "— Click to edit"}</span>`;
      return { dom };
    };
  },
});

/* ── Toolbar button ──────────────────────────────────────────────── */
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
      className={cn(
        "p-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled ? "opacity-30 cursor-not-allowed" : "",
      )}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return <div className="w-px h-4 bg-border mx-0.5" />;
}

/* ── Image upload ────────────────────────────────────────────────── */
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

/* ── Main RichEditor ─────────────────────────────────────────────── */
interface Props {
  content: string;
  onChange: (markdown: string) => void;
  projectId?: string;
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
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);
  const [showChartPopover, setShowChartPopover] = useState(false);
  const chartBtnRef = useRef<HTMLButtonElement>(null);

  const onChangeFn = useRef(onChange);
  useEffect(() => {
    onChangeFn.current = onChange;
  }, [onChange]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !readOnly,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({ allowBase64: false, inline: true }),
        Placeholder.configure({ placeholder }),
        CharacterCount,
        PlaceholderNode,
        ChartNode, // ← new
      ],
      content: markdownToHtml(content),
      onUpdate: ({ editor }) => {
        onChangeFn.current(htmlToMarkdown(editor.getHTML()));
      },
      onSelectionUpdate: () => forceUpdate(),
      editorProps: {
        attributes: {
          class: cn(
            "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-5",
            "text-foreground leading-relaxed tiptap-editor",
            "[&_table]:w-full [&_table]:border-collapse [&_table]:my-3",
            "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
            "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
            "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3",
            "[&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
          ),
        },
      },
    },
    [],
  );

  /* Sync content when prop changes */
  const prevContent = useRef(content);
  useEffect(() => {
    if (!editor || content === prevContent.current) return;
    prevContent.current = content;
    const html = markdownToHtml(content);
    if (editor.getHTML() !== html)
      editor.commands.setContent(html, { emitUpdate: false });
  }, [content, editor]);

  const insertPlaceholder = useCallback(
    (label: string, hint = "") => {
      editor
        ?.chain()
        .focus()
        .insertContent({ type: "reportPlaceholder", attrs: { label, hint } })
        .run();
    },
    [editor],
  );

  const handleChartInsert = useCallback(
    (
      type: ChartType,
      title: string,
      data: ChartDataPoint[],
      currency: string,
    ) => {
      if (!editor) return;
      insertChart(editor, type, title, data, currency);
      setShowChartPopover(false);
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
      <div className="border border-border rounded-xl min-h-[400px] flex items-center justify-center bg-card">
        <div className="size-4 border-2 border-muted border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  const charCount = editor.storage.characterCount?.characters() ?? 0;
  const wordCount = editor.storage.characterCount?.words() ?? 0;

  return (
    <div
      className={cn(
        "border border-border rounded-xl bg-card relative",
        className,
      )}
    >
      {/* ── Toolbar ───────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="sticky top-[109px] z-10 flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/90 backdrop-blur flex-wrap rounded-t-xl">
          {/* History */}
          <ToolBtn
            title="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="size-3.5" />
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
            <Heading1 className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="size-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Inline */}
          <ToolBtn
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Code"
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Blockquote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="size-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Lists */}
          <ToolBtn
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* Table */}
          <div className="relative group">
            <ToolBtn
              title="Table"
              active={editor.isActive("table")}
              onClick={() => {}}
            >
              <TableIcon className="size-3.5" />
            </ToolBtn>
            <div className="absolute top-full left-0 w-2 h-2 z-50 hidden group-hover:block" />
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg py-1 z-50 w-44 hidden group-hover:block">
              {editor.isActive("table") ? (
                <>
                  {[
                    [
                      "Add row above",
                      () => editor.chain().focus().addRowBefore().run(),
                    ],
                    [
                      "Add row below",
                      () => editor.chain().focus().addRowAfter().run(),
                    ],
                    [
                      "Add column left",
                      () => editor.chain().focus().addColumnBefore().run(),
                    ],
                    [
                      "Add column right",
                      () => editor.chain().focus().addColumnAfter().run(),
                    ],
                    ["—"],
                    [
                      "Delete row",
                      () => editor.chain().focus().deleteRow().run(),
                    ],
                    [
                      "Delete column",
                      () => editor.chain().focus().deleteColumn().run(),
                    ],
                    [
                      "Delete table",
                      () => editor.chain().focus().deleteTable().run(),
                    ],
                  ].map((item, i) =>
                    item[0] === "—" ? (
                      <div key={i} className="h-px bg-border my-1" />
                    ) : (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          (item[1] as () => void)();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        {item[0] as string}
                      </button>
                    ),
                  )}
                </>
              ) : (
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
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  Insert 3×3 table
                </button>
              )}
            </div>
          </div>

          {/* Image */}
          <ToolBtn
            title="Insert image"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="size-3.5" />
          </ToolBtn>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await handleImageUpload(f);
              e.target.value = "";
            }}
          />

          {/* Divider */}
          <ToolBtn
            title="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="size-3.5" />
          </ToolBtn>

          <ToolDivider />

          {/* ── Chart insert ── */}
          <div className="relative">
            <button
              ref={chartBtnRef}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowChartPopover((v) => !v);
              }}
              title="Insert chart"
              className={cn(
                "p-1.5 rounded-md text-sm transition-colors flex items-center gap-1",
                showChartPopover
                  ? "bg-brand-800 text-white"
                  : "text-brand-700 hover:bg-brand-50 hover:text-brand-800",
              )}
            >
              <BarChart2 className="size-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">
                Chart
              </span>
            </button>
            {showChartPopover && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowChartPopover(false)}
                />
                <div className="absolute top-full left-0 mt-1.5 z-50">
                  <ChartInsertPopover
                    onInsert={handleChartInsert}
                    onClose={() => setShowChartPopover(false)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Placeholder */}
          <div className="relative group">
            <ToolBtn title="Insert placeholder" onClick={() => {}}>
              <AlertTriangle className="size-3.5 text-amber-500" />
            </ToolBtn>
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg py-1 z-50 w-56 hidden group-hover:block">
              <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Insert placeholder
              </p>
              {[
                [
                  "Site Photo / Rendering",
                  "Upload site photo or farm rendering",
                ],
                ["Greenhouse Layout Plan", "Upload site plan or CAD drawing"],
                ["Financial Chart / Graph", "Upload ROI or cash flow chart"],
                ["Gantt Chart", "Upload project timeline"],
                ["Equipment Supplier Quotes", "Attach supplier quotations"],
                ["Water Quality Report", "Upload lab EC/TDS/pH report"],
                ["Staffing Plan", "Add detailed role and salary breakdown"],
                ["Marketing Budget", "Add quarterly marketing spend plan"],
                ["Custom", ""],
              ].map(([label, hint]) => (
                <button
                  key={label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertPlaceholder(label, hint);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-amber-50 hover:text-amber-800 transition-colors"
                >
                  ⬡ {label}
                </button>
              ))}
            </div>
          </div>

          {/* Word count */}
          <div className="ml-auto text-[10px] text-muted-foreground hidden sm:block pr-1">
            {wordCount} words · {charCount} chars
          </div>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Table context bar */}
      {!readOnly && editor.isActive("table") && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-amber-100 bg-amber-50/50 text-[11px] flex-wrap">
          <span className="text-amber-700 font-bold text-[9px] uppercase tracking-wider mr-1 flex items-center gap-1">
            <TableIcon className="size-3" /> Table:
          </span>
          {[
            ["+Row", () => editor.chain().focus().addRowAfter().run()],
            ["+Col", () => editor.chain().focus().addColumnAfter().run()],
            ["−Row", () => editor.chain().focus().deleteRow().run()],
            ["−Col", () => editor.chain().focus().deleteColumn().run()],
            ["Delete", () => editor.chain().focus().deleteTable().run(), true],
          ].map(([label, fn, danger]) => (
            <button
              key={String(label)}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                (fn as () => void)();
              }}
              className={cn(
                "px-2 py-1 rounded border text-[11px] font-medium transition-colors",
                danger
                  ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                  : "border-amber-200 bg-white text-amber-700 hover:bg-amber-100",
              )}
            >
              {String(label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
