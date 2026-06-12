import React from 'react';
import { ReviewPage } from './components/ReviewPage';
import { BrowsePage } from './components/BrowsePage';
import { StatsPage } from './components/StatsPage';
import { SettingsPage } from './components/SettingsPage';
import { AiCardsPage } from './components/AiCardsPage';
import { ImportModal } from './components/ImportModal';
import { useToast } from './hooks/useToast';
import { AiTaskPanel } from './components/AiTaskPanel';
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from './components/ui/sidebar';
import { TooltipProvider } from './components/ui/tooltip';
import { BookOpen, Library, Sparkles, BarChart3, Settings } from 'lucide-react';

type Page = 'review' | 'browse' | 'aicards' | 'stats' | 'settings';

const pages: { key: Page; label: string; icon: React.ElementType }[] = [
  { key: 'review', label: 'Review', icon: BookOpen },
  { key: 'browse', label: 'Cards', icon: Library },
  { key: 'aicards', label: 'AI Cards', icon: Sparkles },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export const App: React.FC = () => {
  const [page, setPage] = React.useState<Page>('review');
  const { toasts, toast } = useToast();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          {/* Left Sidebar - Navigation */}
          <Sidebar side="left">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="text-base font-semibold italic py-3">
                  FSRS Flashcards
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {pages.map(p => (
                      <SidebarMenuItem key={p.key}>
                        <SidebarMenuButton
                          isActive={page === p.key}
                          onClick={() => setPage(p.key)}
                          tooltip={p.label}
                        >
                          <p.icon />
                          <span>{p.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          {/* Center - Main Content */}
          <main className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground">
                {pages.find(p => p.key === page)?.label}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
              {page === 'review' && <ReviewPage />}
              {page === 'browse' && <BrowsePage />}
              {page === 'aicards' && <AiCardsPage />}
              {page === 'stats' && <StatsPage />}
              {page === 'settings' && <SettingsPage />}
            </div>
          </main>

          {/* Right Sidebar - AI Tasks */}
          <aside className="w-80 border-l shrink-0 hidden lg:flex flex-col bg-sidebar">
            <AiTaskPanel />
          </aside>
        </div>

        <ImportModal onToast={toast} />

        {toasts.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-popover border rounded-lg px-6 py-2.5 text-sm font-medium shadow-lg z-[200]">
            {toasts[toasts.length - 1]?.msg ?? ''}
          </div>
        )}
      </SidebarProvider>
    </TooltipProvider>
  );
};
