import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

const components: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-[#d4d4d4]">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-white mb-2 mt-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-white mb-2 mt-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium text-[#e0e0e0] mb-1.5 mt-1">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1.5 text-[#d4d4d4]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-[#d4d4d4]">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="text-[#bbb] italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#a99aff] underline underline-offset-2 hover:text-[#c4b5fd]"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-3 p-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] overflow-x-auto text-xs font-mono text-[#c9d1d9]">
      {children}
    </pre>
  ),
  code: ({ className, children }) => (
    <code
      className={
        className
          ? className
          : "px-1.5 py-0.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-xs font-mono text-[#c9d1d9]"
      }
    >
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#8B7CF6] pl-3 my-3 text-[#aaa] italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-[#333] my-4" />,
};

type Props = {
  content: string;
  streaming?: boolean;
};

export function AssistantMarkdown({ content, streaming }: Props) {
  if (!content.trim() && streaming) {
    return (
      <span className="text-[#666] text-sm italic">Thinking…</span>
    );
  }

  if (!content.trim()) {
    return null;
  }

  return (
    <div className="assistant-markdown text-sm">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
      {streaming && (
        <span
          className="inline-block w-0.5 h-4 bg-[#8B7CF6] ml-0.5 align-middle animate-pulse"
          aria-hidden
        />
      )}
    </div>
  );
}
