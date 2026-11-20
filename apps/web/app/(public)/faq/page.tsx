import { faqCopy } from "@prommatch/config";
import { getEventConfig } from "../../../lib/config.js";
import { Container, Card } from "../../../components/ui.js";

export default async function FaqPage() {
  const config = await getEventConfig();
  const items = faqCopy(config);

  return (
    <Container className="py-12">
      <h1 className="font-heading text-3xl mb-6">Frequently asked questions</h1>
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.q}>
            <h3 className="font-semibold mb-1">{item.q}</h3>
            <p className="text-sm text-muted">{item.a}</p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
