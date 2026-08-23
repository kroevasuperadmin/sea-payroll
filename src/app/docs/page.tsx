import { ExternalLink, PlaceholderPage } from "@/components/ui";
import { REPO_URL } from "@/lib/site";

export default function Docs() {
  return (
    <PlaceholderPage
      eyebrow="Docs"
      title="The code is the documentation."
      body="Tiba is fully open source — read the README and the payment engine directly on GitHub."
      backTone="muted"
    >
      <ExternalLink href={REPO_URL} className="text-sm text-[#123B63] underline mt-2">
        View the repository ↗
      </ExternalLink>
    </PlaceholderPage>
  );
}
