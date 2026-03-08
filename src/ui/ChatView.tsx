import React from "react";
import { Box, Text } from "ink";

export interface ChatMessage {
  id: string;
  type: "prompt" | "response" | "tool" | "system" | "session_event";
  user?: string;
  isHost?: boolean;
  text: string;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
}

export function ChatView({ messages }: Props) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((msg) => {
        switch (msg.type) {
          case "prompt":
            return (
              <Box key={msg.id} marginTop={1}>
                <Text color={msg.isHost ? "blue" : "magenta"} bold>
                  [{msg.user}{msg.isHost ? " (host)" : ""}]:
                </Text>
                <Text> {msg.text}</Text>
              </Box>
            );
          case "response":
            return <Text key={msg.id}>{msg.text}</Text>;
          case "tool":
            return <Text key={msg.id} dimColor>  [tool] {msg.text}</Text>;
          case "system":
            return <Text key={msg.id} dimColor>  {msg.text}</Text>;
          case "session_event":
            return (
              <Box key={msg.id} marginY={1}>
                <Text color="yellow" bold>  ✦ {msg.text}</Text>
              </Box>
            );
          default:
            return null;
        }
      })}
    </Box>
  );
}
