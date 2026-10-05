"use client";

import { isValidElement, memo, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./CopyButton";

function CodeBlock({ children }: React.HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const className = isValidElement<{ className?: string }>(children) ? children.props.className : "";
  const lang = /language-([\w-]+)/.exec(className ?? "")?.[1] ?? "";

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-line bg-code">
      <div className="flex h-9 items-center justify-between pr-1 pl-4 text-xs text-muted">
        <span>{lang}</span>
        <CopyButton getText={() => ref.current?.textContent ?? ""} label="Copy code" showLabel />
      </div>
      <pre ref={ref} className="overflow-x-auto px-4 pb-4 font-mono text-sm leading-[22px]">
        {children}
      </pre>
    </div>
  );
}

// react-markdown passes its AST `node` to every component; keep it off the DOM.
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

const components: Components = {
  pre: (props) => <CodeBlock {...withoutNode(props)} />,
  a: (props) => <a {...withoutNode(props)} target="_blank" rel="noreferrer noopener" />,
  table: (props) => (
    <div className="my-4 overflow-x-auto">
      <table {...withoutNode(props)} />
    </div>
  ),
};

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
});
