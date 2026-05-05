import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { DatasetImportPage } from "@/pages/DatasetImportPage";
import { ContextImportPage } from "@/pages/ContextImportPage";

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("dataset editor removes its edit query when it unmounts", () => {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/edit/datasets")) {
      return jsonResponse({ object: { logical_identifier: "urn:test:dataset::1.0" }, relationships: [] });
    }
    if (url.includes("/api/tags/datasets") || url.includes("/api/status/tools")) {
      return jsonResponse([]);
    }
    return jsonResponse({});
  });

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
  const editKey = ["edit", "datasets", "urn:test:dataset::1.0"] as const;
  client.setQueryData(editKey, { object: { logical_identifier: "stale" }, relationships: [] });

  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/datasets/import?edit=urn%3Atest%3Adataset%3A%3A1.0"]}>
        <DatasetImportPage onError={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  view.unmount();

  expect(client.getQueryData(editKey)).toBeUndefined();
});

test("context editor removes its edit query when it unmounts", () => {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/edit/target")) {
      return jsonResponse({ object: { logical_identifier: "urn:nasa:pds:context:target:test" }, relationships: [] });
    }
    if (url.includes("/api/tags/targets") || url.includes("/api/status/tools") || url.includes("/api/relationship-types/target")) {
      return jsonResponse([]);
    }
    return jsonResponse({});
  });

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
  const editKey = ["edit", "target", "urn:nasa:pds:context:target:test"] as const;
  client.setQueryData(editKey, { object: { logical_identifier: "stale" }, relationships: [] });

  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/targets/import?edit=urn%3Anasa%3Apds%3Acontext%3Atarget%3Atest"]}>
        <ContextImportPage
          config={{
            title: "Target Details",
            entityType: "targets",
            editType: "target",
            tagType: "targets",
            relationshipType: "target",
            relationshipTo: "spacecraft",
            modelName: "target",
            relationshipModelNames: ["mission"],
          }}
          onError={() => undefined}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  view.unmount();

  expect(client.getQueryData(editKey)).toBeUndefined();
});
