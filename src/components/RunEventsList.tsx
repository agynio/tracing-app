import { useCallback, useEffect, useRef } from 'react';
import { MessageSquare, Bot, Wrench, FileText, Terminal, Users, Loader2 } from 'lucide-react';
import { type EventType, type MessageSubtype, type RunEventData } from './RunEventDetails';
import { StatusIndicator, type Status } from './StatusIndicator';

export interface RunEvent {
  id: string;
  type: EventType;
  timestamp: string;
  duration?: string;
  status?: Status;
  data: RunEventData;
}

export interface RunEventsListProps {
  events: RunEvent[];
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
  hasMore?: boolean;
  loadMore?: () => void;
  isLoadingMore?: boolean;
}

export function RunEventsList({
  events,
  selectedEventId,
  onSelectEvent,
  hasMore = false,
  loadMore = () => {},
  isLoadingMore = false,
}: RunEventsListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);

  const getEventIcon = (event: RunEvent) => {
    switch (event.type) {
      case 'message':
        return <MessageSquare className="w-4 h-4 text-primary" />;
      case 'llm':
        return <Bot className="w-4 h-4 text-[var(--agyn-purple)]" />;
      case 'tool':
        if (event.data?.toolSubtype === 'shell') {
          return <Terminal className="w-4 h-4 text-[var(--agyn-cyan)]" />;
        } else if (event.data?.toolSubtype === 'manage') {
          return <Users className="w-4 h-4 text-[var(--agyn-cyan)]" />;
        }
        return <Wrench className="w-4 h-4 text-[var(--agyn-cyan)]" />;
      case 'summarization':
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case 'message':
        return 'bg-primary/10 border-primary/20';
      case 'llm':
        return 'bg-[var(--agyn-purple)]/10 border-[var(--agyn-purple)]/20';
      case 'tool':
        return 'bg-[var(--agyn-cyan)]/10 border-[var(--agyn-cyan)]/20';
      case 'summarization':
        return 'bg-muted-foreground/10 border-muted-foreground/20';
    }
  };

  const getEventLabel = (event: RunEvent) => {
    if (event.type === 'message') {
      const subtype = event.data.messageSubtype;
      const messageSubtype: MessageSubtype =
        subtype === 'intermediate' || subtype === 'result' ? subtype : 'source';
      switch (messageSubtype) {
        case 'source':
          return 'Message • Source';
        case 'intermediate':
          return 'Message • Intermediate';
        case 'result':
          return 'Message • Result';
      }
    }
    
    switch (event.type) {
      case 'llm':
        return 'LLM Call';
      case 'tool':
        return event.data?.toolName || 'Tool Call';
      case 'summarization':
        return 'Summarization';
      default:
        return 'Event';
    }
  };

  const getEventSubtitle = (_event: RunEvent) => null;

  const renderEventItem = (event: RunEvent) => {
    const subtitle = getEventSubtitle(event);
    const isSelected = selectedEventId === event.id;
    
    return (
      <button
        data-testid={`run-event-${event.id}`}
        onClick={() => onSelectEvent(event.id)}
        className={`w-full px-4 py-3 border-b border-border hover:bg-muted transition-colors text-left relative ${
          isSelected ? 'bg-muted' : ''
        }`}
      >
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
        )}
        
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border ${getEventColor(event.type)}`}>
            {getEventIcon(event)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-sm text-foreground truncate">
                {getEventLabel(event)}
              </div>
              {event.status && (
                <span data-run-event-status="true">
                  <StatusIndicator status={event.status} size="sm" showTooltip={false} />
                </span>
              )}
            </div>
            {subtitle && (
              <div className="text-xs text-muted-foreground truncate mb-1">
                {subtitle}
              </div>
            )}
            <div className="text-xs text-muted-foreground" data-testid="run-event-meta">
              {event.timestamp}
              {event.duration && ` • ${event.duration}`}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const header = hasMore ? (
    <div className="p-4 flex items-center justify-center">
      {isLoadingMore ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading more events...</span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Scroll up to load more</div>
      )}
    </div>
  ) : null;

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (hasMore && !isLoadingMore && element.scrollTop <= 80) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || events.length === 0) return;
    const isFirstRender = !hasInitializedRef.current;
    if (isFirstRender) {
      hasInitializedRef.current = true;
      element.scrollTop = element.scrollHeight;
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 40) {
      element.scrollTop = element.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="bg-card overflow-hidden h-full flex flex-col" data-testid="run-events-list">
      <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {header}
        {events.map((event) => (
          <div key={event.id}>{renderEventItem(event)}</div>
        ))}
      </div>
    </div>
  );
}
