import { useState } from 'react';
import { Modal } from './components';
import { netReport } from './net/netlog';
import { store } from './store';
import { APP_VERSION_TEXT, useStore, useT } from './ui';

/** "Report a problem": what the network did lately, ready to copy and send */
export function ReportSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const s = useStore();
  const g = s.game;
  // taken once, when the sheet opens
  const [text] = useState(() => netReport({
    version: APP_VERSION_TEXT,
    time: new Date().toISOString(),
    mode: s.mode,
    net: s.net,
    room: s.room ? `${s.room}#${s.gen}` : '-',
    game: g ? `v${g.v} gid=${g.gid ?? '-'} head=${g.q[0]?.k ?? '-'} waiting=${g.q[0] ? JSON.stringify(g.q[0]).slice(0, 160) : '-'}` : '-',
    browser: navigator.userAgent,
  }));
  return (
    <Modal onClose={onClose}>
      <h2>🛠️ {t('report')}</h2>
      <p className="small muted">{t('reportHelp')}</p>
      <textarea className="report" readOnly value={text} rows={12} />
      <button className="btn primary wide" onClick={async () => {
        try { await navigator.clipboard.writeText(text); store.toast('copied'); } catch { /* select it by hand */ }
      }}>📋 {t('reportCopy')}</button>
      <button className="btn wide" onClick={onClose}>{t('close')}</button>
    </Modal>
  );
}
