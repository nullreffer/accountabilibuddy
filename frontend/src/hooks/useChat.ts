import { useEffect, useRef, useState } from 'react';
import { fetchChatMessages, sendChatMessage, type ChatMessage } from '../lib/api';

export const useChat = (groupId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const data = await fetchChatMessages(groupId, 50);
        if (!cancelled) setMessages(data);
      } catch {
        if (!cancelled && !hasFetched.current) setMessages([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasFetched.current = true;
        }
      }
    };

    void load(true);
    const interval = setInterval(() => void load(), 5_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [groupId]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendChatMessage(groupId, text.trim());
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } finally {
      setSending(false);
    }
  };

  return { messages, loading, sending, send };
};
