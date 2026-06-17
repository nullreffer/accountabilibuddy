import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarFallback } from '../lib/avatar';
import LoadingSpinner from './LoadingSpinner';

const ChatPanel = ({ groupId }: { groupId: string }) => {
  const { user } = useAuth();
  const { messages, loading, sending, send } = useChat(groupId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (messages.length !== prevLengthRef.current) {
      prevLengthRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

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
                  <div className={`chat-bubble${isOwn ? ' chat-bubble--own' : ''}`}>
                    <p>{msg.text}</p>
                  </div>
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
        <button className="button button--primary" disabled={sending || !text.trim()} type="submit">
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
};

export default ChatPanel;
