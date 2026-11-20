import { Text } from "@react-email/components";
import * as React from "react";
import { tokens } from "@prommatch/ui-tokens";
import { Layout, PrimaryButton } from "./Layout.js";

export interface MutualMatchProps {
  appName: string;
  displayName: string;
  matchName: string;
  chatUrl: string;
}

export function MutualMatch({ appName, displayName, matchName, chatUrl }: MutualMatchProps) {
  const t = tokens.dark;
  return (
    <Layout previewText={`It's mutual! Say hi to ${matchName}`} appName={appName}>
      <Text style={{ color: t.rose, fontSize: 22, fontWeight: 700 }}>It's mutual! 💛</Text>
      <Text style={{ color: t.text, fontSize: 16 }}>
        Hi {displayName}, you and <strong>{matchName}</strong> both said yes. Say hi!
      </Text>
      <PrimaryButton href={chatUrl}>Open your chat</PrimaryButton>
    </Layout>
  );
}

export default MutualMatch;
