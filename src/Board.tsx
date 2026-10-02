import type { ReactNode } from 'react';
import { board, sqName } from './game/engine';
import type { Game } from './game/types';
import { useT } from './ui';
import { PieceIcon } from './components';
import { cellPos } from './game/layout';

const ICON: Record<string, string> = {
  go: '←', jail: '⛓', parking: 'P', gotojail: '🚓', chance: '?', chest: '✉', tax: '€', station: '🚆', utility: '💡',
};


export function BoardView({ g, onSquare, center }: { g: Game; onSquare: (sq: number) => void; center: ReactNode }) {
  const { lang } = useT();
  const b = board(g);
  const N = b.squares.length;
  const s = N / 4;
  return (
    <div className="board" style={{ ['--inner' as string]: s - 1, ['--fs' as string]: `${(100 / (s + 1.8)) * 0.19}cqw` }}>
      {b.squares.map((sq, i) => {
        const { row, col, side } = cellPos(i, s);
        const pr = g.props[i];
        const owner = pr?.owner ? g.players.find((p) => p.id === pr.owner) : undefined;
        const here = g.players.filter((p) => !p.out && p.pos === i);
        const color = sq.group !== undefined ? b.groups[sq.group].color : undefined;
        const corner = i % s === 0;
        return (
          <button key={i} className={`cell side-${side}${corner ? ' corner' : ''}${pr?.mort ? ' mort' : ''}`}
            style={{ gridRow: row, gridColumn: col, ['--own' as string]: owner?.color ?? 'transparent' }}
            onClick={() => onSquare(i)} aria-label={sqName(g, i, lang)}>
            {color && <span className="strip" style={{ background: color }} />}
            <span className="cname">{sq.kind === 'street' ? sqName(g, i, lang) : ICON[sq.kind]}</span>
            {pr && pr.houses > 0 && (
              <span className="houses">{pr.houses === 5 ? '▣' : '▪'.repeat(pr.houses)}</span>
            )}
            {here.length > 0 && (
              <span className="tokens">
                {here.map((p) => (
                  <span key={p.id} className={'tok' + (g.players[g.cur].id === p.id ? ' cur' : '')} style={{ borderColor: p.color }}><PieceIcon id={p.emoji} color={p.color} size={40} /></span>
                ))}
              </span>
            )}
          </button>
        );
      })}
      <div className="bcenter" style={{ gridRow: `2 / ${s + 1}`, gridColumn: `2 / ${s + 1}` }}>{center}</div>
    </div>
  );
}

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
export function Die({ n, tint }: { n: number; tint?: string }) {
  return (
    <span className="die" style={tint ? { ['--pip' as string]: tint } : undefined} aria-label={String(n)}>
      {Array.from({ length: 9 }, (_, k) => <span key={k} className={PIPS[n]?.includes(k) ? 'pip' : ''} />)}
    </span>
  );
}
