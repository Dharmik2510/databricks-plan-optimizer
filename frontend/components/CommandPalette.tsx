import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../design-system/components/Modal';
import Input from '../design-system/components/Input';
import { Search, FileText, MessageSquare, Settings, GitBranch, Sparkles, Clock } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  category?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  recentCommands?: string[];
  onCommandExecute?: (commandId: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  commands,
  recentCommands = [],
  onCommandExecute,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter and sort commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      // Show recent commands first when no search
      const recent = commands.filter(cmd => recentCommands.includes(cmd.id));
      const others = commands.filter(cmd => !recentCommands.includes(cmd.id));
      return [...recent, ...others];
    }

    const searchLower = search.toLowerCase();
    return commands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordsMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      return labelMatch || descMatch || keywordsMatch;
    });
  }, [search, commands, recentCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      const category = cmd.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        executeCommand(filteredCommands[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredCommands]);

  const executeCommand = (command: Command) => {
    command.action();
    if (onCommandExecute) {
      onCommandExecute(command.id);
    }
    onOpenChange(false);
    setSearch('');
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'navigation':
        return <FileText className="h-4 w-4" />;
      case 'actions':
        return <Sparkles className="h-4 w-4" />;
      case 'chat':
        return <MessageSquare className="h-4 w-4" />;
      case 'repository':
        return <GitBranch className="h-4 w-4" />;
      case 'settings':
        return <Settings className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  let globalIndex = 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      showCloseButton={false}
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 pb-4 border-b border-gray-200 dark:border-gray-700">
          <Input
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
            autoFocus
            fullWidth
          />
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No commands found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 px-2 py-1 mb-2">
                    <span className="text-gray-400 dark:text-gray-500">
                      {getCategoryIcon(category)}
                    </span>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {category}
                    </h4>
                  </div>

                  <div className="space-y-1">
                    {categoryCommands.map((command) => {
                      const currentIndex = globalIndex++;
                      const isSelected = currentIndex === selectedIndex;
                      const isRecent = recentCommands.includes(command.id);

                      return (
                        <button
                          key={command.id}
                          onClick={() => executeCommand(command)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                            ${isSelected
                              ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }
                          `}
                        >
                          {command.icon && (
                            <div className={`
                              flex-shrink-0 p-2 rounded-md
                              ${isSelected
                                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }
                            `}>
                              {command.icon}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`
                                font-medium text-sm
                                ${isSelected
                                  ? 'text-primary-700 dark:text-primary-300'
                                  : 'text-gray-900 dark:text-gray-100'
                                }
                              `}>
                                {command.label}
                              </p>
                              {isRecent && !search && (
                                <Clock className="h-3 w-3 text-gray-400" />
                              )}
                            </div>
                            {command.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                {command.description}
                              </p>
                            )}
                          </div>

                          {isSelected && (
                            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default CommandPalette;
