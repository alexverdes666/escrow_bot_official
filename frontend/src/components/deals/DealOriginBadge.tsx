'use client';

import { MessageCircle, Users } from 'lucide-react';

interface DealOriginBadgeProps {
  origin: {
    type: string;
    chatTitle?: string;
  };
}

export function DealOriginBadge({ origin }: DealOriginBadgeProps) {
  if (origin.type === 'private') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <MessageCircle className="w-3 h-3" />
        Private Chat
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
      <Users className="w-3 h-3" />
      {origin.chatTitle || 'Group'}
    </span>
  );
}
