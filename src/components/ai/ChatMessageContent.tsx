import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[#F5F7F5]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-white/10 text-[#B7FF67] font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key++} className="italic text-[#D8E2DF]">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }

  return nodes.length > 0 ? nodes : [text];
}

function parsePipeRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  const cells = parsePipeRow(trimmed);
  return cells.length >= 2 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function isTableRowLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.includes('|', 1);
}

export const ChatMessageContent: React.FC<{ content: string; isStreaming?: boolean }> = ({
  content,
  isStreaming = false,
}) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Markdown table (header row + separator row + 0..N body rows)
    if (
      i + 1 < lines.length &&
      isTableRowLine(lines[i]) &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headers = parsePipeRow(lines[i]);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && isTableRowLine(lines[i])) {
        bodyRows.push(parsePipeRow(lines[i]));
        i += 1;
      }

      elements.push(
        <div
          key={blockKey++}
          className="overflow-x-auto rounded-xl border border-white/10 bg-[#101619]"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-3 py-2 font-semibold text-[#B7FF67] whitespace-nowrap"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/[0.02]">
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-[#DCE3E0] align-top">
                      {renderInline(row[cIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Markdown headings (###, ##, #)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const cls =
        level <= 2
          ? 'text-sm font-bold text-[#B7FF67] tracking-tight pt-1'
          : 'text-[13px] font-semibold text-[#40E0D0] pt-1';
      elements.push(
        <div key={blockKey++} className={cls}>
          {renderInline(headingText)}
        </div>
      );
      i += 1;
      continue;
    }

    // Unordered list (- or *)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, '').trim());
        i += 1;
      }
      elements.push(
        <ul key={blockKey++} className="list-disc pl-5 space-y-1 text-[#DCE3E0]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1. 2. ...)
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '').trim());
        i += 1;
      }
      elements.push(
        <ol key={blockKey++} className="list-decimal pl-5 space-y-1 text-[#DCE3E0]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (combine consecutive non-empty plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !(i + 1 < lines.length && isTableRowLine(lines[i]) && isTableSeparatorLine(lines[i + 1])) &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }

    elements.push(
      <p key={blockKey++} className="leading-relaxed text-[#E7ECEA]">
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return (
    <div className="space-y-2.5 text-sm">
      {elements}
      {isStreaming && (
        <span
          aria-hidden="true"
          className="inline-block w-2 h-4 align-middle bg-[#B7FF67] animate-pulse rounded-xs ml-1"
        />
      )}
    </div>
  );
};
