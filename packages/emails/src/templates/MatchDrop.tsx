import { Text } from "@react-email/components";
import * as React from "react";
import { tokens } from "@prommatch/ui-tokens";
import { Layout, PrimaryButton } from "./Layout.js";

export interface MatchDropProps {
  appName: string;
  displayName: string;
  proposalCount: number;
  mode: "DATE" | "FRIEND" | "SQUAD";
  decisionDeadline: string; // human-formatted, already in event timezone
  matchesUrl: string;
}

const MODE_LABEL: Record<MatchDropProps["mode"], string> = {
  DATE: "Date",
  FRIEND: "Friend",
  SQUAD: "Squad",
};

export function MatchDrop({ appName, displayName, proposalCount, mode, decisionDeadline, matchesUrl }: MatchDropProps) {
  const t = tokens.dark;
  return (
    <Layout previewText={`Your ${MODE_LABEL[mode]} matches are in`} appName={appName}>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: 600 }}>Hi {displayName}, your matches are in! 🌟</Text>
      <Text style={{ color: t.text, fontSize: 16 }}>
        You have {proposalCount} new {MODE_LABEL[mode].toLowerCase()} {proposalCount === 1 ? "match" : "matches"}{" "}
        waiting for your decision.
      </Text>
      <Text style={{ color: t.muted, fontSize: 14 }}>
        Decide by <strong style={{ color: t.text }}>{decisionDeadline}</strong> — after that, undecided proposals
        expire.
      </Text>
      <PrimaryButton href={matchesUrl}>See your matches</PrimaryButton>
    </Layout>
  );
}

export default MatchDrop;
