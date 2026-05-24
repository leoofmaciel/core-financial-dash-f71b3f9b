import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/budgets/new")({
  beforeLoad: () => { throw redirect({ to: "/budgets/$id", params: { id: "new" } }); },
  component: () => null,
});
