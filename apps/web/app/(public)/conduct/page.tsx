import { codeOfConduct, conductConsequences } from "@prommatch/config";
import { Container, SectionHeading } from "../../../components/ui.js";

export default function ConductPage() {
  return (
    <Container className="py-12 space-y-8">
      <h1 className="font-heading text-3xl">Code of conduct</h1>

      <section>
        <SectionHeading>The rules</SectionHeading>
        <ul className="list-disc pl-5 text-sm text-muted space-y-2">
          {codeOfConduct.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>What happens if they're broken</SectionHeading>
        <ol className="list-decimal pl-5 text-sm text-muted space-y-2">
          {conductConsequences.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </section>
    </Container>
  );
}
