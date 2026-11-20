import { landingCopy } from "@prommatch/config";
import { getEventConfig } from "../../lib/config.js";
import { Container, PillButton, Card } from "../../components/ui.js";

export default async function LandingPage() {
  const config = await getEventConfig();
  const copy = landingCopy(config);

  return (
    <Container className="py-16">
      <h1 className="font-heading text-4xl sm:text-5xl text-text mb-4">{copy.heroTitle}</h1>
      <p className="text-lg text-muted mb-8 max-w-xl">{copy.heroSubtitle}</p>
      <div className="flex gap-3 mb-14">
        <PillButton href="/signin" variant="primary">
          Get started
        </PillButton>
        <PillButton href="/faq" variant="secondary">
          Learn more
        </PillButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {copy.steps.map((step, i) => (
          <Card key={step.title}>
            <div className="text-gold font-heading text-2xl mb-2">{i + 1}</div>
            <h3 className="font-semibold mb-1">{step.title}</h3>
            <p className="text-sm text-muted">{step.body}</p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
