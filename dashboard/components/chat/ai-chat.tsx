'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sendChatMessage, ChatSource } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Bot,
  FileText,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

interface AIChatProps {
  userEmail: string;
}

export function AIChat({ userEmail }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: sendChatMessage,
    onSuccess: (data) => {
      setSessionId(data.session_id);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response,
          sources: data.sources,
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate({
      query: input.trim(),
      sessionId: sessionId || undefined,
      userEmail,
    });
    setInput('');
  };

  const handleReset = () => {
    setMessages([]);
    setSessionId(null);
  };

  const suggestedQuestions = [
    "What action items are pending?",
    "What decisions were made last week?",
    "Summarize recent client meetings",
    "What are the key topics discussed?",
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-base">Ask AI</SheetTitle>
                <SheetDescription className="text-xs">
                  Ask questions about your meeting notes
                </SheetDescription>
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                New Chat
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Ask about your meetings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                I can help you find information in your meeting notes, summarize discussions, and track action items.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedQuestions.map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setInput(q);
                    }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {message.sources.slice(0, 3).map((source) => (
                          <Link key={source.id} href={`/notes/${source.id}`}>
                            <Badge
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-secondary/80"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {source.title.length > 30
                                ? source.title.substring(0, 30) + '...'
                                : source.title}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your meetings..."
              disabled={chatMutation.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || chatMutation.isPending}
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
