import { useCallback, useEffect, useRef, useState } from "react";
import webSocketClient from "../../../infrastructure/websocket/WebSocketClient.js";

const RESPONSE_TIMEOUT_MS = 60_000;

export function useAiChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [connected, setConnected] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [connectionAttempt, setConnectionAttempt] = useState(0);
    const timeoutRef = useRef(null);
    const mountedRef = useRef(true);

    const clearPendingTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        let socket;
        let cancelled = false;

        const handleResponse = (payload) => {
            clearPendingTimeout();
            if (!mountedRef.current) return;
            if (payload?.success && payload.message) {
                setMessages((current) => [...current, {
                    id: `${Date.now()}-${Math.random()}`,
                    role: "assistant",
                    content: payload.message.content ?? String(payload.message),
                    createdAt: payload.message.createdAt ?? new Date().toISOString(),
                }]);
                setError("");
            } else {
                setError(payload?.message || "The AI could not respond. Please try again.");
            }
            setSending(false);
        };

        const handleError = (payload) => {
            clearPendingTimeout();
            if (!mountedRef.current) return;
            setError(payload?.message || "Unable to reach the AI assistant.");
            setSending(false);
        };

        const handleConnect = () => {
            if (!mountedRef.current) return;
            setConnected(true);
        };

        const handleDisconnect = () => {
            if (!mountedRef.current) return;
            setConnected(false);
        };

        const connectAndListen = async () => {
            try {
                socket = await webSocketClient.connect();
                if (cancelled) return;
                socket.on("ai:response", handleResponse);
                socket.on("ai:error", handleError);
                socket.on("connect", handleConnect);
                socket.on("disconnect", handleDisconnect);
                setConnected(socket.connected);
                setError("");
            } catch (connectionError) {
                if (cancelled) return;
                setConnected(false);
                setError(connectionError?.message || "Could not connect to the chat server.");
            }
        };

        void connectAndListen();

        return () => {
            cancelled = true;
            mountedRef.current = false;
            clearPendingTimeout();
            if (socket) {
                socket.off("ai:response", handleResponse);
                socket.off("ai:error", handleError);
                socket.off("connect", handleConnect);
                socket.off("disconnect", handleDisconnect);
            }
        };
    }, [connectionAttempt, clearPendingTimeout]);

    const retryConnection = useCallback(() => {
        setError("");
        setConnectionAttempt((attempt) => attempt + 1);
    }, []);

    const sendMessage = useCallback(async (value = input) => {
        const content = value.trim();
        if (!content || sending) return;

        setError("");
        setInput("");
        setSending(true);
        setMessages((current) => [...current, {
            id: `${Date.now()}-${Math.random()}`,
            role: "user",
            content,
            createdAt: new Date().toISOString(),
        }]);

        try {
            const socket = await webSocketClient.connect();
            if (!socket.connected) socket.connect();

            clearPendingTimeout();
            timeoutRef.current = setTimeout(() => {
                if (!mountedRef.current) return;
                setSending(false);
                setError("The AI took too long to respond. Please try again.");
            }, RESPONSE_TIMEOUT_MS);

            socket.emit("ai:message", { message: content }, (ack) => {
                if (ack?.success === false) {
                    clearPendingTimeout();
                    if (!mountedRef.current) return;
                    setSending(false);
                    setError(ack.message || "Unable to process your message.");
                }
            });
        } catch (sendError) {
            clearPendingTimeout();
            setSending(false);
            setError(sendError?.message || "Could not send your message.");
        }
    }, [input, sending, clearPendingTimeout]);

    const clearChat = useCallback(() => {
        if (sending) return;
        setMessages([]);
        setError("");
    }, [sending]);

    return {
        messages,
        input,
        setInput,
        connected,
        sending,
        error,
        sendMessage,
        clearChat,
        retryConnection,
    };
}
