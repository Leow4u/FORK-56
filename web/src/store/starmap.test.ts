import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StarmapGraph } from "@/types/work4you";

const getStarmapGraph = vi.hoisted(() => vi.fn());

vi.mock("@/work4you", () => ({
  getStarmapGraph,
}));

import {
  $starmapError,
  $starmapGraph,
  $starmapLoading,
  evictStarmapNode,
  loadStarmapGraph,
  resetStarmapGraph,
} from "./starmap";

function sampleGraph(id = "skill-a"): StarmapGraph {
  return {
    clusters: [{ category: "devops", count: 1 }],
    edges: [{ source: id, target: "skill-b" }],
    memory: [],
    nodes: [
      {
        category: "devops",
        createdBy: "agent",
        id,
        kind: "skill",
        label: id,
        pinned: false,
        state: "active",
        timestamp: 1_700_000_000,
        useCount: 2,
      },
      {
        category: "devops",
        createdBy: null,
        id: "skill-b",
        kind: "skill",
        label: "skill-b",
        pinned: false,
        state: "active",
        timestamp: 1_700_000_100,
        useCount: 0,
      },
    ],
    stats: {},
  };
}

describe("starmap store", () => {
  beforeEach(() => {
    resetStarmapGraph();
    $starmapLoading.set(false);
    getStarmapGraph.mockReset();
  });

  it("loads the graph into the cache", async () => {
    const graph = sampleGraph();
    getStarmapGraph.mockResolvedValueOnce(graph);

    await loadStarmapGraph();

    expect($starmapGraph.get()).toEqual(graph);
    expect($starmapError.get()).toBeNull();
    expect($starmapLoading.get()).toBe(false);
  });

  it("reuses the cache unless force is set", async () => {
    getStarmapGraph.mockResolvedValue(sampleGraph());
    await loadStarmapGraph();
    await loadStarmapGraph();
    expect(getStarmapGraph).toHaveBeenCalledTimes(1);

    await loadStarmapGraph(true);
    expect(getStarmapGraph).toHaveBeenCalledTimes(2);
  });

  it("records a load failure without wiping a later success path", async () => {
    getStarmapGraph.mockRejectedValueOnce(new Error("scan failed"));
    await loadStarmapGraph();
    expect($starmapError.get()).toBe("scan failed");
    expect($starmapGraph.get()).toBeNull();
  });

  it("evicts a node and its edges, with rollback", () => {
    $starmapGraph.set(sampleGraph());
    const rollback = evictStarmapNode("skill-a");
    const next = $starmapGraph.get();
    expect(next?.nodes.map((n) => n.id)).toEqual(["skill-b"]);
    expect(next?.edges).toEqual([]);
    rollback();
    expect($starmapGraph.get()?.nodes.map((n) => n.id)).toEqual([
      "skill-a",
      "skill-b",
    ]);
  });

  it("reset drops the cache so the next open refetches", async () => {
    getStarmapGraph.mockResolvedValue(sampleGraph());
    await loadStarmapGraph();
    resetStarmapGraph();
    expect($starmapGraph.get()).toBeNull();
    await loadStarmapGraph();
    expect(getStarmapGraph).toHaveBeenCalledTimes(2);
  });
});
