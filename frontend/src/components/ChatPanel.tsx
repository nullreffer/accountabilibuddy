import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';
import LoadingSpinner from './LoadingSpinner';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '🙌'] as const;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

interface ReactionsStore {
  [msgId: string]: { [emoji: string]: string[] }; // emoji -> userIds
}

const REACTIONS_KEY = (groupId: string) => `ab_reactions_${groupId}`;

const loadReactions = (groupId: string): ReactionsStore => {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY(groupId));
    return raw ? (JSON.parse(raw) as ReactionsStore) : {};
  } catch {
    return {};
  }
};

const saveReactions = (groupId: string, store: ReactionsStore) => {
  localStorage.setItem(REACTIONS_KEY(groupId), JSON.stringify(store));
};

const ChatPanel = ({ groupId, checkinSlot }: { groupId: string; checkinSlot?: ReactNode }) => {
  const { user } = useAuth();
  const { messages, loading, sending, send } = useChat(groupId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const [reactions, setReactions] = useState<ReactionsStore>(() => loadReactions(groupId));
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messages.length !== prevLengthRef.current) {
      prevLengthRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerMsgId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleReaction = (msgId: string, emoji: ReactionEmoji) => {
    if (!user) return;
    setReactions((prev) => {
      const updated = { ...prev };
      if (!updated[msgId]) updated[msgId] = {};
      const users = updated[msgId][emoji] ?? [];
      updated[msgId] = {
        ...updated[msgId],
        [emoji]: users.includes(user.id) ? users.filter((id) => id !== user.id) : [...users, user.id]
      };
      saveReactions(groupId, updated);
      return updated;
    });
    setPickerMsgId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    await send(text);
    setText('');
  };

  if (loading) {
    return <LoadingSpinner label="Loading chat..." />;
  }

  return (
    <section className="chat-panel stack-lg">
      <div className="chat-messages card" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === user?.id;
            if (msg.type === 'system') {
              return (
                <div className="chat-system" key={msg.id}>
                  <span>⚡ {msg.text}</span>
                </div>
              );
            }

            const msgReactions = reactions[msg.id] ?? {};
            const reactionEntries = Object.entries(msgReactions).filter(([, users]) => users.length > 0);

            return (
              <div className={`chat-bubble-row${isOwn ? ' chat-bubble-row--own' : ''}`} key={msg.id}>
                {!isOwn ? (
                  <img
                    alt={msg.userDisplayName ?? 'User'}
                    className="avatar avatar--small"
                    src={
                      msg.userPhotoURL ||
                      getAvatarFallback(msg.userDisplayName || 'AB')
                    }
                  />
                ) : null}
                <div className="chat-bubble-col">
                  {!isOwn ? (
                    <span className="chat-sender">{msg.userDisplayName}</span>
                  ) : null}
                  <div
                    className={`chat-bubble${isOwn ? ' chat-bubble--own' : ''}`}
                    onMouseEnter={() => setPickerMsgId(msg.id)}
                    onMouseLeave={(e) => {
                      if (!pickerRef.current?.contains(e.relatedTarget as Node)) {
                        setPickerMsgId(null);
                      }
                    }}
                  >
                    <p>{msg.text}</p>
                    {pickerMsgId === msg.id ? (
                      <div className="reaction-picker" ref={pickerRef}>
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            aria-label={`React with ${emoji}`}
                            className={`reaction-btn${user && (msgReactions[emoji] ?? []).includes(user.id) ? ' reaction-btn--active' : ''}`}
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {reactionEntries.length > 0 ? (
                    <div className="reaction-bar">
                      {reactionEntries.map(([emoji, users]) => (
                        <button
                          aria-label={`${emoji} ${users.length}`}
                          className={`reaction-chip${user && users.includes(user.id) ? ' reaction-chip--own' : ''}`}
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji as ReactionEmoji)}
                          type="button"
                        >
                          {emoji} {users.length}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <span className="chat-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-composer card" onSubmit={(event) => void handleSubmit(event)}>
        {checkinSlot ? <div className="chat-composer__checkin">{checkinSlot}</div> : null}
        <input
          aria-label="Message"
          className="input chat-input"
          disabled={sending}
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a message…"
          type="text"
          value={text}
        />
        <button aria-label="Send" className="icon-btn send-btn" disabled={sending || !text.trim()} type="submit">
          {sending ? '…' : '➤'}
        </button>
      </form>
    </section>
  );
};

export default ChatPanel;
