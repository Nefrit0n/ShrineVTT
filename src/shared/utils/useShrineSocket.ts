import { useEffect, useRef } from "react";

export function useShrineSocket(onMessage: (data: any) => void) {
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:3001"); // адрес 
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };

        ws.onerror = (e) => console.error("WS error", e);
        ws.onclose = () => console.log("WS closed");

        return () => ws.close();
    }, [onMessage]);

    return wsRef;
}
