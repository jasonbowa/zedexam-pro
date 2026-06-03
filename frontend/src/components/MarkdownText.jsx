function inlineFormat(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export default function MarkdownText({ text }) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = [];
  let listType = null;

  const flushList = () => {
    if (!list.length) return;
    const ListTag = listType === 'ol' ? 'ol' : 'ul';
    blocks.push(
      <ListTag key={`list-${blocks.length}`} className={`mt-2 space-y-1 pl-5 text-sm leading-6 text-slate-600 ${listType === 'ol' ? 'list-decimal' : 'list-disc'}`}>
        {list.map((item, index) => <li key={index}>{inlineFormat(item)}</li>)}
      </ListTag>
    );
    list = [];
    listType = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const size = heading[1].length === 1 ? 'text-base' : 'text-sm';
      blocks.push(<h5 key={`heading-${index}`} className={`mt-3 font-black text-slate-950 ${size}`}>{inlineFormat(heading[2])}</h5>);
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      list.push(bullet[1]);
      return;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      list.push(numbered[1]);
      return;
    }

    flushList();
    blocks.push(<p key={`p-${index}`} className="mt-2 text-sm leading-6 text-slate-600">{inlineFormat(trimmed)}</p>);
  });

  flushList();
  return <div className="mt-2">{blocks}</div>;
}
