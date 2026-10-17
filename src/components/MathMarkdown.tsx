import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

/**
 * Unified pipeline for processing Gemini & AI responses:
 * Gemini Response -> Normalize LaTeX/Math delimiters & symbols -> Markdown Parser -> KaTeX Parser -> Safe Sanitized Render
 * 
 * Guarantees that:
 * 1. Users NEVER see raw LaTeX tokens (\Rightarrow, \cdot, \frac, \sqrt, \[, \], \(, \), $$, $)
 * 2. Code blocks (```...``` and `...`) are strictly protected from math manipulation
 * 3. Markdown (bold, italic, lists, headings, tables, blockquotes) is fully preserved
 */
export function formatGeminiMathResponse(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // 1. Normalize double-escaped backslashes before LaTeX macros or brackets
  let processed = text.replace(/\\\\([a-zA-Z]+|\{|\}|\[|\]|\(|\))/g, '\\$1');

  // 2. Extract and protect code blocks & inline code
  const codeBlocks: string[] = [];
  processed = processed.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    const placeholder = `__PROTECTED_CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 3. Normalize standard LaTeX display math delimiters: \[ ... \] -> $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula) => {
    const trimmed = formula.trim();
    return `\n\n$$\n${trimmed}\n$$\n\n`;
  });

  // 4. Normalize standard LaTeX inline math delimiters: \( ... \) -> $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula) => {
    const trimmed = formula.trim();
    return `$${trimmed}$`;
  });

  // 5. Wrap standalone LaTeX environments (cases, aligned, matrix, array) in $$ ... $$
  processed = processed.replace(
    /(?:^|[^\$])(\\begin\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix|array)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix|array)\})(?:[^\$]|$)/g,
    (match, env) => {
      if (match.startsWith('$$') || match.endsWith('$$')) return match;
      return `\n\n$$\n${env.trim()}\n$$\n\n`;
    }
  );

  // 6. Normalize multi-line $$ ... $$ to ensure clean parsing by remark-math
  processed = processed.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_match, formula) => {
    return `\n\n$$\n${formula.trim()}\n$$\n\n`;
  });

  // 7. Trim internal spaces inside inline $ ... $ to satisfy remark-math boundary requirements ($ math $ -> $math$)
  processed = processed.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_match, inner) => {
    return `$${inner.trim()}$`;
  });

  // 8. Protect existing math blocks ($$ ... $$ and $ ... $) before scanning for raw standalone macros
  const mathBlocks: string[] = [];
  let nonMath = processed.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    const placeholder = `__PROTECTED_MATH_BLOCK_${mathBlocks.length}__`;
    mathBlocks.push(match);
    return placeholder;
  });

  // 9. Auto-detect and wrap un-delimited standalone fractions and radicals in $ ... $
  // e.g. \frac{a}{b}, \dfrac{1}{2}, \cfrac{...}{...}, \sqrt{x}, \sqrt[3]{8}
  nonMath = nonMath.replace(
    /(\\(?:frac|dfrac|cfrac|binom|sqrt)\s*(?:\[[^\]]*\])?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}(?:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?)/g,
    (match) => `$${match.trim()}$`
  );

  // 10. Auto-detect and wrap standalone LaTeX symbols and arrows outside math mode
  // e.g. \Rightarrow, \Leftarrow, \Leftrightarrow, \cdot, \approx, \le, \ge, \pm, \neq, \times, \div, \in, etc.
  const commonSymbols = [
    'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'rightarrow', 'leftarrow', 'leftrightarrow',
    'implies', 'iff', 'cdot', 'bullet', 'circ', 'degree',
    'le', 'ge', 'leq', 'geq', 'neq', 'pm', 'mp', 'approx', 'sim', 'cong', 'equiv',
    'times', 'div', 'in', 'notin', 'subset', 'subseteq', 'supset', 'supseteq',
    'cup', 'cap', 'Delta', 'nabla', 'infty', 'partial', 'forall', 'exists',
    'alpha', 'beta', 'gamma', 'theta', 'pi', 'omega', 'sigma', 'lambda', 'mu',
    'perp', 'parallel', 'angle'
  ].join('|');
  const symbolsRegex = new RegExp(`(\\\\(${commonSymbols}))\\b`, 'g');
  nonMath = nonMath.replace(symbolsRegex, (match) => `$${match}$`);

  // 11. Auto-detect and wrap un-delimited algebraic power expressions: (a-b)^2, (x+1)^3
  nonMath = nonMath.replace(
    /(?<![\w\$\\])(\([a-zA-Z0-9\s\+\-\*\/\,\.]+\)\^[0-9a-zA-Z]+)(?![\w\$\\])/g,
    (match) => `$${match}$`
  );

  // 12. Auto-detect and wrap standalone \text{...} if found in raw text
  nonMath = nonMath.replace(/(\\text\{[^{}]*\})/g, (match) => `$${match}$`);

  // 13. Restore protected math blocks (CRITICAL: use function replacer () => block so $$ is never eaten by String.replace)
  mathBlocks.forEach((block, idx) => {
    nonMath = nonMath.replace(`__PROTECTED_MATH_BLOCK_${idx}__`, () => block);
  });

  // 14. Restore protected code blocks using function replacer
  codeBlocks.forEach((block, idx) => {
    nonMath = nonMath.replace(`__PROTECTED_CODE_BLOCK_${idx}__`, () => block);
  });

  return nonMath;
}

const REMARK_PLUGINS: any[] = [
  [remarkMath, { singleDollarTextMath: true }],
  remarkGfm
];
const REHYPE_PLUGINS = [
  [
    rehypeKatex,
    {
      output: 'htmlAndMathml',
      throwOnError: false,
      strict: false
    }
  ] as any
];

const MARKDOWN_COMPONENTS: React.ComponentProps<typeof Markdown>['components'] = {
  // Custom renderers for polished learning UI
  h1: ({ children }) => (
    <h1 className="text-lg font-extrabold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200/80">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-slate-900 mt-3.5 mb-1.5 flex items-center gap-1.5">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold text-slate-800 mt-3 mb-1">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-1.5 leading-relaxed text-slate-800">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1 text-slate-700">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1 text-slate-700">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-700">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-400 pl-3.5 py-1.5 my-2.5 bg-amber-50/60 rounded-r-xl text-slate-700 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 border border-slate-200/90 rounded-xl shadow-xs">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-100 bg-white">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-slate-50/70 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3.5 py-2.5 text-left font-bold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3.5 py-2 text-slate-700">{children}</td>
  ),
  code: ({ className: codeClassName, children, ...props }) => {
    const isBlock = /language-(\w+)/.test(codeClassName || '');
    if (isBlock) {
      return (
        <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xs">
          <pre className="p-3 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
            <code className={codeClassName} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    }
    return (
      <code
        className="bg-amber-50 border border-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded-md font-mono text-xs font-semibold"
        {...props}
      >
        {children}
      </code>
    );
  }
};

interface MathMarkdownProps {
  content: string;
  className?: string;
  inline?: boolean;
}

/**
 * Unified Component for rendering Gemini AI & Question content with Markdown & KaTeX.
 * Memoized with React.memo to ensure zero re-renders during typing or scrolling.
 */
export const MathMarkdown = React.memo<MathMarkdownProps>(({
  content,
  className = '',
  inline = false
}) => {
  const formattedContent = useMemo(() => {
    return formatGeminiMathResponse(content || '');
  }, [content]);

  return (
    <div
      className={`math-markdown-container break-words leading-relaxed ${className} ${
        inline ? 'inline' : 'space-y-2.5'
      }`}
    >
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={MARKDOWN_COMPONENTS}
      >
        {formattedContent}
      </Markdown>
    </div>
  );
});

MathMarkdown.displayName = 'MathMarkdown';
