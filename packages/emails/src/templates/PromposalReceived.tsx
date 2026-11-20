import { Text } from "@react-email/components";
import * as React from "react";
import { tokens } from "@prommatch/ui-tokens";
import { Layout, PrimaryButton } from "./Layout.js";

export interface PromposalReceivedProps {
  appName: string;
  displayName: string;
  fromName: string;
  viewUrl: string;
}

export function PromposalReceived({ appName, displayName, fromName, viewUrl }: PromposalReceivedProps) {
  const t = tokens.dark;
  return (
    <Layout previewText={`${fromName} sent you a promposal`} appName={appName}>
      <Text style={{ color: t.rose, fontSize: 22, fontWeight: 700 }}>You've got a promposal! 💌</Text>
      <Text style={{ color: t.text, fontSize: 16 }}>
        Hi {displayName}, {fromName} just asked you to prom.
      </Text>
      <PrimaryButton href={viewUrl}>See it</PrimaryButton>
    </Layout>
  );
}

export default PromposalReceived;
