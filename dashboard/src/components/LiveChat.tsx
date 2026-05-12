'use client';
import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: number;
}

export default function LiveChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:4000';
    const es = new EventSource(`${botUrl}/chat`);

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'connected') { setConnected(true); return; }
      if (data.type === 'message') {
        setMessages(prev => [...prev.slice(-99), data]);
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="live-chat-wrapper">
      <div className="chat-header">
        <span className={`chat-status-dot ${connected ? 'online' : 'offline'}`} />
        <span className="chat-status-text">{connected ? 'Live Chat — Discord' : 'Menghubungkan...'}</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>Belum ada pesan. Kirim pesan di Discord!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <img
                src={msg.avatar}
                alt={msg.author}
                className="chat-avatar"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${msg.author}&background=66fcf1&color=000`; }}
              />
              <div className="chat-body">
                <div className="chat-meta">
                  <span className="chat-author">{msg.author}</span>
                  <span className="chat-time">{formatTime(msg.timestamp)}</span>
                </div>
                <p className="chat-content">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
