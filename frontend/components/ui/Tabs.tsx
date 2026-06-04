interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 rounded-lg bg-bg-hover p-1 ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150
            ${activeTab === tab.id
              ? 'bg-bg-card text-accent-primary shadow-sm'
              : 'text-text-muted hover:text-text-primary'
            }
          `.trim()}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
