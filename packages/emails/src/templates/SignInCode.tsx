import { Text } from "@react-email/components";
import * as React from "react";
import { tokens } from "@prommatch/ui-tokens";
import { Layout } from "./Layout.js";

export interface SignInCodeProps {
  appName: string;
  code: string;
  magicLink: string;
  expiresInMinutes: number;
}

export function SignInCode({ appName, code, magicLink, expiresInMinutes }: SignInCodeProps) {
  const t = tokens.dark;
  return (
    <Layout previewText={`Your ${appName} sign-in code: ${code}`} appName={appName}>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: 600 }}>Your sign-in code</Text>
      <Text style={{ color: t.text, fontSize: 32, fontWeight: 700, letterSpacing: 6, textAlign: "center" }}>
        {code}
      </Text>
      <Text style={{ color: t.muted, fontSize: 14 }}>
        This code expires in {expiresInMinutes} minutes. Or just tap the button below on this device:
      </Text>
      <Text style={{ textAlign: "center" }}>
        <a href={magicLink} style={{ color: t.gold }}>
          Sign in to {appName} →
        </a>
      </Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>
        If you didn't request this, you can safely ignore this email.
      </Text>
    </Layout>
  );
}

export default SignInCode;
