import React, { useEffect, useRef } from "react";
import { ArrowUp, Bot, Check, CircleHelp, LoaderCircle, Plus, Sparkles, Wifi, WifiOff } from "lucide-react";
import { useAiChat } from "../hooks/useAiChat.js";

const SUGGESTIONS = [
    { icon: CircleHelp, title: "Explain a concept", prompt: "Explain end-to-end encryption in simple terms." },
    { icon: Sparkles, title: "Help me write", prompt: "Help me write a clear and friendly message." },
    { icon: Bot, title: "Brainstorm ideas", prompt: "Give me some creative project ideas for a BCA student." },
];

export default function AiChatPanel() {
    const {
        messages, input, setInput, connected, sending, error,
        sendMessage, clearChat, retryConnection,
    } = useAiChat();
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, sending]);

    const submit = (event) => {
        event.preventDefault();
        void sendMessage();
    };

    const onComposerKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void sendMessage();
        }
    };

    return (
        <section className="flex min-w-0 flex-1 flex-col h-full bg-[var(--canvas)] text-[var(--ink)]" aria-label="AI assistant chat">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-4 sm:px-7">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm">
                        <Sparkles size={22} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="m-0 truncate text-lg font-bold tracking-tight">E2EE AI</h1>
                        <p className="m-0 mt-0.5 flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
                            {connected ? <Wifi size={13} className="text-emerald-500" /> : <WifiOff size={13} />}
                            {connected ? "Connected · Ready to help" : "Connecting to assistant…"}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={clearChat} disabled={!messages.length || sending} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink-2)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40" title="Clear this view">
                    <Plus size={16} className="rotate-45" /> <span className="hidden sm:inline">New chat</span>
                </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-7">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                    {!messages.length && (
                        <div className="flex min-h-[min(60vh,560px)] flex-col items-center justify-center py-8 text-center">
                            <div className="mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-[24px] border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)] shadow-sm">
                                <Sparkles size={32} />
                            </div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">Your AI companion</p>
                            <h2 className="m-0 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">What can I help you with?</h2>
                            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--ink-3)]">Ask a question, work through an idea, or get help writing something. Start wherever you are.</p>
                            <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                                {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                                    <button key={title} type="button" onClick={() => { setInput(prompt); textareaRef.current?.focus(); }} className="group flex min-h-28 flex-col items-start rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-2)]">
                                        <Icon size={19} className="mb-4 text-[var(--accent)]" />
                                        <span className="text-sm font-semibold">{title}</span>
                                        <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-3)]">{prompt}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                        <article key={message.id} className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                            {message.role === "assistant" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white"><Sparkles size={16} /></div>}
                            <div className={`max-w-[min(88%,680px)] rounded-2xl px-4 py-3 text-sm leading-6 sm:px-5 ${message.role === "user" ? "rounded-br-md bg-[var(--accent)] text-white" : "rounded-bl-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                                <p className="m-0 whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                            {message.role === "user" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-3)] text-[var(--ink-2)]"><Check size={16} /></div>}
                        </article>
                    ))}

                    {sending && (
                        <div className="flex items-start gap-3" role="status" aria-live="polite">
                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white"><Sparkles size={16} /></div>
                            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-3)]">
                                <LoaderCircle size={16} className="animate-spin" /> Thinking…
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            <footer className="border-t border-[var(--line)] bg-[var(--surface)] px-4 pb-4 pt-3 sm:px-7 sm:pb-5">
                <div className="mx-auto max-w-3xl">
                    {error && (
                        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
                            <span>{error}</span>
                            {!connected && <button type="button" onClick={retryConnection} className="shrink-0 font-semibold underline">Reconnect</button>}
                        </div>
                    )}
                    <form onSubmit={submit} className="rounded-[22px] border border-[var(--line)] bg-[var(--canvas)] p-2 shadow-sm transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/10">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={onComposerKeyDown}
                            placeholder="Message your AI assistant…"
                            rows={2}
                            maxLength={10000}
                            disabled={!connected || sending}
                            aria-label="Message your AI assistant"
                            className="max-h-40 min-h-12 w-full resize-y border-0 bg-transparent px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)] disabled:opacity-60"
                        />
                        <div className="flex items-center justify-between gap-3 px-2 pb-1">
                            <span className="text-[11px] text-[var(--ink-3)]">AI can make mistakes · Enter to send, Shift+Enter for a new line</span>
                            <button type="submit" disabled={!connected || sending || !input.trim()} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                                {sending ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowUp size={20} />}
                            </button>
                        </div>
                    </form>
                    <p className="mb-0 mt-2 text-center text-[10px] text-[var(--ink-3)]">AI messages are processed by the configured AI service and stored in your account history.</p>
                </div>
            </footer>
        </section>
    );
}
