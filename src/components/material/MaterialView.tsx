import type { MaterialBlock } from "../../types/Material";
import CodeBlock from "./CodeBlock";
import RichText from "./RichText";

// Cómo se ve un material: igual en la vista previa del Host y para las alumnas.
export default function MaterialView({ blocks }: { blocks: MaterialBlock[] }) {
  return (
    <div className="space-y-5 text-white">
      {blocks.map((block, index) => {
        if (block.type === "text") return <RichText key={index} text={block.text} />;
        if (block.type === "code") return <CodeBlock key={index} code={block.code} language={block.language} />;
        return (
          <a
            key={index}
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4 hover:bg-fuchsia-500/20"
          >
            <span className="text-2xl">🔗</span>
            <span className="min-w-0">
              <span className="block font-semibold break-words">{block.label || block.url}</span>
              {block.label && <span className="block truncate text-xs text-slate-400">{block.url}</span>}
            </span>
          </a>
        );
      })}
    </div>
  );
}
