import { useState } from 'react';
import { MessageSquare, Database, StickyNote, FolderArchive } from 'lucide-react';

import DragDropFiles from './DragDropFiles';
import { GoogleKeepImport } from './GoogleKeepImport';
import { GoogleKeepBulkImport } from './Googlekeepbulkimport';
import { ChatGPTImport } from './ChatGPTImport';

type Source = 'claude' | 'chatgpt' | 'keep-single' | 'keep-bulk';

interface Tab {
  id: Source;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  {
    id: 'claude',
    label: 'Claude',
    description: 'Drop a Claude export JSON',
    icon: MessageSquare,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    description: 'Upload a ChatGPT export ZIP',
    icon: Database,
  },
  {
    id: 'keep-single',
    label: 'Google Keep',
    description: 'Single notes JSON',
    icon: StickyNote,
  },
  {
    id: 'keep-bulk',
    label: 'Google Keep (Bulk)',
    description: 'Many JSONs at once',
    icon: FolderArchive,
  },
];

export default function ImportsPage() {
  const [active, setActive] = useState<Source>('claude');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Import Conversations</h1>
          <p className="text-sm text-slate-600 mt-1">
            Bring in your chats from elsewhere. Each tab handles a different export format.
          </p>
        </header>

        {/* Tab strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`
                  text-left p-3 rounded-lg border transition-all
                  ${isActive
                    ? 'border-blue-400 bg-white shadow-md ring-1 ring-blue-200'
                    : 'border-slate-200 bg-white/60 hover:bg-white hover:border-slate-300'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      isActive ? 'text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {t.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{t.description}</p>
              </button>
            );
          })}
        </div>

        {/* Panel — render the chosen importer */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          {active === 'claude'      && <DragDropFiles />}
          {active === 'chatgpt'     && <ChatGPTImport />}
          {active === 'keep-single' && <GoogleKeepImport />}
          {active === 'keep-bulk'   && <GoogleKeepBulkImport />}
        </div>
      </div>
    </div>
  );
}