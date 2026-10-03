import type { ReactNode } from "react";

// Formato básico, dibujado como elementos de React (nunca como HTML crudo,
// así que no se puede inyectar código):
//   # Título   ## Subtítulo   ### Sección
//   - viñeta   1. lista numerada
//   **negritas**   *cursiva*   `código`
//   Una línea vacía separa párrafos.

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbers"; items: string[] }
  | { kind: "paragraph"; lines: string[] };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];

  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks.at(-1);

    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length as 1 | 2 | 3, text: heading[2]! });
    } else if (bullet) {
      if (last?.kind === "bullets") last.items.push(bullet[1]!);
      else blocks.push({ kind: "bullets", items: [bullet[1]!] });
    } else if (numbered) {
      if (last?.kind === "numbers") last.items.push(numbered[1]!);
      else blocks.push({ kind: "numbers", items: [numbered[1]!] });
    } else if (!line.trim()) {
      blocks.push({ kind: "paragraph", lines: [] }); // separador
    } else if (last?.kind === "paragraph" && last.lines.length > 0) {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "paragraph", lines: [line] });
    }
  }

  return blocks.filter((block) => block.kind !== "paragraph" || block.lines.length > 0);
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={index} className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.9em] text-fuchsia-200">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

const HEADING_CLASS = { 1: "text-2xl sm:text-3xl", 2: "text-xl sm:text-2xl", 3: "text-lg sm:text-xl" } as const;

export default function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-3 leading-relaxed break-words">
      {parseBlocks(text).map((block, index) => {
        if (block.kind === "heading") {
          const Tag = (`h${block.level + 1}`) as "h2" | "h3" | "h4";
          return <Tag key={index} className={`font-bold ${HEADING_CLASS[block.level]}`}>{renderInline(block.text)}</Tag>;
        }
        if (block.kind === "bullets") {
          return <ul key={index} className="list-disc space-y-1 pl-6">{block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}</ul>;
        }
        if (block.kind === "numbers") {
          return <ol key={index} className="list-decimal space-y-1 pl-6">{block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}</ol>;
        }
        return (
          <p key={index}>
            {block.lines.map((line, i) => (
              <span key={i}>{i > 0 && <br />}{renderInline(line)}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
