import { BOARDS } from './game/boards';
import type { Game } from './game/types';
import { fill, RULES, ruleValues } from './rules';
import { Modal } from './components';
import { useT } from './ui';

/** The rules: short sections that open for details. Inside a game, the game's own settings come first. */
export function RulesSheet({ g, onClose }: { g?: Game | null; onClose: () => void }) {
  const { t, m, lang } = useT();
  const b = BOARDS[g?.boardId ?? 'classic'];
  const v = ruleValues(b, m);
  const r = g?.rules;
  const customCards = g ? Math.max(0, g.cards.length - 32) : 0;
  const onOff = (on: boolean) => (on ? '✅' : '—');
  return (
    <Modal onClose={onClose}>
      <h2>📖 {t('rules')}</h2>
      {g && r && (
        <div className="rules-game">
          <h3>{t('rulesThisGame')}</h3>
          <ul>
            <li>{t(g.boardId)}: {t(g.boardId + 'Info')}</li>
            <li>{t('rulesSalaryFine', { s: v.salary, f: v.fine })}</li>
            <li>{t('auctionMode')}: {t(r.auction === 'open' ? 'auctionOpen' : 'auctionSealed')}</li>
            <li>{t('timeLimit')}: {r.timeLimitMin ? t('minutes', { n: r.timeLimitMin }) : t('off')}</li>
            {(['freeParking', 'doubleGo', 'noRentInJail', 'buyAfterLap', 'allowPass'] as const).map((k) => (
              <li key={k}>{onOff(!!r[k])} {t('r_' + k)}</li>
            ))}
            {customCards > 0 && <li>🃏 {t('rulesCustomCards', { n: customCards })}</li>}
            {g.prices && Object.keys(g.prices).length > 0 && <li>🏷️ {t('rulesPrices', { n: Object.keys(g.prices).length })}</li>}
          </ul>
        </div>
      )}
      <div className="rules-list">
        {RULES[lang].map((sec) => (
          <details key={sec.id} className="rule">
            <summary>
              <span className="rule-icon">{sec.icon}</span>
              <span className="rule-head">
                <strong>{sec.title}</strong>
                <span className="small muted">{fill(sec.short, v)}</span>
              </span>
            </summary>
            <ul>
              {sec.details.map((d, i) => <li key={i}>{fill(d, v)}</li>)}
            </ul>
          </details>
        ))}
      </div>
      <button className="btn wide" onClick={onClose}>{t('close')}</button>
    </Modal>
  );
}
