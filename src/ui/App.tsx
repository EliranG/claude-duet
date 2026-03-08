import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { StatusBar } from "./StatusBar.js";
import { ChatView, type ChatMessage } from "./ChatView.js";

interface AppProps {
  role: "host" | "guest";
  userName: string;
  sessionCode: string;
  connectionMode: string;
  onInput: (text: string) => void;
  onCommand: (cmd: string) => void;
}

export function App({ role, userName, sessionCode, connectionMode, onInput, onCommand }: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guestUser, setGuestUser] = useState<string>();
  const [cost, setCost] = useState(0);
  const [contextPercent, setContextPercent] = useState(0);

  // Expose state setters for external wiring
  (globalThis as any).__pairVibe = {
    addMessage: (msg: ChatMessage) => setMessages(prev => [...prev, msg]),
    setGuestUser,
    setCost,
    setContextPercent,
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onCommand("/quit");
      exit();
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        hostUser={role === "host" ? userName : guestUser || "host"}
        guestUser={role === "guest" ? userName : guestUser}
        sessionCode={sessionCode}
        connectionMode={connectionMode}
        cost={cost}
        contextPercent={contextPercent}
      />
      <ChatView messages={messages} />
      <Box paddingX={1} borderStyle="single" borderColor="gray">
        <Box gap={4}>
          <Text dimColor>/end  /quit  /trust  /kick</Text>
        </Box>
      </Box>
    </Box>
  );
}
