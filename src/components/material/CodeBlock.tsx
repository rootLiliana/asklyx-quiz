import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import type { CodeLanguage } from "../../types/Material";

const LANGUAGE_LABEL: Record<CodeLanguage, string> = { python: "Python", sql: "SQL", bash: "Terminal", text: "Texto" };

// Bloque de código con colores y botón de copiar.
export default function CodeBlock({ code, language }: { code: string; language: CodeLanguage }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles (http o navegador viejo): se puede seleccionar a mano.
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e2e]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
        <span>{LANGUAGE_LABEL[language]}</span>
        <button type="button" onClick={() => void copy()} className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">
          {copied ? "✅ Copiado" : "📋 Copiar"}
        </button>
      </div>
      <Highlight code={code.replace(/\n+$/, "")} language={language === "bash" ? "text" : language} theme={themes.dracula}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
            {tokens.map((line, lineIndex) => (
              <div key={lineIndex} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => <span key={tokenIndex} {...getTokenProps({ token })} />)}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
