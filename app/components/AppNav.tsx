import { NavBar } from "@westy/shared/ui";

interface AppNavProps {
  active: "dashboard" | "connections";
}

export function AppNav({ active }: AppNavProps) {
  return (
    <NavBar
      brand="Westy"
      links={[
        { label: "Dashboard", href: "/dashboard", active: active === "dashboard" },
        { label: "Connections", href: "/connections", active: active === "connections" },
        { label: "My Care Team", href: "#care-team" },
        { label: "Bills", href: "#bills" },
        { label: "Household", href: "#household" },
      ]}
    />
  );
}
