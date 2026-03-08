import React from "react";
import { Box, Text } from "ink";

interface Props {
  hostUser: string;
  guestUser?: string;
  sessionCode: string;
  connectionMode: string;
  cost: number;
  contextPercent: number;
}

export function StatusBar({ hostUser, guestUser, sessionCode, connectionMode, cost, contextPercent }: Props) {
  return (
    <Box justifyContent="space-between" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box gap={1}>
        <Text color="cyan" bold>pair-vibe</Text>
        <Text dimColor>──</Text>
        <Text color="blue">{hostUser} (host)</Text>
        <Text color="green">●</Text>
        {guestUser ? (
          <>
            <Text color="magenta">{guestUser} (guest)</Text>
            <Text color="green">●</Text>
          </>
        ) : (
          <Text dimColor>waiting...</Text>
        )}
        <Text dimColor>──</Text>
        <Text dimColor>{sessionCode}</Text>
        <Text dimColor>──</Text>
        <Text dimColor>{connectionMode}</Text>
      </Box>
      <Box gap={2}>
        <Text dimColor>${cost.toFixed(4)}</Text>
        <Text dimColor>{contextPercent}% ctx</Text>
      </Box>
    </Box>
  );
}
