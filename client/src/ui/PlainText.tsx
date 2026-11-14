/**
 * Renders therapist-written plain text: blank lines separate paragraphs and lines starting with
 * "- " become a bullet list. Everything is rendered as text (React escapes it); no HTML or links.
 */
export function PlainText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((block) => block.split('\n').filter((line) => line.trim() !== ''));
  return (
    <div className={`grid gap-3 ${className}`}>
      {blocks.map((lines, index) => {
        const bullets = lines.filter((line) => /^\s*-\s+/.test(line));
        if (bullets.length > 0 && bullets.length === lines.length) {
          return (
            <ul key={index} className="grid list-disc gap-1 ps-6">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.replace(/^\s*-\s+/, '')}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line">
            {lines.join('\n')}
          </p>
        );
      })}
    </div>
  );
}
