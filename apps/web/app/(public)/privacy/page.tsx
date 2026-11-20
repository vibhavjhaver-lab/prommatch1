import { privacyNotice } from "@prommatch/config";
import { getEventConfig } from "../../../lib/config.js";
import { Container, Card, SectionHeading } from "../../../components/ui.js";

export default async function PrivacyPage() {
  const config = await getEventConfig();
  const notice = privacyNotice(config);

  return (
    <Container className="py-12 space-y-8">
      <h1 className="font-heading text-3xl">Privacy</h1>

      <section>
        <SectionHeading>What we collect</SectionHeading>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">
          {notice.collects.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>Why</SectionHeading>
        <p className="text-sm text-muted">{notice.why}</p>
      </section>

      <section>
        <SectionHeading>Who sees what</SectionHeading>
        <div className="space-y-2">
          {notice.whoSees.map((row) => (
            <Card key={row.data}>
              <p className="text-sm font-medium">{row.data}</p>
              <p className="text-sm text-muted">{row.who}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading>Retention</SectionHeading>
        <p className="text-sm text-muted">{notice.retention}</p>
      </section>

      <section>
        <SectionHeading>Your rights</SectionHeading>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">
          {notice.rights.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>Contact</SectionHeading>
        <p className="text-sm text-muted">{notice.contact}</p>
      </section>
    </Container>
  );
}
