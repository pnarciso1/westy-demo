import { NavBar, Card, CardKicker, CardTitle, CardBody, Button, Tag } from "@westy/shared/ui";

export default function Home() {
  return (
    <>
      <NavBar
        brand="Westy"
        links={[
          { label: "My Care Team", href: "#", active: true },
          { label: "Bills", href: "#" },
          { label: "Household", href: "#" },
        ]}
      />
      <main style={{ padding: "var(--space-6)" }}>
   <Card>
     <CardKicker>Design system check</CardKicker>
     <CardTitle>If this looks like Westy, it worked</CardTitle>
     <CardBody>
       This card, the nav bar above, and this button are all real components
       from @westy/shared/ui — not placeholder Next.js content.
     </CardBody>
     <div style={{ alignSelf: "flex-start" }}>
       <Tag variant="accent">Wired up</Tag>
     </div>
     <Button variant="primary">Looks right</Button>
   </Card>
      </main>
    </>
  );
}
